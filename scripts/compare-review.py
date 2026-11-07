#!/usr/bin/env python3
"""Benchmark multiple Together.ai models on the same set of PRs.

Caches PR context per PR (one gh fetch), then runs each model against it
and writes the parsed review + metadata to:

    _review-bench/PR<N>/<model_slug>.json

Final stdout: a table comparing verdict, issue counts, latency, tokens.

Usage:
    uv run python scripts/compare-review.py --prs 91 90 88 93 84 \
        --models Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 MiniMaxAI/MiniMax-M2.7
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

# Make sibling _review_lib importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _review_lib import (  # noqa: E402
    ReviewCallError,
    build_prompt,
    call_together,
    gather_pr_context,
    load_env,
)


load_env()

REPO_ROOT = Path(__file__).resolve().parent.parent
BENCH_DIR = REPO_ROOT / "_review-bench"


def model_slug(model: str) -> str:
    return model.replace("/", "_").replace(":", "_")


def load_or_fetch_context(pr_number: int) -> dict:
    """Cache PR context to disk so re-runs don't re-hit gh."""
    pr_dir = BENCH_DIR / f"PR{pr_number}"
    pr_dir.mkdir(parents=True, exist_ok=True)
    ctx_path = pr_dir / "_context.json"
    if ctx_path.is_file():
        return json.loads(ctx_path.read_text())
    print(f"  fetching PR #{pr_number} context...")
    ctx = gather_pr_context(pr_number)
    ctx_path.write_text(json.dumps(ctx, indent=2))
    return ctx


def run_one(pr_number: int, model: str, force: bool) -> dict | None:
    pr_dir = BENCH_DIR / f"PR{pr_number}"
    out_path = pr_dir / f"{model_slug(model)}.json"
    if out_path.is_file() and not force:
        print(f"  cached: PR#{pr_number} / {model}")
        return json.loads(out_path.read_text())

    ctx = load_or_fetch_context(pr_number)
    prompt = build_prompt(ctx)

    print(f"  calling {model} on PR #{pr_number}...")
    try:
        result = call_together(prompt, model=model)
    except ReviewCallError as e:
        err_path = pr_dir / f"{model_slug(model)}.error.txt"
        err_path.write_text(str(e))
        print(f"  FAILED: {e}", file=sys.stderr)
        return None

    record = {
        "pr": pr_number,
        "model": model,
        "title": ctx["title"],
        "diff_lines": len(ctx["diff"].splitlines()),
        "latency_ms": result.latency_ms,
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
        "total_tokens": result.total_tokens,
        "review": result.review,
    }
    out_path.write_text(json.dumps(record, indent=2))
    return record


def severity_counts(review: dict) -> Counter:
    c = Counter()
    for issue in review.get("issues", []):
        c[(issue.get("severity") or "?").lower()] += 1
    return c


def print_table(records: list[dict]) -> None:
    if not records:
        print("\nNo records to summarize.")
        return

    print("\n=== Review Bench Summary ===\n")
    header = f"{'PR':<5}{'Model':<44}{'Verdict':<18}{'Issues':<8}{'Sev (b/s/l/?)':<16}{'Latency':<10}{'Tok in/out':<14}"
    print(header)
    print("-" * len(header))
    for r in records:
        review = r["review"]
        verdict = (review.get("verdict") or "?").lower()
        issues = review.get("issues", [])
        sev = severity_counts(review)
        sev_str = f"{sev.get('bug',0)}/{sev.get('security',0)}/{sev.get('logic',0)}/{sev.get('?',0)}"
        latency = f"{r['latency_ms']}ms"
        tok = f"{r['prompt_tokens']}/{r['completion_tokens']}"
        print(
            f"{r['pr']:<5}{r['model']:<44}{verdict:<18}{len(issues):<8}"
            f"{sev_str:<16}{latency:<10}{tok:<14}"
        )


def print_issue_diff(records: list[dict]) -> None:
    """For each PR, list issues per model so reviewer can score by hand."""
    by_pr: dict[int, list[dict]] = {}
    for r in records:
        by_pr.setdefault(r["pr"], []).append(r)

    for pr_number, group in sorted(by_pr.items()):
        print(f"\n--- PR #{pr_number} issue lists ---")
        for r in group:
            review = r["review"]
            print(f"\n  [{r['model']}] verdict={review.get('verdict')}")
            print(f"  summary: {review.get('summary','')}")
            for i, issue in enumerate(review.get("issues", []), 1):
                sev = (issue.get("severity") or "?").upper()
                f = issue.get("file", "?")
                ln = issue.get("line", "?")
                msg = issue.get("message", "")
                print(f"    {i}. [{sev}] {f}:{ln} — {msg}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare Together.ai models on past PRs")
    parser.add_argument("--prs", nargs="+", type=int, required=True, help="PR numbers")
    parser.add_argument("--models", nargs="+", required=True, help="Together model ids")
    parser.add_argument("--force", action="store_true", help="Ignore cached results")
    parser.add_argument("--no-issues", action="store_true", help="Skip per-issue dump")
    args = parser.parse_args()

    BENCH_DIR.mkdir(exist_ok=True)
    print(f"Output dir: {BENCH_DIR}\n")

    records: list[dict] = []
    for pr in args.prs:
        print(f"PR #{pr}")
        for model in args.models:
            rec = run_one(pr, model, force=args.force)
            if rec:
                records.append(rec)
        print()

    print_table(records)
    if not args.no_issues:
        print_issue_diff(records)


if __name__ == "__main__":
    main()
