"""LLM-as-judge scorer using DeepSeek via Fireworks."""
import json
from dataclasses import dataclass
from llm_router.fireworks_provider import FireworksProvider
from llm_router.claude_provider import ClaudeProvider
from shared.config import settings


@dataclass
class JudgeScores:
    relevance: float  # 0-1: does the answer address the question?
    completeness: float  # 0-1: does it cover the key aspects?
    groundedness: float  # 0-1: is it grounded in evidence, not hallucinated?
    citation_quality: float  # 0-1: are sources cited and relevant?
    reasoning: str  # brief explanation of scores


JUDGE_PROMPT = """You are evaluating an AI assistant that answers questions about City of Toronto services using official Toronto.ca content.

## Question
{question}

## Expected Topics
The answer should cover these concepts (not exact words): {expected_signals}

## Answer Being Evaluated
{answer}

## Sources Cited
{sources}

## Scoring Instructions

Rate the answer on four dimensions, each from 0.0 to 1.0:

1. **relevance**: Does the answer directly address the question asked?
   - 1.0 = directly answers the question with specific, actionable information
   - 0.5 = partially addresses the question but misses key aspects
   - 0.0 = does not answer the question or says it cannot help

2. **completeness**: Does the answer cover the expected topics?
   - 1.0 = covers all expected topics thoroughly
   - 0.5 = covers some but misses important aspects
   - 0.0 = misses most expected topics
   Note: The expected topics are CONCEPTS, not exact keywords. "penalty" covers "fine", "work must stop" covers "stop work", etc.

3. **groundedness**: Is the answer grounded in evidence rather than hallucinated?
   - 1.0 = all claims appear supported and factual
   - 0.5 = mostly supported but some claims seem unsupported
   - 0.0 = appears to contain significant hallucination

4. **citation_quality**: Are sources cited and do they seem relevant?
   - 1.0 = sources are cited and appear relevant to the claims
   - 0.5 = some sources cited but incomplete
   - 0.0 = no sources cited or sources seem irrelevant

Return ONLY valid JSON:
{{"relevance": 0.0, "completeness": 0.0, "groundedness": 0.0, "citation_quality": 0.0, "reasoning": "brief explanation"}}
"""


def _get_judge_provider():
    """Get the LLM provider for judging."""
    if settings.fireworks_api_key:
        return FireworksProvider(
            api_key=settings.fireworks_api_key,
            base_url=settings.fireworks_base_url,
            model=settings.fireworks_model,
        )
    return ClaudeProvider(api_key=settings.anthropic_api_key)


async def judge_answer(
    question: str,
    answer: str,
    sources: list[str],
    expected_signals: list[str],
) -> JudgeScores:
    """Use LLM to evaluate an answer's quality."""
    provider = _get_judge_provider()

    sources_text = "\n".join(sources) if sources else "No sources cited"
    signals_text = ", ".join(expected_signals) if expected_signals else "General permit information"

    prompt = JUDGE_PROMPT.format(
        question=question,
        answer=answer,
        sources=sources_text,
        expected_signals=signals_text,
    )

    response = await provider.generate(
        prompt=prompt,
        system="You are a precise evaluation judge. Return only valid JSON. No markdown.",
        max_tokens=512,
    )

    response_text = response.text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        return JudgeScores(
            relevance=0.0,
            completeness=0.0,
            groundedness=0.0,
            citation_quality=0.0,
            reasoning=f"Failed to parse judge response: {response_text[:200]}",
        )

    return JudgeScores(
        relevance=float(data.get("relevance", 0)),
        completeness=float(data.get("completeness", 0)),
        groundedness=float(data.get("groundedness", 0)),
        citation_quality=float(data.get("citation_quality", 0)),
        reasoning=data.get("reasoning", ""),
    )
