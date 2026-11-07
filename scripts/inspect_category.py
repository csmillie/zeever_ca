"""Show what models actually said on one category, to explain a score gap.

    uv run python scripts/inspect_category.py --category utilities
    uv run python scripts/inspect_category.py --category utilities --full
    uv run python scripts/inspect_category.py --category utilities --models qwen3.5-9b gpt-oss-20b

Retrievals are pre-computed once per benchmark run and shared by every model, so
a category where one model scores 1.00 and another 0.62 is a difference in what
the models did with identical context. The aggregate cannot show that; the
answers can.

Prints a per-prompt score matrix first, so the prompts driving the gap are
obvious, then the answers and the judge's stated reasoning for those prompts.

    uv run python scripts/inspect_category.py --quadrant confident
    uv run python scripts/inspect_category.py --quadrant confident --models ollama1-gpt-oss-20b

--quadrant ignores categories and pulls answers by their relevance/groundedness
pair instead. "confident" is the one worth reading: high relevance, low
groundedness — the model answered the question and the sources do not support it.
The aggregate reports that as a count and nothing else, which is not enough to
tell a citation nitpick from an invented procedure.
"""
import argparse
import csv
import glob
import statistics
import textwrap
from collections import defaultdict

SCORE = "judge_relevance"


def _newest() -> str | None:
    files = sorted(glob.glob("evals/model_comparison_*.csv"))
    return files[-1] if files else None


def _score(row: dict, col: str = SCORE) -> float | None:
    try:
        v = float(row.get(col, -1))
    except (TypeError, ValueError):
        return None
    return v if v >= 0 else None


def _wrap(text: str, width: int, indent: str) -> str:
    text = " ".join((text or "").split())
    return textwrap.fill(text, width=width, initial_indent=indent, subsequent_indent=indent)


# rel/grnd bounds per quadrant, matching the thresholds analyze_benchmark.py counts.
QUADRANTS = {
    "confident": (lambda rel, grnd: rel >= 0.75 and grnd <= 0.5,
                  "answered confidently, sources do not support it"),
    "qualified": (lambda rel, grnd: rel <= 0.5 and grnd >= 0.75,
                  "hedged or declined, and was right that the evidence was thin"),
    "both-low": (lambda rel, grnd: rel <= 0.5 and grnd <= 0.5,
                 "no useful answer and no grounding"),
}


def _show_quadrant(path: str, args) -> int:
    """Print every answer falling in one relevance/groundedness quadrant."""
    test, blurb = QUADRANTS[args.quadrant]

    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if args.models:
        rows = [r for r in rows if r["model"] in args.models]

    hits = []
    for r in rows:
        rel, grnd = _score(r), _score(r, "judge_groundedness")
        if rel is not None and grnd is not None and test(rel, grnd):
            hits.append((r, rel, grnd))

    print(f"{path}\nquadrant: {args.quadrant} — {blurb}\n")
    if not hits:
        print("No answers fall in this quadrant.")
        return 0

    by_model = defaultdict(int)
    for r, _, _ in hits:
        by_model[r["model"]] += 1
    print(f"{'model':<24}{'count':>7}")
    print("-" * 31)
    for m, n in sorted(by_model.items(), key=lambda kv: -kv[1]):
        print(f"{m:<24}{n:>7}")

    print(f"\n{'=' * 100}\n{len(hits)} ANSWER(S)\n{'=' * 100}")
    for r, rel, grnd in sorted(hits, key=lambda h: (h[0]["model"], h[0]["prompt_id"])):
        print(f"\n[{r['prompt_id']}] {r['model']}  rel {rel:.2f}  grnd {grnd:.2f}  ({r['category']})")
        print(f"  Q: {r['prompt']}")
        print(_wrap(r["answer"][:args.chars] + ("…" if len(r["answer"]) > args.chars else ""), 96, "      "))
        reason = (r.get("judge_reasoning") or "").strip()
        if reason:
            print(_wrap(f"judge: {reason}", 96, "      > "))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--category", help="category to inspect, e.g. utilities")
    ap.add_argument("--quadrant", choices=["confident", "qualified", "both-low"],
                    help="inspect answers by relevance/groundedness quadrant instead of category")
    ap.add_argument("--file", help="CSV to read (default: newest in evals/)")
    ap.add_argument("--models", nargs="*", help="limit to these model names")
    ap.add_argument("--full", action="store_true", help="show every prompt, not only the ones with disagreement")
    ap.add_argument("--chars", type=int, default=420, help="answer excerpt length (default 420)")
    args = ap.parse_args()

    path = args.file or _newest()
    if not path:
        print("No evals/model_comparison_*.csv found.")
        return 2

    if not args.category and not args.quadrant:
        ap.error("give --category or --quadrant")

    if args.quadrant:
        return _show_quadrant(path, args)

    with open(path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["category"] == args.category]
    if not rows:
        with open(path, newline="", encoding="utf-8") as f:
            cats = sorted({r["category"] for r in csv.DictReader(f)})
        print(f"No rows for category {args.category!r} in {path}.\nAvailable: {', '.join(cats)}")
        return 2

    models = args.models or sorted({r["model"] for r in rows})
    prompts = sorted({r["prompt_id"] for r in rows})
    by = {(r["model"], r["prompt_id"]): r for r in rows}

    print(f"{path}\ncategory: {args.category}  —  {len(prompts)} prompts, {len(models)} models\n")

    # --- score matrix ---
    head = f"{'prompt':<10}" + "".join(f"{m[:11]:>12}" for m in models)
    print(head)
    print("-" * len(head))
    spread: dict[str, float] = {}
    for pid in prompts:
        line = f"{pid:<10}"
        vals = []
        for m in models:
            v = _score(by.get((m, pid), {}))
            line += f"{'  err' if (m, pid) in by and v is None else (f'{v:>12.2f}' if v is not None else f'{chr(45):>12}')}"
            if v is not None:
                vals.append(v)
        spread[pid] = (max(vals) - min(vals)) if len(vals) > 1 else 0.0
        print(line + (f"   <- spread {spread[pid]:.2f}" if spread[pid] >= 0.25 else ""))

    means = {m: statistics.mean([v for pid in prompts if (v := _score(by.get((m, pid), {}))) is not None] or [0])
             for m in models}
    print("\n" + f"{'mean':<10}" + "".join(f"{means[m]:>12.2f}" for m in models))

    # --- answers, for the prompts that actually differ ---
    focus = prompts if args.full else [p for p in prompts if spread[p] >= 0.25]
    if not focus:
        print("\nNo prompt shows a spread of 0.25 or more; the gap is spread thinly. Use --full to see everything.")
        return 0

    print(f"\n{'=' * 100}\nANSWERS for {len(focus)} prompt(s) where models disagree\n{'=' * 100}")
    for pid in focus:
        sample = next((by[(m, pid)] for m in models if (m, pid) in by), None)
        if not sample:
            continue
        print(f"\n[{pid}]  {sample['prompt']}")
        print("-" * 100)
        for m in models:
            r = by.get((m, pid))
            if not r:
                continue
            v = _score(r)
            score_s = "err" if v is None else f"{v:.2f}"
            extra = []
            for col, label in (("judge_groundedness", "grnd"), ("judge_citation", "cite")):
                cv = _score(r, col)
                if cv is not None:
                    extra.append(f"{label} {cv:.2f}")
            print(f"  {m:<22} rel {score_s}  {'  '.join(extra)}  [{r.get('sources', '') or 'no sources'}]")
            print(_wrap(r["answer"][:args.chars] + ("…" if len(r["answer"]) > args.chars else ""), 96, "      "))
            reason = (r.get("judge_reasoning") or "").strip()
            if reason:
                print(_wrap(f"judge: {reason}", 96, "      > "))
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
