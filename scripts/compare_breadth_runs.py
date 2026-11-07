"""Compare two breadth-eval runs as the paired experiment they are.

    uv run python scripts/compare_breadth_runs.py before.csv after.csv
    uv run python scripts/compare_breadth_runs.py before.csv after.csv --show 30

When both runs used the same --urls and the same --questions, every page was
asked an identical question twice. That is a paired design, and a net change is
the wrong way to read it: plus seven could be seven gained and none lost, which is
convincing, or twenty-two gained and fifteen lost, which is churn.

McNemar's test uses only the pages that disagree between the runs, which is the
information a net figure discards. Pages that were found both times, or missed
both times, tell you nothing about the change.

It also refuses to compare runs that do not share their pages, since a difference
between two different samples is not a result.
"""
import argparse
import csv
import math
from collections import Counter


def _load(path: str) -> dict[str, bool | None]:
    """url -> found, or None when the run errored on that page."""
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["url"]] = None if row.get("error") else bool(row.get("rank"))
    return out


def _ranks(path: str) -> dict[str, int]:
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("rank"):
                out[row["url"]] = int(row["rank"])
    return out


def _mcnemar_p(b: int, c: int) -> float:
    """Two-sided exact p for the discordant pairs, via the binomial at p=0.5.

    Exact rather than the chi-square approximation because the counts here are
    small, and the approximation is unreliable below about 25 discordant pairs.
    """
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / (2 ** n)
    return min(1.0, 2 * tail)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("before")
    ap.add_argument("after")
    ap.add_argument("--show", type=int, default=15, help="how many flipped pages to list")
    args = ap.parse_args()

    before, after = _load(args.before), _load(args.after)
    shared = sorted(set(before) & set(after))
    if not shared:
        print("These runs share no pages. A difference between two different samples")
        print("is not a result. Re-run both with the same --urls file.")
        return 2

    only_b, only_a = len(set(before) - set(after)), len(set(after) - set(before))
    scored = [u for u in shared if before[u] is not None and after[u] is not None]

    print(f"before: {args.before}")
    print(f"after:  {args.after}")
    print(f"{len(shared)} pages in common, {len(scored)} scored in both runs"
          + (f", {only_b} only in before, {only_a} only in after" if only_b or only_a else ""))

    hits_b = sum(1 for u in scored if before[u])
    hits_a = sum(1 for u in scored if after[u])
    print(f"\nrecall  {hits_b}/{len(scored)} = {hits_b / len(scored):.1%}"
          f"   ->   {hits_a}/{len(scored)} = {hits_a / len(scored):.1%}"
          f"   ({hits_a - hits_b:+d})")

    gained = [u for u in scored if not before[u] and after[u]]
    lost = [u for u in scored if before[u] and not after[u]]
    p = _mcnemar_p(len(gained), len(lost))

    print(f"\nPAIRED COMPARISON (only the pages that disagree carry information)")
    print(f"  found only after   {len(gained):>4}")
    print(f"  found only before  {len(lost):>4}")
    print(f"  unchanged          {len(scored) - len(gained) - len(lost):>4}")
    print(f"\n  McNemar exact two-sided p = {p:.4f}")
    if p < 0.05:
        print("  The change is unlikely to be chance. It is still small; read the size,")
        print("  not just the verdict.")
    else:
        print("  Not distinguishable from chance on this sample. The change may be real")
        print("  and too small to detect here, but this run does not show it.")

    rb, ra = _ranks(args.before), _ranks(args.after)
    both = [u for u in scored if u in rb and u in ra]
    if both:
        mb = sum(rb[u] for u in both) / len(both)
        ma = sum(ra[u] for u in both) / len(both)
        moved = Counter("better" if ra[u] < rb[u] else "worse" if ra[u] > rb[u] else "same"
                        for u in both)
        print(f"\nRANK, for the {len(both)} pages found in both runs")
        print(f"  mean {mb:.2f} -> {ma:.2f}   ({ma - mb:+.2f})")
        print(f"  moved up {moved['better']}, down {moved['worse']}, unchanged {moved['same']}")

    for label, items in (("FOUND ONLY AFTER", gained), ("FOUND ONLY BEFORE", lost)):
        if not items:
            continue
        print(f"\n{label} ({len(items)})")
        for u in items[:args.show]:
            print(f"  {u[:104]}")
        if len(items) > args.show:
            print(f"  ... and {len(items) - args.show} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
