"""Warm the semantic query cache with benchmark and homepage questions.

Runs each question through the full RAG pipeline (retrieve + generate)
to populate the cache. Subsequent user queries that match will get
instant cached responses.

Usage:
    uv run python scripts/warm_cache.py                    # warm all questions
    uv run python scripts/warm_cache.py --benchmark        # 100 benchmark only
    uv run python scripts/warm_cache.py --homepage          # 30 homepage only
    uv run python scripts/warm_cache.py --dry-run           # show questions only
"""
import asyncio
import argparse
import time
from datetime import datetime

from shared.config import settings
from query_engine.retriever import retrieve
from query_engine.generator import generate_answer
from query_engine.sanitizer import sanitize_query
from query_engine.cache import check_cache, store_cache


# Homepage suggested questions (same as ChatInterface.tsx)
HOMEPAGE_QUESTIONS = [
    'Do I need a permit to build a deck?',
    'How much does a building permit cost?',
    'What documents do I need for a permit?',
    'Do I need a sign permit in Toronto?',
    'Can I remove a tree on my property?',
    'How do I get a zoning review?',
    'How do I pay my property tax?',
    'What is the vacant home tax?',
    'What is the land transfer tax?',
    'Do I need a business licence?',
    'How do I renew my business licence?',
    'What goes in the blue bin?',
    'What goes in the green bin?',
    'Where can I drop off hazardous waste?',
    'How do I get a parking permit?',
    'How do I pay a parking ticket?',
    'How do I report a pothole?',
    'How does Toronto handle snow removal?',
    'How do speed cameras work in Toronto?',
    'Is Toronto tap water safe to drink?',
    'What is the basement flooding subsidy?',
    'What home energy grants are available?',
    'How do I find affordable housing?',
    'What are my rights as a tenant?',
    'Where can I get vaccinated in Toronto?',
    'How do I register for rec programs?',
    'Where can I go swimming in Toronto?',
    'How do I get to the Toronto Islands?',
    'Who is my city councillor?',
    'How do I access Toronto open data?',
]


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def get_provider():
    """Get the default LLM provider (same logic as api.py)."""
    if settings.together_api_key:
        from llm_router.together_provider import TogetherProvider
        return TogetherProvider(api_key=settings.together_api_key, base_url=settings.together_base_url, model=settings.together_model)
    elif settings.fireworks_api_key:
        from llm_router.fireworks_provider import FireworksProvider
        return FireworksProvider(api_key=settings.fireworks_api_key, base_url=settings.fireworks_base_url, model=settings.fireworks_model)
    elif settings.ovh_api_key:
        from llm_router.ovh_provider import OvhProvider
        return OvhProvider(api_key=settings.ovh_api_key, base_url=settings.ovh_base_url, model=settings.ovh_model)
    else:
        from llm_router.claude_provider import ClaudeProvider
        return ClaudeProvider(api_key=settings.anthropic_api_key)


async def warm_question(question: str, provider, index: int, total: int) -> dict:
    """Warm a single question into the cache."""
    question = sanitize_query(question)
    chunks, embedding = retrieve(question, limit=5)
    if not chunks:
        log(f"  [{index}/{total}] SKIP (no chunks): {question[:60]}")
        return {"status": "skip"}

    # Check if already cached
    try:
        cached = check_cache(embedding, chunks)
        if cached:
            log(f"  [{index}/{total}] CACHED: {question[:60]}")
            return {"status": "cached"}
    except Exception:
        pass

    # Generate and cache
    start = time.time()
    try:
        result = await generate_answer(question, chunks, provider)
    except Exception as e:
        log(f"  [{index}/{total}] GENERATE ERROR: {e}")
        return {"status": "error"}
    elapsed = int((time.time() - start) * 1000)

    try:
        store_cache(
            question=question,
            question_embedding=embedding,
            chunks=chunks,
            answer=result["answer"],
            sources=result["sources"],
            model_used=result["model"],
            query_class="warmup",
            tokens_used=result["total_tokens"],
        )
    except Exception as e:
        log(f"  [{index}/{total}] STORE ERROR: {e}")
        return {"status": "error"}

    log(f"  [{index}/{total}] WARMED ({elapsed}ms, {result['total_tokens']} tokens): {question[:60]}")
    return {"status": "warmed", "latency_ms": elapsed, "tokens": result["total_tokens"]}


async def run(questions: list[str], dry_run: bool = False):
    log("=" * 60)
    log("CACHE WARMUP")
    log(f"Questions: {len(questions)}")
    log("=" * 60)

    if dry_run:
        for i, q in enumerate(questions, 1):
            log(f"  [{i}/{len(questions)}] {q}")
        return

    provider = get_provider()
    start = time.time()
    warmed = 0
    cached = 0
    skipped = 0
    errors = 0

    for i, question in enumerate(questions, 1):
        result = await warm_question(question, provider, i, len(questions))
        if result["status"] == "warmed":
            warmed += 1
        elif result["status"] == "cached":
            cached += 1
        elif result["status"] == "skip":
            skipped += 1
        else:
            errors += 1

        # Delay between requests to avoid rate limits
        if i < len(questions):
            await asyncio.sleep(3)

    elapsed = int(time.time() - start)
    log("=" * 60)
    log(f"DONE in {elapsed}s")
    log(f"  Warmed: {warmed}, Already cached: {cached}, Skipped: {skipped}, Errors: {errors}")
    log("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Warm the semantic query cache")
    parser.add_argument("--benchmark", action="store_true", help="Warm 100 benchmark questions")
    parser.add_argument("--homepage", action="store_true", help="Warm 30 homepage questions")
    parser.add_argument("--dry-run", action="store_true", help="Show questions without warming")
    args = parser.parse_args()

    questions = []
    if args.benchmark:
        from evals.prompts import BENCHMARK_PROMPTS
        questions = [bp.prompt for bp in BENCHMARK_PROMPTS]
    elif args.homepage:
        questions = HOMEPAGE_QUESTIONS
    else:
        # Default: homepage + benchmark (deduplicated)
        from evals.prompts import BENCHMARK_PROMPTS
        benchmark = [bp.prompt for bp in BENCHMARK_PROMPTS]
        seen = set()
        for q in HOMEPAGE_QUESTIONS + benchmark:
            if q not in seen:
                questions.append(q)
                seen.add(q)

    asyncio.run(run(questions, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
