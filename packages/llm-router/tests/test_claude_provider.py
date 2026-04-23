import pytest
from unittest.mock import AsyncMock, MagicMock
from llm_router.claude_provider import ClaudeProvider

@pytest.mark.asyncio
async def test_claude_provider_generate():
    provider = ClaudeProvider(api_key="test-key", model="claude-sonnet-4-20250514")

    mock_content = MagicMock()
    mock_content.text = "Test response"
    mock_usage = MagicMock()
    mock_usage.input_tokens = 10
    mock_usage.output_tokens = 20
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage

    provider.client.messages.create = AsyncMock(return_value=mock_response)

    result = await provider.generate(prompt="Test prompt", system="Test system")
    assert result.text == "Test response"
    assert result.model == "claude-sonnet-4-20250514"
    assert result.total_tokens == 30
