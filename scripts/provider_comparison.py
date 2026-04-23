#!/usr/bin/env python3
"""Compare Fireworks vs Together.ai latency over 24 hours.

Runs a random benchmark question every hour (at a random minute within
the hour) against both providers simultaneously. Logs results to a
CSV file for analysis.

Usage:
    uv run python scripts/provider_comparison.py                    # 24-hour run
    uv run python scripts/provider_comparison.py --hours 4          # shorter test
    uv run python scripts/provider_comparison.py --results results.csv  # custom output
    uv run python scripts/provider_comparison.py --dry-run          # show schedule only

Results are saved to provider_comparison_YYYYMMDD_HHMMSS.csv
"""
import asyncio
import argparse
import csv
import random
import time
from datetime import datetime, timedelta
from pathlib import Path

from shared.config import settings
from llm_router.fireworks_provider import FireworksProvider
from llm_router.together_provider import TogetherProvider
from llm_router.ovh_provider import OvhProvider
from llm_router.ollama_provider import OllamaProvider
from query_engine.retriever import retrieve
from query_engine.generator import generate_answer


# Use the full benchmark prompt list so we get variety
from evals.prompts import BENCHMARK_PROMPTS
QUESTIONS = [bp.prompt for bp in BENCHMARK_PROMPTS]


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


async def test_provider(provider, provider_name: str, question: str, chunks: list[dict]) -> dict:
    """Run a single query against one provider and record timing."""
    start = time.time()
    error = None
    tokens = 0
    answer_len = 0

    try:
        result = await generate_answer(question, chunks, provider)
        tokens = result["total_tokens"]
        answer_len = len(result["answer"])
    except Exception as e:
        error = str(e)[:200]

    elapsed_ms = int((time.time() - start) * 1000)

    return {
        "provider": provider_name,
        "latency_ms": elapsed_ms,
        "tokens": tokens,
        "answer_length": answer_len,
        "error": error,
    }


async def run_single_test(hour_num: int, writer, question: str):
    """Run one test: same question to both providers near-simultaneously."""
    log(f"Hour {hour_num}: Testing with question: {question[:80]}...")

    # Retrieve chunks once (same context for both providers)
    chunks, _ = retrieve(question, limit=5)
    if not chunks:
        log(f"  No chunks found, skipping")
        return

    # Create providers
    providers = {}
    if settings.fireworks_api_key:
        providers["fireworks"] = FireworksProvider(
            api_key=settings.fireworks_api_key,
            base_url=settings.fireworks_base_url,
            model=settings.fireworks_model,
        )
    if settings.together_api_key:
        providers["together"] = TogetherProvider(
            api_key=settings.together_api_key,
            base_url=settings.together_base_url,
            model=settings.together_model,
        )
    providers["ovhcloud"] = OvhProvider(
        api_key=settings.ovh_api_key,
        base_url=settings.ovh_base_url,
        model=settings.ovh_model,
    )
    if settings.ollama_base_url:
        providers["ollama"] = OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
        )

    # Fire all simultaneously
    timestamp = datetime.now().isoformat()
    tasks = [test_provider(p, name, question, chunks) for name, p in providers.items()]
    results = await asyncio.gather(*tasks)

    # Log results
    for result in results:
        status = f"{result['latency_ms']}ms" if not result['error'] else f"ERROR: {result['error'][:50]}"
        log(f"  {result['provider']}: {status} ({result['tokens']} tokens)")

        writer.writerow({
            "timestamp": timestamp,
            "hour": hour_num,
            "provider": result["provider"],
            "question": question[:100],
            "latency_ms": result["latency_ms"],
            "tokens": result["tokens"],
            "answer_length": result["answer_length"],
            "error": result["error"] or "",
        })


async def run(hours: int = 24, results_file: str = None, dry_run: bool = False):
    """Run the comparison test over the specified number of hours."""
    active = []
    if settings.fireworks_api_key:
        active.append("fireworks")
    if settings.together_api_key:
        active.append("together")
    active.append("ovhcloud")  # OVHcloud works without an API key

    if settings.ollama_base_url:
        active.append("ollama")

    if len(active) < 2:
        log("ERROR: Need at least 2 providers. Set FIREWORKS_API_KEY and/or TOGETHER_API_KEY.")
        return

    # Pick random questions and random minutes for each hour
    schedule = []
    for h in range(hours):
        minute = random.randint(0, 59)
        question = random.choice(QUESTIONS)
        schedule.append((h, minute, question))

    if not results_file:
        results_file = f"provider_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    log("=" * 60)
    log("PROVIDER COMPARISON TEST")
    log(f"Duration: {hours} hours")
    log(f"Providers: {', '.join(active)}")
    if settings.fireworks_api_key:
        log(f"  Fireworks: {settings.fireworks_model}")
    if settings.together_api_key:
        log(f"  Together:  {settings.together_model}")
    log(f"  OVHcloud:  {settings.ovh_model}")
    if settings.ollama_base_url:
        log(f"  Ollama:    {settings.ollama_model}")
    log(f"Results: {results_file}")
    log("=" * 60)

    if dry_run:
        log("\nDRY RUN - Schedule:")
        start_time = datetime.now()
        for h, minute, question in schedule:
            run_time = start_time + timedelta(hours=h, minutes=minute)
            log(f"  Hour {h} at :{minute:02d} ({run_time.strftime('%H:%M')}) - {question[:70]}...")
        return

    # Open CSV and run
    fieldnames = ["timestamp", "hour", "provider", "question", "latency_ms", "tokens", "answer_length", "error"]
    with open(results_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        start_time = datetime.now()
        for h, minute, question in schedule:
            # Calculate when this test should run
            target_time = start_time + timedelta(hours=h, minutes=minute)
            now = datetime.now()

            if target_time > now:
                wait_seconds = (target_time - now).total_seconds()
                log(f"\nWaiting {int(wait_seconds)}s until hour {h} (:{minute:02d})...")
                await asyncio.sleep(wait_seconds)

            await run_single_test(h, writer, question)
            f.flush()  # Write after each test so results are available immediately

    log("\n" + "=" * 60)
    log("TEST COMPLETE")
    log(f"Results saved to: {results_file}")
    log("=" * 60)

    # Print summary
    print_summary(results_file)


def print_summary(results_file: str):
    """Print a summary of the comparison results."""
    with open(results_file) as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        log("No results to summarize.")
        return

    for provider in ["fireworks", "together", "ovhcloud", "ollama"]:
        p_rows = [r for r in rows if r["provider"] == provider and not r["error"]]
        errors = sum(1 for r in rows if r["provider"] == provider and r["error"])

        if not p_rows:
            log(f"\n{provider}: no successful results")
            continue

        latencies = [int(r["latency_ms"]) for r in p_rows]
        tokens = [int(r["tokens"]) for r in p_rows]
        avg_lat = sum(latencies) // len(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)
        p50 = sorted(latencies)[len(latencies) // 2]
        avg_tok = sum(tokens) // len(tokens)

        log(f"\n{provider}:")
        log(f"  Requests: {len(p_rows)} ok, {errors} errors")
        log(f"  Latency:  avg={avg_lat}ms  p50={p50}ms  min={min_lat}ms  max={max_lat}ms")
        log(f"  Tokens:   avg={avg_tok}")


async def run_now():
    """Run a single test immediately against all providers. For quick validation."""
    active = []
    if settings.fireworks_api_key:
        active.append("fireworks")
    if settings.together_api_key:
        active.append("together")
    active.append("ovhcloud")
    if settings.ollama_base_url:
        active.append("ollama")

    log("=" * 60)
    log("QUICK TEST - single question, all providers")
    log(f"Providers: {', '.join(active)}")
    log("=" * 60)

    results_file = f"provider_quicktest_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    question = random.choice(QUESTIONS)
    fieldnames = ["timestamp", "hour", "provider", "question", "latency_ms", "tokens", "answer_length", "error"]

    with open(results_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        await run_single_test(0, writer, question)

    print_summary(results_file)


def main():
    parser = argparse.ArgumentParser(description="Compare inference providers over time")
    parser.add_argument("--hours", type=int, default=24, help="Number of hours to run (default: 24)")
    parser.add_argument("--results", type=str, default=None, help="Output CSV file path")
    parser.add_argument("--dry-run", action="store_true", help="Show schedule without running")
    parser.add_argument("--now", action="store_true", help="Run one test immediately (quick validation)")
    parser.add_argument("--summary", type=str, default=None, help="Print summary of existing results file")
    args = parser.parse_args()

    if args.summary:
        print_summary(args.summary)
        return

    if args.now:
        asyncio.run(run_now())
        return

    asyncio.run(run(hours=args.hours, results_file=args.results, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
