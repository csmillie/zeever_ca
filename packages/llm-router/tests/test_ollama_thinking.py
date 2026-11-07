"""Ollama auto-enables thinking, which returns empty content.

The switch differs from Together's: `think: false` is not honoured on the
OpenAI-compatible route, and `reasoning_effort: "none"` is what works. Confirmed
against Ollama 0.33.1 with qwen3:14b via scripts/check_ollama.py.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from llm_router.ollama_provider import OllamaProvider, _default_extra_body


def _client(content, finish_reason="stop"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.choices[0].finish_reason = finish_reason
    resp.usage.prompt_tokens = 7
    resp.usage.completion_tokens = 3
    c = MagicMock()
    c.chat.completions.create = AsyncMock(return_value=resp)
    return c


@pytest.mark.parametrize("model", ["qwen3:14b", "qwen3:4b", "qwq:32b", "deepseek-r1:7b", "QWEN3:14B"])
def test_thinking_models_get_reasoning_effort_none(model):
    assert _default_extra_body(model) == {"reasoning_effort": "none"}


@pytest.mark.parametrize("model", ["qwen2.5:7b-instruct", "qwen2.5:14b", "llama3:latest", "gemma3:12b"])
def test_non_thinking_models_send_nothing(model):
    """qwen2.5 must not be caught by a loose qwen3 match."""
    assert _default_extra_body(model) == {}


@pytest.mark.asyncio
async def test_switch_reaches_the_request():
    client = _client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(base_url="http://amd:11434/v1", model="qwen3:14b")
        result = await provider.generate(prompt="q")

    assert result.text == "An answer."
    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["extra_body"] == {"reasoning_effort": "none"}


@pytest.mark.asyncio
async def test_no_extra_body_for_ordinary_models():
    client = _client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="qwen2.5:7b-instruct")
        await provider.generate(prompt="q")

    _, kwargs = client.chat.completions.create.call_args
    assert "extra_body" not in kwargs


@pytest.mark.asyncio
@pytest.mark.parametrize("content", ["", "  ", None])
async def test_empty_content_raises(content):
    """A thinking model that slips through must fail loudly, not serve blanks."""
    client = _client(content)
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="qwen3:14b")
        with pytest.raises(ValueError, match="empty content"):
            await provider.generate(prompt="q")


@pytest.mark.asyncio
async def test_explicit_extra_body_wins():
    client = _client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OllamaProvider(model="qwen3:14b", extra_body={"reasoning_effort": "low"})
        await provider.generate(prompt="q")

    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["extra_body"] == {"reasoning_effort": "low"}


def test_gpt_oss_tag_gets_low_effort():
    assert _default_extra_body("gpt-oss:20b") == {"reasoning_effort": "low"}


def test_qwen3_and_gpt_oss_differ():
    """qwen3 can be turned off entirely; gpt-oss can only be turned down."""
    assert _default_extra_body("qwen3:14b") == {"reasoning_effort": "none"}
    assert _default_extra_body("gpt-oss:20b") == {"reasoning_effort": "low"}
