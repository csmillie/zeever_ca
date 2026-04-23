# LLM-as-Judge Implementation Guide

Instructions for implementing the LLM-as-judge scoring pattern from Ask Toronto in another application.

## What this does

Uses an LLM (DeepSeek via Fireworks.ai) to evaluate the quality of AI-generated answers. Instead of brittle keyword matching, the judge understands synonyms and semantic equivalence — "penalty" matches "fine", "work must stop" matches "stop work order".

## The pattern

```
Input:
  - question: the user's original question
  - answer: the AI-generated answer to evaluate
  - sources: list of URLs or references cited in the answer
  - expected_signals: list of concept keywords the answer should cover

Output (all 0.0 to 1.0):
  - relevance: does the answer address the question?
  - completeness: does it cover the expected topics (semantically)?
  - groundedness: is it supported by evidence, not hallucinated?
  - citation_quality: are sources cited and relevant?
  - reasoning: brief text explanation of the scores
```

## Reference implementation

Source: `packages/evals/src/evals/llm_judge.py`

### The judge prompt

This is the core of the system. It must:
1. Provide the question, answer, sources, and expected topics
2. Define each scoring dimension with concrete examples at 0.0, 0.5, and 1.0
3. Explicitly state that expected topics are CONCEPTS not exact keywords (this is what makes it better than keyword matching)
4. Request structured JSON output

```
You are evaluating an AI assistant that answers questions about {domain}.

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
{"relevance": 0.0, "completeness": 0.0, "groundedness": 0.0, "citation_quality": 0.0, "reasoning": "brief explanation"}
```

### Adapting the prompt for other domains

Replace `{domain}` with your application's domain. The four scoring dimensions are generic and work across domains. If your app doesn't use citations, drop `citation_quality` and the sources section. If you need additional dimensions (e.g., safety, tone), add them to the scoring instructions with the same 0.0/0.5/1.0 example pattern.

### Calling the judge

The judge is a single async function. It:
1. Formats the prompt with the inputs
2. Calls an OpenAI-compatible API (Fireworks/DeepSeek, or any provider)
3. Parses the JSON response
4. Handles markdown code block wrapping (LLMs sometimes wrap JSON in ```json blocks)
5. Returns a typed dataclass with the scores

```python
import json

async def judge_answer(question, answer, sources, expected_signals, llm_client):
    """
    llm_client: any async function that takes (prompt: str, system: str) -> str
    """
    sources_text = "\n".join(sources) if sources else "No sources cited"
    signals_text = ", ".join(expected_signals) if expected_signals else "General information"

    prompt = JUDGE_PROMPT.format(
        question=question,
        answer=answer,
        sources=sources_text,
        expected_signals=signals_text,
    )

    response_text = await llm_client(
        prompt=prompt,
        system="You are a precise evaluation judge. Return only valid JSON. No markdown.",
    )

    # Strip markdown code blocks if present
    response_text = response_text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    data = json.loads(response_text)

    return {
        "relevance": float(data.get("relevance", 0)),
        "completeness": float(data.get("completeness", 0)),
        "groundedness": float(data.get("groundedness", 0)),
        "citation_quality": float(data.get("citation_quality", 0)),
        "reasoning": data.get("reasoning", ""),
    }
```

### LLM provider

The judge works with any OpenAI-compatible API. In Ask Toronto we use DeepSeek v3 via Fireworks.ai:

```python
import openai

client = openai.AsyncOpenAI(
    api_key="your-fireworks-key",
    base_url="https://api.fireworks.ai/inference/v1",
)

async def llm_call(prompt, system):
    response = await client.chat.completions.create(
        model="accounts/fireworks/models/deepseek-v3p1",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
        temperature=0,  # deterministic output for consistent scoring
    )
    return response.choices[0].message.content
```

**Important:** Use `temperature=0` for the judge. Non-deterministic scoring defeats the purpose of evaluation.

### Error handling

LLMs sometimes return invalid JSON. Always wrap the parse in try/except and return zero scores with the raw response in reasoning:

```python
try:
    data = json.loads(response_text)
except json.JSONDecodeError:
    return {
        "relevance": 0.0,
        "completeness": 0.0,
        "groundedness": 0.0,
        "citation_quality": 0.0,
        "reasoning": f"Failed to parse: {response_text[:200]}",
    }
```

## Integration pattern

The judge is designed to run alongside fast heuristic scoring, not replace it:

```python
# Always compute fast scores (< 1ms)
signal_score = keyword_match(answer, expected_keywords)
source_score = url_fragment_match(cited_sources, expected_sources)

# Optionally compute judge scores (~2-5s per answer, costs ~$0.001)
if use_judge:
    judge_scores = await judge_answer(question, answer, sources, expected_signals)
```

This lets you run quick iterations with keyword scoring and do thorough evaluations with the judge when needed.

## Cost

At Fireworks DeepSeek pricing (~$0.20/M input, $0.80/M output):
- ~500 input tokens + ~100 output tokens per judge call
- ~$0.0002 per evaluation
- 12-prompt benchmark suite: ~$0.0024
- You can run hundreds of eval runs for under $1

## Observed results

In Ask Toronto, switching from keyword matching to LLM-as-judge revealed the system was much better than keyword scores indicated:

| Metric | Keyword Score | LLM Judge Score |
|--------|:------------:|:---------------:|
| Relevance | 0.60 | **0.79** |
| Groundedness | (heuristic) | **0.92** |
| Citation | 0.62 | **0.79** |

The biggest correction was bp-11 ("What happens if you build without a permit?"): keyword score 0.00, judge score 1.00. The answer correctly described penalties and consequences but used different words than the expected signals.
