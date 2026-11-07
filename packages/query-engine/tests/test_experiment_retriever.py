import pytest
from unittest.mock import patch
from query_engine import experiment_retriever as er


def test_pgvector_vector_dispatch_and_threshold():
    chunks = [{"id": "a", "chunk_text": "x", "url": "u", "similarity": 0.9},
              {"id": "b", "chunk_text": "y", "url": "u", "similarity": 0.1}]
    with patch.object(er, "embed_texts", return_value=[[0.1]]), \
         patch.object(er, "search_similar", return_value=chunks) as ss:
        out, emb = er.retrieve_arm("q", backend="pgvector", mode="vector", limit=5)
    ss.assert_called_once()
    assert [c["id"] for c in out] == ["a"]  # 0.1 filtered out by 0.2 threshold
    assert emb == [0.1]


def test_turbopuffer_hybrid_dispatch():
    chunks = [{"id": "a", "chunk_text": "x", "url": "u", "similarity": 0.8}]
    with patch.object(er, "embed_texts", return_value=[[0.1]]), \
         patch.object(er, "search_hybrid", return_value=chunks) as sh:
        out, _ = er.retrieve_arm("q", backend="turbopuffer", mode="hybrid", limit=5)
    sh.assert_called_once_with([0.1], "q", 5)
    assert [c["id"] for c in out] == ["a"]


def test_unknown_backend_raises():
    with patch.object(er, "embed_texts", return_value=[[0.1]]):
        with pytest.raises(ValueError):
            er.retrieve_arm("q", backend="nope", mode="vector")
