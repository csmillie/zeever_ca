#!/usr/bin/env python
"""Seed Benchmark A's retrieval ground truth from what already exists.

    uv run python scripts/build_retrieval_truth.py            # write the sidecar
    uv run python scripts/build_retrieval_truth.py --dry-run  # show, write nothing
    uv run python scripts/build_retrieval_truth.py --review   # queue for a person

Creates experiments/benchmarks/a-retrieval-truth.jsonl, one row per benchmark
prompt, carrying the frozen `expected_sources` patterns plus the thing they have
never had: a measurement of how precise each one is against the live corpus.

`prompts.py` is not modified. Neither is anything in production.

## What this can and cannot do

It can count. For every prompt it asks how many distinct corpus URLs the
substring matches, which is the difference between a measurement and a gesture:

    bp-01  'when-do-i-need-a-building-permit'   ->  1 URL     scorable
    bp-85  'community-people'                   ->  1,653     not scorable

It cannot decide which page answers a question. Two automatic routes were tried
before writing this and both produced confident nonsense:

  - URL term overlap proposes 'detailed-email-submission-process' for "What is
    the process for applying for a building permit?"
  - Prior run citations cover 12 of 100 prompts and none of the loose ones,
    because those CSVs predate most of the corpus.

So everything it writes is labelled `frozen-expected-sources` and unverified,
and `--review` prints the queue a person has to work through rather than
pretending the queue is already done.
"""
import argparse
from collections import defaultdict

from sqlalchemy import text as sql

from evals.prompts import BENCHMARK_PROMPTS
from evals.retrieval_truth import (
    SOURCE_FROZEN,
    RetrievalTruth,
    coverage,
    load,
    save,
    TRUTH_PATH,
)
from shared.db import get_session


def _band(n: int) -> str:
    """Same boundaries scripts/audit_expected_sources.py reports, so the two
    tools cannot disagree about what 'loose' means."""
    if n == 0:
        return "missing"
    if n == 1:
        return "exact"
    if n <= 5:
        return "narrow"
    if n <= 25:
        return "loose"
    return "section"


def _match_counts(patterns: set[str]) -> dict[str, int]:
    """How many distinct corpus URLs each substring matches.

    One query for the whole URL list rather than one per pattern: the corpus has
    ~12,800 distinct URLs, which is small enough to match in Python and saves
    110 round trips.
    """
    with get_session() as session:
        urls = [r[0] for r in session.execute(sql("""
            SELECT DISTINCT pd.url
            FROM canadian_ai.parsed_documents pd
            JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
            WHERE pd.url IS NOT NULL
        """)).fetchall()]

    lowered = [u.lower() for u in urls]
    counts: dict[str, int] = {}
    for pat in patterns:
        p = pat.lower()
        counts[pat] = sum(1 for u in lowered if p in u)
    return counts, urls


def build(dry_run: bool = False) -> dict[str, RetrievalTruth]:
    patterns = {p for bp in BENCHMARK_PROMPTS for p in bp.expected_sources}
    counts, urls = _match_counts(patterns)
    print(f"{len(urls):,} distinct URLs in the corpus")

    existing = load()
    truths: dict[str, RetrievalTruth] = {}

    for bp in BENCHMARK_PROMPTS:
        # A prompt's precision is its *best* pattern: hitting the narrowest one
        # is what a scorer would credit, so scoring on the loosest would
        # overstate how weak the label is.
        matched = min((counts[p] for p in bp.expected_sources), default=0)

        prior = existing.get(bp.id)
        if prior and (prior.is_verified or prior.has_human_content):
            # Keep anything a person has put here, and refresh only what the
            # corpus decides -- the counts move under a label without the label
            # changing.
            #
            # `has_human_content` as well as `is_verified` because narrowing
            # happens in passes: name the pages, then the chunks, then grade
            # them, and the row is unverified throughout. Preserving only
            # verified rows would delete that work at precisely the point where
            # this file is the only copy of it.
            prior.matched_url_count = matched
            prior.precision_band = _band(matched)
            truths[bp.id] = prior
            continue

        truths[bp.id] = RetrievalTruth(
            id=bp.id,
            query=bp.prompt,
            category=bp.category,
            relevant_url_patterns=list(bp.expected_sources),
            precision_band=_band(matched),
            matched_url_count=matched,
            label_source=SOURCE_FROZEN,
            expects_refusal=bp.expects_refusal,
            notes="Seeded from prompts.py expected_sources. Not verified.",
        )

    kept = sum(1 for t in truths.values() if t.is_verified or t.has_human_content)
    if kept:
        print(f"preserved {kept} row(s) carrying human work; refreshed their counts only")

    if not dry_run:
        n = save(truths)
        print(f"wrote {n} rows to {TRUTH_PATH.relative_to(TRUTH_PATH.parents[2])}")
    return truths


def report(truths: dict[str, RetrievalTruth]) -> None:
    bands = defaultdict(list)
    for t in truths.values():
        bands[t.precision_band].append(t)

    print("\nLABEL PRECISION")
    print(f"{'band':<10}{'prompts':>9}   {'scorable':>9}")
    for band in ("exact", "narrow", "loose", "section", "missing"):
        rows = bands.get(band, [])
        if rows:
            print(f"{band:<10}{len(rows):>9}   {sum(1 for r in rows if r.is_scorable):>9}")

    c = coverage(truths)
    print(f"\n{c['scorable']} of {c['total']} prompts can distinguish two retrieval methods.")
    print(f"  excluded, section-wide label : {c['excluded_section']}")
    print(f"  excluded, no page in corpus  : {c['excluded_missing']}")
    print(f"  excluded, expects refusal    : {c['excluded_refusal']}")
    print(f"  chunk-level labels           : {c['with_chunk_labels']}")
    print(f"  graded                       : {c['with_grades']}")
    print(f"  HUMAN VERIFIED               : {c['verified']}")
    if c["verified"] == 0:
        print("\nEvery label is unverified, so every metric computed from this file is")
        print("provisional. Run with --review to see what needs deciding.")


def review_queue(truths: dict[str, RetrievalTruth], limit: int) -> None:
    """The prompts whose labels cannot measure anything, worst first."""
    queue = [t for t in truths.values()
             if t.precision_band in ("section", "loose") and not t.expects_refusal]
    queue.sort(key=lambda t: -t.matched_url_count)

    print(f"\nREVIEW QUEUE — {len(queue)} prompts need a narrower label")
    print("A person decides which page answers the question. Candidates from")
    print("scripts/propose_expected_sources.py --prompt-id <id> are suggestions,")
    print("not answers: term overlap picks specific-sounding pages, not correct ones.\n")
    for t in queue[:limit]:
        print(f"  {t.id:<8} {t.category:<18} {t.matched_url_count:>5} URLs  "
              f"{','.join(t.relevant_url_patterns)}")
        print(f"           {t.query}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="show, write nothing")
    ap.add_argument("--review", action="store_true", help="print the human review queue")
    ap.add_argument("--show", type=int, default=15, help="rows of review queue to print")
    args = ap.parse_args()

    truths = build(dry_run=args.dry_run)
    report(truths)
    if args.review:
        review_queue(truths, args.show)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
