import pytest
from unittest.mock import patch, MagicMock

from indexer.index_pipeline import TurbopufferSyncFailed, run_index_pipeline
from shared.config import settings


@pytest.fixture(autouse=True)
def turbopuffer_configured():
    """The dual-write only runs when Turbopuffer is configured, and the switch is
    the API key, which this machine does not have. Unpinned, every test in this
    module asserting a sync would pass by never attempting one."""
    with patch("indexer.index_pipeline.turbopuffer_enabled", return_value=True):
        yield

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
                with patch("indexer.index_pipeline.sync_chunk_ids"):
                    run_index_pipeline(batch_size=10)

    mock_embed.assert_called_once()
    assert mock_store.call_count == 2
    mock_store.assert_any_call("chunk-1", [0.1] * 768)
    mock_store.assert_any_call("chunk-2", [0.2] * 768)


def _one_chunk_session():
    chunk = MagicMock()
    chunk.id = "chunk-1"
    chunk.chunk_text = "info"
    session = MagicMock()
    session.execute.return_value.all.return_value = [chunk]
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=session)
    cm.__exit__ = MagicMock(return_value=False)
    return cm


def test_pipeline_dual_writes_to_turbopuffer():
    with patch("indexer.index_pipeline.get_session", return_value=_one_chunk_session()), \
         patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768]), \
         patch("indexer.index_pipeline.store_embedding"), \
         patch("indexer.index_pipeline.sync_chunk_ids") as sync:
        run_index_pipeline(batch_size=10)
    sync.assert_called_once_with(["chunk-1"])


# --- what happens when the dual-write fails -----------------------------------
# It used to print a warning and report the run successful, whichever backend was
# serving. The two stores drifted 13,188 rows apart and nobody saw it until a
# restored page failed to appear in an answer. Embedding still finishes either
# way, because the Postgres embeddings are durable and worth keeping; what
# changes is whether the run admits it half worked.

def _failing_sync_run(backend, attempts=1):
    """Run the pipeline with a sync that always fails, under a chosen backend."""
    with patch("indexer.index_pipeline.get_session", return_value=_one_chunk_session()), \
         patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768]), \
         patch("indexer.index_pipeline.store_embedding") as store, \
         patch.object(settings, "retrieval_backend", backend), \
         patch("indexer.index_pipeline.sync_chunk_ids", side_effect=RuntimeError("down")):
        run_index_pipeline(batch_size=10, sync_attempts=attempts)
    return store


def test_sync_failure_under_pgvector_only_warns():
    """pgvector is serving, so nothing is missing from search. The gap is real
    but costs nothing today, and failing the run would be noise."""
    store = _failing_sync_run("pgvector")
    store.assert_called_once()  # the embedding still happened


def test_sync_failure_under_turbopuffer_raises():
    """Turbopuffer is serving, so those chunks are not searchable. A run that
    leaves the index short must not report success."""
    with pytest.raises(TurbopufferSyncFailed):
        _failing_sync_run("turbopuffer")


def test_the_failure_says_how_to_repair_it():
    """The error is read by whoever is woken by it. Naming the tools beats
    naming the problem."""
    with pytest.raises(TurbopufferSyncFailed) as exc:
        _failing_sync_run("turbopuffer")
    assert "rebuild_turbopuffer" in str(exc.value)
    assert "1 of 1" in str(exc.value)


def test_embedding_completes_before_the_failure_is_raised():
    """Stopping at the first failed batch would leave more chunks unembedded
    than unsynced, and the embeddings are the expensive half."""
    chunks = []
    for i in range(3):
        c = MagicMock()
        c.id = f"chunk-{i}"
        c.chunk_text = "info"
        chunks.append(c)
    session = MagicMock()
    session.execute.return_value.all.return_value = chunks
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=session)
    cm.__exit__ = MagicMock(return_value=False)

    with patch("indexer.index_pipeline.get_session", return_value=cm), \
         patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768]), \
         patch("indexer.index_pipeline.store_embedding") as store, \
         patch.object(settings, "retrieval_backend", "turbopuffer"), \
         patch("indexer.index_pipeline.sync_chunk_ids", side_effect=RuntimeError("down")):
        with pytest.raises(TurbopufferSyncFailed):
            run_index_pipeline(batch_size=1, sync_attempts=1)

    # All three batches embedded despite every sync failing.
    assert store.call_count == 3


def test_a_transient_failure_is_retried():
    """Most sync failures are the network, not the data. One flaky call should
    not fail a run that would succeed on the next attempt."""
    sync = MagicMock(side_effect=[RuntimeError("blip"), None])
    with patch("indexer.index_pipeline.get_session", return_value=_one_chunk_session()), \
         patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768]), \
         patch("indexer.index_pipeline.store_embedding"), \
         patch("indexer.index_pipeline.time.sleep"), \
         patch.object(settings, "retrieval_backend", "turbopuffer"), \
         patch("indexer.index_pipeline.sync_chunk_ids", sync):
        run_index_pipeline(batch_size=10, sync_attempts=3)  # must not raise
    assert sync.call_count == 2


def test_a_successful_run_raises_nothing():
    with patch("indexer.index_pipeline.get_session", return_value=_one_chunk_session()), \
         patch("indexer.index_pipeline.embed_texts", return_value=[[0.1] * 768]), \
         patch("indexer.index_pipeline.store_embedding"), \
         patch.object(settings, "retrieval_backend", "turbopuffer"), \
         patch("indexer.index_pipeline.sync_chunk_ids"):
        run_index_pipeline(batch_size=10)
