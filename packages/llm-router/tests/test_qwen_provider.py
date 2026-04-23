import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from llm_router.qwen_provider import QwenProvider

@pytest.mark.asyncio
async def test_qwen_provider_generate():
    provider = QwenProvider(api_url="https://api.example.com", api_key="test-key")

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Qwen response"}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 25},
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await provider.generate(prompt="Test prompt")

    assert result.text == "Qwen response"
    assert result.total_tokens == 40
