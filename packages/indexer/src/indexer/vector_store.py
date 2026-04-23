from sqlalchemy import text
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
        # Increase IVFFlat probes for better recall (default 1 is too low for 8k+ vectors)
        session.execute(text("SET ivfflat.probes = 10"))
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
