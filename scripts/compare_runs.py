"""Diff two benchmark runs, to tell a real change from noise.

    uv run python scripts/compare_runs.py before.csv after.csv
    uv run python scripts/compare_runs.py before.csv after.csv --models ollama1-gpt-oss-20b

Written for the system-prompt experiment, where the thing being measured is not
the headline score. A prompt that reduces fabrication will *lower* judge_relevance
on the prompts it stops the model bluffing on, so a run that looks slightly worse
on the aggregate may be the better one. The number that matters is confident+:
answered confidently with sources that do not support it.

The failure mode to watch for is the opposite trade — buying a lower confident+
count by hedging on questions the evidence does answer. That shows up as
`qualified` and `both low` climbing together, and as groundedness rising while
relevance falls. Both are printed side by side so the trade is visible rather
than inferred.

Rows are matched on (model, prompt_id), so the two runs need not contain the same
models; only the overlap is compared, and anything dropped is named.
"""
import argparse
import csv
import statistics
from collections import defaultdict

# Same thresholds analyze_benchmark.py counts, so the two agree.
CONFIDENT = lambda rel, grnd: rel >= 0.75 and grnd <= 0.5      # noqa: E731
QUALIFIED = lambda rel, grnd: rel <= 0.5 and grnd >= 0.75      # noqa: E731
BOTH_LOW = lambda rel, grnd: rel <= 0.5 and grnd <= 0.5        # noqa: E731


def _load(path: str) -> dict[tuple[str, str], dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return {(r["model"], r["prompt_id"]): r for r in csv.DictReader(f)}


def _score(row: dict, col: str) -> float | None:
    try:
        v = float(row.get(col, -1))
    except (TypeError, ValueError):
        return None
    return v if v >= 0 else None


def _pairs(rows: list[dict]) -> list[tuple[float, float]]:
    out = []
    for r in rows:
        rel, grnd = _score(r, "judge_relevance"), _score(r, "judge_groundedness")
        if rel is not None and grnd is not None:
            out.append((rel, grnd))
    return out


def _stats(rows: list[dict]) -> dict:
    pairs = _pairs(rows)
    if not pairs:
        return {}
    return {
        "n": len(pairs),
        "rel": statistics.mean(a for a, _ in pairs),
        "grnd": statistics.mean(b for _, b in pairs),
        "composite": statistics.mean(a * b for a, b in pairs),
        "confident": sum(1 for a, b in pairs if CONFIDENT(a, b)),
        "qualified": sum(1 for a, b in pairs if QUALIFIED(a, b)),
        "both_low": sum(1 for a, b in pairs if BOTH_LOW(a, b)),
    }


def _delta(before: float, after: float, places: int = 3) -> str:
    d = after - before
    if abs(d) < 10 ** -places / 2:
        return f"{'—':>8}"
    return f"{d:>+8.{places}f}"


def _variant(rows: dict) -> str:
    names = {r.get("prompt_variant", "") for r in rows.values()} - {""}
    return "/".join(sorted(names)) if names else "unrecorded"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("before", help="baseline CSV")
    ap.add_argument("after", help="CSV to compare against it")
    ap.add_argument("--models", nargs="*", help="limit to these models")
    args = ap.parse_args()

    before, after = _load(args.before), _load(args.after)

    models_b = {m for m, _ in before}
    models_a = {m for m, _ in after}
    shared = sorted(models_b & models_a)
    if args.models:
        shared = [m for m in shared if m in args.models]
    if not shared:
        print("No models in common between the two runs.")
        return 2

    print(f"before: {args.before}  (prompt: {_variant(before)})")
    print(f"after:  {args.after}  (prompt: {_variant(after)})")
    only_b, only_a = sorted(models_b - models_a), sorted(models_a - models_b)
    if only_b:
        print(f"  not compared, missing from 'after': {', '.join(only_b)}")
    if only_a:
        print(f"  not compared, missing from 'before': {', '.join(only_a)}")
    print()

    head = (f"{'model':<24}{'confident+':>12}{'qualified':>11}{'both low':>10}"
            f"{'rel':>9}{'grnd':>9}{'composite':>11}")
    print(head)
    print("-" * len(head))

    totals = defaultdict(lambda: [0, 0])
    for m in shared:
        b = _stats([r for (mm, _), r in before.items() if mm == m])
        a = _stats([r for (mm, _), r in after.items() if mm == m])
        if not b or not a:
            continue
        for key in ("confident", "qualified", "both_low"):
            totals[key][0] += b[key]
            totals[key][1] += a[key]
        conf = f"{b['confident']}->{a['confident']}"
        qual = f"{b['qualified']}->{a['qualified']}"
        low = f"{b['both_low']}->{a['both_low']}"
        print(f"{m:<24}{conf:>12}{qual:>11}{low:>10}"
              f"{_delta(b['rel'], a['rel'])}{_delta(b['grnd'], a['grnd'])}"
              f"{_delta(b['composite'], a['composite']):>11}")

    print("\nTOTALS")
    for key, label in (("confident", "confident+ (the risky one, want this down)"),
                       ("qualified", "qualified   (honest refusals, some rise is fine)"),
                       ("both_low", "both low    (want this flat; a rise means over-refusal)")):
        b, a = totals[key]
        arrow = "down" if a < b else ("up" if a > b else "flat")
        print(f"  {label:<52} {b:>4} -> {a:<4} ({arrow})")

    # --- prompts that flipped, which is where the mechanism shows ---
    flipped_out, flipped_in = [], []
    for key in set(before) & set(after):
        rb, ra = before[key], after[key]
        pb = (_score(rb, "judge_relevance"), _score(rb, "judge_groundedness"))
        pa = (_score(ra, "judge_relevance"), _score(ra, "judge_groundedness"))
        if None in pb or None in pa:
            continue
        was, now = CONFIDENT(*pb), CONFIDENT(*pa)
        if was and not now:
            flipped_out.append((key, pb, pa))
        elif now and not was:
            flipped_in.append((key, pb, pa))

    if flipped_out:
        print(f"\nLEFT the confident+ quadrant ({len(flipped_out)}) — the intended effect")
        for (m, pid), pb, pa in sorted(flipped_out):
            print(f"  {pid:<8} {m:<24} rel {pb[0]:.2f}->{pa[0]:.2f}  grnd {pb[1]:.2f}->{pa[1]:.2f}")
    if flipped_in:
        print(f"\nENTERED the confident+ quadrant ({len(flipped_in)}) — regressions")
        for (m, pid), pb, pa in sorted(flipped_in):
            print(f"  {pid:<8} {m:<24} rel {pb[0]:.2f}->{pa[0]:.2f}  grnd {pb[1]:.2f}->{pa[1]:.2f}")
    if not flipped_out and not flipped_in:
        print("\nNo prompt changed quadrant. Whatever moved, it was not this.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
