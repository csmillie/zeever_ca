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
from typing import NamedTuple

from evals.prompts import BENCHMARK_PROMPTS
from evals.scorer import score_signal_coverage, score_source_coverage, score_groundedness
from evals.llm_judge import judge_answer
from shared.config import settings
from llm_router.together_provider import TogetherProvider  # judge
from llm_router.factory import build_provider
from query_engine.retriever import retrieve
from query_engine.classifier import classify_query
from query_engine.generator import generate_answer, SYSTEM_PROMPTS

# CAD -> USD conversion for providers that publish in Canadian dollars.
# Every other provider here lists USD, so costs are normalized to USD in the
# cost_usd column and the native figure is preserved alongside it. Update this
# rate (and the date) when it drifts enough to matter.
CAD_TO_USD = 0.73  # approximate, as of 2026-08

class ModelSpec(NamedTuple):
    """One row of the comparison table.

    Named rather than a bare tuple because this list is unpacked in more than one
    place: adding a field to a plain tuple silently broke the summary loop once.
    """
    name: str
    provider: str
    model_id: str
    input_price: float   # per 1M tokens, in `currency`
    output_price: float  # per 1M tokens, in `currency`
    currency: str = "USD"
    extra_body: dict | None = None  # model-specific options, e.g. disabling thinking


MODELS = [
    # --- Together: serverless replacements for the retired Qwen2.5-7B-Instruct-Turbo ---
    # That model is still listed but is now dedicated-endpoint only, so it 400s.
    # Verified serverless on 2026-08-26; most of Together's small open models are not.
    ModelSpec("gpt-oss-20b",   "together", "openai/gpt-oss-20b",                    0.05, 0.20),
    ModelSpec("gpt-oss-120b",  "together", "openai/gpt-oss-120b",                   0.15, 0.60),
    # Qwen3.5-9B is a reasoning model: without this it returns empty content and
    # spends the whole budget in a `reasoning` field.
    ModelSpec("qwen3.5-9b",    "together", "Qwen/Qwen3.5-9B",                       0.17, 0.25,
              extra_body={"chat_template_kwargs": {"enable_thinking": False}}),
    ModelSpec("llama-3.3-70b", "together", "meta-llama/Llama-3.3-70B-Instruct-Turbo", 1.04, 1.04),

    # --- Local Ollama (free; requires OLLAMA_BASE_URL pointing at the box) ---
    # The two hosts were swapped on 2026-08-27 so the box with more VRAM leads the
    # failover chain. These names follow OLLAMA_BASE_URL / OLLAMA_BASE_URL_2, not
    # the hardware, so they had to move with it: a name pointing at a host that
    # does not have the tag fails all 100 prompts and reads as a bad model.
    # Host 1 (OLLAMA_BASE_URL) — HP Z640, AMD RX 7900 XT 20GB, so larger models fit
    ModelSpec("ollama1-gpt-oss-20b", "ollama",  "gpt-oss:20b",         0.0, 0.0),
    ModelSpec("ollama1-qwen3-14b",   "ollama",  "qwen3:14b",           0.0, 0.0),
    ModelSpec("ollama1-qwen2.5-14b", "ollama",  "qwen2.5:14b",         0.0, 0.0),
    ModelSpec("ollama1-gemma3-12b",  "ollama",  "gemma3:12b",          0.0, 0.0),
    # Host 2 (OLLAMA_BASE_URL_2) — Dell XPS 8940, NVIDIA RTX 3070 8GB
    ModelSpec("ollama2-qwen2.5-7b",  "ollama2", "qwen2.5:7b-instruct", 0.0, 0.0),
    ModelSpec("ollama2-llama3",      "ollama2", "llama3:latest",       0.0, 0.0),

    # --- Cohere (eval-only, proprietary) ---
    # Cohere retired a set of model ids effective 2026-04-04 and removed bare
    # "command-r" in Sept 2025, so run scripts/check_models.py --provider cohere
    # before a long run rather than discovering a dead id 100 prompts in.
    ModelSpec("command-a-plus", "cohere", "command-a-plus-05-2026", 2.50, 10.00),
    ModelSpec("command-a",   "cohere", "command-a-03-2025",   2.50, 10.00),
    ModelSpec("command-r",   "cohere", "command-r-08-2024",   0.15,  0.60),
    ModelSpec("command-r7b", "cohere", "command-r7b-12-2024", 0.0375, 0.15),

    # --- Augure (eval-only, proprietary, sovereign Canadian; CAD list prices) ---
    ModelSpec("ossington-5", "augure", "ossington-5", 1.50, 3.00, "CAD"),
    ModelSpec("rosedale-1",  "augure", "rosedale-1",  2.50, 6.00, "CAD"),
    ModelSpec("tofino-3",    "augure", "tofino-3",    0.60, 2.00, "CAD"),
]


# Maps provider_name -> (api_key, base_url) pulled from settings.
PROVIDER_CREDS = {
    "together":  (settings.together_api_key,  settings.together_base_url),
    "fireworks": (settings.fireworks_api_key, settings.fireworks_base_url),
    "cohere":    (settings.cohere_api_key,    settings.cohere_base_url),
    "augure":    (settings.augure_api_key,    settings.augure_base_url),
    # Ollama needs no key; the base URL is what decides whether it is reachable.
    "ollama":    ("ollama",                   settings.ollama_base_url),
    "ollama2":   ("ollama",                   settings.ollama_base_url_2),
}

# Use a separate judge model to avoid self-evaluation bias
# Independent of all 4 models under test (not Qwen, not Cohere); serverless on Together.
JUDGE_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"


def calc_cost(input_tokens: int, output_tokens: int, input_price: float, output_price: float) -> float:
    """Cost in the provider's own listing currency, given per-1M-token prices."""
    return (input_tokens * input_price + output_tokens * output_price) / 1_000_000


def to_usd(cost: float, currency: str) -> float:
    """Normalize a native cost to USD so models priced in different currencies compare."""
    if currency == "USD":
        return cost
    if currency == "CAD":
        return cost * CAD_TO_USD
    raise ValueError(f"Unknown currency {currency!r} — add a conversion before benchmarking it.")


async def run_comparison(use_judge: bool = True, model_filter: list[str] | None = None,
                         prompt_variant: str | None = None):
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
        judge_provider = TogetherProvider(
            api_key=settings.together_api_key,
            base_url=settings.together_base_url,
            model=JUDGE_MODEL,
        )
        print(f"Judge model: {JUDGE_MODEL}")

    # Pre-compute retrievals (same chunks for all models — fair comparison)
    print("\nPre-computing retrievals for all prompts...")
    prompt_chunks = {}
    for bp in BENCHMARK_PROMPTS:
        # retrieve() returns (chunks, distances) — generate_answer wants just the chunk dicts
        chunks, _ = retrieve(bp.prompt, limit=5)
        prompt_chunks[bp.id] = chunks
        print(f"  {bp.id}: {len(chunks)} chunks retrieved")

    for spec in models:
        print(f"\n{'='*70}")
        print(f"Testing model: {spec.name} ({spec.model_id})")
        print(f"{'='*70}")

        api_key, base_url = PROVIDER_CREDS[spec.provider]
        if spec.provider.startswith("ollama"):
            if not base_url:
                var = "OLLAMA_BASE_URL" if spec.provider == "ollama" else "OLLAMA_BASE_URL_2"
                print(f"  SKIP: {var} not set — skipping {spec.name}")
                continue
        elif not api_key or api_key == "none":
            print(f"  SKIP: {spec.provider.upper()}_API_KEY not set — skipping {spec.name}")
            continue
        extras = {"extra_body": spec.extra_body} if spec.extra_body else {}
        provider = build_provider(spec.provider, api_key, base_url, spec.model_id, **extras)

        # Warm the model before timing anything. Ollama loads a model into VRAM on
        # first use and evicts whatever was resident, so without this the first
        # prompt carries the load cost: 21.9s for gpt-oss:20b in one run, against a
        # 4.0s median. That lands in the average and makes local models look slower
        # than they are. Hosted providers warm too; it costs one short call.
        try:
            t_warm = time.time()
            await provider.generate(prompt="Reply with: ok", max_tokens=8)
            warm_ms = int((time.time() - t_warm) * 1000)
            print(f"  warmed in {warm_ms}ms (not counted)")
        except Exception as e:
            print(f"  warm-up failed ({type(e).__name__}: {e}) — continuing, first prompt may be slow")

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
                    result = await generate_answer(bp.prompt, chunks, provider,
                                                   prompt_variant=prompt_variant)
                    answer = result["answer"]
                    if not (answer or "").strip():
                        # Reasoning models can return empty content while spending the
                        # whole token budget on hidden thinking. Scoring that as 0.0
                        # makes a broken call look like a bad answer.
                        raise ValueError("empty response (model returned no content)")
                    sources = result["sources"]
                    input_tokens = result["input_tokens"]
                    output_tokens = result["output_tokens"]
            except Exception as e:
                answer = f"ERROR: {e}"
                sources = []
                input_tokens = 0
                output_tokens = 0

            latency_ms = int((time.time() - start) * 1000)
            cost_native = calc_cost(input_tokens, output_tokens, spec.input_price, spec.output_price)
            cost = to_usd(cost_native, spec.currency)
            total_cost += cost

            # Keyword-based scores. A failed call gets -1 rather than a score, the
            # same convention the judge columns use. Scoring "ERROR: ..." as text
            # yields a near-zero that averages in as a bad answer, which is how a
            # provider returning 422 on 14% of prompts came out looking like a
            # weak model instead of an unreliable endpoint.
            failed = answer.startswith("ERROR")
            signal_rel = -1.0 if failed else score_signal_coverage(answer, bp.expected_signals)
            signal_cit = -1.0 if failed else score_source_coverage(sources, bp.expected_sources)

            row = {
                "model": spec.name,
                "model_id": spec.model_id,
                "prompt_id": bp.id,
                "category": bp.category,
                "prompt": bp.prompt,
                "answer": answer,
                "sources": "; ".join(sources),
                "query_class": query_class,
                # Recorded per row so a results file is self-describing: two runs
                # that differ only in the system prompt are otherwise identical.
                "prompt_variant": prompt_variant or settings.system_prompt_variant,
                "signal_relevance": round(signal_rel, 3),
                "signal_citation": round(signal_cit, 3),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "cost_native": round(cost_native, 6),
                "list_currency": spec.currency,
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
                        expects_refusal=bp.expects_refusal,
                        provider=judge_provider,
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
    if not results:
        print("\nNo results — every model was skipped (no API keys set). Nothing to write.")
        return

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

    for spec in models:
        model_results = [r for r in results if r["model"] == spec.name]
        if not model_results:
            print(f"{spec.name:<20} {'(skipped — no API key)':>40}")
            continue
        n = len(model_results) or 1
        scored = [r for r in model_results if r["signal_relevance"] >= 0]
        avg_sig = (sum(r["signal_relevance"] for r in scored) / len(scored)) if scored else -1.0
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
                f"{spec.name:<20} {avg_sig:>8.3f} {avg_jrel:>7.3f} {avg_jcomp:>8.3f} "
                f"{avg_jgrnd:>8.3f} {avg_jcite:>8.3f} {avg_lat:>8} {model_cost:>10.4f}"
            )
        else:
            cit_scored = [r for r in model_results if r["signal_citation"] >= 0]
            avg_cit = (sum(r["signal_citation"] for r in cit_scored) / len(cit_scored)) if cit_scored else -1.0
            print(f"{spec.name:<20} {avg_sig:>8.3f} {avg_cit:>8.3f} {avg_lat:>8} {model_cost:>10.4f}")

    print(f"\nTotal cost: ${total_cost:.4f}")
    if use_judge:
        print(f"Judge model: {JUDGE_MODEL}")
    print(f"Results saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Compare Fireworks models on Ask Toronto benchmarks")
    parser.add_argument("--no-judge", action="store_true", help="Skip LLM-as-judge scoring (faster, cheaper)")
    parser.add_argument("--models", nargs="+", help="Only test specific models (by short name)")
    parser.add_argument("--prompt-variant", choices=sorted(SYSTEM_PROMPTS),
                        help="system prompt to generate with (default: settings.system_prompt_variant)")
    args = parser.parse_args()

    asyncio.run(run_comparison(
        use_judge=not args.no_judge,
        model_filter=args.models,
        prompt_variant=args.prompt_variant,
    ))


if __name__ == "__main__":
    main()
