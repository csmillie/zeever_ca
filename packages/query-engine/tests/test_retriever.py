from unittest.mock import patch
from query_engine.retriever import retrieve

def test_retrieve_calls_embed_and_search():
    with patch("query_engine.retriever.embed_texts", return_value=[[0.1] * 768]) as mock_embed:
        with patch("query_engine.retriever.search_similar", return_value=[
            {"id": "1", "chunk_text": "test", "url": "https://toronto.ca/test", "similarity": 0.9}
        ]) as mock_search:
            chunks, embedding = retrieve("test query", limit=3)

    mock_embed.assert_called_once_with(["test query"])
    mock_search.assert_called_once_with([0.1] * 768, limit=3)
    assert len(chunks) == 1
    assert len(embedding) == 768
