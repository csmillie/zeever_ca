"""Retrieval metrics for the requirement-aware retrieval experiment.

Scores a ranked list of chunks against a `RetrievalTruth` row. Deliberately
small: the hard part of this experiment is the ground truth, not the arithmetic,
and every function here is one formula with a reason attached.

## What is and is not computed

Recall@K and MRR only. **nDCG is absent on purpose.** It weights results by a
graded relevance score, and Benchmark A has binary judgments -- a chunk either
matches an expected pattern or it does not. Computing nDCG over binary grades
produces a number that looks like nDCG, moves like Recall, and invites a
comparison with published figures that were computed over real grades. Benchmark
B is where grading is planned; the field exists in the schema and this module
will gain the metric when there is something to feed it.

## Recall@K over a single relevant page

Most Benchmark A questions name one page, so Recall@K collapses to hit@K: did the
right page appear in the top K. That is worth stating rather than hiding behind
the word "recall", because a reader who sees Recall@5 = 0.74 will assume it means
74% of all relevant material was found, and it means 74% of questions found their
one expected page.

Where a question names several patterns, the fraction of *distinct patterns*
matched is used, which is a real recall over the labels that exist.

## Matching is by URL substring

Ground truth is a URL pattern, so a result matches when the pattern appears in
its URL. Chunk-level labels are honoured first when present, because a chunk id
is a stronger statement than a URL fragment.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from evals.retrieval_truth import RetrievalTruth

#: The cut-offs reported for every arm. 1 and 3 matter because the generator is
#: given five chunks and the first two dominate the prompt; 10 is the diagnostic
#: one, showing whether a miss was a ranking failure or an absence.
DEFAULT_KS = (1, 3, 5, 10)


def _matches(chunk: dict, truth: RetrievalTruth) -> bool:
    """Is this chunk relevant to this question?

    Chunk ids first: an id names one passage, while a URL pattern names a page
    that may hold dozens. Falling back to the pattern keeps every question
    scorable while the chunk-level labels are still being collected.
    """
    cid = str(chunk.get("id", ""))
    if truth.relevant_chunks:
        return cid in truth.relevant_chunks

    url = (chunk.get("url") or "").lower()
    if not url:
        return False
    if truth.relevant_pages and any(p.lower() in url for p in truth.relevant_pages):
        return True
    return any(p.lower() in url for p in truth.relevant_url_patterns)


def hit_rank(chunks: list[dict], truth: RetrievalTruth) -> int | None:
    """1-based rank of the first relevant chunk, or None.

    The same definition scripts/compare_retrieval_modes.py has used since July,
    so numbers from the two tools stay comparable.
    """
    for i, c in enumerate(chunks, 1):
        if _matches(c, truth):
            return i
    return None


def recall_at_k(chunks: list[dict], truth: RetrievalTruth, k: int) -> float:
    """Fraction of the question's distinct labels found in the top k.

    With one label this is hit@k, which is what most of Benchmark A reduces to.
    """
    top = chunks[:k]
    targets = truth.relevant_chunks or truth.relevant_pages or truth.relevant_url_patterns
    if not targets:
        return 0.0

    found = 0
    for t in targets:
        tl = str(t).lower()
        for c in top:
            if truth.relevant_chunks:
                if str(c.get("id", "")) == t:
                    found += 1
                    break
            elif tl in (c.get("url") or "").lower():
                found += 1
                break
    return found / len(targets)


def reciprocal_rank(chunks: list[dict], truth: RetrievalTruth) -> float:
    """1/rank of the first relevant result, 0 when absent.

    Rewards getting the right page to the top rather than merely into the list,
    which is the difference this experiment is looking for: a requirement-aware
    method that promotes the correct page from rank 4 to rank 1 moves MRR a long
    way and Recall@5 not at all.
    """
    r = hit_rank(chunks, truth)
    return 1.0 / r if r else 0.0


@dataclass
class QueryResult:
    """One question, one arm. Kept per-query so Stage 8 can diff arms."""

    prompt_id: str
    category: str
    rank: int | None
    reciprocal_rank: float
    recall: dict[int, float] = field(default_factory=dict)
    retrieved_urls: list[str] = field(default_factory=list)

    #: Wall time for the whole retrieval, which is what a caller waits and the
    #: only figure comparable across every arm.
    total_ms: int = 0

    #: The split, where the arm can provide it. None when an arm calls a function
    #: that owns its own embedding -- production `retrieve()` does -- because a
    #: split that cannot be measured must read as absent rather than as zero.
    embed_ms: int | None = None
    search_ms: int | None = None


def score_query(prompt_id: str, category: str, chunks: list[dict],
                truth: RetrievalTruth, ks: tuple[int, ...] = DEFAULT_KS,
                total_ms: int = 0, embed_ms: int | None = None,
                search_ms: int | None = None) -> QueryResult:
    return QueryResult(
        prompt_id=prompt_id,
        category=category,
        rank=hit_rank(chunks, truth),
        reciprocal_rank=reciprocal_rank(chunks, truth),
        recall={k: recall_at_k(chunks, truth, k) for k in ks},
        retrieved_urls=[(c.get("url") or "") for c in chunks[:10]],
        total_ms=total_ms,
        embed_ms=embed_ms,
        search_ms=search_ms,
    )


def aggregate(results: list[QueryResult], ks: tuple[int, ...] = DEFAULT_KS) -> dict:
    """Arm-level summary.

    `n` is reported beside every figure. A mean over a subset that changed size
    between runs is the classic way to compare two numbers that are not
    comparable, and the scorable subset of Benchmark A moves as the corpus does.
    """
    if not results:
        return {"n": 0}

    n = len(results)
    ranked = [r for r in results if r.rank]
    out: dict = {
        "n": n,
        "mrr": sum(r.reciprocal_rank for r in results) / n,
        "found": len(ranked),
        "missed": n - len(ranked),
        "mean_rank_when_found": (sum(r.rank for r in ranked) / len(ranked)) if ranked else None,
    }
    for k in ks:
        out[f"recall@{k}"] = sum(r.recall.get(k, 0.0) for r in results) / n

    # Totals, not embed+search. An arm whose split is unavailable would sum to
    # zero and quietly drop out of the median, making the fastest arm the one
    # that reported least.
    lat = sorted(r.total_ms for r in results if r.total_ms)
    if lat:
        out["latency_ms_median"] = lat[len(lat) // 2]
        out["latency_ms_p95"] = lat[max(0, int(len(lat) * 0.95) - 1)]

    split = [(r.embed_ms, r.search_ms) for r in results
             if r.embed_ms is not None and r.search_ms is not None]
    if split:
        out["embed_ms_median"] = sorted(e for e, _ in split)[len(split) // 2]
        out["search_ms_median"] = sorted(s for _, s in split)[len(split) // 2]
    return out


def by_category(results: list[QueryResult], ks: tuple[int, ...] = DEFAULT_KS) -> dict[str, dict]:
    """Per-category breakdown.

    The hypothesis is about compositional questions, not about average retrieval,
    so an aggregate that improves while one category collapses is the result this
    experiment most needs to not miss.
    """
    buckets: dict[str, list[QueryResult]] = {}
    for r in results:
        buckets.setdefault(r.category, []).append(r)
    return {cat: aggregate(rs, ks) for cat, rs in sorted(buckets.items())}
