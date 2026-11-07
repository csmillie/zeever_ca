"""Summarize a model_comparison_*.csv into a compact per-model table.

Usage:
    uv run python scripts/summarize_eval.py                # newest CSV in evals/
    uv run python scripts/summarize_eval.py path/to.csv    # a specific CSV
"""
import csv
import glob
import sys
from collections import OrderedDict


def main() -> None:
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        files = sorted(glob.glob("evals/model_comparison_*.csv"))
        if not files:
            print("No evals/model_comparison_*.csv found.")
            return
        path = files[-1]

    rows = list(csv.DictReader(open(path)))
    print(f"{path}  ({len(rows)} rows)\n")

    agg = OrderedDict()
    for r in rows:
        m = r["model"]
        d = agg.setdefault(
            m, {"ok": 0, "err": 0, "sig": 0.0, "jrel": 0.0, "jcomp": 0.0,
                "jgr": 0.0, "jcite": 0.0, "lat": 0, "cost": 0.0, "jn": 0}
        )
        if r["answer"].startswith("ERROR"):
            d["err"] += 1
        else:
            d["ok"] += 1
        d["sig"] += float(r["signal_relevance"])
        d["lat"] += int(r["latency_ms"])
        d["cost"] += float(r["cost_usd"])
        if float(r["judge_relevance"]) >= 0:
            d["jrel"] += float(r["judge_relevance"])
            d["jcomp"] += float(r["judge_completeness"])
            d["jgr"] += float(r["judge_groundedness"])
            d["jcite"] += float(r["judge_citation"])
            d["jn"] += 1

    header = (
        f"{'model':<14}{'ok':>4}{'err':>5}{'sigRel':>8}"
        f"{'jRel':>7}{'jComp':>7}{'jGrnd':>7}{'jCite':>7}{'avgMs':>8}{'cost$':>9}"
    )
    print(header)
    print("-" * len(header))
    for m, d in agg.items():
        n = d["ok"] + d["err"] or 1
        jn = d["jn"] or 1
        print(
            f"{m:<14}{d['ok']:>4}{d['err']:>5}{d['sig'] / n:>8.3f}"
            f"{d['jrel'] / jn:>7.3f}{d['jcomp'] / jn:>7.3f}{d['jgr'] / jn:>7.3f}{d['jcite'] / jn:>7.3f}"
            f"{d['lat'] // n:>8}{d['cost']:>9.4f}"
        )


if __name__ == "__main__":
    main()
