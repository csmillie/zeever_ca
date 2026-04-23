import time
import logging
from indexer.embedder import embed_texts
from indexer.vector_store import search_similar

SIMILARITY_THRESHOLD = 0.2
logger = logging.getLogger("zeever.timing")


def retrieve(query: str, limit: int = 5) -> tuple[list[dict], list[float]]:
    """Retrieve relevant document chunks for a query, filtering out low-similarity results.

    Returns (chunks, query_embedding) so the embedding can be reused for caching.
    """
    t0 = time.time()
    query_embedding = embed_texts([query])[0]
    embed_ms = int((time.time() - t0) * 1000)

    t1 = time.time()
    chunks = search_similar(query_embedding, limit=limit)
    search_ms = int((time.time() - t1) * 1000)

    logger.info("retrieve | embed=%dms search=%dms total=%dms", embed_ms, search_ms, embed_ms + search_ms)

    filtered = [c for c in chunks if c.get("similarity", 0) >= SIMILARITY_THRESHOLD]
    return filtered, query_embedding
