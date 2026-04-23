import pytest
from unittest.mock import AsyncMock, MagicMock
from query_engine.generator import generate_answer
from llm_router.provider import LLMResponse

@pytest.mark.asyncio
async def test_generate_answer():
    mock_provider = AsyncMock()
    mock_provider.generate.return_value = LLMResponse(
        text="You need a permit for decks. [Source: https://toronto.ca/permits]",
        model="claude-sonnet-4-20250514",
        input_tokens=100,
        output_tokens=50,
    )

    chunks = [
        {"url": "https://toronto.ca/permits", "chunk_text": "Decks require a building permit."},
        {"url": "https://toronto.ca/fees", "chunk_text": "The fee is $500."},
    ]

    result = await generate_answer("Do I need a permit for a deck?", chunks, mock_provider)

    assert "permit" in result["answer"].lower()
    assert len(result["sources"]) == 2
    assert result["model"] == "claude-sonnet-4-20250514"
    assert result["total_tokens"] == 150
