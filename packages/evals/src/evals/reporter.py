"""Generate eval reports."""
from evals.models import EvalScore


def print_report(results_by_model: dict[str, list[EvalScore]], run_label: str):
    """Print a formatted eval report to stdout.

    Accepts a dict of model_name -> scores. For single-model runs,
    prints the detailed per-prompt report. For multi-model runs,
    prints per-model detail plus a comparison summary.
    """
    for model_name, scores in results_by_model.items():
        _print_model_report(scores, f"{run_label} / {model_name}")

    if len(results_by_model) > 1:
        _print_comparison(results_by_model, run_label)


def _print_model_report(scores: list[EvalScore], label: str):
    """Print detailed report for a single model."""
    has_judge = any(s.judge_relevance >= 0 for s in scores)

    print(f"\n{'='*100}")
    print(f"EVALUATION REPORT: {label}")
    print(f"{'='*100}")

    if has_judge:
        print(f"{'ID':<7} {'Signal':<8} {'J-Rel':<7} {'J-Comp':<8} {'J-Grnd':<8} {'J-Cite':<8} {'Lat':<7} {'Reasoning'}")
        print(f"{'-'*7} {'-'*8} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*7} {'-'*40}")
    else:
        print(f"{'Prompt ID':<10} {'Category':<12} {'Relevance':<10} {'Citation':<10} {'Latency':<10} {'Model'}")
        print(f"{'-'*10} {'-'*12} {'-'*10} {'-'*10} {'-'*10} {'-'*20}")

    totals = {
        "signal": 0, "j_rel": 0, "j_comp": 0, "j_grnd": 0, "j_cite": 0,
        "citation": 0, "latency": 0,
    }

    for s in scores:
        totals["signal"] += s.relevance_score
        totals["citation"] += s.citation_score
        totals["latency"] += s.latency_ms

        if has_judge:
            totals["j_rel"] += max(s.judge_relevance, 0)
            totals["j_comp"] += max(s.judge_completeness, 0)
            totals["j_grnd"] += max(s.judge_groundedness, 0)
            totals["j_cite"] += max(s.judge_citation, 0)

            reasoning = s.judge_reasoning[:50] if s.judge_reasoning else ""
            print(
                f"{s.prompt_id:<7} "
                f"{s.relevance_score:<8.2f} "
                f"{s.judge_relevance:<7.2f} "
                f"{s.judge_completeness:<8.2f} "
                f"{s.judge_groundedness:<8.2f} "
                f"{s.judge_citation:<8.2f} "
                f"{s.latency_ms:<7} "
                f"{reasoning}"
            )
        else:
            category = s.prompt_id.replace("bp-", "")
            print(f"{s.prompt_id:<10} {category:<12} {s.relevance_score:<10.2f} {s.citation_score:<10.2f} {s.latency_ms:<10} {s.model_used}")

    n = len(scores) or 1

    if has_judge:
        print(f"\n{'AVG':<7} "
              f"{totals['signal']/n:<8.2f} "
              f"{totals['j_rel']/n:<7.2f} "
              f"{totals['j_comp']/n:<8.2f} "
              f"{totals['j_grnd']/n:<8.2f} "
              f"{totals['j_cite']/n:<8.2f} "
              f"{totals['latency']//n:<7}")
        print(f"\nColumns: Signal=keyword match, J-Rel=judge relevance, J-Comp=judge completeness,")
        print(f"         J-Grnd=judge groundedness, J-Cite=judge citation quality")
    else:
        print(f"\n{'AVERAGES':<10} {'':12} {totals['signal']/n:<10.2f} {totals['citation']/n:<10.2f} {totals['latency']//n:<10}")

    print(f"{'='*100}")


def _print_comparison(results_by_model: dict[str, list[EvalScore]], run_label: str):
    """Print a side-by-side comparison table for multi-model runs."""
    has_judge = any(
        s.judge_relevance >= 0
        for scores in results_by_model.values()
        for s in scores
    )

    print(f"\n{'='*100}")
    print(f"MODEL COMPARISON: {run_label}")
    print(f"{'='*100}")

    if has_judge:
        print(f"{'Model':<20} {'Signal':<8} {'J-Rel':<7} {'J-Comp':<8} {'J-Grnd':<8} {'J-Cite':<8} {'Avg Lat':<8} {'Errors'}")
        print(f"{'-'*20} {'-'*8} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*7}")
    else:
        print(f"{'Model':<20} {'Signal':<10} {'Citation':<10} {'Avg Lat':<10} {'Errors'}")
        print(f"{'-'*20} {'-'*10} {'-'*10} {'-'*10} {'-'*7}")

    for model_name, scores in results_by_model.items():
        n = len(scores) or 1
        errors = sum(1 for s in scores if s.model_used == "error")

        avg_signal = sum(s.relevance_score for s in scores) / n
        avg_citation = sum(s.citation_score for s in scores) / n
        avg_latency = sum(s.latency_ms for s in scores) // n

        if has_judge:
            avg_j_rel = sum(max(s.judge_relevance, 0) for s in scores) / n
            avg_j_comp = sum(max(s.judge_completeness, 0) for s in scores) / n
            avg_j_grnd = sum(max(s.judge_groundedness, 0) for s in scores) / n
            avg_j_cite = sum(max(s.judge_citation, 0) for s in scores) / n
            print(
                f"{model_name:<20} "
                f"{avg_signal:<8.2f} "
                f"{avg_j_rel:<7.2f} "
                f"{avg_j_comp:<8.2f} "
                f"{avg_j_grnd:<8.2f} "
                f"{avg_j_cite:<8.2f} "
                f"{avg_latency:<8} "
                f"{errors}"
            )
        else:
            print(f"{model_name:<20} {avg_signal:<10.2f} {avg_citation:<10.2f} {avg_latency:<10} {errors}")

    print(f"{'='*100}")
