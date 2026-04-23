from unittest.mock import patch, MagicMock
from indexer.index_pipeline import run_index_pipeline

def test_index_pipeline_no_chunks():
    mock_session = MagicMock()
    mock_session.execute.return_value.all.return_value = []

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("indexer.index_pipeline.get_session", return_value=mock_cm):
        run_index_pipeline()

def test_index_pipeline_embeds_chunks():
    mock_chunk_1 = MagicMock()
    mock_chunk_1.id = "chunk-1"
    mock_chunk_1.chunk_text = "Building permit info"

    mock_chunk_2 = MagicMock()
    mock_chunk_2.id = "chunk-2"
    mock_chunk_2.chunk_text = "Fee schedule info"

    mock_session = MagicMock()
    mock_session.execute.return_value.all.return_value = [mock_chunk_1, mock_chunk_2]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("indexer.index_pipeline.get_session", return_value=mock_cm):
        with patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768, [0.2] * 768]) as mock_embed:
            with patch("indexer.index_pipeline.store_embedding") as mock_store:
                run_index_pipeline(batch_size=10)

    mock_embed.assert_called_once()
    assert mock_store.call_count == 2
    mock_store.assert_any_call("chunk-1", [0.1] * 768)
    mock_store.assert_any_call("chunk-2", [0.2] * 768)
