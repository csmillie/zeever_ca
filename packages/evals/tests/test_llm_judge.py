import pytest
import json
from unittest.mock import AsyncMock, patch
from evals.llm_judge import judge_answer, JudgeScores
from llm_router.provider import LLMResponse


MOCK_JUDGE_RESPONSE = json.dumps({
    "relevance": 0.9,
    "completeness": 0.8,
    "groundedness": 0.95,
    "citation_quality": 0.7,
    "reasoning": "Answer directly addresses the question with specific Toronto permit info."
})


@pytest.mark.asyncio
async def test_judge_answer_parses_response():
    mock_provider = AsyncMock()
    mock_provider.generate.return_value = LLMResponse(
        text=MOCK_JUDGE_RESPONSE,
        model="deepseek-v3",
        input_tokens=500,
        output_tokens=100,
    )

    with patch("evals.llm_judge._get_judge_provider", return_value=mock_provider):
        scores = await judge_answer(
            question="Do I need a permit for a deck?",
            answer="Yes, you need a building permit for a deck in Toronto.",
            sources=["https://toronto.ca/permits"],
            expected_signals=["permit", "deck"],
        )

    assert scores.relevance == 0.9
    assert scores.completeness == 0.8
    assert scores.groundedness == 0.95
    assert scores.citation_quality == 0.7
    assert "directly addresses" in scores.reasoning


@pytest.mark.asyncio
async def test_judge_handles_markdown_wrapped_json():
    mock_provider = AsyncMock()
    mock_provider.generate.return_value = LLMResponse(
        text=f"```json\n{MOCK_JUDGE_RESPONSE}\n```",
        model="deepseek-v3",
        input_tokens=500,
        output_tokens=100,
    )

    with patch("evals.llm_judge._get_judge_provider", return_value=mock_provider):
        scores = await judge_answer(
            question="Test?",
            answer="Test answer.",
            sources=[],
            expected_signals=["test"],
        )

    assert scores.relevance == 0.9


@pytest.mark.asyncio
async def test_judge_handles_bad_json():
    mock_provider = AsyncMock()
    mock_provider.generate.return_value = LLMResponse(
        text="This is not valid JSON at all",
        model="deepseek-v3",
        input_tokens=500,
        output_tokens=50,
    )

    with patch("evals.llm_judge._get_judge_provider", return_value=mock_provider):
        scores = await judge_answer(
            question="Test?",
            answer="Test.",
            sources=[],
            expected_signals=[],
        )

    assert scores.relevance == 0.0
    assert "Failed to parse" in scores.reasoning


def test_judge_scores_dataclass():
    scores = JudgeScores(
        relevance=0.8,
        completeness=0.7,
        groundedness=0.9,
        citation_quality=0.6,
        reasoning="Good answer.",
    )
    assert scores.relevance == 0.8
