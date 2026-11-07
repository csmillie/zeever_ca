"""Run the evaluation benchmark suite."""
import asyncio
import time
import httpx
from evals.prompts import BENCHMARK_PROMPTS
from evals.scorer import score_signal_coverage, score_source_coverage, score_groundedness
from evals.models import EvalScore

# All models available for benchmarking on Fireworks.ai
FIREWORKS_MODELS = {
    # Original comparison models
    "gpt-oss-120b": "accounts/fireworks/models/gpt-oss-120b",
    "kimi-k2.5": "accounts/fireworks/models/kimi-k2p5",
    "glm-5": "accounts/fireworks/models/glm-5",
    "deepseek-v3.2": "accounts/fireworks/models/deepseek-v3p2",
    "mixtral-8x22b": "accounts/fireworks/models/mixtral-8x22b-instruct",
    "glm-4.7": "accounts/fireworks/models/glm-4p7",
    "deepseek-v3.1": "accounts/fireworks/models/deepseek-v3p1",
    # Smaller / alternative models
    "qwen3-8b": "accounts/fireworks/models/qwen3-8b",
    "llama3.3-70b": "accounts/fireworks/models/llama-v3p3-70b-instruct",
}

SMALL_MODELS = ["qwen3-8b", "llama3.3-70b"]

assert all(m in FIREWORKS_MODELS for m in SMALL_MODELS), "SMALL_MODELS contains keys not in FIREWORKS_MODELS"

MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 30]  # seconds between retries
REQUEST_DELAY = 5  # seconds between requests (stay under 20/min API limit)


async def _fetch_with_retry(client: httpx.AsyncClient, url: str, payload: dict, params: dict) -> httpx.Response:
    """Fetch with retry on transient errors (disconnects, 404, 429, 500, 502, 503)."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.post(url, json=payload, params=params)
            if response.status_code in (404, 429, 500, 502, 503) and attempt < MAX_RETRIES:
                delay = RETRY_DELAYS[attempt]
                print(f"    Retry {attempt + 1}/{MAX_RETRIES} after {response.status_code}, waiting {delay}s...", flush=True)
                await asyncio.sleep(delay)
                continue
            response.raise_for_status()
            return response
        except httpx.RemoteProtocolError as e:
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS[attempt]
                print(f"    Retry {attempt + 1}/{MAX_RETRIES} after disconnect, waiting {delay}s...", flush=True)
                await asyncio.sleep(delay)
                continue
            raise
        except httpx.TimeoutException as e:
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS[attempt]
                print(f"    Retry {attempt + 1}/{MAX_RETRIES} after timeout, waiting {delay}s...", flush=True)
                await asyncio.sleep(delay)
                continue
            raise


async def run_single_model(
    model_id: str,
    api_url: str = "http://localhost:3034",
    mode: str = "vector",
    use_judge: bool = False,
    limit: int | None = None,
) -> list[EvalScore]:
    """Run benchmark prompts against a single model.

    Args:
        limit: Only run the first N prompts. None means run all.
    """
    judge_fn = None
    if use_judge:
        from evals.llm_judge import judge_answer
        judge_fn = judge_answer

    prompts = BENCHMARK_PROMPTS[:limit] if limit is not None else BENCHMARK_PROMPTS
    results = []

    async with httpx.AsyncClient(timeout=120) as client:
        for i, bp in enumerate(prompts):
            if i > 0:
                await asyncio.sleep(REQUEST_DELAY)
            print(f"  {bp.id} - {bp.prompt[:60]}...", flush=True)

            start = time.time()
            try:
                payload = {"question": bp.prompt}
                if model_id:
                    payload["model"] = model_id
                response = await _fetch_with_retry(
                    client,
                    f"{api_url}/api/query",
                    payload,
                    {"mode": mode},
                )
                data = response.json()
            except Exception as e:
                print(f"    ERROR: {e}", flush=True)
                results.append(EvalScore(
                    prompt_id=bp.id,
                    prompt_text=bp.prompt,
                    answer=f"ERROR: {e}",
                    sources_cited=[],
                    relevance_score=0.0,
                    citation_score=0.0,
                    groundedness=0.0,
                    latency_ms=int((time.time() - start) * 1000),
                    model_used="error",
                ))
                continue

            latency_ms = int((time.time() - start) * 1000)
            answer = data["answer"]
            sources = [s["url"] for s in data.get("sources", [])]

            relevance = score_signal_coverage(answer, bp.expected_signals)
            citation = score_source_coverage(sources, bp.expected_sources)
            # API response doesn't include retrieved chunk text, so groundedness
            # can't be computed here (was incorrectly comparing answer to itself).
            grounded = 0.0

            score = EvalScore(
                prompt_id=bp.id,
                prompt_text=bp.prompt,
                answer=answer,
                sources_cited=sources,
                relevance_score=relevance,
                citation_score=citation,
                groundedness=grounded,
                latency_ms=latency_ms,
                model_used=data.get("model_used", model_id),
            )

            if judge_fn:
                try:
                    judge_scores = await judge_fn(
                        question=bp.prompt,
                        answer=answer,
                        sources=sources,
                        expected_signals=bp.expected_signals,
                        expects_refusal=bp.expects_refusal,
                    )
                    score.judge_relevance = judge_scores.relevance
                    score.judge_completeness = judge_scores.completeness
                    score.judge_groundedness = judge_scores.groundedness
                    score.judge_citation = judge_scores.citation_quality
                    score.judge_reasoning = judge_scores.reasoning
                except Exception as e:
                    print(f"    Judge error: {e}")

            if score.judge_relevance >= 0:
                print(f"    signal={relevance:.2f} judge={score.judge_relevance:.2f}/{score.judge_completeness:.2f}/{score.judge_groundedness:.2f}/{score.judge_citation:.2f} latency={latency_ms}ms")
            else:
                print(f"    relevance={relevance:.2f} citation={citation:.2f} latency={latency_ms}ms")

            results.append(score)

    return results


async def run_benchmark(
    run_label: str = "baseline",
    api_url: str = "http://localhost:3034",
    mode: str = "vector",
    use_judge: bool = False,
    models: list[str] | None = None,
    limit: int | None = None,
) -> dict[str, list[EvalScore]]:
    """Run benchmark prompts against one or more models.

    Returns a dict mapping model name to its list of EvalScores.
    When no models are specified, runs against the default (server-configured) model.
    """
    if models:
        model_map = {}
        for name in models:
            model_id = FIREWORKS_MODELS.get(name, name)
            model_map[name] = model_id
    else:
        model_map = {"default": None}

    all_results = {}
    for name, model_id in model_map.items():
        print(f"\n{'='*60}")
        print(f"Model: {name}" + (f" ({model_id})" if model_id else ""))
        print(f"{'='*60}")

        results = await run_single_model(
            model_id=model_id,
            api_url=api_url,
            mode=mode,
            use_judge=use_judge,
            limit=limit,
        )
        all_results[name] = results

    return all_results
