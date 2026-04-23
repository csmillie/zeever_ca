"""Run the full data pipeline: crawl, parse, embed.

Designed to be run on a schedule (cron) or triggered manually.
Only processes new/changed content — safe to run repeatedly.
Writes progress to a status file for the admin dashboard.

Usage:
    uv run python scripts/pipeline.py              # full pipeline
    uv run python scripts/pipeline.py --skip-crawl  # parse + embed only
    uv run python scripts/pipeline.py --dry-run     # show stats without changes
"""
import argparse
import asyncio
import time
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_status import start as status_start, update_step, set_before, set_after, complete as status_complete, fail as status_fail


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def _crawl_progress(pages_crawled, pdfs_downloaded, total_urls, phase):
    """Callback from the crawler to update the status file during crawl."""
    update_step("crawling", pages_found=total_urls, pages_crawled=pages_crawled, pdfs_downloaded=pdfs_downloaded)


async def run_crawl():
    """Crawl Toronto.ca for new/changed pages."""
    log("Starting crawl...")
    update_step("crawling")
    start = time.time()

    from crawler.crawl import run_crawl
    await run_crawl(on_progress=_crawl_progress)

    elapsed = int(time.time() - start)
    log(f"Crawl complete in {elapsed}s")


def run_parse():
    """Parse any raw documents that haven't been parsed yet."""
    log("Starting parse...")
    update_step("parsing")
    start = time.time()

    from parser.pipeline import run_parse_pipeline
    run_parse_pipeline()

    elapsed = int(time.time() - start)
    log(f"Parse complete in {elapsed}s")


def run_index():
    """Embed any chunks that don't have embeddings yet."""
    log("Starting index...")
    update_step("embedding")
    start = time.time()

    from indexer.index_pipeline import run_index_pipeline
    run_index_pipeline()

    elapsed = int(time.time() - start)
    log(f"Index complete in {elapsed}s")


def run_cleanup():
    """Clear raw_content for already-parsed documents to reclaim disk space."""
    log("Starting cleanup...")
    update_step("cleanup")
    start = time.time()

    from shared.db import get_session
    from sqlalchemy import text

    with get_session() as session:
        # Count how many can be cleaned
        count = session.execute(text("""
            SELECT count(*) FROM canadian_ai.raw_documents
            WHERE raw_content IS NOT NULL
            AND id IN (SELECT raw_document_id FROM canadian_ai.parsed_documents)
        """)).scalar()

        if count == 0:
            log("Nothing to clean up.")
            return

        log(f"Clearing raw_content for {count} parsed documents...")

        # Clear binary content for parsed docs
        session.execute(text("""
            UPDATE canadian_ai.raw_documents
            SET raw_content = NULL
            WHERE id IN (SELECT raw_document_id FROM canadian_ai.parsed_documents)
            AND raw_content IS NOT NULL
        """))
        session.commit()

        # Reclaim disk space
        log("Running VACUUM FULL on raw_documents (this may take a moment)...")

    # VACUUM FULL can't run inside a transaction, use a separate connection
    from shared.db import engine
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("VACUUM FULL canadian_ai.raw_documents"))

    elapsed = int(time.time() - start)
    log(f"Cleanup complete in {elapsed}s — cleared {count} documents")


def get_stats():
    """Get current database stats."""
    from shared.db import get_session
    from sqlalchemy import text

    with get_session() as session:
        raw = session.execute(text("SELECT count(*) FROM canadian_ai.raw_documents")).scalar()
        parsed = session.execute(text("SELECT count(*) FROM canadian_ai.parsed_documents")).scalar()
        chunks = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks")).scalar()
        embedded = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")).scalar()
        unembedded = chunks - embedded

    return {
        "raw_documents": raw,
        "parsed_documents": parsed,
        "chunks": chunks,
        "embedded": embedded,
        "unembedded": unembedded,
    }


async def run_pipeline(skip_crawl: bool = False, skip_cleanup: bool = False, dry_run: bool = False):
    """Run the full pipeline."""
    log("=" * 60)
    log("PIPELINE START")
    log("=" * 60)

    before = get_stats()
    log(f"Before: {before['raw_documents']} raw, {before['parsed_documents']} parsed, {before['embedded']} embedded, {before['unembedded']} unembedded")

    if dry_run:
        log("DRY RUN — no changes will be made")
        return

    status_start(skip_crawl=skip_crawl)
    set_before(before)

    pipeline_start = time.time()

    try:
        if not skip_crawl:
            await run_crawl()

            # Update stats after crawl
            mid_stats = get_stats()
            new_raw = mid_stats["raw_documents"] - before["raw_documents"]
            update_step("crawl_complete", pages_crawled=new_raw, new_documents=new_raw)
        else:
            new_raw = 0

        run_parse()

        # Update stats after parse
        parse_stats = get_stats()
        new_parsed = parse_stats["parsed_documents"] - before["parsed_documents"]
        update_step("parse_complete", documents_parsed=new_parsed)

        run_index()

        if not skip_cleanup:
            run_cleanup()

        after = get_stats()
        new_embedded = after["embedded"] - before["embedded"]
        update_step("complete", chunks_embedded=new_embedded)
        set_after(after)
        status_complete()

        elapsed = int(time.time() - pipeline_start)

        log("=" * 60)
        log("PIPELINE COMPLETE")
        log(f"Duration: {elapsed}s")
        log(f"New documents: {new_raw}")
        log(f"New parsed: {new_parsed}")
        log(f"New embeddings: {new_embedded}")
        log(f"Totals: {after['raw_documents']} raw, {after['parsed_documents']} parsed, {after['embedded']} embedded")
        log("=" * 60)

    except Exception as e:
        status_fail(str(e))
        log(f"PIPELINE FAILED: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Run the full data pipeline")
    parser.add_argument("--skip-crawl", action="store_true", help="Skip crawl step (parse + embed only)")
    parser.add_argument("--skip-cleanup", action="store_true", help="Keep raw_content after parsing (for debugging)")
    parser.add_argument("--dry-run", action="store_true", help="Show current stats without making changes")
    args = parser.parse_args()

    asyncio.run(run_pipeline(skip_crawl=args.skip_crawl, skip_cleanup=args.skip_cleanup, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
