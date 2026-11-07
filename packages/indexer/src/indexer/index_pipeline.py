"""Pipeline to embed all document chunks and store vectors."""
import time

from sqlalchemy import select

from shared.config import settings
from shared.db import get_session
from shared.models import DocumentChunk
from indexer.embedder import embed_texts
from indexer.vector_store import store_embedding
from indexer.turbopuffer_store import enabled as turbopuffer_enabled
from indexer.turbopuffer_store import sync_chunk_ids

# A sync failure is usually the network rather than the data, so a batch gets
# more than one chance before it counts against the run.
SYNC_ATTEMPTS = 3


class TurbopufferSyncFailed(RuntimeError):
    """Chunks were embedded in Postgres but never reached the search index.

    Raised only when Turbopuffer is the backend actually serving queries. Under
    pgvector the same failure costs nothing today, so it warns instead.

    This used to be a printed warning in every case, and the run reported success
    either way. The result was 13,188 rows of drift between the two stores that
    nobody saw until a restored page failed to turn up in an answer. A pipeline
    that half worked has to say so.
    """


def _sync_batch(chunk_ids: list[str], attempts: int = SYNC_ATTEMPTS) -> None:
    """Write a batch to Turbopuffer, retrying briefly. Raises if it never lands."""
    for attempt in range(1, attempts + 1):
        try:
            sync_chunk_ids(chunk_ids)
            return
        except Exception as exc:
            if attempt == attempts:
                raise
            delay = 2 ** (attempt - 1)
            print(f"  Turbopuffer sync failed ({exc}); retrying in {delay}s "
                  f"[{attempt}/{attempts}]")
            time.sleep(delay)


def run_index_pipeline(batch_size: int = 50, sync_attempts: int = SYNC_ATTEMPTS):
    """Embed all chunks that don't have embeddings yet.

    Raises TurbopufferSyncFailed if any batch never reached the index while
    Turbopuffer is the serving backend. Embedding still completes first: the
    Postgres embeddings are durable and worth keeping, and stopping at the first
    failed batch would leave more chunks unembedded than unsynced.
    """
    with get_session() as session:
        # Find chunks without embeddings, skipping empty text
        unembedded = session.execute(
            select(DocumentChunk.id, DocumentChunk.chunk_text).where(
                DocumentChunk.embedding.is_(None),
                DocumentChunk.chunk_text.isnot(None),
                DocumentChunk.chunk_text != "",
            )
        ).all()

        print(f"Found {len(unembedded)} chunks to embed")
        if not turbopuffer_enabled():
            # Said once, at the top, because the absence of the usual sync lines
            # further down is otherwise indistinguishable from a silent failure.
            print("Turbopuffer is disabled (no API key); writing to pgvector only.")

        if not unembedded:
            print("Nothing to embed.")
            return

        # Process in batches
        total_embedded = 0
        unsynced: list[str] = []
        for i in range(0, len(unembedded), batch_size):
            batch = unembedded[i:i + batch_size]
            chunk_ids = [str(row.id) for row in batch]
            chunk_texts = [row.chunk_text for row in batch]

            print(f"  Embedding batch {i // batch_size + 1} ({len(batch)} chunks)...")
            embeddings = embed_texts(chunk_texts)

            for chunk_id, embedding in zip(chunk_ids, embeddings):
                store_embedding(chunk_id, embedding)

            # Dual-write to Turbopuffer. A failure never breaks pgvector
            # indexing, but it is recorded rather than shrugged off.
            #
            # Skipped entirely when Turbopuffer is disabled. Retrying an API call
            # three times with backoff for every batch, to reach a store nobody
            # configured, would turn a re-index into an exercise in waiting.
            if turbopuffer_enabled():
                try:
                    _sync_batch(chunk_ids, attempts=sync_attempts)
                except Exception as exc:
                    print(f"  WARN: Turbopuffer sync failed for batch: {exc}")
                    unsynced.extend(chunk_ids)

            total_embedded += len(batch)
            print(f"  Embedded {total_embedded}/{len(unembedded)}")

    print(f"\nDone. Embedded {total_embedded} chunks.")

    if not unsynced:
        return

    detail = (f"{len(unsynced)} of {total_embedded} chunks were embedded in Postgres "
              f"but never written to Turbopuffer.")
    if settings.retrieval_backend != "turbopuffer":
        # pgvector is serving, so nothing is missing from search. Still worth
        # saying, because the gap persists and would matter on a switch.
        print(f"\nWARNING: {detail}")
        print("pgvector is the active backend, so search is unaffected today.")
        print("Reconcile before switching: scripts/rebuild_turbopuffer.py")
        return

    raise TurbopufferSyncFailed(
        f"{detail} Turbopuffer is the active backend, so those chunks are not "
        f"searchable. Repair with:\n"
        f"  uv run python scripts/audit_turbopuffer_drift.py\n"
        f"  uv run python scripts/rebuild_turbopuffer.py --namespace <new> --verify"
    )
