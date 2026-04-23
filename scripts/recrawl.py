"""Smart re-crawl: only fetch pages that changed since our last crawl.

Compares sitemap lastmod dates against what we have stored in the database.
Only fetches pages where the sitemap shows a newer lastmod than our record.

Usage:
    uv run python scripts/recrawl.py                           # all changed pages
    uv run python scripts/recrawl.py --dry-run                  # show what would change
    uv run python scripts/recrawl.py --since 7                  # last 7 days only
    uv run python scripts/recrawl.py --section recreation       # recreation pages only
    uv run python scripts/recrawl.py --section recreation --since 1  # daily rec update
"""
import argparse
import asyncio
import time
from datetime import datetime, timezone, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_status import start as status_start, update_step, set_before, set_after, complete as status_complete, fail as status_fail


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


async def discover_changed_urls(since_days: int | None = None, section: str | None = None) -> list[dict]:
    """Compare sitemap lastmod dates against our database to find changed pages."""
    from crawler.fetcher import Fetcher
    from crawler.sitemap import parse_sitemap_index, extract_urls_with_dates
    from shared.config import settings
    from shared.db import get_session
    from sqlalchemy import text

    fetcher = Fetcher(rate_limit_ms=settings.crawl_rate_limit_ms, user_agent=settings.crawl_user_agent)

    # Get all URLs with lastmod from sitemap
    log("Fetching sitemap index...")
    result = await fetcher.fetch("https://www.toronto.ca/sitemap.xml")
    sub_sitemaps = parse_sitemap_index(result.raw_content.decode())

    all_entries = []
    for sitemap_url in sub_sitemaps:
        try:
            sm_result = await fetcher.fetch(sitemap_url)
            entries = extract_urls_with_dates(sm_result.raw_content.decode())
            all_entries.extend(entries)
        except Exception as e:
            log(f"  Error fetching {sitemap_url}: {e}")

    log(f"Found {len(all_entries)} URLs in sitemap")

    # Filter by section if specified
    if section:
        all_entries = [e for e in all_entries if section in e["url"]]
        log(f"Filtered to {len(all_entries)} URLs matching section '{section}'")

    # Filter by since_days if specified
    if since_days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
        all_entries = [e for e in all_entries if e["lastmod"] and e["lastmod"] >= cutoff]
        log(f"Filtered to {len(all_entries)} URLs changed in the last {since_days} days")

    # Compare against our database
    with get_session() as session:
        # Get URLs we already have with their lastmod
        existing = {}
        rows = session.execute(text("""
            SELECT url, sitemap_lastmod FROM canadian_ai.raw_documents
            WHERE sitemap_lastmod IS NOT NULL
        """))
        for row in rows:
            existing[row._mapping["url"]] = row._mapping["sitemap_lastmod"]

    changed = []
    new_pages = []
    for entry in all_entries:
        url = entry["url"]
        lastmod = entry["lastmod"]

        if url not in existing:
            new_pages.append(entry)
        elif lastmod and existing[url]:
            # Parse both dates properly to avoid timezone/format mismatches
            from dateutil.parser import parse as parse_date
            try:
                sitemap_dt = parse_date(lastmod)
                db_dt = existing[url] if hasattr(existing[url], 'date') else parse_date(str(existing[url]))
                if sitemap_dt.date() > db_dt.date():
                    changed.append(entry)
            except (ValueError, TypeError):
                # If we can't parse dates, treat as changed to be safe
                changed.append(entry)

    await fetcher.close()
    return changed, new_pages


async def recrawl_urls(urls_to_fetch: list[dict], on_progress=None):
    """Re-crawl specific URLs and update their content."""
    from crawler.fetcher import Fetcher
    from crawler.storage import create_crawl_run, save_raw_document
    from shared.config import settings
    from shared.db import get_session
    from sqlalchemy import text

    fetcher = Fetcher(rate_limit_ms=settings.crawl_rate_limit_ms, user_agent=settings.crawl_user_agent)
    total = len(urls_to_fetch)
    fetched = 0
    updated = 0
    crawl_run_id = create_crawl_run(config={"type": "recrawl", "urls": total})

    for i, entry in enumerate(urls_to_fetch):
        url = entry["url"]
        lastmod = entry["lastmod"]

        try:
            result = await fetcher.fetch(url)

            # Save new content first, only delete old content if save succeeds
            doc_id = save_raw_document(crawl_run_id, result)

            if doc_id:
                # New content saved successfully, now remove old versions
                with get_session() as session:
                    session.execute(text("""
                        DELETE FROM canadian_ai.document_chunks
                        WHERE parsed_document_id IN (
                            SELECT id FROM canadian_ai.parsed_documents WHERE url = :url
                        )
                    """), {"url": url})
                    session.execute(text("DELETE FROM canadian_ai.parsed_documents WHERE url = :url"), {"url": url})
                    # Delete old raw docs for this URL (keep the one we just saved)
                    session.execute(text("DELETE FROM canadian_ai.raw_documents WHERE url = :url AND id != :new_id"), {"url": url, "new_id": doc_id})

                    # Update lastmod tracking on the new doc
                    if lastmod:
                        session.execute(text("""
                            UPDATE canadian_ai.raw_documents
                            SET sitemap_lastmod = :lastmod, last_crawled_at = :now
                            WHERE id = :id
                        """), {"lastmod": lastmod, "now": datetime.now(timezone.utc), "id": doc_id})

                    session.commit()
                updated += 1

            fetched += 1

            if on_progress and (i + 1) % 10 == 0:
                on_progress(fetched, 0, total, "recrawl")

        except Exception as e:
            log(f"  Error fetching {url}: {e}")
            fetched += 1

    await fetcher.close()
    return updated


def get_stats():
    from shared.db import get_session
    from sqlalchemy import text
    with get_session() as session:
        raw = session.execute(text("SELECT count(*) FROM canadian_ai.raw_documents")).scalar()
        parsed = session.execute(text("SELECT count(*) FROM canadian_ai.parsed_documents")).scalar()
        chunks = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks")).scalar()
        embedded = session.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")).scalar()
    return {"raw_documents": raw, "parsed_documents": parsed, "chunks": chunks, "embedded": embedded, "unembedded": chunks - embedded}


async def run_recrawl(since_days: int | None = None, section: str | None = None, dry_run: bool = False):
    log("=" * 60)
    log("SMART RE-CRAWL")
    if section:
        log(f"Section: {section}")
    if since_days:
        log(f"Since: {since_days} days")
    log("=" * 60)

    changed, new_pages = await discover_changed_urls(since_days=since_days, section=section)
    log(f"Changed pages: {len(changed)}")
    log(f"New pages: {len(new_pages)}")

    if dry_run:
        log("\nDRY RUN - pages that would be re-crawled:")
        for entry in changed[:20]:
            log(f"  CHANGED: {entry['url']} (lastmod: {entry['lastmod']})")
        for entry in new_pages[:20]:
            log(f"  NEW: {entry['url']}")
        if len(changed) + len(new_pages) > 40:
            log(f"  ... and {len(changed) + len(new_pages) - 40} more")
        return

    all_urls = changed + new_pages
    if not all_urls:
        log("Nothing to re-crawl. Content is up to date.")
        return

    before = get_stats()
    status_start(skip_crawl=False)
    set_before(before)
    start_time = time.time()

    try:
        log(f"\nRe-crawling {len(all_urls)} pages...")
        update_step("crawling", pages_found=len(all_urls))
        updated = await recrawl_urls(all_urls, on_progress=lambda f, p, t, ph: update_step("crawling", pages_found=t, pages_crawled=f))
        update_step("crawl_complete", pages_crawled=updated, new_documents=updated)

        log(f"Re-crawled {updated} pages. Running parse...")
        update_step("parsing")
        from parser.pipeline import run_parse_pipeline
        run_parse_pipeline()

        parse_stats = get_stats()
        new_parsed = parse_stats["parsed_documents"] - before["parsed_documents"]
        update_step("parse_complete", documents_parsed=new_parsed)

        log("Running embed...")
        update_step("embedding")
        from indexer.index_pipeline import run_index_pipeline
        run_index_pipeline()

        log("Running cleanup...")
        update_step("cleanup")
        from shared.db import get_session
        from sqlalchemy import text
        with get_session() as session:
            session.execute(text("""
                UPDATE canadian_ai.raw_documents SET raw_content = NULL
                WHERE id IN (SELECT raw_document_id FROM canadian_ai.parsed_documents)
                AND raw_content IS NOT NULL
            """))
            session.commit()

        after = get_stats()
        new_embedded = after["embedded"] - before["embedded"]
        update_step("complete", chunks_embedded=new_embedded)
        set_after(after)
        status_complete()

        elapsed = int(time.time() - start_time)
        log("=" * 60)
        log("RE-CRAWL COMPLETE")
        log(f"Duration: {elapsed}s")
        log(f"Pages updated: {updated}")
        log(f"New chunks: {new_embedded}")
        log("=" * 60)

    except Exception as e:
        status_fail(str(e))
        log(f"RE-CRAWL FAILED: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Smart re-crawl of changed Toronto.ca pages")
    parser.add_argument("--since", type=int, default=None, help="Only re-crawl pages changed in the last N days")
    parser.add_argument("--section", type=str, default=None, help="Only re-crawl URLs containing this path (e.g. 'recreation', 'housing-shelter')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be re-crawled without doing it")
    args = parser.parse_args()

    asyncio.run(run_recrawl(since_days=args.since, section=args.section, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
