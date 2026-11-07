import time
import logging
from indexer.embedder import embed_texts
from indexer.vector_store import search_similar
from indexer.turbopuffer_store import search_hybrid, search_vector
from shared.config import settings

SIMILARITY_THRESHOLD = 0.2
logger = logging.getLogger("zeever.timing")


# How many chunks any single page may contribute to one answer. Without a cap, a
# page indexed more than once can take every slot: "How do I pay my water bill"
# returned the same connection-and-disconnection page three times at identical
# similarity, pushing the actual Pay Your Utility Bill page to rank 6, below the
# top 5 the app reads. No model could answer from context it never received.
#
# 2 was a guess. Swept across all 100 benchmark prompts it loses to 1, and the
# trend is monotonic — 89 hits at cap 1, 88 at 2, 87 at 3 — with nothing lost by
# tightening. bp-35 is the case in miniature: at 2 the parks-recreation
# registration page held two of the five slots on "How do I set up a new water
# account in Toronto?", and at 1 it holds one and the utility-bill page takes the
# freed slot.
#
# One chunk per page also suits what the context is for. Five distinct sources give
# a model more to reason over, and more to decline from, than three pages does.
DEFAULT_MAX_CHUNKS_PER_URL = 1


def _max_per_url() -> int:
    # Unset falls back to the default; an explicit 0 clamps to 1 rather than
    # silently becoming the default, so a sweep reports the value it was given.
    value = getattr(settings, "max_chunks_per_url", None)
    if value is None or value == "":
        return DEFAULT_MAX_CHUNKS_PER_URL
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        logger.warning("max_chunks_per_url=%r is not an integer, using %d",
                       value, DEFAULT_MAX_CHUNKS_PER_URL)
        return DEFAULT_MAX_CHUNKS_PER_URL


# Two URLs can serve the same content, which the per-URL cap cannot see: on "How do
# I apply for a business licence" ranks 4 and 5 were both "My Business Licence &
# Permit Account", published under /business-economy/... and /services-payments/...
# Exact text matching misses these, because the copies differ by a stray heading or
# a trailing sentence.
#
# Jaccard over token sets, which is cheap at this scale (at most limit*3 chunks
# compared against at most `limit` kept ones) and does not care about word order.
# Short chunks are exempt: a two-line chunk can hit 0.9 against an unrelated one
# purely on stopwords, and losing a distinct source is worse than keeping a
# near-copy.
NEAR_DUPLICATE_THRESHOLD = 0.9
MIN_TOKENS_FOR_NEAR_DUPLICATE = 25


def _tokens(text: str) -> frozenset[str]:
    return frozenset((text or "").lower().split())


def _is_near_duplicate(tokens: frozenset[str], kept: list[frozenset[str]],
                       threshold: float = NEAR_DUPLICATE_THRESHOLD) -> bool:
    """True when `tokens` overlaps an already-kept chunk beyond the threshold."""
    if len(tokens) < MIN_TOKENS_FOR_NEAR_DUPLICATE:
        return False
    for other in kept:
        if len(other) < MIN_TOKENS_FOR_NEAR_DUPLICATE:
            continue
        union = len(tokens | other)
        if union and len(tokens & other) / union >= threshold:
            return True
    return False


def _dedupe(chunks: list[dict], limit: int) -> list[dict]:
    """Drop repeated text, then cap how much any one page can contribute.

    Order is preserved, so the best-scoring copy of anything survives. Exact text
    duplicates go first because they add nothing at all; the per-page cap then
    keeps one page from crowding out the rest of the evidence; and near-duplicates
    catch the case the cap cannot, where two different URLs serve the same content.
    """
    cap = _max_per_url()
    seen_text: set[str] = set()
    kept_tokens: list[frozenset[str]] = []
    per_url: dict[str, int] = {}
    out: list[dict] = []
    for c in chunks:
        body = c.get("chunk_text") or ""
        text_key = " ".join(body.split())
        if text_key and text_key in seen_text:
            continue
        url = c.get("url") or ""
        if url and per_url.get(url, 0) >= cap:
            continue
        tokens = _tokens(body)
        if _is_near_duplicate(tokens, kept_tokens):
            continue
        seen_text.add(text_key)
        kept_tokens.append(tokens)
        per_url[url] = per_url.get(url, 0) + 1
        out.append(c)
        if len(out) >= limit:
            break
    return out


def _effective_mode() -> str:
    """The retrieval mode that will actually be used, given the backend.

    Hybrid needs a lexical index, which only Turbopuffer has here. Asking for it
    on pgvector silently getting dense results is the kind of thing that makes a
    later A/B unreadable, so it is logged once per call rather than assumed.
    """
    mode = getattr(settings, "retrieval_mode", "vector") or "vector"
    if mode not in ("vector", "hybrid"):
        logger.warning("unknown retrieval_mode %r, using vector", mode)
        return "vector"
    if mode == "hybrid" and settings.retrieval_backend != "turbopuffer":
        logger.warning("retrieval_mode=hybrid needs retrieval_backend=turbopuffer; "
                       "using dense vector search")
        return "vector"
    return mode


def retrieve(query: str, limit: int = 5) -> tuple[list[dict], list[float]]:
    """Retrieve relevant document chunks for a query, filtering out low-similarity results.

    Reads from Turbopuffer when retrieval_backend='turbopuffer' (falling back to pgvector
    on error), else pgvector. Returns (chunks, query_embedding) so the embedding can be
    reused for caching.
    """
    t0 = time.time()
    query_embedding = embed_texts([query])[0]
    embed_ms = int((time.time() - t0) * 1000)

    # Over-fetch so that duplicates and per-page crowding can be removed without
    # returning fewer chunks than the caller asked for.
    fetch = limit * 3
    t1 = time.time()
    mode = _effective_mode()
    if settings.retrieval_backend == "turbopuffer":
        try:
            if mode == "hybrid":
                chunks = search_hybrid(query_embedding, query, limit=fetch)
            else:
                chunks = search_vector(query_embedding, limit=fetch)
        except Exception as e:
            logger.warning("turbopuffer retrieval failed, falling back to pgvector: %s", e)
            chunks = search_similar(query_embedding, limit=fetch)
    else:
        chunks = search_similar(query_embedding, limit=fetch)
    search_ms = int((time.time() - t1) * 1000)

    logger.info("retrieve | backend=%s mode=%s embed=%dms search=%dms total=%dms",
                settings.retrieval_backend, mode, embed_ms, search_ms, embed_ms + search_ms)

    filtered = [c for c in chunks if c.get("similarity", 0) >= SIMILARITY_THRESHOLD]
    deduped = _dedupe(filtered, limit)
    if len(filtered) > len(deduped):
        logger.info("retrieve | dropped %d duplicate/crowding chunk(s) of %d",
                    len(filtered) - len(deduped), len(filtered))
    return deduped, query_embedding
