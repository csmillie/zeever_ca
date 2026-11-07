"""Crawl URLs that exist in raw_documents but have no content and no parsed doc.

Finds the HTML pages that were discovered but never successfully crawled,
fetches them, and runs parse + embed so they're ready for search.

Usage:
    uv run python scripts/crawl_gaps.py --dry-run    # show what would be crawled
    uv run python scripts/crawl_gaps.py               # crawl, parse, and embed
"""
import asyncio
import argparse
import time
from datetime import datetime

from shared.db import get_session
from shared.config import settings
from sqlalchemy import text
from crawler.fetcher import Fetcher, OffsiteRedirect
from crawler.redirects import record_redirect
from crawler.storage import create_crawl_run, save_raw_document


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def find_gap_urls():
    """Find HTML URLs that have no parsed document.

    Includes both URLs with no content (need crawling) and URLs with
    content that failed to parse (need re-parsing). The crawl step
    skips URLs that already have content.
    """
    with get_session() as session:
        rows = session.execute(text("""
            SELECT DISTINCT rd.url,
              CASE WHEN rd.raw_content IS NOT NULL THEN true ELSE false END as has_content
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%'
            -- ILIKE, because a mayoral decision is filed as .PDF and a
            -- case-sensitive match let it through as an HTML gap forever.
            AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%'
            AND rd.url NOT LIKE '%?%'
            ORDER BY rd.url
        """)).fetchall()
    return [(r[0], r[1]) for r in rows]


async def crawl_urls(urls: list[str]):
    """Fetch a list of URLs and save them as raw documents."""
    fetcher = Fetcher(rate_limit_ms=settings.crawl_rate_limit_ms, user_agent=settings.crawl_user_agent)
    crawl_run_id = create_crawl_run(config={"type": "gap-fill", "urls": len(urls)})
    saved = 0
    errors = 0
    redirects = 0

    for i, url in enumerate(urls):
        try:
            result = await fetcher.fetch(url)
            doc_id = save_raw_document(crawl_run_id, result)
            if result.requested_url and result.requested_url != result.url:
                # A City page that redirects to an accountability office is still
                # a pointer. The content is stored under the publisher's URL, so
                # without this the toronto.ca URL keeps no parsed document, stays
                # in the gap list, and is re-fetched on every run forever.
                with get_session() as session:
                    record_redirect(session, result.requested_url, result.url)
                    session.commit()
                # Counted, because the caller decides whether to run parse and
                # embed from these numbers. A handoff writes a chunk with no
                # embedding, and on the run that matters most — the four
                # affiliated URLs, whose content is already stored under the
                # publisher's URL, so save_raw_document returns None — nothing
                # else increments. The gate would be false, embedding would be
                # skipped, and the records would be parsed but unsearchable.
                # They leave the gap list once the pointer exists, so no later
                # run would repair them.
                redirects += 1
            if doc_id:
                saved += 1
                log(f"  [{i+1}/{len(urls)}] Saved: {url}")
            else:
                log(f"  [{i+1}/{len(urls)}] Duplicate: {url}")
        except OffsiteRedirect as e:
            # Not a failure. The page is a handoff to a service run by somebody
            # else, so record where it goes without taking their content. These
            # were 43 of the 47 remaining gaps, re-attempted on every run and
            # reported as errors each time.
            with get_session() as session:
                record_redirect(session, url, f"https://{e.landed}/")
                session.commit()
            redirects += 1
            log(f"  [{i+1}/{len(urls)}] Redirect recorded: {url} -> {e.landed}")
        except Exception as e:
            errors += 1
            log(f"  [{i+1}/{len(urls)}] Error: {url} - {e}")

    await fetcher.close()
    return saved, errors, redirects


def run_parse_and_embed():
    """Run parse, embed, and cleanup pipelines."""
    log("Parsing...")
    from parser.pipeline import run_parse_pipeline
    run_parse_pipeline()

    log("Embedding...")
    from indexer.index_pipeline import run_index_pipeline
    run_index_pipeline()

    log("Cleaning up raw content...")
    with get_session() as session:
        session.execute(text("""
            UPDATE canadian_ai.raw_documents SET raw_content = NULL
            WHERE id IN (SELECT raw_document_id FROM canadian_ai.parsed_documents)
            AND raw_content IS NOT NULL
        """))
        session.commit()


async def run(dry_run: bool = False):
    log("=" * 60)
    log("CRAWL GAPS")
    log("=" * 60)

    gap_urls = find_gap_urls()
    needs_crawl = [url for url, has_content in gap_urls if not has_content]
    has_content = [url for url, hc in gap_urls if hc]

    log(f"Found {len(gap_urls)} unparsed HTML URLs")
    log(f"  Needs crawl: {len(needs_crawl)}")
    log(f"  Has content (ready to parse): {len(has_content)}")

    if not gap_urls:
        log("No gaps to fill.")
        return

    if dry_run:
        if needs_crawl:
            log("\nWould crawl:")
            for url in needs_crawl:
                log(f"  {url}")
        if has_content:
            log("\nWould parse (already have content):")
            for url in has_content:
                log(f"  {url}")
        return

    start = time.time()
    saved = 0
    redirects = 0

    if needs_crawl:
        log(f"\nCrawling {len(needs_crawl)} URLs...")
        saved, errors, redirects = await crawl_urls(needs_crawl)
        log(f"Crawled: {saved} saved, {redirects} redirects recorded, {errors} errors")

    # A recorded redirect writes a chunk with no embedding, so it needs the embed
    # step as much as a crawled page does. Leaving it out was how the restored
    # documents ended up parsed but unsearchable.
    if saved > 0 or redirects > 0 or has_content:
        run_parse_and_embed()

    elapsed = int(time.time() - start)
    log("=" * 60)
    log(f"DONE in {elapsed}s")
    log(f"  Crawled: {saved}, Redirects recorded: {redirects}, "
        f"Already had content: {len(has_content)}")
    log("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Crawl HTML pages missing from the index")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be crawled without doing it")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
