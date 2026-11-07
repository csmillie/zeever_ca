from unittest.mock import patch
from query_engine import retriever as r
from query_engine.retriever import retrieve

CHUNKS = [{"id": "a", "chunk_text": "x", "url": "u", "similarity": 0.9}]


def test_pgvector_default_uses_search_similar():
    with patch.object(r, "embed_texts", return_value=[[0.1]]), \
         patch.object(r.settings, "retrieval_backend", "pgvector"), \
         patch.object(r, "search_similar", return_value=CHUNKS) as ss, \
         patch.object(r, "search_vector") as sv:
        out, _ = r.retrieve("q", limit=5)
    ss.assert_called_once()
    sv.assert_not_called()
    assert [c["id"] for c in out] == ["a"]


def test_turbopuffer_backend_uses_search_vector():
    with patch.object(r, "embed_texts", return_value=[[0.1]]), \
         patch.object(r.settings, "retrieval_backend", "turbopuffer"), \
         patch.object(r, "search_vector", return_value=CHUNKS) as sv, \
         patch.object(r, "search_similar") as ss:
        out, _ = r.retrieve("q", limit=5)
    sv.assert_called_once()
    ss.assert_not_called()
    assert [c["id"] for c in out] == ["a"]


def test_turbopuffer_falls_back_to_pgvector_on_error():
    with patch.object(r, "embed_texts", return_value=[[0.1]]), \
         patch.object(r.settings, "retrieval_backend", "turbopuffer"), \
         patch.object(r, "search_vector", side_effect=RuntimeError("tpuf down")), \
         patch.object(r, "search_similar", return_value=CHUNKS) as ss:
        out, _ = r.retrieve("q", limit=5)
    ss.assert_called_once()  # fell back
    assert [c["id"] for c in out] == ["a"]


def test_retrieve_calls_embed_and_search():
    # The backend is pinned because settings reads the deployment's .env, and
    # production runs turbopuffer: unpinned, this asserted against whichever store
    # the machine happened to be configured for and failed on the live host while
    # passing everywhere else.
    with patch.object(r.settings, "retrieval_backend", "pgvector"), \
         patch("query_engine.retriever.embed_texts", return_value=[[0.1] * 768]) as mock_embed:
        with patch("query_engine.retriever.search_similar", return_value=[
            {"id": "1", "chunk_text": "test", "url": "https://toronto.ca/test", "similarity": 0.9}
        ]) as mock_search:
            chunks, embedding = retrieve("test query", limit=3)

    mock_embed.assert_called_once_with(["test query"])
    # Retrieval over-fetches so that dropping duplicates and capping any one page
    # cannot leave the caller with fewer chunks than it asked for.
    mock_search.assert_called_once_with([0.1] * 768, limit=9)
    assert len(chunks) == 1
    assert len(embedding) == 768
