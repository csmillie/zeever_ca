import pytest
from query_engine.provider_chain import Link
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from query_engine.api import app
from llm_router.provider import LLMResponse

client = TestClient(app)

MOCK_EMBEDDING = [0.1] * 768

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_query_no_results():
    with patch("query_engine.api.retrieve", return_value=([], MOCK_EMBEDDING)):
        response = client.post("/api/query", json={"question": "something random"})

    assert response.status_code == 200
    data = response.json()
    assert "couldn't find" in data["answer"].lower()
    assert data["sources"] == []
    assert data["response_time"]["seconds"] >= 0
    assert data["response_time"]["milliseconds"] >= 0

def test_query_with_results():
    mock_chunks = [
        {"id": "1", "chunk_text": "Decks need a permit", "url": "https://toronto.ca/permits", "title": "Permits", "content_type": "page", "similarity": 0.9}
    ]
    mock_llm_response = LLMResponse(
        text="Yes, you need a permit for a deck. [Source: https://toronto.ca/permits]",
        model="test-model",
        input_tokens=100,
        output_tokens=50,
    )

    with patch("query_engine.api.retrieve", return_value=(mock_chunks, MOCK_EMBEDDING)):
        with patch("query_engine.api.check_cache", return_value=None):
            with patch("query_engine.api.store_cache"):
                # The API no longer constructs a provider directly; it builds an
                # ordered chain and falls through failures. Patch the chain so the
                # test still exercises one healthy provider end to end.
                mock_provider = AsyncMock()
                mock_provider.generate.return_value = mock_llm_response
                fake_chain = [Link(label="test", provider=mock_provider, timeout_s=5.0)]
                with patch("query_engine.api.build_chain", return_value=fake_chain):
                    response = client.post("/api/query", json={"question": "Do I need a permit for a deck?"})

    assert response.status_code == 200
    data = response.json()
    assert "permit" in data["answer"].lower()
    assert data["query_class"] == "conditional"
    assert len(data["sources"]) > 0
    rt = data["response_time"]
    assert rt["milliseconds"] >= 0
    assert isinstance(rt["seconds"], (int, float))
    # seconds and milliseconds describe the same duration
    assert round(rt["seconds"] * 1000) == rt["milliseconds"]
