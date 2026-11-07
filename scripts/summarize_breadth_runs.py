"""Tabulate every breadth-eval run in a directory: recall and search latency.

    uv run python scripts/summarize_breadth_runs.py
    uv run python scripts/summarize_breadth_runs.py evals --sort latency

Each run writes its own CSV, so a comparison of four index configurations means
four files whose summaries have scrolled off the screen by the time the last one
finishes. This reads them back.

Runs from before search_ms was recorded are listed with their recall and no
timing, rather than skipped: a missing column is not a missing run.
"""
import argparse
import csv
import glob
import os
import statistics


def _pct(values: list[float], p: float) -> float:
    """Nearest-rank percentile. Small n here, so no interpolation."""
    k = max(0, min(len(values) - 1, int(round(p / 100 * (len(values) - 1)))))
    return values[k]


# A breadth run's rows carry these. Other CSVs live in evals/ too — model
# comparisons, retrieval experiments — and they have neither, so every row scores
# as a miss and they arrive in the table as a wall of 0.0%. A file that cannot be
# a breadth run is not a breadth run with no hits.
REQUIRED = {"url", "rank"}


def _read(path: str):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not REQUIRED.issubset(set(reader.fieldnames or ())):
            return None
        rows = list(reader)
    scored = [r for r in rows if not r.get("error")]
    hits = [r for r in scored if r.get("rank")]
    timings = sorted(float(r["search_ms"]) for r in scored if r.get("search_ms"))
    return {
        "name": os.path.basename(path),
        "scored": len(scored),
        "errors": len(rows) - len(scored),
        "hits": len(hits),
        "recall": len(hits) / len(scored) if scored else 0.0,
        "mean_rank": statistics.mean(int(r["rank"]) for r in hits) if hits else 0.0,
        "timings": timings,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("directory", nargs="?", default="evals", help="where the CSVs are")
    ap.add_argument("--sort", choices=["name", "recall", "latency"], default="name")
    args = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(args.directory, "*.csv")))
    if not paths:
        print(f"No CSVs in {args.directory}/")
        return 2

    runs = [r for r in (_read(p) for p in paths) if r is not None]
    skipped = len(paths) - len(runs)
    if not runs:
        print(f"No breadth runs among the {len(paths)} CSVs in {args.directory}/. "
              "A breadth run has url and rank columns.")
        return 2
    if args.sort == "recall":
        runs.sort(key=lambda r: -r["recall"])
    elif args.sort == "latency":
        # Runs without timings sort last rather than first, which is what sorting
        # by a missing value as zero would do.
        runs.sort(key=lambda r: statistics.median(r["timings"]) if r["timings"] else float("inf"))

    if skipped:
        # Above the table, not below it. The point of counting skips is that a run
        # missing from a comparison is worse than a noisy table, and a notice under
        # forty rows of output is one nobody reads before drawing a conclusion from
        # the rows above it.
        print(f"{skipped} CSV(s) skipped: no url/rank columns, so not breadth runs.\n")

    width = max(len(r["name"]) for r in runs)
    print(f"{'run':<{width}}  {'recall':>15}  {'rank':>5}  "
          f"{'p50':>7}  {'p95':>7}  {'max':>7}")
    print("-" * (width + 50))
    for r in runs:
        recall = f"{r['hits']}/{r['scored']} = {r['recall']:.1%}"
        rank = f"{r['mean_rank']:.2f}" if r["hits"] else "-"
        if r["timings"]:
            t = r["timings"]
            lat = (f"{statistics.median(t):>6.0f}ms  {_pct(t, 95):>6.0f}ms  {t[-1]:>6.0f}ms")
        else:
            lat = f"{'-':>7}  {'-':>7}  {'-':>7}"
        print(f"{r['name']:<{width}}  {recall:>15}  {rank:>5}  {lat}")

    print("\nRecall is comparable only across runs that used the same --urls and")
    print("--questions. Latency includes the network path to the store, so it")
    print("compares deployments rather than index implementations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
