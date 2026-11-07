"""Deleting from Postgres alone leaves the live index serving orphans."""
from unittest.mock import MagicMock, patch

from indexer import turbopuffer_store as tp


def test_empty_is_a_no_op():
    with patch.object(tp, "get_namespace") as ns:
        assert tp.delete_chunk_ids([]) == 0
    ns.assert_not_called()


def test_blank_ids_are_filtered():
    with patch.object(tp, "get_namespace") as ns:
        assert tp.delete_chunk_ids([None, ""]) == 0
    ns.assert_not_called()


def test_ids_are_stringified():
    import uuid
    ident = uuid.uuid4()
    ns = MagicMock()
    with patch.object(tp, "get_namespace", return_value=ns):
        assert tp.delete_chunk_ids([ident]) == 1
    ns.write.assert_called_once_with(deletes=[str(ident)])


def test_large_lists_are_batched():
    """A full cleanup retires thousands of chunks at once."""
    ns = MagicMock()
    with patch.object(tp, "get_namespace", return_value=ns):
        assert tp.delete_chunk_ids([f"id-{i}" for i in range(2500)], batch_size=1000) == 2500
    assert ns.write.call_count == 3
    assert len(ns.write.call_args_list[0].kwargs["deletes"]) == 1000
    assert len(ns.write.call_args_list[-1].kwargs["deletes"]) == 500
