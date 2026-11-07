import asyncio
import json
import logging
import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, Request
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from query_engine.limiter import limiter, real_ip
from starlette.responses import JSONResponse
from fastapi.responses import StreamingResponse
from query_engine.models import QueryRequest, QueryResponse, Source, TokenUsage, ResponseTime, ALLOWED_MODELS
from query_engine.classifier import classify_query
from query_engine.retriever import retrieve
from query_engine.generator import generate_answer
from query_engine.router import select_model
from query_engine.sanitizer import sanitize_query, is_suspicious, log_suspicious_query
from query_engine.cache import check_cache, store_cache
from query_engine.graph_retriever import retrieve_graph_context
from query_engine.provider_chain import (
    build_chain, generate_with_failover, stream_with_failover, AllProvidersFailed,
)
from query_engine.generator import generate_answer_stream
from llm_router.ollama_health import check_ollama_health
from shared.config import settings

# Configure Langfuse via environment variables (picked up automatically by the SDK)
if settings.langfuse_secret_key:
    os.environ.setdefault("LANGFUSE_SECRET_KEY", settings.langfuse_secret_key)
    os.environ.setdefault("LANGFUSE_PUBLIC_KEY", settings.langfuse_public_key)
    os.environ.setdefault("LANGFUSE_BASE_URL", settings.langfuse_base_url)

from langfuse import observe, get_client  # noqa: E402

def _configure_logging() -> None:
    """Let the application's own log lines out.

    The service runs under bare uvicorn, which configures its own loggers and
    not ours. Everything the code records with logger.info has therefore been
    discarded since the service was first deployed -- warnings and errors get
    through, which is why a 404 was visible, but timings never have.

    That was found while investigating a request that spent 12.9 seconds before
    generation began. retriever.py already logs

        retrieve | backend=pgvector mode=vector embed=118ms search=45ms total=163ms

    which is exactly the measurement needed, and it had never once been written.
    Diagnosing it meant re-measuring from outside instead of reading what the
    code had already recorded.

    ## Why this is a per-logger allowlist rather than a level

    Turning INFO on globally would also start writing residents' questions into
    the PM2 logs, because cache.py records them on every hit and store:

        cache store | question=How do I appeal an eviction...

    This site answers questions about permits, evictions and property taxes, and
    those same log files held a leaked API key on 2026-09-14. Retaining what
    people asked is a decision about privacy, not about observability, and it is
    not one to make as a side effect of wanting millisecond timings.

    So the loggers that emit measurements are raised, and the one that emits user
    content is left where it is. LOG_LEVEL can override for a debugging session.
    """
    level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))

    root = logging.getLogger()
    if not root.handlers:
        # uvicorn attaches handlers to its own loggers, not to the root, so
        # without this the records have nowhere to go even at the right level.
        root.addHandler(handler)
    root.setLevel(logging.WARNING)

    # These are the names the modules actually construct, not their import paths.
    # retriever.py and generator.py both do getLogger("zeever.timing"); cache.py
    # does getLogger("zeever.cache"). Naming them by module path, as this list
    # first did, configured four loggers that nothing logs to and left the real
    # ones inheriting the root -- so the timing line stayed discarded and the
    # privacy pin protected a logger that does not exist.
    #
    # Verified against the modules rather than by emitting records to the names
    # written here, which is the check that missed it: it confirmed this list
    # agreed with itself.
    #
    # Measurements only: how long retrieval took, which model answered, how many
    # tokens it cost, which embedding endpoint served. No question text.
    for name in ("zeever.timing",                 # retriever.py, generator.py
                 "query_engine.provider_chain",   # failover decisions
                 "indexer.embedder"):             # which endpoint served
        logging.getLogger(name).setLevel(level)

    # Deliberately not raised: cache.py logs the question on every hit and store.
    logging.getLogger("zeever.cache").setLevel(logging.WARNING)

    # Left alone on purpose. zeever.security logs suspicious queries at WARNING,
    # including the query text and the client IP, and it is meant to -- that is a
    # security record rather than analytics. Named here so it is a decision
    # somebody made rather than one this file quietly inherits.
    logging.getLogger("zeever.security").setLevel(logging.WARNING)


_configure_logging()

logger = logging.getLogger(__name__)

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


# Fix #9: CORS — only allow requests from our frontend.
# allow_credentials is left at the default (False) explicitly so a future
# change to allow_origins can't silently start accepting credentialed
# cross-origin requests.
ALLOWED_ORIGINS = [
    "https://www.zeever.ca",
    "https://zeever.ca",
    "http://localhost:3033",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)


@app.middleware("http")
async def reject_cross_site_posts(request: Request, call_next):
    """Refuse a POST whose Origin is a site we do not serve.

    The CSRF check in apps/web/src/proxy.ts never runs for these endpoints.
    Apache proxies /api/query and /api/query/stream straight to FastAPI, so
    Next.js middleware is not in the path at all. Verified against production on
    2026-08-31: a POST to /api/query with `Origin: https://evil.example.com`
    returned 200.

    CORS already stops a malicious page reading the answer, so this is not about
    disclosure. It is that any site could make this server run a paid model
    generation, as often as it liked. That is the cost, and the rate limit was
    not a backstop because its key was client-controlled.

    A missing Origin is allowed on purpose. The benchmark, the eval suite and the
    server-side A2A and MCP skills all call this API without one, and browsers
    always send Origin on a cross-site POST, so requiring it would break every
    legitimate non-browser caller while blocking nothing a browser does.
    """
    if request.method == "POST" and request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return JSONResponse(status_code=403,
                                content={"detail": "Cross-site request refused."})
    return await call_next(request)


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


def _is_overridden(body) -> bool:
    """True when the request asked for anything other than the default path.

    The semantic cache is shared across every caller, so an answer produced by a
    non-default model or a non-default provider must neither be read from it nor
    written into it. Both overrides are the same hazard, and keeping the test in
    one place is what stops the four guard sites from drifting apart.
    """
    return bool(body.model or body.provider)


# The decorator belongs here and nowhere else. It was moved onto _is_overridden
# by accident in #281, which inserted that helper between this comment and its
# function, and for three weeks the one span that carries model, token usage and
# cost measured a boolean instead: every "generate" observation in Langfuse read
# latency 0ms, model None, usage None, output true/false.
def _record_stream_usage(payload: dict) -> None:
    """Attach the streamed answer's model and token counts to the open span.

    Same job as the update inside traced_generate and a separate call site,
    because the streamed path produces its usage at the end of a generator
    rather than as the return value of a function.

    Never raises. It runs mid-stream, with a partial answer already delivered to
    the reader, and a telemetry fault must not truncate what they are reading.
    """
    try:
        get_client().update_current_generation(
            model=payload.get("model"),
            usage_details={
                "input": payload.get("input_tokens") or 0,
                "output": payload.get("output_tokens") or 0,
                "total": payload.get("total_tokens") or 0,
            },
        )
    except Exception:  # pragma: no cover - telemetry must never raise here
        logger.debug("could not attach usage to the streamed generation span",
                     exc_info=True)


@observe(name="generate", as_type="generation")
async def traced_generate(question: str, chunks: list[dict], provider, graph_context=None) -> dict:
    result = await generate_answer(question, chunks, provider, graph_context=graph_context)

    # as_type="generation" tells Langfuse to expect a model and token counts; it
    # does not tell it where to find them. Without this the span records latency
    # and the text, and reports the model as None and the cost as zero -- which
    # reads as "this call was free" rather than as "nobody said".
    #
    # Wrapped because tracing is not allowed to break answering. get_client()
    # returns a disabled client when no keys are set, and this runs on the path
    # every question takes.
    try:
        get_client().update_current_generation(
            model=result.get("model"),
            usage_details={
                "input": result.get("input_tokens") or 0,
                "output": result.get("output_tokens") or 0,
                "total": result.get("total_tokens") or 0,
            },
        )
    except Exception:  # pragma: no cover - telemetry must never raise here
        logger.debug("could not attach usage to the generation span", exc_info=True)

    return result


@app.post("/api/query", response_model=QueryResponse)
@limiter.limit("20/minute")
@observe(name="query")
async def query(request: Request, body: QueryRequest, mode: str = Query(default="vector", pattern="^(vector|graph)$")):
    t_start = time.perf_counter()

    def elapsed() -> ResponseTime:
        # Derive both fields from one rounded millisecond value so they never disagree.
        ms = round((time.perf_counter() - t_start) * 1000)
        return ResponseTime(seconds=ms / 1000, milliseconds=ms)

    # Sanitize input and log suspicious queries
    question = sanitize_query(body.question)
    if is_suspicious(body.question):
        # real_ip, not get_remote_address. Behind Apache the transport address is
        # 127.0.0.1 for every caller, so the injection log recorded the same
        # address for everyone and could not identify anybody.
        log_suspicious_query(body.question, real_ip(request))

    # Before retrieval, not after. Retrieval costs an embedding API call, and
    # rejecting the model afterwards meant paying for it on every request that
    # was going to 400 anyway.
    if body.model and body.model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model specified.")

    query_class = traced_classify(question)
    model_name = select_model(question, query_class)

    chunks, query_embedding = await asyncio.to_thread(traced_retrieve, question, 5)

    if not chunks:
        return QueryResponse(
            answer="I couldn't find relevant information about that topic in the Toronto.ca content. Please try rephrasing your question.",
            sources=[],
            query_class=query_class,
            model_used=model_name,
            response_time=elapsed(),
        )

    # Check semantic cache (skip if the request overrode model or provider)
    if not _is_overridden(body):
        try:
            cached = await asyncio.to_thread(check_cache, query_embedding, chunks, mode)
        except Exception:
            cached = None
        if cached:
            return QueryResponse(
                answer=cached["answer"],
                sources=[Source(url=url) for url in cached["sources"]],
                query_class=cached.get("query_class", query_class),
                model_used=cached["model_used"] + " (cached)",
                response_time=elapsed(),
            )

    graph_context = None
    if mode == "graph":
        graph_context = await asyncio.to_thread(traced_retrieve_graph, chunks)

    # Ordered chain rather than a single choice: a provider that fails is skipped
    # and the next is tried, so one retired model cannot take the endpoint down.
    chain = build_chain(settings, requested_model=body.model, provider=body.provider)
    try:
        result, served_by = await generate_with_failover(
            traced_generate, question, chunks, chain, graph_context=graph_context,
        )
    except AllProvidersFailed as exc:
        # `from exc` so a failure inside the handler is distinguishable from the
        # provider failure it is reporting.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Store in cache (best-effort, don't block response on failure).
    #
    # Guarded to match the read above, which was already guarded. Without it a
    # request that overrode the model wrote its answer into the shared cache,
    # and the next default request was served it. One experiment changed what
    # every other caller got.
    #
    # provider counts as an override for the same reason: /a2a and /api/mcp pin
    # themselves to a small local model, and those answers must not become what
    # the website serves to people.
    if not _is_overridden(body):
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
                mode=mode,
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
        response_time=elapsed(),
    )


def _sse(event: str, data) -> str:
    """One Server-Sent Event. The blank line is what flushes it to the client."""
    return f"data: {json.dumps({'event': event, 'data': data})}\n\n"


@app.post("/api/query/stream")
@limiter.limit("20/minute")
async def query_stream(request: Request, body: QueryRequest,
                       mode: str = Query(default="vector", pattern="^(vector|graph)$")):
    """The same answer as /api/query, delivered as it is generated.

    /api/query stays as it is: the MCP and A2A skills, the benchmark and the
    eval suite all want one complete JSON object, and streaming would only make
    them reassemble it. This endpoint exists for the chat UI, where the wait is
    perceived rather than actual — a 31-second generation that starts printing
    after 400ms reads as fast, and the same generation delivered whole does not.

    Events: sources, provider, reasoning, text, final, error.
    """
    t_start = time.perf_counter()

    question = sanitize_query(body.question)
    if is_suspicious(body.question):
        log_suspicious_query(body.question, real_ip(request))

    if body.model and body.model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model specified.")

    async def events():
        def elapsed_ms() -> int:
            return round((time.perf_counter() - t_start) * 1000)

        # Classification and retrieval happen inside the generator, and inside the
        # span, because a trace has to be opened and closed in one execution
        # scope. An async generator does not run in the context its enclosing
        # function had -- each step runs in the caller's -- so a span opened
        # around the `return StreamingResponse(...)` closes before a single token
        # is generated, and the work it claims to measure lands outside it.
        #
        # That is why this endpoint used to emit `classify`, `retrieve` and
        # `generate` as three unrelated root traces while /api/query emitted one
        # tree of five. The data was all there and nothing said the three
        # belonged to the same question.
        #
        # Moving them here also moves retrieval failures from an HTTP 500 to an
        # `error` event. That is the protocol this endpoint already speaks for
        # every other failure -- a provider outage has always arrived that way --
        # and the web client has handled `error` since streaming was added.
        with get_client().start_as_current_observation(
            name="query_stream", as_type="span",
            input={"question": question, "mode": mode},
        ):
            try:
                query_class = traced_classify(question)
                chunks, query_embedding = await asyncio.to_thread(
                    traced_retrieve, question, 5)
            except Exception as exc:
                logger.exception("retrieval failed for a streamed question")
                yield _sse("error", f"Retrieval failed: {exc}")
                return

            async for event in _stream_answer(
                body, question, mode, query_class, chunks, query_embedding, elapsed_ms):
                yield event

    async def _stream_answer(body, question, mode, query_class, chunks,
                             query_embedding, elapsed_ms):
        if not chunks:
            yield _sse("final", {
                "answer": "I couldn't find relevant information about that topic in the "
                          "Toronto.ca content. Please try rephrasing your question.",
                "sources": [], "query_class": query_class, "model_used": "none",
                "response_time": {"seconds": elapsed_ms() / 1000, "milliseconds": elapsed_ms()},
            })
            return

        # A cache hit has nothing to stream, but the client speaks one protocol, so
        # it arrives as a single text event followed by the same final event.
        if not _is_overridden(body):
            try:
                cached = await asyncio.to_thread(check_cache, query_embedding, chunks, mode)
            except Exception:
                cached = None
            if cached:
                yield _sse("sources", cached["sources"])
                yield _sse("text", cached["answer"])
                yield _sse("final", {
                    "answer": cached["answer"], "sources": cached["sources"],
                    "query_class": cached.get("query_class", query_class),
                    "model_used": cached["model_used"] + " (cached)",
                    "response_time": {"seconds": elapsed_ms() / 1000, "milliseconds": elapsed_ms()},
                })
                return

        graph_context = None
        if mode == "graph":
            graph_context = await asyncio.to_thread(traced_retrieve_graph, chunks)

        chain = build_chain(settings, requested_model=body.model, provider=body.provider)
        final = None
        # The streamed path never reaches traced_generate -- it iterates
        # generate_answer_stream instead -- so without this the generation is not
        # traced at all, and the endpoint the website actually uses reports no
        # model, no tokens and no cost. That is what the first query_stream trace
        # showed: retrieve, classify, and nothing about the answer.
        #
        # A decorator cannot do it, for the same reason the root span cannot. The
        # work happens inside an async generator, and the token counts only exist
        # when the final payload arrives at the end of it.
        try:
            with get_client().start_as_current_observation(
                name="generate", as_type="generation",
                input={"question": question, "chunks": len(chunks)},
            ):
                async for kind, payload in stream_with_failover(
                    generate_answer_stream, question, chunks, chain,
                    graph_context=graph_context,
                ):
                    if kind == "final":
                        final = payload
                        _record_stream_usage(payload)
                        yield _sse("final", {
                            "answer": payload["answer"],
                            "sources": payload["sources"],
                            "query_class": query_class,
                            "model_used": payload["model"],
                            "usage": {
                                "input_tokens": payload["input_tokens"],
                                "output_tokens": payload["output_tokens"],
                                "total_tokens": payload["total_tokens"],
                            },
                            "response_time": {"seconds": elapsed_ms() / 1000,
                                              "milliseconds": elapsed_ms()},
                        })
                    else:
                        yield _sse(kind, payload)
        except AllProvidersFailed as exc:
            # A stream cannot change its status code once it has started, so a
            # failure is an event rather than a 503.
            yield _sse("error", str(exc))
            return
        except asyncio.CancelledError:
            # The client went away. Let it propagate so the provider stream closes
            # and Ollama stops generating for a reader that is no longer there.
            raise

        # Same guard as the read above: a request that overrode the model or the
        # provider must not write into the cache default requests are served from.
        if final and not _is_overridden(body):
            try:
                await asyncio.to_thread(
                    store_cache,
                    question=question, question_embedding=query_embedding, chunks=chunks,
                    answer=final["answer"], sources=final["sources"],
                    model_used=final["model"], query_class=query_class,
                    tokens_used=final["total_tokens"], mode=mode,
                )
            except Exception:
                pass

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # Cloudflare and nginx both buffer by default, which would hold the
            # whole answer and defeat the point of streaming it.
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/embeddings")
async def embeddings_health():
    """Which endpoint is actually serving embeddings, and what is wrong with the rest.

    Exists because the failure this reports is invisible from every other angle.
    A misconfigured endpoint is skipped, the chain falls through to the next one,
    and the site keeps answering correctly -- on the paid provider, from another
    country, 5x slower, with nothing in the response to say so.

    `serving` is what the last embedding actually used, not what configuration
    says should be preferred. Those differing is the whole point.
    """
    from indexer import embedder

    try:
        chain = embedder.build_endpoints()
    except RuntimeError as exc:
        return {"status": "error", "detail": str(exc)}

    preferred = chain[0].label if chain else None
    serving = embedder.LAST_SERVED_BY
    problems = list(embedder.CONFIG_PROBLEMS)

    # Degraded rather than ok when the chain is working but not as intended: a
    # skipped endpoint, or answers coming from something other than the first
    # choice. Both mean somebody should look, and neither breaks anything.
    if problems:
        status = "degraded"
    elif serving is not None and serving != preferred:
        status = "degraded"
    else:
        status = "ok"

    return {
        "status": status,
        "preferred": preferred,
        "serving": serving,
        "chain": [{"label": e.label, "base_url": e.base_url, "model": e.model,
                   "input_limit": e.limit} for e in chain],
        "problems": problems,
    }


@app.get("/health/ollama")
async def ollama_health():
    """Per-host Ollama diagnosis: reachable, model present, endpoint agrees, streams."""
    hosts = [
        ("host-1", settings.ollama_base_url, settings.ollama_model),
        ("host-2", settings.ollama_base_url_2,
         settings.ollama_model_2 or settings.ollama_model),
    ]
    results = {}
    for label, base_url, model in hosts:
        if not base_url:
            continue
        health = await check_ollama_health(base_url, model)
        results[label] = {
            "ok": health.ok,
            "endpoint": health.base_url,
            "api_mode": health.api_mode,
            "model": health.model,
            "model_available": health.model_available,
            "loaded": health.loaded,
            "latency_ms": health.latency_ms,
            "errors": health.errors,
            "summary": health.summary(),
        }
    if not results:
        return {"status": "not configured", "hosts": {}}
    return {"status": "ok" if all(h["ok"] for h in results.values()) else "degraded",
            "hosts": results}
