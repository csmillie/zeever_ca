"""Semantic query cache using pgvector similarity search.

Cache flow:
1. Embed the question (already done for retrieval)
2. Search cache for similar questions (cosine > 0.95)
3. If found AND chunk_hash matches (same content), return cached answer
4. If miss, generate answer and store in cache

Auto-invalidation:
- chunk_hash changes when content is re-crawled (different chunks retrieved)
- TTL: entries older than 7 days are cleaned up
"""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from shared.db import get_session

logger = logging.getLogger("zeever.cache")

SIMILARITY_THRESHOLD = 0.95
CACHE_TTL_DAYS = 7


def _compute_chunk_hash(chunks: list[dict]) -> str:
    """Hash the retrieved chunk IDs to detect content changes."""
    chunk_ids = sorted(str(c.get("id", c.get("url", ""))) for c in chunks)
    return hashlib.sha256("|".join(chunk_ids).encode()).hexdigest()[:16]


def check_cache(question_embedding: list[float], chunks: list[dict]) -> dict | None:
    """Check if a semantically similar question with the same chunks is cached.

    Returns cached result dict or None.
    """
    chunk_hash = _compute_chunk_hash(chunks)
    embedding_str = "[" + ",".join(str(x) for x in question_embedding) + "]"

    with get_session() as session:
        result = session.execute(text("""
            SELECT id, question, answer, sources, model_used, query_class,
                   1 - (question_embedding <=> CAST(:embedding AS vector)) as similarity
            FROM canadian_ai.query_cache
            WHERE chunk_hash = :chunk_hash
            AND created_at > :cutoff
            AND 1 - (question_embedding <=> CAST(:embedding AS vector)) > :threshold
            ORDER BY similarity DESC
            LIMIT 1
        """), {
            "embedding": embedding_str,
            "chunk_hash": chunk_hash,
            "cutoff": datetime.now(timezone.utc) - timedelta(days=CACHE_TTL_DAYS),
            "threshold": SIMILARITY_THRESHOLD,
        })

        row = result.fetchone()
        if not row:
            return None

        mapping = row._mapping

        # Update hit count
        session.execute(text("""
            UPDATE canadian_ai.query_cache
            SET hit_count = hit_count + 1, last_hit_at = now()
            WHERE id = :id
        """), {"id": mapping["id"]})
        session.commit()

        logger.info(
            "cache hit | similarity=%.3f original=%s",
            mapping["similarity"],
            mapping["question"][:60],
        )

        sources = mapping["sources"]
        if isinstance(sources, str):
            sources = json.loads(sources)

        return {
            "answer": mapping["answer"],
            "sources": sources,
            "model_used": mapping["model_used"],
            "query_class": mapping["query_class"],
            "cached": True,
        }


def store_cache(
    question: str,
    question_embedding: list[float],
    chunks: list[dict],
    answer: str,
    sources: list[str],
    model_used: str,
    query_class: str,
    tokens_used: int = 0,
):
    """Store a query result in the semantic cache."""
    chunk_hash = _compute_chunk_hash(chunks)
    embedding_str = "[" + ",".join(str(x) for x in question_embedding) + "]"

    with get_session() as session:
        session.execute(text("""
            INSERT INTO canadian_ai.query_cache
                (question, question_embedding, chunk_hash, answer, sources, model_used, query_class, tokens_used)
            VALUES
                (:question, CAST(:embedding AS vector), :chunk_hash, :answer, CAST(:sources AS jsonb), :model_used, :query_class, :tokens_used)
        """), {
            "question": question,
            "embedding": embedding_str,
            "chunk_hash": chunk_hash,
            "answer": answer,
            "sources": json.dumps(sources),
            "model_used": model_used,
            "query_class": query_class,
            "tokens_used": tokens_used,
        })
        session.commit()

    logger.info("cache store | question=%s", question[:60])


def cleanup_cache():
    """Remove expired cache entries."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=CACHE_TTL_DAYS)
    with get_session() as session:
        result = session.execute(text("""
            DELETE FROM canadian_ai.query_cache WHERE created_at < :cutoff
        """), {"cutoff": cutoff})
        session.commit()
        deleted = result.rowcount
    if deleted:
        logger.info("cache cleanup | deleted=%d expired entries", deleted)
    return deleted
