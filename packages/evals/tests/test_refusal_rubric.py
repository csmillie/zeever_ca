"""Questions the corpus cannot answer must score the refusal, not the answer.

The default relevance rubric ends with "0.0 = does not answer the question or says
it cannot help". On a question with no supporting evidence that scores honesty at
zero and fabrication at one: in the 2026-08-29 run, gpt-oss:20b scored 1.00
relevance for inventing a water-account signup flow while two models that said the
evidence did not cover it scored 0.50. These pin the corrected behaviour.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from evals.llm_judge import ANSWERABLE_RUBRIC, REFUSAL_RUBRIC, judge_answer
from evals.models import BenchmarkPrompt
from evals.prompts import BENCHMARK_PROMPTS


def _judge(payload='{"relevance": 1.0, "completeness": 1.0, "groundedness": 1.0, '
                   '"citation_quality": 1.0, "reasoning": "ok"}'):
    provider = MagicMock()
    provider.generate = AsyncMock(return_value=MagicMock(text=payload))
    return provider


async def _prompt_sent(expects_refusal: bool) -> str:
    provider = _judge()
    await judge_answer("q", "a", [], ["x"], provider=provider, expects_refusal=expects_refusal)
    return provider.generate.call_args.kwargs["prompt"]


@pytest.mark.asyncio
async def test_default_keeps_the_answerable_rubric():
    sent = await _prompt_sent(expects_refusal=False)
    assert "directly answers the question with specific, actionable information" in sent
    assert "does NOT contain the answer" not in sent


@pytest.mark.asyncio
async def test_refusal_rubric_replaces_it():
    sent = await _prompt_sent(expects_refusal=True)
    assert "does NOT contain the answer" in sent
    assert "directly answers the question with specific, actionable information" not in sent


@pytest.mark.asyncio
async def test_refusal_rubric_scores_a_confident_answer_at_zero():
    """The inversion is the whole point: fabrication must be the 0.0 case."""
    sent = await _prompt_sent(expects_refusal=True)
    zero_line = next(l for l in sent.splitlines() if l.strip().startswith("- 0.0 ="))
    assert "confidently supplies a procedure" in zero_line


@pytest.mark.asyncio
async def test_refusal_rubric_tells_the_judge_to_ignore_its_own_knowledge():
    """A judge that knows Toronto would otherwise pass a plausible invention."""
    sent = await _prompt_sent(expects_refusal=True)
    assert "Judge against the evidence, not" in sent


def test_the_two_rubrics_are_not_the_same_text():
    assert ANSWERABLE_RUBRIC != REFUSAL_RUBRIC
    for rubric in (ANSWERABLE_RUBRIC, REFUSAL_RUBRIC):
        assert "**relevance**" in rubric
        assert "**completeness**" in rubric
        # groundedness and citation stay in the shared body and must not be duplicated.
        assert "**groundedness**" not in rubric


def test_flag_defaults_to_false():
    bp = BenchmarkPrompt(id="x", prompt="p", category="c", expected_signals=[])
    assert bp.expects_refusal is False


def test_no_prompt_currently_carries_the_flag():
    """bp-35, bp-57 and bp-70 were flagged and then unflagged.

    Each looked unanswerable because nothing in the corpus answered it. All three
    are answered on toronto.ca, in the 311 knowledge base, which the crawler has
    never fetched: toronto.ca/sitemap.xml lists eight WordPress page sitemaps and
    nothing else. The flags were recording a crawl gap as a content gap.

    The rubric stays, because the scoring bug it fixes is real — judge_relevance
    scores "the evidence does not cover this" at 0.0. But a flag is a claim that
    toronto.ca does not publish an answer, and that has to be checked against
    toronto.ca rather than against our own index.
    """
    flagged = [p.id for p in BENCHMARK_PROMPTS if p.expects_refusal]
    assert flagged == []


@pytest.mark.asyncio
async def test_scores_still_parse_under_the_refusal_rubric():
    provider = _judge('{"relevance": 1.0, "completeness": 0.5, "groundedness": 1.0, '
                      '"citation_quality": 0.5, "reasoning": "declined correctly"}')
    scores = await judge_answer("q", "cannot help", [], ["x"],
                                provider=provider, expects_refusal=True)
    assert (scores.relevance, scores.completeness) == (1.0, 0.5)
    assert scores.reasoning == "declined correctly"
