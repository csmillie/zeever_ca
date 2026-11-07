import turbopuffer
from sqlalchemy import text
from shared.config import settings
from shared.db import get_session

_client = None


def enabled() -> bool:
    """Whether Turbopuffer is configured at all.

    The API key is the switch. An empty key means disabled rather than broken, so
    turning it off is one line in .env and turning it back on is the same line,
    with no code path that only exists while it is off.

    Callers that can carry on without it (the dual-write, retiring a page's
    vectors) check this and skip. Callers that cannot get a clear error from
    _get_client instead of a 401 from the API.
    """
    return bool((settings.turbopuffer_api_key or "").strip())

# chunk_text: full_text_search=True implicitly sets filterable=false (FTS-only).
# url/title/content_type are retrieve-only (never filtered on), so mark them
# non-filterable — avoids the 4096-byte filterable-value limit and takes the
# 50% storage discount. (metadata is dropped entirely: unused by the retriever.)
TPUF_SCHEMA = {
    "chunk_text": {"type": "string", "full_text_search": True},
    "url": {"type": "string", "filterable": False},
    "title": {"type": "string", "filterable": False},
    "content_type": {"type": "string", "filterable": False},
}


def _get_client():
    global _client
    if not enabled():
        raise RuntimeError(
            "Turbopuffer is disabled: TURBOPUFFER_API_KEY is empty. Set it to "
            "re-enable, or use the pgvector path. Retrieval reads from "
            f"retrieval_backend={settings.retrieval_backend!r}."
        )
    if _client is None:
        _client = turbopuffer.Turbopuffer(
            api_key=settings.turbopuffer_api_key,
            region=settings.turbopuffer_region,
        )
    return _client


def get_namespace(name: str | None = None):
    """Return a Turbopuffer namespace handle, the configured one unless named.

    The override exists so an index can be rebuilt into a fresh namespace while
    the live one keeps serving. Clearing and refilling the namespace in place
    leaves search empty for the length of the backfill, and partial if it fails
    part way; building alongside and switching TURBOPUFFER_NAMESPACE afterwards
    has no such window and is reversible by switching it back.
    """
    return _get_client().namespace(name or settings.turbopuffer_namespace)


def _embedding_to_list(emb):
    # pgvector returns a string like "[0.1,0.2]" or a list depending on driver.
    if isinstance(emb, str):
        return [float(x) for x in emb.strip("[]").split(",") if x]
    return list(emb)


def chunk_row_to_tpuf(row: dict) -> dict:
    """Map a PG document_chunks+parsed_documents row to a Turbopuffer upsert row."""
    return {
        "id": row["id"],
        "vector": _embedding_to_list(row["embedding"]),
        "chunk_text": row["chunk_text"],
        "url": row.get("url") or "",
        "title": row.get("title") or "",
        "content_type": row.get("content_type") or "",
    }


def upsert_rows(rows: list[dict], namespace: str | None = None) -> None:
    """Write a batch of already-transformed rows to the namespace."""
    get_namespace(namespace).write(
        upsert_rows=rows,
        distance_metric="cosine_distance",
        schema=TPUF_SCHEMA,
    )


_SYNC_QUERY = """
    SELECT dc.id, dc.chunk_text, dc.metadata,
           pd.url, pd.title, pd.content_type, dc.embedding
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.id::text = ANY(:ids) AND dc.embedding IS NOT NULL
"""


def sync_chunk_ids(chunk_ids: list[str]) -> int:
    """Fetch the given chunks from Postgres and upsert them to Turbopuffer.

    Used for ongoing dual-write from the indexing pipeline. Returns the number
    of rows written.
    """
    ids = [str(c) for c in chunk_ids]
    if not ids:
        return 0
    with get_session() as session:
        rows = [dict(r._mapping) for r in session.execute(text(_SYNC_QUERY), {"ids": ids})]
    if not rows:
        return 0
    upsert_rows([chunk_row_to_tpuf(r) for r in rows])
    return len(rows)


_ATTRS = ["chunk_text", "url", "title", "content_type"]


def _field(row, key, default=None):
    """Read a field from a Turbopuffer Row, tolerating item- or attribute-access.

    `$dist` and computed attributes (e.g. `vector_distance`) are not valid Python
    identifiers / may only be exposed one way; try item access first, fall back to
    attribute access. Keeps the search functions correct regardless of which form
    the SDK version exposes.
    """
    try:
        val = row[key]
        if val is not None:
            return val
    except (TypeError, KeyError, IndexError):
        pass
    return getattr(row, key, default)


def _row_to_dict(row) -> dict:
    d = {"id": _field(row, "id"), "similarity": 1.0 - float(_field(row, "$dist"))}
    for a in _ATTRS:
        d[a] = _field(row, a)
    return d


def search_vector(query_embedding: list[float], limit: int = 5) -> list[dict]:
    result = get_namespace().query(
        rank_by=("vector", "ANN", query_embedding),
        limit=limit,
        include_attributes=_ATTRS,
    )
    return [_row_to_dict(r) for r in result.rows]


def search_hybrid(query_embedding: list[float], query_text: str, limit: int = 5) -> list[dict]:
    # Fetch a wider vector + BM25 candidate set, fuse with native RRF.
    response = get_namespace().multi_query(
        queries=[
            {"rank_by": ("vector", "ANN", query_embedding), "limit": limit * 4,
             "include_attributes": _ATTRS,
             "compute_attributes": {"vector_distance": ("vector", "VectorDist", query_embedding)}},
            {"rank_by": ("chunk_text", "BM25", query_text), "limit": limit * 4,
             "include_attributes": _ATTRS,
             "compute_attributes": {"vector_distance": ("vector", "VectorDist", query_embedding)}},
        ],
        rerank_by=("RRF",),
    )
    # With rerank_by=("RRF",), the SDK returns the single fused result set as
    # results[0].rows (per Turbopuffer's hybrid-search docs); the per-query result
    # sets are only separate when no rerank_by is passed.
    rows = response.results[0].rows[:limit]
    out = []
    for r in rows:
        d = {"id": _field(r, "id"), "similarity": 1.0 - float(_field(r, "vector_distance"))}
        for a in _ATTRS:
            d[a] = _field(r, a)
        out.append(d)
    return out


def delete_chunk_ids(chunk_ids: list[str], batch_size: int = 1000) -> int:
    """Remove chunks from the namespace by id. Returns how many were requested.

    Turbopuffer is the index production reads, so deleting rows from Postgres
    without this leaves the vectors live: the chunk keeps being retrieved, and its
    text and URL come back from Turbopuffer's own copy of the attributes. A
    superseded page would go on answering questions after its replacement landed.

    Batched because a re-parse of a long page can retire a few hundred chunks at
    once, and the whole cleanup of the existing duplicates retires thousands.
    """
    ids = [str(c) for c in chunk_ids if c]
    if not ids:
        return 0
    namespace = get_namespace()
    for start in range(0, len(ids), batch_size):
        namespace.write(deletes=ids[start:start + batch_size])
    return len(ids)
