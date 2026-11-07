"""Summarize a retrieval_experiment_*.csv into a per-arm comparison table.

Usage:
    uv run python scripts/summarize_retrieval.py            # newest CSV
    uv run python scripts/summarize_retrieval.py path.csv
"""
import csv
import glob
import statistics
import sys
from collections import OrderedDict


def pct(xs, p):
    if not xs:
        return 0
    xs = sorted(xs)
    k = max(0, min(len(xs) - 1, int(round((p / 100) * (len(xs) - 1)))))
    return xs[k]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob("evals/retrieval_experiment_*.csv"))[-1]
    rows = list(csv.DictReader(open(path)))
    print(f"{path}  ({len(rows)} rows)\n")

    by_arm = OrderedDict()
    for r in rows:
        by_arm.setdefault(r["arm"], []).append(r)

    # chunk sets per (arm, prompt) for overlap vs arm A
    chunk_sets = {(r["arm"], r["prompt_id"]): set(filter(None, r["chunk_ids"].split("; "))) for r in rows}
    prompts = sorted({r["prompt_id"] for r in rows})

    hdr = f"{'arm':<4}{'backend/mode':<20}{'mesh':<6}{'err':>4}{'jRel':>7}{'jComp':>7}{'jGrnd':>7}{'jCite':>7}{'p50ms':>7}{'p95ms':>7}{'ovlpA':>7}"
    print(hdr)
    print("-" * len(hdr))
    for arm, rs in by_arm.items():
        judged = [r for r in rs if float(r["judge_relevance"]) >= 0]
        err = sum(1 for r in rs if r["answer"].startswith("ERROR"))

        def avg(k):
            return statistics.mean(float(r[k]) for r in judged) if judged else 0

        # Exclude error rows (search_ms=0) so they don't skew latency percentiles,
        # mirroring the judged-rows filter used for the score averages above.
        lat = [int(r["search_ms"]) for r in rs if not r["answer"].startswith("ERROR")]
        # mean chunk overlap vs arm A on the same prompt
        ov = []
        for pid in prompts:
            a = chunk_sets.get(("A", pid), set())
            b = chunk_sets.get((arm, pid), set())
            if a or b:
                ov.append(len(a & b) / max(len(a | b), 1))
        meta = f"{rs[0]['backend']}/{rs[0]['mode']}"
        print(f"{arm:<4}{meta:<20}{rs[0]['mesh']:<6}{err:>4}"
              f"{avg('judge_relevance'):>7.3f}{avg('judge_completeness'):>7.3f}"
              f"{avg('judge_groundedness'):>7.3f}{avg('judge_citation'):>7.3f}"
              f"{pct(lat,50):>7}{pct(lat,95):>7}{statistics.mean(ov) if ov else 0:>7.2f}")


if __name__ == "__main__":
    main()
