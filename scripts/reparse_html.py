"""Re-parse HTML documents with improved heading-aware parser and re-embed chunks.

This script:
1. Finds all raw HTML documents
2. Deletes their existing parsed_documents and document_chunks
3. Re-parses with the updated HTML parser (heading-aware sections)
4. Re-chunks with heading-aware chunker
5. Re-embeds the new chunks
"""
from sqlalchemy import select, delete
from shared.db import get_session
from shared.models import RawDocument, ParsedDocument, DocumentChunk
from shared.models import GraphNode, GraphEdge, Workflow
from parser.pipeline import parse_document
from indexer.embedder import embed_texts
from indexer.vector_store import store_embedding


def main():
    session = get_session()

    # Find all HTML raw documents
    html_docs = session.execute(
        select(RawDocument).where(RawDocument.content_type.like("text/html%"))
    ).scalars().all()

    print(f"Found {len(html_docs)} HTML documents to re-parse")

    # Get IDs of parsed docs from HTML sources
    html_raw_ids = [doc.id for doc in html_docs]
    parsed_docs = session.execute(
        select(ParsedDocument).where(ParsedDocument.raw_document_id.in_(html_raw_ids))
    ).scalars().all()

    parsed_ids = [pd.id for pd in parsed_docs]

    # Get chunk IDs that will be deleted
    chunk_ids = [row.id for row in session.execute(
        select(DocumentChunk.id).where(DocumentChunk.parsed_document_id.in_(parsed_ids))
    ).all()] if parsed_ids else []

    # Clear ALL graph data — chunk IDs will change and graph needs full rebuild
    print("Clearing all graph data (edges, nodes, workflows) for rebuild...")
    session.execute(delete(GraphEdge))
    session.execute(delete(GraphNode))
    session.execute(delete(Workflow))
    session.commit()

    print(f"Deleting {len(parsed_ids)} existing parsed documents and their chunks")

    # Delete chunks first (FK constraint), then parsed docs
    if parsed_ids:
        session.execute(
            delete(DocumentChunk).where(DocumentChunk.parsed_document_id.in_(parsed_ids))
        )
        session.execute(
            delete(ParsedDocument).where(ParsedDocument.id.in_(parsed_ids))
        )
        session.commit()

    # Re-parse
    total_chunks = 0
    new_chunk_ids = []

    for i, raw_doc in enumerate(html_docs):
        try:
            parsed_doc, chunks = parse_document(raw_doc)
            session.add(parsed_doc)
            session.flush()

            for chunk in chunks:
                chunk.parsed_document_id = parsed_doc.id
                session.add(chunk)
                session.flush()
                if chunk.chunk_text and chunk.chunk_text.strip():
                    new_chunk_ids.append(str(chunk.id))

            session.commit()
            total_chunks += len(chunks)

            if (i + 1) % 20 == 0:
                print(f"  Parsed {i+1}/{len(html_docs)} docs, {total_chunks} chunks so far")
        except Exception as e:
            session.rollback()
            print(f"  Error parsing {raw_doc.url}: {e}")

    print(f"\nRe-parsed {len(html_docs)} docs into {total_chunks} chunks")
    print(f"Chunks with content to embed: {len(new_chunk_ids)}")

    # Re-embed
    if new_chunk_ids:
        # Get chunk texts
        embeddable = session.execute(
            select(DocumentChunk.id, DocumentChunk.chunk_text).where(
                DocumentChunk.id.in_([__import__('uuid').UUID(cid) for cid in new_chunk_ids]),
                DocumentChunk.chunk_text.isnot(None),
                DocumentChunk.chunk_text != "",
            )
        ).all()

        print(f"\nEmbedding {len(embeddable)} chunks...")
        batch_size = 50
        for i in range(0, len(embeddable), batch_size):
            batch = embeddable[i:i + batch_size]
            ids = [str(row.id) for row in batch]
            texts = [row.chunk_text for row in batch]

            embeddings = embed_texts(texts)
            for chunk_id, emb in zip(ids, embeddings):
                store_embedding(chunk_id, emb)

            print(f"  Embedded {min(i + batch_size, len(embeddable))}/{len(embeddable)}")

    session.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
