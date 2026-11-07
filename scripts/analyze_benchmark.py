"""Summarize a model_comparison CSV: overall, by category, and what failed.

    uv run python scripts/analyze_benchmark.py                  # newest run
    uv run python scripts/analyze_benchmark.py --file path.csv  # a specific run
    uv run python scripts/analyze_benchmark.py --metric judge_groundedness

The aggregate table the benchmark prints at the end hides the thing worth
knowing: whether a model is weak on particular Toronto service areas rather than
uniformly mediocre. A model that averages well but collapses on property tax is a
different problem from one that is evenly slightly worse.

Judge columns are -1 when the judge never ran, which happens when a call errored.
Those are excluded rather than averaged as zero, because a failure that renders
as a zero silently becomes a data point.
"""
import argparse
import csv
import glob
import statistics
from collections import defaultdict

JUDGE_COLS = ["judge_relevance", "judge_completeness", "judge_groundedness", "judge_citation"]


def _load(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _judged(rows: list[dict], col: str) -> list[float]:
    """Only rows the judge actually scored: -1 means it never ran."""
    out = []
    for r in rows:
        try:
            v = float(r.get(col, -1))
        except ValueError:
            continue
        if v >= 0:
            out.append(v)
    return out


def _score(row: dict, col: str) -> float | None:
    """One row's score for a column, or None when the judge never ran (-1)."""
    try:
        v = float(row.get(col, -1))
    except (TypeError, ValueError):
        return None
    return v if v >= 0 else None


def _fmt(v: float | None, width: int = 12, places: int = 3) -> str:
    return f"{'n/a':>{width}}" if v is None else f"{v:>{width}.{places}f}"


def _mean(vals: list[float]) -> float | None:
    return statistics.mean(vals) if vals else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", help="CSV to read (default: newest in evals/)")
    ap.add_argument("--metric", default="judge_relevance",
                    help=f"per-category metric; one of {', '.join(JUDGE_COLS)} or signal_relevance")
    args = ap.parse_args()

    path = args.file
    if not path:
        candidates = sorted(glob.glob("evals/model_comparison_*.csv"))
        if not candidates:
            print("No evals/model_comparison_*.csv found. Run scripts/compare_models.py first.")
            return 2
        path = candidates[-1]

    rows = _load(path)
    if not rows:
        print(f"{path} is empty.")
        return 2

    models = sorted({r["model"] for r in rows})
    cats = sorted({r["category"] for r in rows})
    print(f"{path}  —  {len(rows)} rows, {len(models)} models, {len(cats)} categories\n")

    # ---- overall ----
    print("OVERALL")
    header = (f"{'model':<22}{'judge avg':>11}{'sig-rel':>9}{'avg ms':>9}{'med ms':>9}"
              f"{'1st ms':>9}{'cost':>10}{'errors':>8}")
    print(header)
    print("-" * len(header))
    overall: dict[str, float | None] = {}
    for m in models:
        mr = [r for r in rows if r["model"] == m]
        per_col = [_mean(_judged(mr, c)) for c in JUDGE_COLS]
        judge_avg = _mean([v for v in per_col if v is not None])
        overall[m] = judge_avg
        # Exclude failed calls. New runs store -1; older CSVs stored a near-zero
        # from scoring the literal "ERROR: ..." text, so check the answer as well.
        sig_rows = [r for r in mr
                    if not r["answer"].startswith("ERROR") and _score(r, "signal_relevance") is not None]
        sig = _mean([float(r["signal_relevance"]) for r in sig_rows])
        lats = [float(r["latency_ms"]) for r in mr]
        lat = _mean(lats)
        # Median resists the cold-start outlier; the first call to an Ollama model
        # pays for loading it into VRAM, which the mean then smears over the run.
        med = statistics.median(lats) if lats else None
        first = lats[0] if lats else None
        cost = sum(float(r.get("cost_usd", 0) or 0) for r in mr)
        errs = sum(1 for r in mr if r["answer"].startswith("ERROR"))
        cur = {r.get("list_currency", "USD") for r in mr}
        cur_note = "" if cur <= {"USD"} else f" ({'/'.join(sorted(cur))} list)"
        lat_s = f"{lat:>9.0f}" if lat is not None else f"{'n/a':>9}"
        med_s = f"{med:>9.0f}" if med is not None else f"{'n/a':>9}"
        first_s = f"{first:>9.0f}" if first is not None else f"{'n/a':>9}"
        # Flag when a model's scores rest on noticeably fewer prompts than the rest.
        partial = f" [{len(sig_rows)}/{len(mr)} scored]" if len(sig_rows) < len(mr) else ""
        print(f"{m:<22}{_fmt(judge_avg, 11)}{_fmt(sig, 9)}{lat_s}{med_s}{first_s}"
              f"{cost:>10.4f}{errs:>8}{cur_note}{partial}")

    # ---- grounded ranking ----
    # judge_relevance alone rewards answering the question whether or not the
    # context supports it, which is backwards for a product whose stated rule is to
    # refuse or qualify when the evidence is incomplete. Multiplying relevance by
    # groundedness scores the thing we actually want: a useful answer the sources
    # back up. The quadrant counts say how each model earns or loses that score.
    print("\nGROUNDED RANKING  (relevance x groundedness; quadrants below)")
    head2 = (f"{'model':<22}{'composite':>11}{'rel':>8}{'grnd':>8}"
             f"{'confident+':>12}{'qualified':>11}{'both low':>10}")
    print(head2)
    print("-" * len(head2))
    ranked = []
    for m in models:
        mr = [r for r in rows if r["model"] == m]
        pairs = [(_score(r, "judge_relevance"), _score(r, "judge_groundedness")) for r in mr]
        pairs = [(a, b) for a, b in pairs if a is not None and b is not None]
        if not pairs:
            continue
        comp = statistics.mean(a * b for a, b in pairs)
        rel = statistics.mean(a for a, _ in pairs)
        grnd = statistics.mean(b for _, b in pairs)
        # The dangerous quadrant: answered confidently, sources do not support it.
        unsupported = sum(1 for a, b in pairs if a >= 0.75 and b <= 0.5)
        # The virtuous one: declined or hedged, and was honest about the evidence.
        qualified = sum(1 for a, b in pairs if a <= 0.5 and b >= 0.75)
        both_low = sum(1 for a, b in pairs if a <= 0.5 and b <= 0.5)
        ranked.append((comp, m, rel, grnd, unsupported, qualified, both_low))
    for comp, m, rel, grnd, uns, qual, low in sorted(ranked, reverse=True):
        print(f"{m:<22}{comp:>11.3f}{rel:>8.3f}{grnd:>8.3f}{uns:>12}{qual:>11}{low:>10}")
    print("  confident+ = answered confidently with sources that do not support it (the risky one)")
    print("  qualified  = hedged or declined, and was right that the evidence was thin")
    print("  both low   = no useful answer and no grounding")

    # ---- cold start ----
    print("\nCOLD START (first call vs median — Ollama loads the model into VRAM on first use)")
    for m in models:
        lats = [float(r["latency_ms"]) for r in rows if r["model"] == m]
        if len(lats) < 3:
            continue
        med = statistics.median(lats)
        penalty = lats[0] - med
        share = penalty / sum(lats) * 100 if sum(lats) else 0
        flag = "  <-- inflates the mean" if penalty > med else ""
        print(f"  {m:<22} first {lats[0]:>7.0f}ms  median {med:>7.0f}ms  "
              f"penalty {penalty:>+7.0f}ms ({share:.1f}% of total){flag}")

    # ---- by category ----
    metric = args.metric
    print(f"\nBY CATEGORY  ({metric}, blank = never scored)")
    head = f"{'category':<26}" + "".join(f"{m[:11]:>12}" for m in models)
    print(head)
    print("-" * len(head))
    weak: dict[str, list[tuple[float, str]]] = defaultdict(list)
    for c in cats:
        line = f"{c:<26}"
        for m in models:
            mr = [r for r in rows if r["category"] == c and r["model"] == m]
            v = _mean(_judged(mr, metric)) if metric.startswith("judge") else _mean(
                [float(r[metric]) for r in mr] if mr else [])
            line += _fmt(v)
            if v is not None:
                weak[m].append((v, c))
        print(line)

    # ---- where each model is weakest ----
    print("\nWEAKEST CATEGORIES PER MODEL")
    for m in models:
        got = sorted(weak[m])[:3]
        if not got:
            continue
        base = overall.get(m)
        worst = ", ".join(f"{c} {v:.2f}" for v, c in got)
        gap = f"  (overall {base:.3f})" if base is not None else ""
        print(f"  {m:<22} {worst}{gap}")

    # ---- failures ----
    errs = [r for r in rows if r["answer"].startswith("ERROR")]
    if errs:
        print(f"\nFAILURES ({len(errs)} rows)")
        seen: dict[tuple[str, str], int] = defaultdict(int)
        for r in errs:
            seen[(r["model"], r["answer"][:110])] += 1
        for (m, msg), n in sorted(seen.items(), key=lambda kv: -kv[1]):
            print(f"  {n:>3}x  {m:<22} {msg}")
    else:
        print("\nNo failed calls.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
