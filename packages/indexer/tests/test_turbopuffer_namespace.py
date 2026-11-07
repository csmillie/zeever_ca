"""A rebuild has to be able to write somewhere other than the live namespace.

Postgres and Turbopuffer drifted: 57,847 embedded chunks against 71,035 indexed
rows, so roughly 13,000 rows described chunks that no longer existed and could
still be returned as sources. The SDK has no export call, so the extras cannot be
found and deleted; the only route to a correct index is to rebuild it from
Postgres.

Rebuilding in place would mean delete_all then refill, leaving search empty for
the length of the run. The override lets the new index be built alongside the one
still serving, so the switch is a config change rather than an outage.
"""
from unittest.mock import MagicMock, patch

from indexer import turbopuffer_store as tp


def _client():
    """A stand-in Turbopuffer client that records which namespace was asked for."""
    client = MagicMock()
    client.namespace.return_value = MagicMock()
    return client


def test_defaults_to_the_configured_namespace():
    client = _client()
    with patch.object(tp, "_get_client", return_value=client), \
         patch.object(tp.settings, "turbopuffer_namespace", "live"):
        tp.get_namespace()
    client.namespace.assert_called_once_with("live")


def test_named_namespace_wins():
    client = _client()
    with patch.object(tp, "_get_client", return_value=client), \
         patch.object(tp.settings, "turbopuffer_namespace", "live"):
        tp.get_namespace("rebuild")
    client.namespace.assert_called_once_with("rebuild")


def test_none_is_not_a_namespace():
    """Passing None explicitly must mean 'the configured one', not a namespace
    literally called None. Every caller that does not care passes it."""
    client = _client()
    with patch.object(tp, "_get_client", return_value=client), \
         patch.object(tp.settings, "turbopuffer_namespace", "live"):
        tp.get_namespace(None)
    client.namespace.assert_called_once_with("live")


def test_upsert_writes_to_the_named_namespace():
    """The point of the override: a rebuild must not touch the live index."""
    ns = MagicMock()
    with patch.object(tp, "get_namespace", return_value=ns) as get_ns:
        tp.upsert_rows([{"id": "a", "vector": [0.1]}], namespace="rebuild")
    get_ns.assert_called_once_with("rebuild")
    assert ns.write.call_args.kwargs["upsert_rows"] == [{"id": "a", "vector": [0.1]}]


def test_upsert_without_a_namespace_still_writes_live():
    """Existing callers pass no namespace and must keep working unchanged."""
    ns = MagicMock()
    with patch.object(tp, "get_namespace", return_value=ns) as get_ns:
        tp.upsert_rows([{"id": "a", "vector": [0.1]}])
    get_ns.assert_called_once_with(None)
