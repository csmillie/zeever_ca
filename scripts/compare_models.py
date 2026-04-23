"""Compare Fireworks models against benchmark prompts with LLM-as-judge scoring.

Runs all 12 benchmark prompts against each model, scores with both keyword
matching and LLM-as-judge, and exports results to CSV.

Usage:
    uv run python scripts/compare_models.py              # all models, with judge
    uv run python scripts/compare_models.py --no-judge    # skip LLM judge (faster)
    uv run python scripts/compare_models.py --models deepseek-v3p1 glm-5  # specific models
"""
import argparse
import asyncio
import csv
import time
from datetime import datetime
from pathlib import Path

from evals.prompts import BENCHMARK_PROMPTS
from evals.scorer import score_signal_coverage, score_source_coverage, score_groundedness
from evals.llm_judge import judge_answer
from shared.config import settings
from llm_router.fireworks_provider import FireworksProvider
from query_engine.retriever import retrieve
from query_engine.classifier import classify_query
from query_engine.generator import generate_answer

MODELS = [
    ("deepseek-v3p1", "accounts/fireworks/models/deepseek-v3p1", 0.56, 1.68),
    ("deepseek-v3p2", "accounts/fireworks/models/deepseek-v3p2", 0.56, 1.68),
    ("mixtral-8x22b", "accounts/fireworks/models/mixtral-8x22b-instruct", 0.50, 0.50),
    ("gpt-oss-120b", "accounts/fireworks/models/gpt-oss-120b", 0.07, 0.30),
    ("glm-5", "accounts/fireworks/models/glm-5", 0.50, 1.50),
    ("glm-4p7", "accounts/fireworks/models/glm-4p7", 0.20, 0.20),
    ("kimi-k2p5", "accounts/fireworks/models/kimi-k2p5", 0.50, 1.50),
]

# Use a separate judge model to avoid self-evaluation bias
JUDGE_MODEL = "accounts/fireworks/models/deepseek-v3p1"


def calc_cost(input_tokens: int, output_tokens: int, input_price: float, output_price: float) -> float:
    """Calculate cost in USD given per-1M-token prices."""
    return (input_tokens * input_price + output_tokens * output_price) / 1_000_000


async def run_comparison(use_judge: bool = True, model_filter: list[str] | None = None):
    models = MODELS
    if model_filter:
        models = [m for m in MODELS if m[0] in model_filter]
        if not models:
            print(f"No models matched filter: {model_filter}")
            print(f"Available: {[m[0] for m in MODELS]}")
            return

    results = []
    total_cost = 0.0

    # Set up judge provider (uses a fixed model to avoid self-evaluation bias)
    judge_provider = None
    if use_judge:
        judge_provider = FireworksProvider(
            api_key=settings.fireworks_api_key,
            base_url=settings.fireworks_base_url,
            model=JUDGE_MODEL,
        )
        print(f"Judge model: {JUDGE_MODEL}")

    # Pre-compute retrievals (same chunks for all models — fair comparison)
    print("\nPre-computing retrievals for all prompts...")
    prompt_chunks = {}
    for bp in BENCHMARK_PROMPTS:
        chunks = retrieve(bp.prompt, limit=5)
        prompt_chunks[bp.id] = chunks
        print(f"  {bp.id}: {len(chunks)} chunks retrieved")

    for model_name, model_id, input_price, output_price in models:
        print(f"\n{'='*70}")
        print(f"Testing model: {model_name} ({model_id})")
        print(f"{'='*70}")

        provider = FireworksProvider(
            api_key=settings.fireworks_api_key,
            base_url=settings.fireworks_base_url,
            model=model_id,
        )

        for bp in BENCHMARK_PROMPTS:
            chunks = prompt_chunks[bp.id]
            query_class = classify_query(bp.prompt)

            start = time.time()
            try:
                if not chunks:
                    answer = "No relevant chunks found."
                    sources = []
                    input_tokens = 0
                    output_tokens = 0
                else:
                    result = await generate_answer(bp.prompt, chunks, provider)
                    answer = result["answer"]
                    sources = result["sources"]
                    input_tokens = result["input_tokens"]
                    output_tokens = result["output_tokens"]
            except Exception as e:
                answer = f"ERROR: {e}"
                sources = []
                input_tokens = 0
                output_tokens = 0

            latency_ms = int((time.time() - start) * 1000)
            cost = calc_cost(input_tokens, output_tokens, input_price, output_price)
            total_cost += cost

            # Keyword-based scores
            signal_rel = score_signal_coverage(answer, bp.expected_signals)
            signal_cit = score_source_coverage(sources, bp.expected_sources)

            row = {
                "model": model_name,
                "model_id": model_id,
                "prompt_id": bp.id,
                "category": bp.category,
                "prompt": bp.prompt,
                "answer": answer,
                "sources": "; ".join(sources),
                "query_class": query_class,
                "signal_relevance": round(signal_rel, 3),
                "signal_citation": round(signal_cit, 3),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "cost_usd": round(cost, 6),
                "latency_ms": latency_ms,
                "judge_relevance": -1.0,
                "judge_completeness": -1.0,
                "judge_groundedness": -1.0,
                "judge_citation": -1.0,
                "judge_reasoning": "",
            }

            # LLM-as-judge scoring
            if use_judge and "ERROR" not in answer:
                try:
                    judge_scores = await judge_answer(
                        question=bp.prompt,
                        answer=answer,
                        sources=sources,
                        expected_signals=bp.expected_signals,
                    )
                    row["judge_relevance"] = round(judge_scores.relevance, 3)
                    row["judge_completeness"] = round(judge_scores.completeness, 3)
                    row["judge_groundedness"] = round(judge_scores.groundedness, 3)
                    row["judge_citation"] = round(judge_scores.citation_quality, 3)
                    row["judge_reasoning"] = judge_scores.reasoning
                except Exception as e:
                    row["judge_reasoning"] = f"Judge error: {e}"

            results.append(row)

            # Print progress
            status = "OK" if "ERROR" not in answer else "FAIL"
            if use_judge and row["judge_relevance"] >= 0:
                print(
                    f"  {bp.id} [{status}] "
                    f"sig={signal_rel:.2f} "
                    f"j-rel={row['judge_relevance']:.2f} "
                    f"j-grnd={row['judge_groundedness']:.2f} "
                    f"{latency_ms}ms ${cost:.4f}"
                )
            else:
                print(f"  {bp.id} [{status}] sig={signal_rel:.2f} cit={signal_cit:.2f} {latency_ms}ms ${cost:.4f}")

    # Export to CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = Path(f"evals/model_comparison_{timestamp}.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = list(results[0].keys())
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    # Print summary
    print(f"\n{'='*100}")
    print(f"SUMMARY")
    print(f"{'='*100}")

    if use_judge:
        print(f"{'Model':<20} {'Sig-Rel':>8} {'J-Rel':>7} {'J-Comp':>8} {'J-Grnd':>8} {'J-Cite':>8} {'Avg ms':>8} {'Total $':>10}")
        print(f"{'-'*20} {'-'*8} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*10}")
    else:
        print(f"{'Model':<20} {'Avg Rel':>8} {'Avg Cit':>8} {'Avg ms':>8} {'Total $':>10}")
        print(f"{'-'*20} {'-'*8} {'-'*8} {'-'*8} {'-'*10}")

    for model_name, _, _, _ in models:
        model_results = [r for r in results if r["model"] == model_name]
        n = len(model_results) or 1
        avg_sig = sum(r["signal_relevance"] for r in model_results) / n
        avg_lat = sum(r["latency_ms"] for r in model_results) // n
        model_cost = sum(r["cost_usd"] for r in model_results)

        if use_judge:
            judged = [r for r in model_results if r["judge_relevance"] >= 0]
            jn = len(judged) or 1
            avg_jrel = sum(r["judge_relevance"] for r in judged) / jn
            avg_jcomp = sum(r["judge_completeness"] for r in judged) / jn
            avg_jgrnd = sum(r["judge_groundedness"] for r in judged) / jn
            avg_jcite = sum(r["judge_citation"] for r in judged) / jn
            print(
                f"{model_name:<20} {avg_sig:>8.3f} {avg_jrel:>7.3f} {avg_jcomp:>8.3f} "
                f"{avg_jgrnd:>8.3f} {avg_jcite:>8.3f} {avg_lat:>8} {model_cost:>10.4f}"
            )
        else:
            avg_cit = sum(r["signal_citation"] for r in model_results) / n
            print(f"{model_name:<20} {avg_sig:>8.3f} {avg_cit:>8.3f} {avg_lat:>8} {model_cost:>10.4f}")

    print(f"\nTotal cost: ${total_cost:.4f}")
    if use_judge:
        print(f"Judge model: {JUDGE_MODEL}")
    print(f"Results saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Compare Fireworks models on Ask Toronto benchmarks")
    parser.add_argument("--no-judge", action="store_true", help="Skip LLM-as-judge scoring (faster, cheaper)")
    parser.add_argument("--models", nargs="+", help="Only test specific models (by short name)")
    args = parser.parse_args()

    asyncio.run(run_comparison(
        use_judge=not args.no_judge,
        model_filter=args.models,
    ))


if __name__ == "__main__":
    main()
