def score_signal_coverage(answer: str, expected_signals: list[str]) -> float:
    """What fraction of expected signals appear in the answer."""
    if not expected_signals:
        return 1.0
    answer_lower = answer.lower()
    hits = sum(1 for signal in expected_signals if signal.lower() in answer_lower)
    return hits / len(expected_signals)

def score_source_coverage(cited_sources: list[str], expected_sources: list[str]) -> float:
    """What fraction of expected source URL fragments appear in cited sources."""
    if not expected_sources:
        return 1.0
    hits = 0
    for expected in expected_sources:
        if any(expected in source for source in cited_sources):
            hits += 1
    return hits / len(expected_sources)

def score_groundedness(answer: str, context_texts: list[str]) -> float:
    """Rough proxy for groundedness. Upgrade to LLM-as-judge later."""
    if not context_texts:
        return 0.0
    # Simple heuristic: check if key phrases from context appear in answer
    context_combined = " ".join(context_texts).lower()
    answer_words = set(answer.lower().split())
    context_words = set(context_combined.split())
    if not answer_words:
        return 0.0
    overlap = len(answer_words & context_words)
    return min(overlap / len(answer_words), 1.0)
