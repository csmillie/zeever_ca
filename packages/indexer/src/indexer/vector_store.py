from sqlalchemy import text
from shared.config import settings
from shared.db import get_session


def store_embedding(chunk_id: str, embedding: list[float]):
    """Store an embedding vector for a document chunk."""
    with get_session() as session:
        session.execute(
            text("UPDATE canadian_ai.document_chunks SET embedding = :emb WHERE id = :id"),
            {"emb": str(embedding), "id": chunk_id},
        )
        session.commit()


def search_similar(query_embedding: list[float], limit: int = 5) -> list[dict]:
    """Search for chunks most similar to the query embedding."""
    with get_session() as session:
        # pgvector's default of 1 probe is far too low here. The value is a
        # recall-for-latency trade against the index's lists, measured over the
        # 300-page breadth eval, so it is configurable rather than fixed.
        # set_config rather than SET, because SET takes no bind parameters and
        # this value would otherwise be interpolated into the statement. The
        # pydantic field is an int with ge=1 so a hostile value cannot reach
        # here, but the embedding and the limit in the same query are bound and
        # this should not be the one place that differs.
        session.execute(text("SELECT set_config('ivfflat.probes', :probes, false)"),
                        {"probes": str(settings.ivfflat_probes)})
        results = session.execute(
            text("""
                SELECT dc.id, dc.chunk_text, dc.metadata,
                       pd.url, pd.title, pd.content_type,
                       1 - (dc.embedding <=> cast(:embedding AS vector)) AS similarity
                FROM canadian_ai.document_chunks dc
                JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
                WHERE dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> cast(:embedding AS vector)
                LIMIT :limit
            """),
            {"embedding": str(query_embedding), "limit": limit},
        )
        rows = [dict(r._mapping) for r in results]
    return rows
