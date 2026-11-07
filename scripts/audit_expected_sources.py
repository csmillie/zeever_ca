"""How precise is each benchmark prompt's expected_sources, really?

    uv run python scripts/audit_expected_sources.py
    uv run python scripts/audit_expected_sources.py --show 30
    uv run python scripts/audit_expected_sources.py --prompt-id bp-57

hit@k is scored by testing whether any retrieved URL contains a prompt's
expected_sources substring. That is only a measurement if the substring picks out
the page that answers the question. Several do not.

bp-70 expects "water", which matches nearly every Toronto Water URL. bp-57 expects
"road-maintenance", and the Clean Roads to Clean Air Program sits under that path,
so a page about sweeper technology scores as a hit on "When does street cleaning
happen" — a question the corpus cannot answer at all. Both were counted as
retrieval successes.

A substring matching one page is an expectation. A substring matching two hundred
is a section filter, and a prompt scored against it is close to unfalsifiable.
This counts the distinct corpus URLs behind each one, so the difference is visible
rather than assumed, and reports how much of the headline recall rests on
expectations too loose to mean anything.

It reads URLs only, so it is one query and no embeddings.
"""
import argparse
from collections import defaultdict

from sqlalchemy import text as sql

from evals.prompts import BENCHMARK_PROMPTS
from shared.db import get_session

# Bands are about what a number can support, not about tidiness. One match is a
# real expectation. A handful still identifies a page family. Past that the
# substring stops distinguishing the right answer from its neighbours.
EXACT, NARROW, LOOSE = 1, 5, 25


def _band(n: int) -> str:
    if n == 0:
        return "MISSING"
    if n <= EXACT:
        return "exact"
    if n <= NARROW:
        return "narrow"
    if n <= LOOSE:
        return "loose"
    return "SECTION"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--show", type=int, default=20, help="how many prompts to list per band")
    ap.add_argument("--prompt-id", help="detail for one prompt, listing the URLs it matches")
    args = ap.parse_args()

    with get_session() as session:
        urls = [r[0] for r in session.execute(sql(
            "SELECT DISTINCT url FROM canadian_ai.parsed_documents WHERE url IS NOT NULL"
        )) if r[0]]
    lowered = [(u, u.lower()) for u in urls]
    print(f"{len(urls):,} distinct URLs in the corpus\n")

    def matches(substr: str) -> list[str]:
        needle = substr.lower()
        return [u for u, low in lowered if needle in low]

    if args.prompt_id:
        bp = next((p for p in BENCHMARK_PROMPTS if p.id == args.prompt_id), None)
        if not bp:
            print(f"No prompt {args.prompt_id!r}.")
            return 2
        print(f"{bp.id} ({bp.category}): {bp.prompt}")
        if bp.expects_refusal:
            print("  [expects_refusal]")
        for substr in bp.expected_sources:
            hits = matches(substr)
            print(f"\n  {substr!r} -> {len(hits)} URL(s) [{_band(len(hits))}]")
            for u in sorted(hits)[:args.show]:
                print(f"      {u}")
            if len(hits) > args.show:
                print(f"      ... and {len(hits) - args.show:,} more")
        return 0

    rows = []
    for bp in BENCHMARK_PROMPTS:
        counts = {s: len(matches(s)) for s in bp.expected_sources}
        # A prompt is only as precise as its most permissive alternative: any one of
        # them satisfies the hit test.
        worst = max(counts.values()) if counts else 0
        rows.append((bp, counts, worst))

    by_band = defaultdict(list)
    for bp, counts, worst in rows:
        by_band[_band(worst)].append((bp, counts, worst))

    print("PRECISION OF expected_sources")
    head = f"{'band':<10}{'prompts':>9}   what it means"
    print(head)
    print("-" * 72)
    for band, note in (
        ("exact", "one page — a real expectation"),
        ("narrow", "2-5 pages — still identifies a page family"),
        ("loose", "6-25 pages — a hit is weak evidence"),
        ("SECTION", "26+ pages — a section filter, near-unfalsifiable"),
        ("MISSING", "0 pages — the expected page is not in the corpus"),
    ):
        print(f"{band:<10}{len(by_band[band]):>9}   {note}")

    trustworthy = len(by_band["exact"]) + len(by_band["narrow"])
    print(f"\n{trustworthy} of {len(rows)} prompts are scored against something specific.")
    print("Comparisons between retrieval configurations stay valid — the same slack")
    print("applies to every arm — but the absolute hit rate is optimistic.")

    for band in ("MISSING", "SECTION", "loose"):
        items = by_band[band]
        if not items:
            continue
        print(f"\n{band} ({len(items)})")
        for bp, counts, worst in sorted(items, key=lambda r: -r[2])[:args.show]:
            detail = ", ".join(f"{s!r}={n}" for s, n in counts.items())
            flag = "  [expects_refusal]" if bp.expects_refusal else ""
            print(f"  {bp.id:<8} {bp.category:<18} {detail}{flag}")
            print(f"           {bp.prompt[:76]}")
        if len(items) > args.show:
            print(f"  ... and {len(items) - args.show} more")

    if by_band["MISSING"]:
        print("\nMISSING means the substring matches no URL at all, so the prompt can never")
        print("score a hit. Either the page was never crawled, or the substring is wrong.")
        print("Check one with:  uv run python scripts/audit_expected_sources.py --prompt-id <id>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
