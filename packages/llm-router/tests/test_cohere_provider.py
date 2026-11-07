import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from llm_router.cohere_provider import CohereProvider


@pytest.mark.asyncio
async def test_cohere_provider_generate():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "Cohere response"
    mock_response.usage.prompt_tokens = 12
    mock_response.usage.completion_tokens = 8

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        provider = CohereProvider(api_key="test-key", model="command-r-08-2024")
        result = await provider.generate(prompt="Test prompt", system="Sys")

    assert result.text == "Cohere response"
    assert result.model == "command-r-08-2024"
    assert result.total_tokens == 20

    _, kwargs = mock_client.chat.completions.create.call_args
    assert kwargs["temperature"] == 0
    assert kwargs["model"] == "command-r-08-2024"
    assert kwargs["messages"][0] == {"role": "system", "content": "Sys"}
    assert kwargs["messages"][1] == {"role": "user", "content": "Test prompt"}
