from unittest.mock import patch, MagicMock
from indexer.embedder import embed_texts


def test_embed_texts_returns_vectors():
    mock_embedding = MagicMock()
    mock_embedding.embedding = [0.1] * 1536

    mock_response = MagicMock()
    mock_response.data = [mock_embedding]

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = mock_response

    with patch("openai.OpenAI", return_value=mock_client):
        vectors = embed_texts(["test text"])

    assert len(vectors) == 1
    assert len(vectors[0]) == 1536


def test_embed_texts_batches():
    mock_embedding = MagicMock()
    mock_embedding.embedding = [0.1] * 1536

    def make_response(model, input):
        mock_response = MagicMock()
        mock_response.data = [mock_embedding] * len(input)
        return mock_response

    mock_client = MagicMock()
    mock_client.embeddings.create.side_effect = make_response

    with patch("openai.OpenAI", return_value=mock_client):
        texts = [f"text {i}" for i in range(150)]
        vectors = embed_texts(texts)

    assert len(vectors) == 150  # 100 + 50
    assert mock_client.embeddings.create.call_count == 2  # 2 batches
