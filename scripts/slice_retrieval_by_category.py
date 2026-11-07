"""Compare two arms of a retrieval experiment per category.

Answers questions like: does the graph mesh (arm E) beat no-mesh (arm C) on the
building-permit / process questions specifically, even if it's flat overall?

Usage:
    uv run python scripts/slice_retrieval_by_category.py             # C vs E, newest CSV
    uv run python scripts/slice_retrieval_by_category.py --arms A B
    uv run python scripts/slice_retrieval_by_category.py path.csv --arms C E
"""
import argparse
import csv
import glob
import statistics
from collections import defaultdict

DIMS = ["judge_relevance", "judge_completeness", "judge_groundedness", "judge_citation"]


def composite(row):
    return statistics.mean(float(row[d]) for d in DIMS)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("csv", nargs="?")
    p.add_argument("--arms", nargs=2, default=["C", "E"], metavar=("ARM1", "ARM2"))
    args = p.parse_args()
    path = args.csv or sorted(glob.glob("evals/retrieval_experiment_*.csv"))[-1]
    a1, a2 = args.arms

    rows = list(csv.DictReader(open(path)))
    scores = defaultdict(list)  # (arm, category) -> [composite, ...], judged rows only
    for r in rows:
        if r["arm"] in (a1, a2) and float(r["judge_relevance"]) >= 0:
            scores[(r["arm"], r["category"])].append(composite(r))

    cats = sorted({c for (_, c) in scores})
    print(f"{path}\nComposite judge score by category: {a2} vs {a1}  (delta = {a2} - {a1})\n")
    hdr = f"{'category':<20}{'n':>4}{a1:>9}{a2:>9}{'delta':>9}"
    print(hdr)
    print("-" * len(hdr))
    for c in cats:
        s1, s2 = scores.get((a1, c), []), scores.get((a2, c), [])
        if not s1 or not s2:
            continue
        m1, m2 = statistics.mean(s1), statistics.mean(s2)
        flag = "  <==" if abs(m2 - m1) >= 0.02 else ""
        print(f"{c:<20}{len(s2):>4}{m1:>9.3f}{m2:>9.3f}{m2 - m1:>+9.3f}{flag}")

    all1 = [v for (a, _), vs in scores.items() if a == a1 for v in vs]
    all2 = [v for (a, _), vs in scores.items() if a == a2 for v in vs]
    print("-" * len(hdr))
    print(f"{'ALL':<20}{len(all2):>4}{statistics.mean(all1):>9.3f}"
          f"{statistics.mean(all2):>9.3f}{statistics.mean(all2) - statistics.mean(all1):>+9.3f}")
    print("\n(<== marks categories where |delta| >= 0.02)")


if __name__ == "__main__":
    main()
