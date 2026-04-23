import pytest
import json
from unittest.mock import AsyncMock, patch
from graphrag_pkg.extractor import extract_entities_and_relationships
from llm_router.provider import LLMResponse

MOCK_EXTRACTION_RESPONSE = json.dumps({
    "nodes": [
        {"name": "residential building permit", "node_type": "permit_type", "description": "Permit for residential construction"},
        {"name": "application form", "node_type": "document", "description": "Required application form"},
        {"name": "site plan", "node_type": "document", "description": "Site plan drawing"},
    ],
    "edges": [
        {"source": "residential building permit", "target": "application form", "relationship": "requires"},
        {"source": "residential building permit", "target": "site plan", "relationship": "requires"},
    ],
})

def _mock_provider():
    """Create a mock LLM provider that returns the extraction response."""
    provider = AsyncMock()
    provider.generate.return_value = LLMResponse(
        text=MOCK_EXTRACTION_RESPONSE,
        model="deepseek-v3",
        input_tokens=200,
        output_tokens=100,
    )
    return provider

@pytest.mark.asyncio
async def test_extract_entities():
    mock_provider = _mock_provider()

    with patch("graphrag_pkg.extractor.FireworksProvider", return_value=mock_provider), \
         patch("graphrag_pkg.extractor.ClaudeProvider", return_value=mock_provider):
        result = await extract_entities_and_relationships(
            "To apply for a residential building permit, submit an application form and site plan.",
            source_chunk_id="chunk-1",
        )

    assert len(result.nodes) == 3
    assert len(result.edges) == 2
    assert any(n.name == "residential building permit" for n in result.nodes)
    assert any(e.relationship == "requires" for e in result.edges)

@pytest.mark.asyncio
async def test_extract_handles_markdown_code_block():
    """Test that extraction handles LLM wrapping JSON in markdown code blocks."""
    wrapped_response = f"```json\n{MOCK_EXTRACTION_RESPONSE}\n```"

    mock_provider = AsyncMock()
    mock_provider.generate.return_value = LLMResponse(
        text=wrapped_response,
        model="deepseek-v3",
        input_tokens=200,
        output_tokens=100,
    )

    with patch("graphrag_pkg.extractor.FireworksProvider", return_value=mock_provider), \
         patch("graphrag_pkg.extractor.ClaudeProvider", return_value=mock_provider):
        result = await extract_entities_and_relationships("Test text")

    assert len(result.nodes) == 3

@pytest.mark.asyncio
async def test_extract_sets_source_chunk_id():
    mock_provider = _mock_provider()

    with patch("graphrag_pkg.extractor.FireworksProvider", return_value=mock_provider), \
         patch("graphrag_pkg.extractor.ClaudeProvider", return_value=mock_provider):
        result = await extract_entities_and_relationships("text", source_chunk_id="my-chunk")

    for node in result.nodes:
        assert node.source_chunk_id == "my-chunk"
