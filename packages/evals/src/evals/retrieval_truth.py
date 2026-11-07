"""Retrieval ground truth for Benchmark A, separate from the questions themselves.

`prompts.py` is frozen. It holds the 100 questions and the `expected_sources`
substrings that every previous Zeever experiment was scored against, and nothing
here rewrites it -- change those and prior results stop being comparable, which
is the one thing Benchmark A exists to protect.

This is a sidecar keyed by prompt id, holding what retrieval evaluation needs and
`prompts.py` does not have: which pages are actually relevant, which chunks, how
strongly, and -- the part that decides whether any of it can be trusted -- where
each label came from and whether a person has checked it.

## Why a sidecar rather than more fields on BenchmarkPrompt

Ground truth changes as the corpus changes; questions do not. September alone
added 22,184 chunks. Keeping the two apart means a relabelling never touches the
file that defines what Benchmark A is.

## Why provenance is a required field

Measured on 2026-09-21, `expected_sources` matches:

    exact      26 prompts     one page
    narrow     23             2-5 pages
    loose      21             6-25 pages
    SECTION    30             26+ pages   <- cannot distinguish any two methods

bp-85 expects "community-people", which matches 1,653 corpus URLs. A retrieval
method returning five random pages from that section scores a hit. Thirty
questions in that state cannot show an improvement or a regression, which was
tolerable when every arm shared the same slack and is not tolerable for an
experiment looking for an effect on hard queries.

Narrowing them means deciding which page answers a question, and that is a
judgement the corpus cannot make. Two automatic routes were tried and both
failed:

  - URL term overlap (scripts/propose_expected_sources.py) proposes
    "detailed-email-submission-process" for "What is the process for applying
    for a building permit?" -- specific, and wrong.
  - Prior citations from stored eval runs cover 12 of 100 prompts, none of them
    the loose ones, because those CSVs predate most of the corpus.

So labels start `bootstrapped` and stay that way until a person marks them
`verified`. Metrics computed over unverified labels are reported as provisional
rather than silently mixed in. That is the brief's rule about not letting one
model both generate judgments and ratify them, made mechanical.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterator

# Repo root from packages/evals/src/evals/retrieval_truth.py
_ROOT = Path(__file__).resolve().parents[4]
TRUTH_PATH = _ROOT / "experiments" / "benchmarks" / "a-retrieval-truth.jsonl"

#: Graded relevance. Binary (0/2) is what Stage 1 ships; the middle grade exists
#: so Benchmark B can carry nDCG without a schema change.
GRADE_IRRELEVANT = 0
GRADE_RELATED = 1
GRADE_ANSWERS = 2

#: A label nobody has checked. Anything measured from these is provisional.
SOURCE_FROZEN = "frozen-expected-sources"   # copied from prompts.py as-is
SOURCE_PROPOSED = "url-term-overlap"        # propose_expected_sources.py
SOURCE_CITATIONS = "prior-run-citations"    # well-judged citations from evals/*.csv
SOURCE_HUMAN = "human"                      # a person decided

VERIFIED_SOURCES = {SOURCE_HUMAN}


@dataclass
class RetrievalTruth:
    """What a single benchmark question is scored against."""

    id: str
    query: str
    category: str

    #: URL substrings, as in prompts.py. Kept so scoring can fall back to the
    #: frozen behaviour and so a corpus rebuild cannot orphan everything.
    relevant_url_patterns: list[str] = field(default_factory=list)

    #: Full URLs, once somebody has named them.
    relevant_pages: list[str] = field(default_factory=list)

    #: Chunk uuids. Deliberately not a foreign key anywhere: chunk ids do not
    #: survive a corpus rebuild, and truth that silently empties itself on the
    #: next crawl is worse than truth that is obviously absent.
    relevant_chunks: list[str] = field(default_factory=list)

    #: chunk_id or url -> grade. Absent means ungraded, not irrelevant.
    grades: dict[str, int] = field(default_factory=dict)

    #: Pages that look right and are not. Populated for Benchmark B.
    hard_negatives: list[str] = field(default_factory=list)

    #: Stage 3 fills this. Present now so the schema does not move later.
    requirements: list[dict] = field(default_factory=list)

    #: How many corpus URLs the patterns match: 'exact'|'narrow'|'loose'|'section'
    precision_band: str = "unknown"
    matched_url_count: int = 0

    label_source: str = SOURCE_FROZEN
    verified_by: str | None = None
    verified_at: str | None = None

    #: True when the corpus cannot answer this, so there is no chunk to find.
    #: Mirrors BenchmarkPrompt.expects_refusal. Excluded from retrieval scoring.
    expects_refusal: bool = False

    difficulty: str = "unknown"
    notes: str = ""

    @property
    def is_verified(self) -> bool:
        return self.label_source in VERIFIED_SOURCES and self.verified_by is not None

    @property
    def has_human_content(self) -> bool:
        """True when somebody has put something here that a rebuild cannot redo.

        Narrowing a label is done in passes -- name the pages, then the chunks,
        then grade them -- and a row is unverified for all of that time. Checking
        `is_verified` to decide what to preserve would therefore throw away work
        precisely while it is in progress, which is the one moment it exists only
        in this file.
        """
        return bool(self.relevant_pages or self.relevant_chunks or self.grades
                    or self.hard_negatives or self.requirements)

    @property
    def is_scorable(self) -> bool:
        """Can this question distinguish one retrieval method from another?

        Three ways it cannot:

        - a refusal question has no correct chunk, by design;
        - a section-wide pattern is satisfied by almost anything, so every
          method scores a hit;
        - a pattern matching no corpus URL at all is satisfied by nothing, so
          every method scores a miss.

        The last is the one that looks harmless. It does not break a comparison
        -- a constant zero applies to every arm equally -- but it is a
        measurement of the corpus rather than of retrieval, and averaging it in
        reports a retrieval failure for what is really a missing page. The
        relevant fact is that nothing was crawled, and that belongs in the
        excluded-from list where somebody might act on it.

        Explicit pages or chunks outrank the band. A row narrowed by naming its
        pages is precise whatever its original substring still matches, and
        scoring it on the substring's breadth would discard the narrowing.
        """
        if self.expects_refusal:
            return False
        if self.relevant_chunks or self.relevant_pages:
            return True
        if not self.relevant_url_patterns:
            return False
        return self.precision_band not in ("section", "missing")


def load(path: Path | None = None) -> dict[str, RetrievalTruth]:
    """Read the sidecar, keyed by prompt id. Missing file is an empty dict."""
    path = path or TRUTH_PATH
    if not path.exists():
        return {}
    out: dict[str, RetrievalTruth] = {}
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            row = json.loads(line)
            out[row["id"]] = RetrievalTruth(**row)
    return out


def save(truths: dict[str, RetrievalTruth] | list[RetrievalTruth],
         path: Path | None = None) -> int:
    """Write the sidecar, ordered by id so diffs stay readable."""
    path = path or TRUTH_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = list(truths.values()) if isinstance(truths, dict) else list(truths)
    rows.sort(key=lambda t: t.id)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")
    return len(rows)


def scorable(truths: dict[str, RetrievalTruth]) -> Iterator[RetrievalTruth]:
    """The subset a retrieval metric may be computed over."""
    for t in sorted(truths.values(), key=lambda x: x.id):
        if t.is_scorable:
            yield t


def coverage(truths: dict[str, RetrievalTruth]) -> dict[str, int]:
    """A one-glance summary, for putting at the top of any run report.

    `verified` is the number that decides how much weight a result carries. It
    starts at zero on purpose.
    """
    rows = list(truths.values())
    return {
        "total": len(rows),
        "scorable": sum(1 for t in rows if t.is_scorable),
        "verified": sum(1 for t in rows if t.is_verified),
        "excluded_refusal": sum(1 for t in rows if t.expects_refusal),
        "excluded_section": sum(1 for t in rows
                                if not t.is_scorable and not t.expects_refusal
                                and t.precision_band == "section"),
        # Reported separately because the cause is different and so is the fix:
        # a section label needs narrowing, a missing one needs a crawl.
        "excluded_missing": sum(1 for t in rows
                                if not t.is_scorable and not t.expects_refusal
                                and t.precision_band == "missing"),
        "with_chunk_labels": sum(1 for t in rows if t.relevant_chunks),
        "with_grades": sum(1 for t in rows if t.grades),
    }
