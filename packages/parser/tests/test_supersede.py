"""A re-parse must retire the previous parse, vectors first.

run_parse_pipeline skips raw documents by raw_document_id. A re-crawl gives the
same URL a new raw document, so the parser wrote a second ParsedDocument and
nothing removed the first: 590 URLs with more than one parse, 1,026 redundant
copies. The copies compete for the same retrieval slots at near-identical
similarity, which is how three of them took ranks 1 to 3 on "How do I pay my
water bill".
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from parser import supersede
from parser.supersede import retire_parsed_documents, supersede_url


class _FakeSession:
    """Records what was executed, and returns scripted scalar results."""

    def __init__(self, chunk_ids=None, superseded=None):
        self._chunk_ids = chunk_ids or []
        self._superseded = superseded or []
        self.statements = []
        self._select_calls = 0

    def execute(self, stmt, *args, **kwargs):
        self.statements.append(stmt)
        result = MagicMock()
        # First select returns whichever list this session was primed with.
        if str(stmt).lstrip().upper().startswith("SELECT"):
            self._select_calls += 1
            values = self._superseded if self._select_calls == 1 and self._superseded \
                else self._chunk_ids
            result.scalars.return_value = iter(values)
        return result



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

def test_no_ids_does_nothing():
    session = _FakeSession()
    assert retire_parsed_documents(session, []) == (0, 0)
    assert session.statements == []


def test_none_ids_are_filtered():
    session = _FakeSession()
    assert retire_parsed_documents(session, [None]) == (0, 0)


def test_vectors_are_deleted_before_postgres():
    """Ordering is the point: PG-first would leave the live index serving orphans."""
    chunk_ids = [uuid.uuid4(), uuid.uuid4()]
    session = _FakeSession(chunk_ids=chunk_ids)
    order = []

    def _delete(ids, **kw):
        order.append(("turbopuffer", len(ids)))
        return len(ids)

    original_execute = session.execute

    def _tracked(stmt, *a, **k):
        verb = str(stmt).lstrip().split()[0].upper()
        if verb in ("DELETE", "UPDATE"):
            order.append((verb.lower(), None))
        return original_execute(stmt, *a, **k)

    session.execute = _tracked
    with patch("indexer.turbopuffer_store.delete_chunk_ids", _delete):
        parsed, chunks = retire_parsed_documents(session, [uuid.uuid4()])

    assert (parsed, chunks) == (1, 2)
    assert order[0] == ("turbopuffer", 2), "Turbopuffer must be cleaned first"
    assert any(v == "delete" for v, _ in order[1:])


def test_a_vector_failure_stops_before_deleting_rows():
    """The caller rolls back, so PG must not have been touched yet.

    The backend is pinned because this rule is conditional on it. Aborting is
    right only while Turbopuffer serves; with pgvector serving, the same failure
    must not block maintenance of the store that is answering questions, which
    test_supersede_backend.py covers. Unpinned, this test asserted whichever
    behaviour the environment's .env happened to select."""
    from parser import supersede

    session = _FakeSession(chunk_ids=[uuid.uuid4()])
    with patch.object(supersede.settings, "retrieval_backend", "turbopuffer"), \
         patch("indexer.turbopuffer_store.delete_chunk_ids",
               side_effect=RuntimeError("turbopuffer unreachable")):
        with pytest.raises(RuntimeError):
            retire_parsed_documents(session, [uuid.uuid4()])

    verbs = [str(s).lstrip().split()[0].upper() for s in session.statements]
    assert "DELETE" not in verbs


def test_graph_references_are_nulled_not_deleted():
    """An extracted entity stays true when its citation goes; deleting it would
    shrink the graph a little on every re-crawl."""
    session = _FakeSession(chunk_ids=[uuid.uuid4()])
    with patch("indexer.turbopuffer_store.delete_chunk_ids", return_value=1):
        retire_parsed_documents(session, [uuid.uuid4()])

    updates = [str(s) for s in session.statements if str(s).lstrip().upper().startswith("UPDATE")]
    assert len(updates) == 2, "graph_nodes and graph_edges both point at chunks"
    assert all("source_chunk_id" in u for u in updates)


def test_vectors_can_be_skipped():
    """Useful for a Postgres-only environment with no Turbopuffer configured."""
    session = _FakeSession(chunk_ids=[uuid.uuid4()])
    with patch("indexer.turbopuffer_store.delete_chunk_ids") as tpuf:
        retire_parsed_documents(session, [uuid.uuid4()], delete_vectors=False)
    tpuf.assert_not_called()


def test_supersede_url_keeps_the_new_parse():
    keep = uuid.uuid4()
    stale = [uuid.uuid4(), uuid.uuid4()]
    session = _FakeSession(superseded=stale, chunk_ids=[uuid.uuid4()])
    with patch("indexer.turbopuffer_store.delete_chunk_ids", return_value=1):
        parsed, _ = supersede_url(session, "https://example.test/x", keep_id=keep)
    assert parsed == 2


def test_supersede_url_is_a_no_op_for_a_first_parse():
    session = _FakeSession(superseded=[])
    assert supersede_url(session, "https://example.test/x", keep_id=uuid.uuid4()) == (0, 0)


def test_blank_url_finds_nothing():
    """A parsed row with no URL must not match every other row with no URL."""
    assert supersede.find_superseded(_FakeSession(), "") == []
