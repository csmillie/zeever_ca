"""Together serves reasoning models that answer into a `reasoning` field.

Without thinking disabled they return empty `content`, which reaches users as a
blank answer rather than an error. These tests pin the behaviour that prevents it.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from llm_router.together_provider import TogetherProvider, _default_extra_body


def _mock_client(content: str, finish_reason: str = "stop"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.choices[0].finish_reason = finish_reason
    resp.usage.prompt_tokens = 10
    resp.usage.completion_tokens = 5
    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=resp)
    return client


@pytest.mark.parametrize("model", [
    "Qwen/Qwen3.5-9B", "Qwen/Qwen3.6-35B-A3B-FP8", "Qwen/Qwen3-8B", "Qwen/Qwen3.7-Plus",
])
def test_reasoning_models_disable_thinking_by_default(model):
    assert _default_extra_body(model) == {"chat_template_kwargs": {"enable_thinking": False}}


@pytest.mark.parametrize("model", [
    # gpt-oss deliberately absent: it turned out to be a reasoning model too, which
    # this test previously asserted the opposite of. See the gpt-oss test below.
    "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
])
def test_non_reasoning_models_send_no_extra_body(model):
    assert _default_extra_body(model) == {}


@pytest.mark.asyncio
async def test_thinking_disabled_reaches_the_request():
    client = _mock_client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = TogetherProvider(api_key="k", model="Qwen/Qwen3.5-9B")
        result = await provider.generate(prompt="q")

    assert result.text == "An answer."
    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}


@pytest.mark.asyncio
async def test_explicit_extra_body_wins():
    client = _mock_client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = TogetherProvider(api_key="k", model="Qwen/Qwen3.5-9B", extra_body={"custom": 1})
        await provider.generate(prompt="q")

    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["extra_body"] == {"custom": 1}


@pytest.mark.asyncio
async def test_explicit_empty_extra_body_is_respected():
    """Passing {} must mean 'send nothing', not 'fall back to the default'."""
    client = _mock_client("An answer.")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = TogetherProvider(api_key="k", model="Qwen/Qwen3.5-9B", extra_body={})
        await provider.generate(prompt="q")

    _, kwargs = client.chat.completions.create.call_args
    assert "extra_body" not in kwargs


@pytest.mark.asyncio
@pytest.mark.parametrize("content", ["", "   ", None])
async def test_empty_content_raises_rather_than_returning_blank(content):
    client = _mock_client(content, finish_reason="length")
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = TogetherProvider(api_key="k", model="Qwen/Qwen3.5-9B")
        with pytest.raises(ValueError, match="empty content"):
            await provider.generate(prompt="q")


@pytest.mark.parametrize("model", ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
def test_gpt_oss_gets_low_effort_not_thinking_off(model):
    """gpt-oss always reasons; it can only be turned down, not off. At default
    effort it can burn the whole token budget and return empty content."""
    assert _default_extra_body(model) == {"reasoning_effort": "low"}


def test_the_two_families_get_different_switches():
    qwen = _default_extra_body("Qwen/Qwen3.5-9B")
    oss = _default_extra_body("openai/gpt-oss-20b")
    assert qwen != oss
    assert "chat_template_kwargs" in qwen and "reasoning_effort" in oss
