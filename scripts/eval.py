"""Run the Ask Toronto evaluation suite."""
import asyncio
import argparse
from evals.benchmark import run_benchmark, FIREWORKS_MODELS, SMALL_MODELS
from evals.reporter import print_report


def main():
    parser = argparse.ArgumentParser(description="Run Ask Toronto eval suite")
    parser.add_argument("--label", default="baseline-v1", help="Label for this eval run")
    parser.add_argument("--mode", default="vector", choices=["vector", "graph"], help="Retrieval mode")
    parser.add_argument("--api-url", default="http://localhost:3034", help="API base URL")
    parser.add_argument("--judge", action="store_true", help="Use LLM-as-judge scoring (slower, more accurate)")
    parser.add_argument(
        "--models",
        nargs="+",
        choices=list(FIREWORKS_MODELS.keys()),
        help=f"Models to benchmark. Available: {', '.join(FIREWORKS_MODELS.keys())}",
    )
    parser.add_argument(
        "--all-models",
        action="store_true",
        help="Run benchmark against all 9 models",
    )
    parser.add_argument(
        "--small",
        action="store_true",
        help="Run benchmark against the smaller alternative models only",
    )
    parser.add_argument(
        "-n", "--limit",
        type=int,
        default=None,
        help="Only run the first N questions (useful for quick tests)",
    )
    args = parser.parse_args()

    models = None
    if args.all_models:
        models = list(FIREWORKS_MODELS.keys())
    elif args.small:
        models = SMALL_MODELS
    elif args.models:
        models = args.models

    results = asyncio.run(run_benchmark(
        run_label=args.label,
        api_url=args.api_url,
        mode=args.mode,
        use_judge=args.judge,
        models=models,
        limit=args.limit,
    ))
    print_report(results, args.label)


if __name__ == "__main__":
    main()
