"""Run the 6-arm retrieval experiment over the 100-question benchmark.

Retrieval is the only variable: same query embedding (computed once per prompt and
reused across arms), same generation model (Qwen2.5-7B on Together), same judge
(Llama-3.3-70B on Together).

Usage:
    uv run python scripts/retrieval_experiment.py            # all 6 arms
    uv run python scripts/retrieval_experiment.py --arms A C D
"""
import argparse
import asyncio
import csv
import time
from datetime import datetime
from pathlib import Path

from evals.prompts import BENCHMARK_PROMPTS
from evals.llm_judge import judge_answer
from shared.config import settings
from llm_router.together_provider import TogetherProvider
from query_engine.experiment_retriever import retrieve_arm
from query_engine.generator import generate_answer
from query_engine.api import traced_retrieve_graph

GEN_MODEL = "Qwen/Qwen2.5-7B-Instruct-Turbo"
JUDGE_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

# (arm, backend, mode, mesh)
ARMS = [
    ("A", "pgvector", "vector", True),
    ("B", "pgvector", "vector", False),
    ("C", "turbopuffer", "vector", False),
    ("D", "turbopuffer", "hybrid", False),
    ("E", "turbopuffer", "vector", True),
    ("F", "turbopuffer", "hybrid", True),
]


async def run(selected):
    gen = TogetherProvider(api_key=settings.together_api_key, base_url=settings.together_base_url, model=GEN_MODEL)
    judge = TogetherProvider(api_key=settings.together_api_key, base_url=settings.together_base_url, model=JUDGE_MODEL)
    arms = [a for a in ARMS if not selected or a[0] in selected]

    # Pre-embed each prompt once; reuse across all arms.
    embeddings = {}
    for bp in BENCHMARK_PROMPTS:
        _, emb = retrieve_arm(bp.prompt, backend="pgvector", mode="vector", limit=1)
        embeddings[bp.id] = emb

    rows = []
    for arm, backend, mode, mesh in arms:
        print(f"\n=== Arm {arm}: {backend}/{mode} mesh={mesh} ===")
        for bp in BENCHMARK_PROMPTS:
            t0 = time.time()
            try:
                chunks, _ = retrieve_arm(bp.prompt, backend=backend, mode=mode, limit=5,
                                         query_embedding=embeddings[bp.id])
                search_ms = int((time.time() - t0) * 1000)
                graph_ctx = None
                graph_ms = 0
                if mesh and chunks:
                    tg = time.time()
                    graph_ctx = traced_retrieve_graph(chunks)
                    graph_ms = int((time.time() - tg) * 1000)
                if not chunks:
                    answer, sources, itok, otok = "No relevant chunks found.", [], 0, 0
                else:
                    res = await generate_answer(bp.prompt, chunks, gen, graph_context=graph_ctx)
                    answer, sources = res["answer"], res["sources"]
                    itok, otok = res["input_tokens"], res["output_tokens"]
            except Exception as e:
                answer, sources, itok, otok, search_ms, graph_ms = f"ERROR: {e}", [], 0, 0, 0, 0
                chunks = []

            js = {"relevance": -1, "completeness": -1, "groundedness": -1, "citation_quality": -1, "reasoning": ""}
            if "ERROR" not in answer and chunks:
                try:
                    s = await judge_answer(question=bp.prompt, answer=answer, sources=sources,
                                           expected_signals=bp.expected_signals, provider=judge)
                    js = {"relevance": s.relevance, "completeness": s.completeness,
                          "groundedness": s.groundedness, "citation_quality": s.citation_quality,
                          "reasoning": s.reasoning}
                except Exception as e:
                    js["reasoning"] = f"Judge error: {e}"

            rows.append({
                "arm": arm, "backend": backend, "mode": mode, "mesh": mesh,
                "prompt_id": bp.id, "category": bp.category,
                "answer": answer, "sources": "; ".join(sources),
                "chunk_ids": "; ".join(str(c["id"]) for c in chunks),
                "n_chunks": len(chunks),
                "search_ms": search_ms, "graph_ms": graph_ms,
                "input_tokens": itok, "output_tokens": otok,
                "judge_relevance": js["relevance"], "judge_completeness": js["completeness"],
                "judge_groundedness": js["groundedness"], "judge_citation": js["citation_quality"],
                "judge_reasoning": js["reasoning"],
            })
            print(f"  {bp.id} [{arm}] chunks={len(chunks)} search={search_ms}ms jRel={js['relevance']}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = Path(f"evals/retrieval_experiment_{ts}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\nResults saved to: {out}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--arms", nargs="+", help="Subset of arm letters, e.g. A C D")
    args = p.parse_args()
    asyncio.run(run(set(args.arms) if args.arms else None))


if __name__ == "__main__":
    main()
