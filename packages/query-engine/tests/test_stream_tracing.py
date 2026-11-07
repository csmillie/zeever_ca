"""The streamed endpoint is one trace, and the generation span carries its cost.

Two halves of the same complaint: Langfuse held data that looked complete and
was not.

The generation span is declared `as_type="generation"`, which tells Langfuse to
expect a model name and token counts. Nothing was telling it where to find them
in the dict the function returns, so every generation read model None and usage
None -- and a cost of zero, which reads as "this call was free" rather than as
"nobody said". Cost reporting for this project was empty for weeks, and empty is
indistinguishable from cheap.

The streamed endpoint had no root span at all, so classify, retrieve and
generate arrived as three unrelated root traces, while /api/query produced one
tree of five. Same work, same order, no way to tell the three belonged to the
same question. The cause is that an async generator does not run in the context
its enclosing function had, so a span opened around the StreamingResponse closes
before any token is generated.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from llm_router.provider import LLMResponse
from query_engine.api import app
from query_engine.provider_chain import Link

client = TestClient(app)

MOCK_EMBEDDING = [0.1] * 768
CHUNKS = [{
    "id": "1", "chunk_text": "Decks need a permit",
    "url": "https://toronto.ca/permits", "title": "Permits",
    "content_type": "page", "similarity": 0.9,
}]


def _chain():
    """A provider that can both answer whole and answer in pieces.

    The two endpoints take different routes into the same provider: /api/query
    awaits generate(), /api/query/stream iterates stream(). A mock with only the
    first makes the streamed tests fall through the chain and pass for the wrong
    reason.
    """
    provider = AsyncMock()
    provider.model = "test-model"
    provider.generate.return_value = LLMResponse(
        text="Yes. [Source: https://toronto.ca/permits]",
        model="test-model", input_tokens=100, output_tokens=50,
    )

    async def stream(**kwargs):
        yield "text", "Yes. "
        yield "text", "[Source: https://toronto.ca/permits]"
        # A real provider reports usage as its own event kind, which is where
        # the streamed path's token counts come from. A mock that yields only
        # text produces a final payload of zero tokens and makes a cost
        # assertion pass or fail for reasons that have nothing to do with the
        # code under test.
        yield "usage", {"input_tokens": 100, "output_tokens": 50}

    provider.stream = stream
    return [Link(label="test", provider=provider, timeout_s=5.0)]


def _events(response):
    """The SSE payloads, as (event, data) pairs."""
    out = []
    for line in response.text.splitlines():
        if line.startswith("data: "):
            payload = json.loads(line[len("data: "):])
            out.append((payload["event"], payload["data"]))
    return out


# --- what the generation span reports ---------------------------------------

def test_the_generation_span_is_told_the_model_and_the_tokens():
    """Otherwise Langfuse shows the call as free, which is a claim, not a gap."""
    lf = MagicMock()
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        response = client.post("/api/query", json={"question": "Do I need a permit?"})

    assert response.status_code == 200
    lf.update_current_generation.assert_called_once()
    kwargs = lf.update_current_generation.call_args.kwargs
    assert kwargs["model"] == "test-model"
    assert kwargs["usage_details"] == {"input": 100, "output": 50, "total": 150}


def test_a_telemetry_failure_does_not_fail_the_answer():
    """This runs on the path every question takes. Langfuse being unreachable,
    misconfigured or mid-upgrade must cost a trace, never an answer."""
    lf = MagicMock()
    lf.update_current_generation.side_effect = RuntimeError("langfuse is down")
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        response = client.post("/api/query", json={"question": "Do I need a permit?"})

    assert response.status_code == 200
    assert response.json()["sources"]


# --- the streamed endpoint as one trace -------------------------------------

def test_the_stream_opens_one_span_around_the_whole_question():
    lf = MagicMock()
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        response = client.post("/api/query/stream", json={"question": "Do I need a permit?"})

    assert response.status_code == 200
    opened = [c.kwargs["name"] for c in lf.start_as_current_observation.call_args_list]
    # The root, and the generation nested inside it. The streamed path never
    # reaches traced_generate, so without the second one this endpoint records
    # retrieval and classification and nothing about the answer.
    assert opened == ["query_stream", "generate"]
    types = [c.kwargs.get("as_type") for c in lf.start_as_current_observation.call_args_list]
    assert types == ["span", "generation"]


def test_the_streamed_generation_reports_its_model_and_tokens():
    """The streamed path produces usage at the end of a generator rather than as
    a return value, so it needs its own call. Without it the website's own
    endpoint reports a cost of zero while /api/query reports the truth."""
    lf = MagicMock()
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        response = client.post("/api/query/stream", json={"question": "Do I need a permit?"})

    assert response.status_code == 200
    lf.update_current_generation.assert_called_once()
    kwargs = lf.update_current_generation.call_args.kwargs
    assert kwargs["model"] == "test-model"
    assert kwargs["usage_details"]["total"] > 0


def test_a_telemetry_failure_mid_stream_does_not_truncate_the_answer():
    """It runs with a partial answer already delivered to the reader."""
    lf = MagicMock()
    lf.update_current_generation.side_effect = RuntimeError("langfuse is down")
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        response = client.post("/api/query/stream", json={"question": "Do I need a permit?"})

    kinds = [e for e, _ in _events(response)]
    assert "final" in kinds and "error" not in kinds


def test_the_span_wraps_retrieval_and_not_only_generation():
    """Retrieval inside the span is the whole point: it is what was arriving as
    its own root trace, unconnected to the answer it fed."""
    order = []
    lf = MagicMock()
    lf.start_as_current_observation.side_effect = lambda **kw: _recording_cm(order)

    def retrieve(*a, **k):
        order.append("retrieve")
        return (CHUNKS, MOCK_EMBEDDING)

    with patch("query_engine.api.retrieve", side_effect=retrieve), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=lf):
        client.post("/api/query/stream", json={"question": "Do I need a permit?"})

    assert order.index("enter") < order.index("retrieve") < order.index("exit")


class _recording_cm:
    def __init__(self, log):
        self.log = log

    def __enter__(self):
        self.log.append("enter")
        return MagicMock()

    def __exit__(self, *exc):
        self.log.append("exit")
        return False


# --- the behaviour change that came with it ---------------------------------

def test_a_retrieval_failure_arrives_as_an_error_event_not_a_500():
    """Moving retrieval into the generator moved its failures onto the protocol
    the endpoint already speaks. A provider outage has always arrived as an
    `error` event, the web client has handled `error` since streaming was added,
    and a half-open stream that 500s is worse to consume than one that says so.
    """
    with patch("query_engine.api.retrieve", side_effect=RuntimeError("pgvector is down")), \
         patch("query_engine.api.get_client", return_value=MagicMock()):
        response = client.post("/api/query/stream", json={"question": "anything"})

    assert response.status_code == 200
    events = _events(response)
    assert [e for e, _ in events] == ["error"]
    assert "pgvector is down" in events[0][1]


def test_the_stream_still_answers_normally():
    """The restructure moved two calls into a generator. This is the check that
    it still produces the same events in the same order."""
    with patch("query_engine.api.retrieve", return_value=(CHUNKS, MOCK_EMBEDDING)), \
         patch("query_engine.api.check_cache", return_value=None), \
         patch("query_engine.api.store_cache"), \
         patch("query_engine.api.build_chain", return_value=_chain()), \
         patch("query_engine.api.get_client", return_value=MagicMock()):
        response = client.post("/api/query/stream", json={"question": "Do I need a permit?"})

    assert response.status_code == 200
    kinds = [e for e, _ in _events(response)]
    assert "final" in kinds
    assert "error" not in kinds


def test_a_question_with_no_chunks_still_says_so_rather_than_erroring():
    with patch("query_engine.api.retrieve", return_value=([], MOCK_EMBEDDING)), \
         patch("query_engine.api.get_client", return_value=MagicMock()):
        response = client.post("/api/query/stream", json={"question": "something random"})

    events = _events(response)
    assert [e for e, _ in events] == ["final"]
    assert "couldn't find" in events[0][1]["answer"].lower()


# --- is the site actually self-hosting its embeddings? ----------------------

def test_health_embeddings_reports_the_endpoint_that_really_served():
    """The question this answers cannot be answered from configuration.

    On 2026-09-21 the configuration named two self-hosted endpoints and every
    embedding went to the paid provider, because a trailing comment in .env made
    both URLs 404 and the chain fell through as designed. `serving` is what the
    last embedding used; `preferred` is what configuration wanted. Those
    disagreeing is the whole reason this exists.
    """
    from indexer import embedder

    ep = embedder.Endpoint("self-hosted-1", "http://nvidia:11434/v1", "k", "m", limit=2048)
    with patch.object(embedder, "build_endpoints", return_value=[ep]), \
         patch.object(embedder, "LAST_SERVED_BY", "fireworks"), \
         patch.object(embedder, "CONFIG_PROBLEMS", []):
        body = client.get("/health/embeddings").json()

    assert body["preferred"] == "self-hosted-1"
    assert body["serving"] == "fireworks"
    # Answering correctly from the wrong place is not "ok".
    assert body["status"] == "degraded"


def test_health_embeddings_surfaces_a_skipped_endpoint():
    from indexer import embedder

    ep = embedder.Endpoint("fireworks", "https://fw/v1", "k", "m", limit=None)
    with patch.object(embedder, "build_endpoints", return_value=[ep]), \
         patch.object(embedder, "LAST_SERVED_BY", None), \
         patch.object(embedder, "CONFIG_PROBLEMS",
                      ["EMBEDDING_BASE_URL contains whitespace"]):
        body = client.get("/health/embeddings").json()

    assert body["status"] == "degraded"
    assert "whitespace" in body["problems"][0]


def test_health_embeddings_is_ok_when_the_preferred_endpoint_is_serving():
    from indexer import embedder

    ep = embedder.Endpoint("self-hosted-1", "http://nvidia:11434/v1", "k", "m", limit=2048)
    with patch.object(embedder, "build_endpoints", return_value=[ep]), \
         patch.object(embedder, "LAST_SERVED_BY", "self-hosted-1"), \
         patch.object(embedder, "CONFIG_PROBLEMS", []):
        body = client.get("/health/embeddings").json()

    assert body["status"] == "ok"
    assert body["chain"][0]["input_limit"] == 2048
