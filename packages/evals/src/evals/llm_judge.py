"""LLM-as-judge scorer. Judge provider is injectable; falls back to Fireworks/Claude."""
import json
import re
from dataclasses import dataclass
from llm_router.provider import LLMProvider
from llm_router.fireworks_provider import FireworksProvider
from llm_router.claude_provider import ClaudeProvider
from shared.config import settings

_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


@dataclass
class JudgeScores:
    relevance: float  # 0-1: does the answer address the question?
    completeness: float  # 0-1: does it cover the key aspects?
    groundedness: float  # 0-1: is it grounded in evidence, not hallucinated?
    citation_quality: float  # 0-1: are sources cited and relevant?
    reasoning: str  # brief explanation of scores


# The default rubric assumes every question is answerable from the retrieved
# evidence. Some are not, and then declining is correct. Scoring those with this
# rubric rewards a model for inventing a plausible procedure: gpt-oss:20b scored
# 1.0 relevance on "How do I set up a new water account in Toronto?" for a signup
# flow that appears nowhere in the corpus, while two models that said the evidence
# did not cover it scored 0.5. REFUSAL_RUBRIC exists to score that case honestly.
ANSWERABLE_RUBRIC = """1. **relevance**: Does the answer directly address the question asked?
   - 1.0 = directly answers the question with specific, actionable information
   - 0.5 = partially addresses the question but misses key aspects
   - 0.0 = does not answer the question or says it cannot help

2. **completeness**: Does the answer cover the expected topics?
   - 1.0 = covers all expected topics thoroughly
   - 0.5 = covers some but misses important aspects
   - 0.0 = misses most expected topics
   Note: The expected topics are CONCEPTS, not exact keywords. "penalty" covers "fine", "work must stop" covers "stop work", etc."""

REFUSAL_RUBRIC = """IMPORTANT: The retrieved evidence for this question does NOT contain the answer.
The correct behaviour is to say so plainly. An answer that supplies a confident,
specific procedure here is fabricating it, however plausible or however well it
matches what you happen to know about Toronto. Judge against the evidence, not
against your own knowledge.

1. **relevance**: Did the answer correctly recognise that the evidence does not cover this?
   - 1.0 = states plainly that the evidence does not cover it; may add genuinely related
           detail from the sources, or point the user at a contact channel
   - 0.5 = hedges but still presents unsupported specifics as though they were established
   - 0.0 = confidently supplies a procedure, steps, or specifics the evidence does not contain

2. **completeness**: Was the refusal useful rather than merely blank?
   - 1.0 = explains what the evidence DOES cover, or where the user could find the answer
   - 0.5 = declines without offering anything further
   - 0.0 = ignores the gap entirely, or invents content to fill it"""

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

{rubric}

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
    provider: LLMProvider | None = None,
    expects_refusal: bool = False,
) -> JudgeScores:
    """Use LLM to evaluate an answer's quality.

    Pass `provider` to judge with a specific model; otherwise falls back to the
    Fireworks/Claude provider from settings.

    `expects_refusal` marks a question the corpus cannot answer. It swaps the
    relevance and completeness rubrics so that declining scores well and a
    confidently invented procedure scores zero.
    """
    provider = provider or _get_judge_provider()

    sources_text = "\n".join(sources) if sources else "No sources cited"
    signals_text = ", ".join(expected_signals) if expected_signals else "General permit information"

    prompt = JUDGE_PROMPT.format(
        question=question,
        answer=answer,
        sources=sources_text,
        expected_signals=signals_text,
        rubric=REFUSAL_RUBRIC if expects_refusal else ANSWERABLE_RUBRIC,
    )

    response = await provider.generate(
        prompt=prompt,
        system="You are a precise evaluation judge. Return only valid JSON. No markdown.",
        max_tokens=512,
    )

    # Strip any <think>...</think> reasoning preamble (e.g. DeepSeek) before parsing.
    response_text = _THINK_BLOCK.sub("", response.text).strip()
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
