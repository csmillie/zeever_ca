import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from llm_router.augure_provider import AugureProvider
from llm_router.factory import build_provider


@pytest.mark.asyncio
async def test_augure_provider_generate():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "Augure response"
    mock_response.usage.prompt_tokens = 15
    mock_response.usage.completion_tokens = 9

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        provider = AugureProvider(api_key="test-key", model="ossington-5")
        result = await provider.generate(prompt="Test prompt", system="Sys")

    assert result.text == "Augure response"
    assert result.model == "ossington-5"
    assert result.total_tokens == 24

    _, kwargs = mock_client.chat.completions.create.call_args
    assert kwargs["temperature"] == 0
    assert kwargs["model"] == "ossington-5"
    assert kwargs["messages"][0] == {"role": "system", "content": "Sys"}
    assert kwargs["messages"][1] == {"role": "user", "content": "Test prompt"}


@pytest.mark.asyncio
async def test_augure_provider_omits_empty_system():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "ok"
    mock_response.usage.prompt_tokens = 1
    mock_response.usage.completion_tokens = 1

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        provider = AugureProvider(api_key="test-key")
        await provider.generate(prompt="Hi")

    _, kwargs = mock_client.chat.completions.create.call_args
    assert kwargs["messages"] == [{"role": "user", "content": "Hi"}]


def test_augure_defaults_to_canadian_gateway():
    with patch("openai.AsyncOpenAI") as mock_openai:
        AugureProvider(api_key="test-key")

    _, kwargs = mock_openai.call_args
    assert kwargs["base_url"] == "https://api.augureai.ca/v1"


def test_factory_builds_augure():
    with patch("openai.AsyncOpenAI", return_value=MagicMock()):
        provider = build_provider(
            "augure",
            api_key="test-key",
            base_url="https://api.augureai.ca/v1",
            model="rosedale-1",
        )

    assert isinstance(provider, AugureProvider)
    assert provider.model == "rosedale-1"
