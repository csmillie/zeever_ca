import pytest
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
                with patch("query_engine.api.TogetherProvider") as mock_provider_class:
                    mock_provider = AsyncMock()
                    mock_provider.generate.return_value = mock_llm_response
                    mock_provider_class.return_value = mock_provider

                    response = client.post("/api/query", json={"question": "Do I need a permit for a deck?"})

    assert response.status_code == 200
    data = response.json()
    assert "permit" in data["answer"].lower()
    assert data["query_class"] == "conditional"
    assert len(data["sources"]) > 0
