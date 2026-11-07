import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from shared.db import get_session
from shared.models import CrawlRun, RawDocument
from crawler.fetcher import FetchResult

def create_crawl_run(config: dict | None = None) -> str:
    """Create a new crawl run, return its ID."""
    with get_session() as session:
        run = CrawlRun(status="running", config=config, started_at=datetime.now(timezone.utc))
        session.add(run)
        session.commit()
        run_id = str(run.id)
    return run_id

def save_raw_document(crawl_run_id: str, result: FetchResult) -> str | None:
    """Save a fetched document. Returns document ID, or None if duplicate.

    A row whose raw_content was cleared is refilled rather than treated as a
    duplicate. Content is deleted after parsing to keep the table small, so a
    row that has been parsed and then had its parsed document removed is a husk:
    it matches on url and content_hash, holds nothing, and re-fetching returns
    the identical bytes. Refusing that as a duplicate left four URLs permanently
    in the gap list, re-fetched on every run and never able to acquire content.
    """
    with get_session() as session:
        # Check for duplicate
        existing = session.execute(
            select(RawDocument).where(
                RawDocument.url == result.url,
                RawDocument.content_hash == result.content_hash,
            )
        ).scalar_one_or_none()

        if existing and existing.raw_content is not None:
            return None

        if existing:
            existing.raw_content = result.raw_content
            existing.http_status = result.status_code
            existing.fetched_at = datetime.now(timezone.utc)
            existing.headers = result.headers
            session.commit()
            return str(existing.id)

        doc = RawDocument(
            crawl_run_id=crawl_run_id,
            url=result.url,
            content_type=result.content_type,
            content_hash=result.content_hash,
            raw_content=result.raw_content,
            http_status=result.status_code,
            fetched_at=datetime.now(timezone.utc),
            headers=result.headers,
        )
        session.add(doc)
        session.commit()
        doc_id = str(doc.id)
    return doc_id

def complete_crawl_run(crawl_run_id: str, pages_found: int, pages_crawled: int, pdfs_downloaded: int, error: str | None = None):
    """Mark a crawl run as completed."""
    with get_session() as session:
        run = session.get(CrawlRun, uuid.UUID(crawl_run_id))
        run.status = "failed" if error else "completed"
        run.completed_at = datetime.now(timezone.utc)
        run.pages_found = pages_found
        run.pages_crawled = pages_crawled
        run.pdfs_downloaded = pdfs_downloaded
        run.error = error
        session.commit()
