from evals.models import BenchmarkPrompt, EvalScore
from evals.benchmark import FIREWORKS_MODELS, SMALL_MODELS

def test_benchmark_prompt_model():
    bp = BenchmarkPrompt(
        id="test-01",
        prompt="Test question?",
        category="test",
        expected_signals=["answer"],
    )
    assert bp.id == "test-01"
    assert bp.expected_sources == []

def test_eval_score_model():
    score = EvalScore(
        prompt_id="test-01",
        prompt_text="Test?",
        answer="Answer here",
        sources_cited=["https://example.com"],
        relevance_score=0.75,
        citation_score=1.0,
        groundedness=0.8,
        latency_ms=500,
        model_used="claude",
    )
    assert score.relevance_score == 0.75
    assert score.cost_usd == 0.0

def test_fireworks_models_registry():
    # Original 7 comparison models
    assert "gpt-oss-120b" in FIREWORKS_MODELS
    assert "kimi-k2.5" in FIREWORKS_MODELS
    assert "glm-5" in FIREWORKS_MODELS
    assert "deepseek-v3.2" in FIREWORKS_MODELS
    assert "mixtral-8x22b" in FIREWORKS_MODELS
    assert "glm-4.7" in FIREWORKS_MODELS
    assert "deepseek-v3.1" in FIREWORKS_MODELS
    # Smaller alternative models
    assert "qwen3-8b" in FIREWORKS_MODELS
    assert "llama3.3-70b" in FIREWORKS_MODELS
    assert len(FIREWORKS_MODELS) == 9
    for name, model_id in FIREWORKS_MODELS.items():
        assert model_id.startswith("accounts/fireworks/models/")

def test_small_models_are_valid():
    assert len(SMALL_MODELS) == 2
    for name in SMALL_MODELS:
        assert name in FIREWORKS_MODELS, f"{name} not in FIREWORKS_MODELS"
