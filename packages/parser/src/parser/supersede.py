"""Retire a page's previous parse when a newer one replaces it.

run_parse_pipeline skips raw documents that already have a ParsedDocument, keyed
on raw_document_id. A re-crawl inserts a *new* raw_documents row for the same
URL, so the parser sees an unparsed document and writes a second ParsedDocument
with its own chunks and its own embeddings. Nothing removes the first.

The copies then compete for the same top-5 slots at near-identical similarity.
That is how three copies of one page took ranks 1 to 3 on "How do I pay my water
bill", pushing the page that answers it to rank 6; and it is why every one of the
seven ranking misses in the retrieval audit lost to a duplicate holding a slot.
At the time of writing: 590 URLs with more than one parse, 1,026 redundant
copies, growing with every crawl.

Deleting from Postgres alone is not enough while Turbopuffer is the index
production reads: it keeps its own copy of each chunk's text, title and URL, so a
superseded page would keep answering questions from vectors that no longer have a
row behind them. Vectors go first, and a failure there aborts before anything is
removed from Postgres, leaving a state that is merely stale rather than one where
the live index serves content nothing can trace.

That ordering is right only while Turbopuffer is serving. Once retrieval moved
back to pgvector it inverted: an expired Turbopuffer key returned 401 and blocked
every maintenance path in the project, because re-crawl, parse, dedupe and prune
all retire pages through here. The store that was no longer serving anything could
stop the store that was.

So the abort is now conditional on which backend is live. With Turbopuffer active
a vector failure still aborts. With pgvector active it warns and continues, and
says what it leaves behind: vectors in a namespace nothing reads, which would have
to be rebuilt before that backend could be trusted again.
"""
import logging
import uuid

from sqlalchemy import delete, select, update

from shared.config import settings
from shared.models import DocumentChunk, GraphEdge, GraphNode, ParsedDocument

logger = logging.getLogger(__name__)

_warned = False
orphaned_vector_chunks = 0


def _warn_orphaned_vectors(count: int, exc: Exception) -> None:
    """Once per process, on stdout as well as the log.

    Both are guarded. An earlier version guarded only the print and left the log
    call outside, so a re-crawl printed the same six-line warning for every page
    it retired. Once per process has to mean once per process, or the mechanism
    is just a slower way of being noisy.

    The running total stays available for a caller that wants to report it at the
    end, which is the right place for a number that only makes sense once the run
    has finished.
    """
    global _warned, orphaned_vector_chunks
    orphaned_vector_chunks += count
    if _warned:
        # Still counted, deliberately not repeated. logger.debug rather than
        # nothing, so a run being investigated can still show every occurrence.
        logger.debug("Turbopuffer delete failed for %d more chunk(s): %s", count, exc)
        return

    _warned = True
    message = (
        f"Turbopuffer delete failed for {count} chunk(s): {type(exc).__name__}: {exc}\n"
        f"  retrieval_backend={settings.retrieval_backend!r}, so nothing user facing "
        f"is affected and the retirement continued.\n"
        f"  Those vectors now have no row behind them. Rebuild before making "
        f"Turbopuffer the active backend again:\n"
        f"    uv run python scripts/rebuild_turbopuffer.py --namespace <new> --verify\n"
        f"  Further occurrences in this run are counted, not repeated. To stop "
        f"trying entirely, clear TURBOPUFFER_API_KEY."
    )
    logger.warning(message)
    print(f"WARNING: {message}")


def find_superseded(session, url: str, keep_id: uuid.UUID | None = None) -> list[uuid.UUID]:
    """Parsed-document ids for `url`, excluding the one being kept."""
    if not url:
        return []
    stmt = select(ParsedDocument.id).where(ParsedDocument.url == url)
    if keep_id is not None:
        stmt = stmt.where(ParsedDocument.id != keep_id)
    return list(session.execute(stmt).scalars())


def retire_parsed_documents(session, parsed_ids: list[uuid.UUID],
                            delete_vectors: bool = True) -> tuple[int, int]:
    """Delete these parsed documents and their chunks. Returns (parsed, chunks).

    Caller owns the transaction, so a failure here can be rolled back with
    whatever else it was doing.
    """
    ids = [i for i in parsed_ids if i]
    if not ids:
        return 0, 0

    chunk_ids = list(session.execute(
        select(DocumentChunk.id).where(DocumentChunk.parsed_document_id.in_(ids))
    ).scalars())

    # Vectors first. While Turbopuffer serves, a failure here has to abort: the
    # caller rolls back and Postgres still matches the index. While pgvector
    # serves, the same failure must not block maintenance of the store that is
    # actually answering questions.
    if delete_vectors and chunk_ids:
        from indexer.turbopuffer_store import delete_chunk_ids
        from indexer.turbopuffer_store import enabled as turbopuffer_enabled

        # Disabled is not the same as failing. With no key configured there is
        # nothing to try, so skip before the call rather than attempt it and
        # catch: the resulting stale namespace is documented where it was turned
        # off, and does not need restating once per retired page.
        if not turbopuffer_enabled():
            delete_vectors = False

        try:
            if delete_vectors:
                delete_chunk_ids([str(c) for c in chunk_ids])
        except Exception as exc:
            if settings.retrieval_backend == "turbopuffer":
                raise
            _warn_orphaned_vectors(len(chunk_ids), exc)

    if chunk_ids:
        # graph_nodes and graph_edges point at chunks with a nullable FK. Null the
        # reference rather than deleting the node: the extracted entity is still
        # true, it just no longer has a citation. Deleting it would silently shrink
        # the graph every time a page is re-crawled.
        for model in (GraphNode, GraphEdge):
            session.execute(
                update(model)
                .where(model.source_chunk_id.in_(chunk_ids))
                .values(source_chunk_id=None)
            )
        session.execute(delete(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)))

    session.execute(delete(ParsedDocument).where(ParsedDocument.id.in_(ids)))
    return len(ids), len(chunk_ids)


def supersede_url(session, url: str, keep_id: uuid.UUID,
                  delete_vectors: bool = True) -> tuple[int, int]:
    """Retire every other parse of `url`, keeping `keep_id`."""
    stale = find_superseded(session, url, keep_id=keep_id)
    if not stale:
        return 0, 0
    parsed, chunks = retire_parsed_documents(session, stale, delete_vectors=delete_vectors)
    logger.info("superseded %d earlier parse(s) of %s (%d chunks removed)",
                parsed, url, chunks)
    return parsed, chunks
