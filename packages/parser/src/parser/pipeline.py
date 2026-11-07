"""Parse raw documents into chunks ready for embedding."""
from datetime import datetime, timezone
from sqlalchemy import select, func
from shared.db import get_session
from shared.models import RawDocument, ParsedDocument, DocumentChunk
from parser.html_parser import parse_html
from parser.pdf_parser import parse_pdf
from parser.content_typer import classify_content
from parser.chunker import chunk_text
from parser.supersede import supersede_url

BATCH_SIZE = 50


def parse_document(raw_doc: RawDocument) -> tuple[ParsedDocument, list[DocumentChunk]]:
    """Parse a single raw document into a ParsedDocument and its chunks."""
    if raw_doc.raw_content is None:
        raise ValueError(f"No raw content for {raw_doc.url}")

    # Parse based on content type
    if raw_doc.content_type and raw_doc.content_type.startswith("application/pdf"):
        parsed = parse_pdf(raw_doc.raw_content, raw_doc.url)
    else:
        html = raw_doc.raw_content.decode("utf-8", errors="replace")
        parsed = parse_html(html, raw_doc.url)

    # Classify content type
    content_type = classify_content(parsed.title, parsed.text)

    # Create ParsedDocument
    parsed_doc = ParsedDocument(
        raw_document_id=raw_doc.id,
        url=raw_doc.url,
        title=parsed.title,
        content_text=parsed.text,
        content_type=content_type,
        source_format=parsed.source_format,
        word_count=len(parsed.text.split()),
        parsed_at=datetime.now(timezone.utc),
        extra_metadata={"headings": parsed.headings},
    )

    # Chunk the text
    chunks = chunk_text(parsed.text)
    doc_chunks = []
    for chunk in chunks:
        doc_chunk = DocumentChunk(
            chunk_index=chunk.chunk_index,
            chunk_text=chunk.text,
            token_count=chunk.token_count,
            created_at=datetime.now(timezone.utc),
            extra_metadata={
                "title": parsed.title,
                "url": raw_doc.url,
                "content_type": content_type,
                "headings": parsed.headings,
            },
        )
        doc_chunks.append(doc_chunk)

    return parsed_doc, doc_chunks


def run_parse_pipeline():
    """Parse all raw documents that haven't been parsed yet.

    Processes in batches to avoid loading all documents into memory at once.
    """
    with get_session() as session:
        # Count unparsed documents (without loading them)
        # NOT NULL matters. Redirect records are parsed_documents with no raw
        # document behind them, and a NOT IN over a subquery containing NULL
        # matches no rows at all, so a single such row would silently stop the
        # pipeline from ever parsing anything again.
        already_parsed = select(ParsedDocument.raw_document_id).where(
            ParsedDocument.raw_document_id.isnot(None)
        )
        total = session.execute(
            select(func.count()).select_from(RawDocument).where(
                RawDocument.id.not_in(already_parsed),
                RawDocument.raw_content.isnot(None),
            )
        ).scalar()

        print(f"Found {total} unparsed documents with content")

        if total == 0:
            print("Nothing to parse.")
            return

        parsed_count = 0
        chunk_count = 0
        error_count = 0
        superseded_count = 0
        superseded_chunks = 0
        failed_ids: set = set()

        while True:
            # Load one batch at a time, excluding already-failed docs
            query = select(RawDocument).where(
                RawDocument.id.not_in(already_parsed),
                RawDocument.raw_content.isnot(None),
            )
            if failed_ids:
                query = query.where(RawDocument.id.not_in(failed_ids))
            query = query.limit(BATCH_SIZE)

            batch = session.execute(query).scalars().all()

            if not batch:
                break

            for raw_doc in batch:
                try:
                    parsed_doc, chunks = parse_document(raw_doc)
                    session.add(parsed_doc)
                    session.flush()

                    for chunk in chunks:
                        chunk.parsed_document_id = parsed_doc.id
                        session.add(chunk)

                    # A re-crawl gives the same URL a new raw_documents row, and the
                    # unparsed filter above keys on raw_document_id, so without this
                    # the previous parse and its chunks stay in the index forever
                    # and compete with this one for the same retrieval slots.
                    retired, retired_chunks = supersede_url(session, raw_doc.url, parsed_doc.id)
                    if retired:
                        superseded_count += retired
                        superseded_chunks += retired_chunks

                    session.commit()
                    parsed_count += 1
                    chunk_count += len(chunks)

                    if parsed_count % 100 == 0:
                        print(f"  Progress: {parsed_count}/{total} parsed, {chunk_count} chunks")
                except Exception as e:
                    session.rollback()
                    error_count += 1
                    failed_ids.add(raw_doc.id)
                    if "No raw content" not in str(e):
                        print(f"  Error parsing {raw_doc.url}: {e}")

    print(f"\nParsed {parsed_count} documents into {chunk_count} chunks ({error_count} errors)")
    if superseded_count:
        print(f"Superseded {superseded_count} earlier parse(s) of the same URLs, "
              f"removing {superseded_chunks} stale chunks")
