"""Pipeline to embed all document chunks and store vectors."""
from sqlalchemy import select, text
from shared.db import get_session
from shared.models import DocumentChunk
from indexer.embedder import embed_texts
from indexer.vector_store import store_embedding


def run_index_pipeline(batch_size: int = 50):
    """Embed all chunks that don't have embeddings yet."""
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

        if not unembedded:
            print("Nothing to embed.")
            return

        # Process in batches
        total_embedded = 0
        for i in range(0, len(unembedded), batch_size):
            batch = unembedded[i:i + batch_size]
            chunk_ids = [str(row.id) for row in batch]
            chunk_texts = [row.chunk_text for row in batch]

            print(f"  Embedding batch {i // batch_size + 1} ({len(batch)} chunks)...")
            embeddings = embed_texts(chunk_texts)

            for chunk_id, embedding in zip(chunk_ids, embeddings):
                store_embedding(chunk_id, embedding)

            total_embedded += len(batch)
            print(f"  Embedded {total_embedded}/{len(unembedded)}")

    print(f"\nDone. Embedded {total_embedded} chunks.")
