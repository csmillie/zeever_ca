import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse
from fastapi.responses import JSONResponse as FastJSONResponse
from query_engine.models import QueryRequest, QueryResponse, Source, TokenUsage, ALLOWED_MODELS
from query_engine.classifier import classify_query
from query_engine.retriever import retrieve
from query_engine.generator import generate_answer
from query_engine.router import select_model
from query_engine.sanitizer import sanitize_query, is_suspicious, log_suspicious_query
from query_engine.cache import check_cache, store_cache
from query_engine.graph_retriever import retrieve_graph_context
from llm_router.claude_provider import ClaudeProvider
from llm_router.fireworks_provider import FireworksProvider
from llm_router.together_provider import TogetherProvider
from llm_router.ovh_provider import OvhProvider
from llm_router.ollama_provider import OllamaProvider
from shared.config import settings

# Configure Langfuse via environment variables (picked up automatically by the SDK)
if settings.langfuse_secret_key:
    os.environ.setdefault("LANGFUSE_SECRET_KEY", settings.langfuse_secret_key)
    os.environ.setdefault("LANGFUSE_PUBLIC_KEY", settings.langfuse_public_key)
    os.environ.setdefault("LANGFUSE_BASE_URL", settings.langfuse_base_url)

from langfuse import observe, get_client  # noqa: E402

# Fix #4: Rate limiting — 20 queries per minute per IP
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        get_client().flush()
    except Exception:
        pass

app = FastAPI(title="Zeever.ca API", description="Toronto city services assistant", lifespan=lifespan)
app.state.limiter = limiter

from query_engine.admin import router as admin_router  # noqa: E402
app.include_router(admin_router)


# Fix #9: CORS — only allow requests from our frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.zeever.ca",
        "https://zeever.ca",
        "http://localhost:3033",
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"answer": "Too many requests. Please wait a moment and try again.", "sources": [], "query_class": "error", "model_used": "none"},
    )


@observe(name="classify")
def traced_classify(question: str) -> str:
    return classify_query(question)


@observe(name="retrieve")
def traced_retrieve(question: str, limit: int = 5) -> tuple[list[dict], list[float]]:
    return retrieve(question, limit=limit)


@observe(name="retrieve_graph")
def traced_retrieve_graph(chunks: list[dict]) -> dict:
    return retrieve_graph_context(chunks)


@observe(name="generate", as_type="generation")
async def traced_generate(question: str, chunks: list[dict], provider, graph_context=None) -> dict:
    return await generate_answer(question, chunks, provider, graph_context=graph_context)


@app.post("/api/query", response_model=QueryResponse)
@limiter.limit("20/minute")
@observe(name="query")
async def query(request: Request, body: QueryRequest, mode: str = Query(default="vector", pattern="^(vector|graph)$")):
    # Sanitize input and log suspicious queries
    question = sanitize_query(body.question)
    if is_suspicious(body.question):
        client_ip = get_remote_address(request)
        log_suspicious_query(body.question, client_ip)

    query_class = traced_classify(question)
    model_name = select_model(question, query_class)

    chunks, query_embedding = await asyncio.to_thread(traced_retrieve, question, 5)

    if not chunks:
        return QueryResponse(
            answer="I couldn't find relevant information about that topic in the Toronto.ca content. Please try rephrasing your question.",
            sources=[],
            query_class=query_class,
            model_used=model_name,
        )

    # Check semantic cache (skip if model override is specified)
    if not body.model:
        try:
            cached = await asyncio.to_thread(check_cache, query_embedding, chunks)
        except Exception:
            cached = None
        if cached:
            return QueryResponse(
                answer=cached["answer"],
                sources=[Source(url=url) for url in cached["sources"]],
                query_class=cached.get("query_class", query_class),
                model_used=cached["model_used"] + " (cached)",
            )

    graph_context = None
    if mode == "graph":
        graph_context = await asyncio.to_thread(traced_retrieve_graph, chunks)

    if body.model and body.model not in ALLOWED_MODELS:
        return QueryResponse(
            answer="Invalid model specified.",
            sources=[],
            query_class=query_class,
            model_used="none",
        )
    if settings.ollama_base_url:
        model_id = body.model or settings.ollama_model
        provider = OllamaProvider(base_url=settings.ollama_base_url, model=model_id)
    elif settings.together_api_key:
        model_id = body.model or settings.together_model
        provider = TogetherProvider(api_key=settings.together_api_key, base_url=settings.together_base_url, model=model_id)
    elif settings.fireworks_api_key:
        model_id = body.model or settings.fireworks_model
        provider = FireworksProvider(api_key=settings.fireworks_api_key, base_url=settings.fireworks_base_url, model=model_id)
    elif settings.ovh_api_key:
        model_id = body.model or settings.ovh_model
        provider = OvhProvider(api_key=settings.ovh_api_key, base_url=settings.ovh_base_url, model=model_id)
    else:
        provider = ClaudeProvider(api_key=settings.anthropic_api_key)
    result = await traced_generate(question, chunks, provider, graph_context=graph_context)

    # Store in cache (best-effort, don't block response on failure)
    try:
        await asyncio.to_thread(
            store_cache,
            question=question,
            question_embedding=query_embedding,
            chunks=chunks,
            answer=result["answer"],
            sources=result["sources"],
            model_used=result["model"],
            query_class=query_class,
            tokens_used=result["total_tokens"],
        )
    except Exception:
        pass

    return QueryResponse(
        answer=result["answer"],
        sources=[Source(url=url) for url in result["sources"]],
        query_class=query_class,
        model_used=result["model"],
        usage=TokenUsage(
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            total_tokens=result["total_tokens"],
        ),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
