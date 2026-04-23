from unittest.mock import patch, MagicMock
from indexer.vector_store import store_embedding, search_similar


def test_store_embedding():
    mock_session = MagicMock()

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("indexer.vector_store.get_session", return_value=mock_cm):
        store_embedding("chunk-123", [0.1] * 1536)

    mock_session.execute.assert_called_once()
    mock_session.commit.assert_called_once()


def test_search_similar():
    mock_row = MagicMock()
    mock_row._mapping = {
        "id": "chunk-1",
        "chunk_text": "Building permits info",
        "metadata": {},
        "url": "https://toronto.ca/permits",
        "title": "Permits",
        "content_type": "page",
        "similarity": 0.95,
    }
    mock_session = MagicMock()
    mock_session.execute.return_value = [mock_row]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("indexer.vector_store.get_session", return_value=mock_cm):
        results = search_similar([0.1] * 1536, limit=5)

    assert len(results) == 1
    assert results[0]["chunk_text"] == "Building permits info"
    assert results[0]["similarity"] == 0.95
