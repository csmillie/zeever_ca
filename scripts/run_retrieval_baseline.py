#!/usr/bin/env python
"""Stage 2: retrieval baselines over Benchmark A, before any requirement work.

    uv run python scripts/run_retrieval_baseline.py                 # arms A and B
    uv run python scripts/run_retrieval_baseline.py --arms A
    uv run python scripts/run_retrieval_baseline.py --limit 10      # smoke test
    uv run python scripts/run_retrieval_baseline.py --runs-dir /tmp/runs

On the server, write runs outside the repository: anything left in the tree can
block the next deploy's git pull. See "The repository directory is not scratch
space" in docs/DEPLOYMENT.md.

Retrieval is the only variable. No generation, no judge, no cost.

## The arms

  A  production        retrieve() exactly as the site calls it: IVFFlat at the
                       configured probes, then the 0.2 similarity threshold and
                       the per-URL dedupe cap.

  A-raw  unfiltered    the same search with neither filter. The threshold and the
                       cap are answer-quality decisions -- they stop one page
                       filling the context window -- and they are not retrieval
                       quality. Measuring only the filtered list would credit or
                       blame the filter for what the index did.

  B  exact             the same vectors and the same query, with the index
                       refused. This separates embedding quality from ANN
                       behaviour: if A and B agree, the index is not costing
                       recall and the embedding is the ceiling. Our own history
                       makes this worth checking -- an ivfflat index built with
                       too few lists went unused for months, and a hosted store
                       was judged twenty times faster than a database that was
                       doing a sequential scan.

Arm C, a modern dense challenger, needs its own table, its own index and its own
probes sweep because its vectors are 1024-dimensional. It is deliberately not in
this script: mixing a re-embedding job into the run that establishes the baseline
is how two variables move at once.

## What is scored

Only the questions that can distinguish two methods. Benchmark A carries 100
questions, of which the section-wide labels and the refusal questions cannot --
see evals/retrieval_truth.py. Every run records how many were excluded and why.

Nothing here is authoritative while HUMAN VERIFIED reads 0 in the coverage line.
The arm-to-arm comparison is still valid, because the same labels apply to every
arm; the absolute numbers are optimistic.
"""
import argparse
import json
import os
import platform
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text as sql

from evals.prompts import BENCHMARK_PROMPTS
from evals.retrieval_metrics import DEFAULT_KS, aggregate, by_category, score_query
from evals.retrieval_truth import coverage, load as load_truth
from indexer.embedder import build_endpoints, embed_texts
from indexer.vector_store import search_similar
from query_engine import retriever
from shared.config import settings
from shared.db import get_session

REPO = Path(__file__).resolve().parents[1]
# Where runs go unless --runs-dir or EXPERIMENT_RUNS_DIR says otherwise. Fine on
# a laptop, where runs are committed; on the server it is inside the deploy tree.
DEFAULT_RUNS_DIR = REPO / "experiments" / "runs"


def _git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True,
                              cwd=REPO).stdout.strip()
    except Exception:
        return ""


def corpus_fingerprint() -> dict:
    """What the corpus was, so a later run can tell whether it moved.

    Chunk count alone is not enough: a recrawl that replaces as much as it adds
    leaves the count flat. The newest chunk timestamp catches that.
    """
    with get_session() as s:
        row = s.execute(sql("""
            SELECT count(*) AS chunks,
                   count(embedding) AS embedded,
                   max(created_at) AS newest
            FROM canadian_ai.document_chunks
        """)).mappings().one()
        urls = s.execute(sql("""
            SELECT count(DISTINCT pd.url)
            FROM canadian_ai.parsed_documents pd
            JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
        """)).scalar()
    return {"chunks": row["chunks"], "embedded": row["embedded"],
            "distinct_urls": urls,
            "newest_chunk": row["newest"].isoformat() if row["newest"] else None}


def search_exact(query_embedding: list[float], limit: int) -> list[dict]:
    """Arm B: the same query with the index refused.

    enable_indexscan alone is not enough -- Postgres can still reach an ivfflat
    index through a bitmap scan -- so both are disabled. LOCAL scopes it to this
    transaction, leaving the session and every other caller untouched.

    `dc.id` is the second sort key, and it is not cosmetic. Two identical runs of
    this arm returned different scores -- R@1 of 0.595 and 0.581, one question
    flipping -- because chunks tied on distance came back in whatever order the
    sort produced. The query embedding was ruled out first: four calls for the
    same text returned byte-identical vectors. Without a tiebreak an arm can beat
    another by one question on nothing at all, which is indistinguishable from a
    real difference at this sample size.

    Production `search_similar` has the same missing tiebreak. It is left alone:
    Stage 2 does not change production behaviour, and the approximate index makes
    an exact tie at the boundary much rarer there. It is worth fixing separately.
    """
    with get_session() as session:
        session.execute(sql("SET LOCAL enable_indexscan = off"))
        session.execute(sql("SET LOCAL enable_bitmapscan = off"))
        rows = session.execute(sql("""
            SELECT dc.id, dc.chunk_text, dc.metadata,
                   pd.url, pd.title, pd.content_type,
                   1 - (dc.embedding <=> cast(:embedding AS vector)) AS similarity
            FROM canadian_ai.document_chunks dc
            JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
            WHERE dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> cast(:embedding AS vector), dc.id
            LIMIT :limit
        """), {"embedding": str(query_embedding), "limit": limit}).mappings().all()
    return [dict(r) for r in rows]


def verify_exact_is_exact() -> str:
    """Prove arm B is not silently using the index.

    Asserting a plan rather than trusting a GUC, because the failure mode is
    quiet: if the index were still used, arm B would be arm A under a different
    name and the two would agree for the wrong reason.
    """
    probe = [0.0] * 768
    with get_session() as session:
        session.execute(sql("SET LOCAL enable_indexscan = off"))
        session.execute(sql("SET LOCAL enable_bitmapscan = off"))
        plan = session.execute(sql("""
            EXPLAIN SELECT dc.id FROM canadian_ai.document_chunks dc
            WHERE dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> cast(:embedding AS vector) LIMIT 5
        """), {"embedding": str(probe)}).scalars().all()
    return " | ".join(plan)


ARMS = ("A", "A-raw", "B")


def run_arm(arm: str, prompts, truths, k_max: int) -> list:
    """One arm over the scorable prompts.

    Arm A is timed as a whole and the other two are timed in halves, because
    production `retrieve()` embeds the query itself. An earlier version embedded
    the prompt first and then called `retrieve()` anyway, so arm A paid for two
    embeddings: its `embed_ms` measured work that was thrown away and its
    `search_ms` hid the real embedding inside it. Every latency figure for arm A
    was one embedding too slow, and the split was simply wrong.

    So the split is reported only where an arm can honestly provide it, and
    `total_ms` -- what a caller actually waits -- is what the arms are compared
    on. A number that cannot be measured is recorded as absent, never as zero:
    zero would sum into a median and make the least-instrumented arm the fastest.
    """
    results = []
    for bp in prompts:
        truth = truths[bp.id]

        if arm == "A":
            # retrieve() owns its embedding, its over-fetch, its threshold and
            # its dedupe. Timing the whole call is the only honest measure of it.
            t0 = time.time()
            chunks, _ = retriever.retrieve(bp.prompt, limit=5)
            total_ms = int((time.time() - t0) * 1000)
            embed_ms = search_ms = None
        else:
            t0 = time.time()
            emb = embed_texts([bp.prompt])[0]
            embed_ms = int((time.time() - t0) * 1000)

            t1 = time.time()
            chunks = (search_similar if arm == "A-raw" else search_exact)(emb, limit=k_max)
            search_ms = int((time.time() - t1) * 1000)
            total_ms = embed_ms + search_ms

        results.append(score_query(bp.id, bp.category, chunks, truth,
                                   total_ms=total_ms, embed_ms=embed_ms,
                                   search_ms=search_ms))
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--arms", nargs="+", default=list(ARMS), choices=list(ARMS))
    ap.add_argument("--limit", type=int, help="score only the first N scorable prompts")
    ap.add_argument("--k-max", type=int, default=10, help="depth to retrieve for Recall@10")
    ap.add_argument("--note", default="", help="recorded in the manifest")
    ap.add_argument("--runs-dir", type=Path,
                    default=Path(os.environ.get("EXPERIMENT_RUNS_DIR") or DEFAULT_RUNS_DIR),
                    help="where to write the manifest and per-query results "
                         "(default: $EXPERIMENT_RUNS_DIR, else experiments/runs)")
    args = ap.parse_args()

    truths = load_truth()
    if not truths:
        print("No ground truth. Run scripts/build_retrieval_truth.py first.")
        return 2

    cov = coverage(truths)
    scorable_ids = {t.id for t in truths.values() if t.is_scorable}
    prompts = [bp for bp in BENCHMARK_PROMPTS if bp.id in scorable_ids]
    if args.limit:
        prompts = prompts[: args.limit]

    print(f"Benchmark A: {cov['total']} questions, {cov['scorable']} scorable, "
          f"{len(prompts)} being run")
    print(f"  excluded: {cov['excluded_section']} section-wide, "
          f"{cov['excluded_missing']} no page in corpus, "
          f"{cov['excluded_refusal']} expect refusal")
    print(f"  HUMAN VERIFIED: {cov['verified']}"
          + ("   <-- every figure below is provisional" if cov["verified"] == 0 else ""))

    chain = build_endpoints()
    corpus = corpus_fingerprint()
    plan = verify_exact_is_exact()
    print(f"\ncorpus: {corpus['chunks']:,} chunks ({corpus['embedded']:,} embedded), "
          f"{corpus['distinct_urls']:,} URLs")
    print(f"arm B plan: {plan[:88]}")
    if "Index Scan" in plan or "Bitmap" in plan:
        print("  WARNING: arm B is still using an index; it is not an exact baseline.")

    run_id = f"stage2-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:6]}"
    manifest = {
        "run_id": run_id,
        "started": datetime.now(timezone.utc).isoformat(),
        "git_commit": _git("rev-parse", "HEAD"),
        "git_dirty": bool(_git("status", "--porcelain")),
        "host": platform.node(),
        "benchmark": "Zeever Retrieval Benchmark A - Existing Questions",
        "benchmark_scored": len(prompts),
        "benchmark_coverage": cov,
        "corpus": corpus,
        "embedding_model": settings.embedding_model,
        "embedding_endpoint": chain[0].label,
        "embedding_base_url": chain[0].base_url,
        "embedding_dimensions": 768,
        "similarity_metric": "cosine",
        "retrieval_backend": settings.retrieval_backend,
        "ivfflat_probes": settings.ivfflat_probes,
        "similarity_threshold": retriever.SIMILARITY_THRESHOLD,
        "k_max": args.k_max,
        "ks": list(DEFAULT_KS),
        "arm_b_plan": plan,
        "note": args.note,
        "arms": {},
    }

    per_query = {}
    for arm in args.arms:
        print(f"\n=== arm {arm}")
        t0 = time.time()
        results = run_arm(arm, prompts, truths, args.k_max)
        agg = aggregate(results)
        agg["wall_seconds"] = round(time.time() - t0, 1)
        manifest["arms"][arm] = agg
        manifest.setdefault("by_category", {})[arm] = by_category(results)
        per_query[arm] = results

        cells = "  ".join(f"R@{k}={agg[f'recall@{k}']:.3f}" for k in DEFAULT_KS)
        split = (f" (embed {agg['embed_ms_median']} + search {agg['search_ms_median']})"
                 if "embed_ms_median" in agg else " (split not separable)")
        print(f"  {cells}  MRR={agg['mrr']:.3f}  found={agg['found']}/{agg['n']}"
              f"  median={agg.get('latency_ms_median','-')}ms{split}")

    runs_dir = args.runs_dir
    runs_dir.mkdir(parents=True, exist_ok=True)
    (runs_dir / f"{run_id}.manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    with (runs_dir / f"{run_id}.jsonl").open("w", encoding="utf-8") as fh:
        for arm, results in per_query.items():
            for r in results:
                fh.write(json.dumps({"run_id": run_id, "arm": arm, **r.__dict__},
                                    default=str) + "\n")

    print(f"\nwrote {runs_dir / run_id}.manifest.json and .jsonl")
    print("Nothing overwritten: every run has its own id.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
