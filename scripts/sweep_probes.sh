#!/usr/bin/env bash
#
# Sweep ivfflat.probes over the breadth eval, one run per value.
#
#   bash scripts/sweep_probes.sh                 # 10 20 40 80
#   bash scripts/sweep_probes.sh 40 60           # just these
#
# probes trades latency for recall against the index's lists (240, see
# db/migrations/005). Ten reads about 4% of the vectors: fast, and measured at
# 53% recall against 58.2% for the exact sequential scan it replaced. This finds
# where the recall comes back and what it costs.
#
# Exists as a script because the equivalent shell loop has been mangled by
# copy-paste four times: a lost character in IVFFLAT_PROBES silently runs the
# default, a stray semicolon silently runs the wrong backend, and a line break
# inside $(ls -t ...) built a filename out of the directory listing. Every one of
# those produced a plausible-looking run that measured the wrong thing.
set -euo pipefail

cd "$(dirname "$0")/.."

PAGES=evals/pages_3way.txt
QUESTIONS=evals/q_3way.json
PROBES=("${@:-}")
if [ -z "${PROBES[0]}" ]; then
    PROBES=(10 20 40 80)
fi

for f in "$PAGES" "$QUESTIONS"; do
    if [ ! -f "$f" ]; then
        echo "Missing $f. The sweep reuses one fixed page list and one fixed set of" >&2
        echo "questions so that probes is the only thing changing between runs." >&2
        exit 2
    fi
done

for p in "${PROBES[@]}"; do
    echo
    echo "=== probes=$p ==============================================="
    IVFFLAT_PROBES="$p" uv run python scripts/eval_retrieval_breadth.py \
        --urls "$PAGES" --questions "$QUESTIONS" --backend pgvector

    # Newest pgvector CSV, not a glob: evals/ holds several from earlier runs and
    # a glob would hand mv more than one argument.
    latest=$(ls -t evals/retrieval_breadth_pgvector_*.csv | head -1)
    mv "$latest" "evals/probes_${p}.csv"
    echo "-> evals/probes_${p}.csv"
done

echo
uv run python scripts/summarize_breadth_runs.py evals --sort recall
echo
echo "Compare any of these against the exact-scan baseline, which is the only"
echo "number that says whether the recall actually came back:"
echo "  uv run python scripts/compare_breadth_runs.py \\"
echo "    evals/retrieval_breadth_pgvector_20260906_013832.csv evals/probes_40.csv"
