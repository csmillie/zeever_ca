from unittest.mock import MagicMock, patch
from indexer import turbopuffer_store


def test_sync_chunk_ids_fetches_and_upserts():
    pg_rows = [{
        "id": "c1", "chunk_text": "t", "url": "u", "title": "T",
        "content_type": "text/html", "metadata": {}, "embedding": [0.1, 0.2],
    }]
    fake_session = MagicMock()
    fake_session.execute.return_value = [MagicMock(_mapping=r) for r in pg_rows]
    cm = MagicMock()
    cm.__enter__.return_value = fake_session
    cm.__exit__.return_value = False
    with patch.object(turbopuffer_store, "get_session", return_value=cm), \
         patch.object(turbopuffer_store, "upsert_rows") as up:
        n = turbopuffer_store.sync_chunk_ids(["c1"])
    assert n == 1
    up.assert_called_once()
    written = up.call_args[0][0]
    assert written[0]["id"] == "c1"
    assert written[0]["vector"] == [0.1, 0.2]


def test_sync_chunk_ids_empty_is_noop():
    with patch.object(turbopuffer_store, "upsert_rows") as up:
        assert turbopuffer_store.sync_chunk_ids([]) == 0
    up.assert_not_called()


def _row(id_, dist, **attrs):
    r = MagicMock()
    r.id = id_
    data = {"$dist": dist, "vector_distance": dist, **attrs}
    r.__getitem__.side_effect = lambda k: data[k]
    for k, v in attrs.items():
        setattr(r, k, v)
    return r


def test_search_vector_maps_rows_and_similarity():
    ns = MagicMock()
    ns.query.return_value.rows = [
        _row("id1", 0.1, chunk_text="t1", url="u1", title="T1", content_type="text/html"),
    ]
    with patch.object(turbopuffer_store, "get_namespace", return_value=ns):
        out = turbopuffer_store.search_vector([0.1, 0.2], limit=5)
    _, kwargs = ns.query.call_args
    assert kwargs["rank_by"] == ("vector", "ANN", [0.1, 0.2])
    assert kwargs["limit"] == 5
    assert out[0]["id"] == "id1"
    assert out[0]["chunk_text"] == "t1"
    assert out[0]["url"] == "u1"
    assert abs(out[0]["similarity"] - 0.9) < 1e-9  # 1 - dist


def test_chunk_row_to_tpuf_maps_fields():
    row = {
        "id": "abc-123",
        "chunk_text": "You need a permit for a deck.",
        "url": "https://toronto.ca/permits",
        "title": "Permits",
        "content_type": "text/html",
        "metadata": {"section": "decks"},
        "embedding": [0.1, 0.2, 0.3],
    }
    out = turbopuffer_store.chunk_row_to_tpuf(row)
    assert out["id"] == "abc-123"
    assert out["vector"] == [0.1, 0.2, 0.3]
    assert out["chunk_text"] == "You need a permit for a deck."
    assert out["url"] == "https://toronto.ca/permits"
    assert out["title"] == "Permits"
    assert out["content_type"] == "text/html"
    assert "metadata" not in out  # dropped: unused by retriever, blew the 4096-byte filter limit


def test_get_namespace_uses_configured_region_and_key():
    turbopuffer_store._client = None  # reset cached client
    fake_ns = MagicMock()
    fake_client = MagicMock()
    fake_client.namespace.return_value = fake_ns
    with patch("turbopuffer.Turbopuffer", return_value=fake_client) as ctor:
        with patch.object(turbopuffer_store.settings, "turbopuffer_api_key", "k"), \
             patch.object(turbopuffer_store.settings, "turbopuffer_region", "gcp-northamerica-northeast2"), \
             patch.object(turbopuffer_store.settings, "turbopuffer_namespace", "toronto-chunks"):
            ns = turbopuffer_store.get_namespace()
    ctor.assert_called_once_with(api_key="k", region="gcp-northamerica-northeast2")
    fake_client.namespace.assert_called_once_with("toronto-chunks")
    assert ns is fake_ns
