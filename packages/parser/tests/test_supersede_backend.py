"""Which store is serving decides whether a Turbopuffer failure is fatal.

Retiring a page deletes its vectors before its rows. That ordering protects the
live index while Turbopuffer serves: a failed delete aborts, and Postgres still
matches what is searchable.

Once retrieval moved to pgvector the same rule inverted. An expired Turbopuffer
key returned 401 and blocked re-crawl, parse, dedupe and prune, because they all
retire pages through here. A store that was no longer serving anything could stop
the store that was.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from parser import supersede



@pytest.fixture(autouse=True)
def turbopuffer_configured():
    """These tests are about what happens when Turbopuffer IS configured.

    The switch is the API key and this machine has none, so without pinning it
    every assertion about deleting vectors would pass by skipping the delete,
    which is the definition of a vacuous test. The disabled case pins it the
    other way, inside the test that is about it.
    """
    with patch("indexer.turbopuffer_store.enabled", return_value=True):
        yield

def _session_with(chunk_ids, parsed_ids):
    session = MagicMock()
    session.execute.side_effect = [MagicMock(scalars=lambda: chunk_ids)] + [
        MagicMock() for _ in range(10)
    ]
    return session


def test_a_vector_failure_aborts_while_turbopuffer_serves():
    """The abort is the whole point of deleting vectors first: the caller rolls
    back and the index still matches Postgres."""
    ids = [uuid.uuid4()]
    session = _session_with(ids, ids)
    with patch.object(supersede.settings, "retrieval_backend", "turbopuffer"), \
         patch("indexer.turbopuffer_store.delete_chunk_ids",
               side_effect=RuntimeError("401 not authorized")):
        with pytest.raises(RuntimeError, match="401"):
            supersede.retire_parsed_documents(session, ids)


def test_a_vector_failure_does_not_block_maintenance_while_pgvector_serves(capsys):
    """Nothing user facing depends on Turbopuffer in this state, and blocking the
    retirement would leave duplicate parses competing for the same context slots,
    which is the problem this module exists to prevent."""
    ids = [uuid.uuid4()]
    session = _session_with(ids, ids)
    supersede._warned = False
    with patch.object(supersede.settings, "retrieval_backend", "pgvector"), \
         patch("indexer.turbopuffer_store.delete_chunk_ids",
               side_effect=RuntimeError("401 not authorized")):
        parsed, chunks = supersede.retire_parsed_documents(session, ids)
    assert (parsed, chunks) == (1, 1)

    # Loud, because these scripts often run with logging unconfigured and a
    # warning nobody sees is how the orphaned vectors would be forgotten.
    out = capsys.readouterr().out
    assert "WARNING" in out and "rebuild_turbopuffer" in out


def test_the_warning_is_emitted_once_per_process(capsys, caplog):
    """One warning per retirement buries a 6,000 page re-crawl in identical
    six-line blocks, which is what happened: the first version of this guarded
    only the print and left logger.warning outside it, so the log repeated every
    time and the earlier version of this test could not see it.

    Asserting both channels now, because guarding one of two is the bug."""
    import logging

    ids = [uuid.uuid4()]
    supersede._warned = False
    supersede.orphaned_vector_chunks = 0
    with caplog.at_level(logging.WARNING, logger=supersede.logger.name), \
         patch.object(supersede.settings, "retrieval_backend", "pgvector"), \
         patch("indexer.turbopuffer_store.enabled", return_value=True), \
         patch("indexer.turbopuffer_store.delete_chunk_ids",
               side_effect=RuntimeError("401")):
        for _ in range(3):
            supersede.retire_parsed_documents(_session_with(ids, ids), ids)

    assert capsys.readouterr().out.count("WARNING:") == 1
    assert len([r for r in caplog.records if r.levelno == logging.WARNING]) == 1


def test_suppressed_occurrences_are_still_counted():
    """Silence and zero are different. A run that hits this three hundred times
    should be able to say so at the end, even though it said it once."""
    ids = [uuid.uuid4()]
    supersede._warned = False
    supersede.orphaned_vector_chunks = 0
    with patch.object(supersede.settings, "retrieval_backend", "pgvector"), \
         patch("indexer.turbopuffer_store.enabled", return_value=True), \
         patch("indexer.turbopuffer_store.delete_chunk_ids",
               side_effect=RuntimeError("401")):
        for _ in range(3):
            supersede.retire_parsed_documents(_session_with(ids, ids), ids)
    assert supersede.orphaned_vector_chunks == 3


def test_a_successful_delete_still_removes_the_rows():
    ids = [uuid.uuid4()]
    session = _session_with(ids, ids)
    with patch.object(supersede.settings, "retrieval_backend", "pgvector"), \
         patch("indexer.turbopuffer_store.delete_chunk_ids") as delete:
        parsed, chunks = supersede.retire_parsed_documents(session, ids)
    delete.assert_called_once()
    assert (parsed, chunks) == (1, 1)
