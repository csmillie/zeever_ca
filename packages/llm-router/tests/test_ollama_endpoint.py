"""The /v1 prefix, request shape, streaming, and what failures say.

A bare `OLLAMA_BASE_URL` sent every generation to `/chat/completions`, which
Ollama answers with 404. It survived because `scripts/check_ollama.py`
normalises the URL before probing, so the health check passed while production
failed. These tests pin the normalisation to the provider, where the app depends
on it, and pin the error text that would have named the cause.
"""
import httpx
import openai
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from llm_router.ollama_provider import (
    OllamaError,
    OllamaProvider,
    _normalize_base_url,
    native_root,
)


# --- URL construction ---------------------------------------------------------

@pytest.mark.parametrize("given", [
    "http://host:11434",
    "http://host:11434/",
    "http://host:11434/v1",
    "http://host:11434/v1/",
    "  http://host:11434/v1  ",
])
def test_every_spelling_normalises_to_one_v1(given):
    assert _normalize_base_url(given) == "http://host:11434/v1"


def test_no_double_v1():
    once = _normalize_base_url("http://host:11434/v1")
    twice = _normalize_base_url(once)
    assert twice == "http://host:11434/v1"
    assert "/v1/v1" not in twice


def test_empty_stays_empty():
    """An unset URL must not become a bare '/v1' that looks configured."""
    assert _normalize_base_url("") == ""
    assert _normalize_base_url(None) == ""


@pytest.mark.parametrize("given", ["http://host:11434", "http://host:11434/v1"])
def test_native_root_strips_v1_for_the_native_api(given):
    root = native_root(given)
    assert root == "http://host:11434"
    assert f"{root}/api/tags".count("/api") == 1


def test_openai_endpoint_is_v1_chat_completions():
    with patch("openai.AsyncOpenAI", return_value=MagicMock()):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
    assert provider.endpoint == "http://host:11434/v1/chat/completions"


def test_client_is_built_with_the_normalised_url():
    with patch("openai.AsyncOpenAI") as ctor:
        OllamaProvider(base_url="http://host:11434", model="m")
    assert ctor.call_args.kwargs["base_url"] == "http://host:11434/v1"


def test_no_retries_configured():
    """A retry after generation started is a second inference, not a repair."""
    with patch("openai.AsyncOpenAI") as ctor:
        OllamaProvider(base_url="http://host:11434", model="m")
    assert ctor.call_args.kwargs["max_retries"] == 0


def test_connect_and_read_timeouts_differ():
    with patch("openai.AsyncOpenAI") as ctor:
        OllamaProvider(base_url="http://host:11434", model="m")
    timeout = ctor.call_args.kwargs["timeout"]
    assert timeout.connect == 5.0
    assert timeout.read == 300.0


# --- request contents ---------------------------------------------------------

def _client(content="An answer.", finish_reason="stop"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.choices[0].finish_reason = finish_reason
    resp.usage.prompt_tokens = 7
    resp.usage.completion_tokens = 3
    c = MagicMock()
    c.chat.completions.create = AsyncMock(return_value=resp)
    return c


@pytest.mark.asyncio
async def test_max_tokens_is_sent():
    client = _client()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="qwen2.5:7b-instruct")
        await provider.generate(prompt="q", max_tokens=800)
    assert client.chat.completions.create.call_args.kwargs["max_tokens"] == 800


@pytest.mark.asyncio
async def test_reasoning_effort_is_configurable():
    client = _client()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="gpt-oss:20b", reasoning_effort="high")
        await provider.generate(prompt="q")
    assert client.chat.completions.create.call_args.kwargs["extra_body"] == {
        "reasoning_effort": "high"
    }


@pytest.mark.asyncio
async def test_reasoning_effort_defaults_to_low_for_gpt_oss():
    client = _client()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="gpt-oss:20b")
        await provider.generate(prompt="q")
    assert client.chat.completions.create.call_args.kwargs["extra_body"] == {
        "reasoning_effort": "low"
    }


# --- failures -----------------------------------------------------------------

def _status_error(code: int, text: str = "") -> openai.APIStatusError:
    request = httpx.Request("POST", "http://host:11434/chat/completions")
    response = httpx.Response(code, request=request, text=text)
    return openai.APIStatusError("boom", response=response, body=None)


@pytest.mark.asyncio
async def test_404_points_at_the_missing_v1():
    client = _client()
    client.chat.completions.create = AsyncMock(side_effect=_status_error(404, "404 page not found"))
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        with pytest.raises(OllamaError) as exc:
            await provider.generate(prompt="q")
    message = str(exc.value)
    assert "/v1" in message
    assert "OLLAMA_BASE_URL" in message
    assert exc.value.status == 404
    assert exc.value.endpoint == "http://host:11434/v1/chat/completions"


@pytest.mark.asyncio
async def test_400_reports_the_server_body():
    client = _client()
    client.chat.completions.create = AsyncMock(
        side_effect=_status_error(400, "model 'nope:1b' not found")
    )
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434/v1", model="nope:1b")
        with pytest.raises(OllamaError, match="not found"):
            await provider.generate(prompt="q")


@pytest.mark.asyncio
async def test_connection_failure_is_plain_language():
    request = httpx.Request("POST", "http://host:11434/v1/chat/completions")
    client = _client()
    client.chat.completions.create = AsyncMock(
        side_effect=openai.APIConnectionError(request=request)
    )
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        with pytest.raises(OllamaError, match="Could not reach Ollama"):
            await provider.generate(prompt="q")


@pytest.mark.asyncio
async def test_timeout_says_it_will_not_retry():
    request = httpx.Request("POST", "http://host:11434/v1/chat/completions")
    client = _client()
    client.chat.completions.create = AsyncMock(
        side_effect=openai.APITimeoutError(request=request)
    )
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        with pytest.raises(OllamaError, match="timed out"):
            await provider.generate(prompt="q")


# --- streaming ----------------------------------------------------------------

class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks
        self.closed = False

    def __aiter__(self):
        async def gen():
            for c in self._chunks:
                yield c
        return gen()

    async def close(self):
        self.closed = True


def _chunk(text=None, reasoning=None, usage=None):
    """MagicMock invents attributes, so absent fields are set to None explicitly."""
    c = MagicMock()
    if usage is not None:
        c.usage = MagicMock(prompt_tokens=usage[0], completion_tokens=usage[1])
        c.choices = []
        return c
    c.usage = None
    delta = MagicMock()
    delta.content = text
    delta.reasoning = reasoning
    delta.reasoning_content = None
    c.choices = [MagicMock(delta=delta)]
    return c


def _streaming_client(chunks):
    stream = _FakeStream(chunks)
    c = MagicMock()
    c.chat.completions.create = AsyncMock(return_value=stream)
    return c, stream


@pytest.mark.asyncio
async def test_stream_assembles_text_and_separates_reasoning():
    client, stream = _streaming_client([
        _chunk(reasoning="thinking..."),
        _chunk(text="Hello "),
        _chunk(text="world"),
        _chunk(usage=(120, 8)),
    ])
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="gpt-oss:20b")
        got = [(k, v) async for k, v in provider.stream(prompt="q", max_tokens=800)]

    assert "".join(v for k, v in got if k == "text") == "Hello world"
    assert [v for k, v in got if k == "reasoning"] == ["thinking..."]
    assert ("usage", {"input_tokens": 120, "output_tokens": 8}) in got
    assert stream.closed


@pytest.mark.asyncio
async def test_stream_requests_usage_and_max_tokens():
    client, _ = _streaming_client([_chunk(text="x")])
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        async for _ in provider.stream(prompt="q", max_tokens=512):
            pass
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["stream"] is True
    assert kwargs["max_tokens"] == 512
    assert kwargs["stream_options"] == {"include_usage": True}


@pytest.mark.asyncio
async def test_stream_404_also_points_at_v1():
    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=_status_error(404))
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        with pytest.raises(OllamaError, match="/v1"):
            async for _ in provider.stream(prompt="q"):
                pass


@pytest.mark.asyncio
async def test_abandoning_the_stream_closes_the_response():
    """Cancellation has to reach Ollama, or it keeps generating for nobody."""
    client, stream = _streaming_client([_chunk(text="a"), _chunk(text="b"), _chunk(text="c")])
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://host:11434", model="m")
        agen = provider.stream(prompt="q")
        async for _ in agen:
            break
        await agen.aclose()

    assert stream.closed
