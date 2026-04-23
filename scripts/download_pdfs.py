"""Download, parse, and embed uncrawled PDFs by category.

Usage:
    uv run python scripts/download_pdfs.py --categories guides policies forms building
    uv run python scripts/download_pdfs.py --categories guides --dry-run
    uv run python scripts/download_pdfs.py --all --dry-run
"""
import asyncio
import argparse
import time
from datetime import datetime

from shared.db import get_session
from shared.config import settings
from sqlalchemy import text
from crawler.fetcher import Fetcher
from crawler.storage import create_crawl_run, save_raw_document


PDF_CATEGORIES = {
    "guides": "(rd.url LIKE '%guide%' OR rd.url LIKE '%handbook%')",
    "forms": "(rd.url LIKE '%form%' OR rd.url LIKE '%application%')",
    "policies": "(rd.url LIKE '%policy%' OR rd.url LIKE '%procedure%')",
    "building": "(rd.url LIKE '%permit%' OR rd.url LIKE '%building%')",
    "bylaws": "(rd.url LIKE '%bylaw%')",
    "plans": "(rd.url LIKE '%plan%' OR rd.url LIKE '%strategy%')",
    "reports": "rd.url LIKE '%report%'",
    "consultations": "(rd.url LIKE '%consultation%' OR rd.url LIKE '%engagement%')",
    "budget": "rd.url LIKE '%budget%'",
    "legal": "rd.url LIKE '%legdocs%'",
    "agendas": "(rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%')",
    "maps": "rd.url LIKE '%map%'",
}


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def find_pdf_urls(categories: list[str]) -> list[str]:
    """Find uncrawled PDF URLs matching the given categories."""
    clauses = []
    for cat in categories:
        if cat not in PDF_CATEGORIES:
            log(f"  Unknown category: {cat}")
            continue
        clauses.append(PDF_CATEGORIES[cat])

    if not clauses:
        return []

    where = " OR ".join(f"({c})" for c in clauses)

    with get_session() as session:
        rows = session.execute(text(f"""
            SELECT DISTINCT rd.url
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND ({where})
            ORDER BY rd.url
        """)).fetchall()
    return [r[0] for r in rows]


def get_category_counts() -> list[dict]:
    """Get counts of uncrawled PDFs by category for the admin UI."""
    with get_session() as session:
        rows = session.execute(text("""
            SELECT
              CASE
                WHEN rd.url LIKE '%/bylaws/%' OR rd.url LIKE '%bylaw%' THEN 'bylaws'
                WHEN rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%' THEN 'agendas'
                WHEN rd.url LIKE '%legdocs%' THEN 'legal'
                WHEN rd.url LIKE '%budget%' THEN 'budget'
                WHEN rd.url LIKE '%report%' THEN 'reports'
                WHEN rd.url LIKE '%consultation%' OR rd.url LIKE '%engagement%' THEN 'consultations'
                WHEN rd.url LIKE '%permit%' OR rd.url LIKE '%building%' THEN 'building'
                WHEN rd.url LIKE '%form%' OR rd.url LIKE '%application%' THEN 'forms'
                WHEN rd.url LIKE '%policy%' OR rd.url LIKE '%procedure%' THEN 'policies'
                WHEN rd.url LIKE '%plan%' OR rd.url LIKE '%strategy%' THEN 'plans'
                WHEN rd.url LIKE '%map%' THEN 'maps'
                WHEN rd.url LIKE '%guide%' OR rd.url LIKE '%handbook%' THEN 'guides'
                ELSE 'other'
              END as category,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            GROUP BY category
            ORDER BY cnt DESC
        """)).fetchall()
    return [{"category": r._mapping["category"], "count": r._mapping["cnt"]} for r in rows]


async def download_and_process(urls: list[str]) -> dict:
    """Download PDFs, parse, embed, and cleanup."""
    fetcher = Fetcher(rate_limit_ms=settings.crawl_rate_limit_ms, user_agent=settings.crawl_user_agent)
    crawl_run_id = create_crawl_run(config={"type": "pdf-download", "urls": len(urls)})
    saved = 0
    errors = 0
    skipped = 0

    for i, url in enumerate(urls):
        try:
            result = await fetcher.fetch(url)
            doc_id = save_raw_document(crawl_run_id, result)
            if doc_id:
                saved += 1
            else:
                skipped += 1
            if (i + 1) % 25 == 0:
                log(f"  Progress: {i+1}/{len(urls)} ({saved} saved, {skipped} duplicate, {errors} errors)")
        except Exception as e:
            errors += 1
            if (i + 1) % 25 == 0:
                log(f"  Progress: {i+1}/{len(urls)} ({saved} saved, {skipped} duplicate, {errors} errors)")

    await fetcher.close()
    log(f"  Download complete: {saved} saved, {skipped} duplicate, {errors} errors")

    if saved > 0:
        log("  Parsing...")
        from parser.pipeline import run_parse_pipeline
        run_parse_pipeline()

        log("  Embedding...")
        from indexer.index_pipeline import run_index_pipeline
        run_index_pipeline()

        log("  Cleaning up raw content...")
        with get_session() as session:
            session.execute(text("""
                UPDATE canadian_ai.raw_documents SET raw_content = NULL
                WHERE id IN (SELECT raw_document_id FROM canadian_ai.parsed_documents)
                AND raw_content IS NOT NULL
            """))
            session.commit()

    return {"saved": saved, "skipped": skipped, "errors": errors}


async def run(categories: list[str], dry_run: bool = False):
    log("=" * 60)
    log("PDF DOWNLOAD")
    log(f"Categories: {', '.join(categories)}")
    log("=" * 60)

    urls = find_pdf_urls(categories)
    log(f"Found {len(urls)} PDFs to download")

    if not urls:
        log("Nothing to download.")
        return

    if dry_run:
        log(f"\nDRY RUN - would download {len(urls)} PDFs:")
        for url in urls[:20]:
            log(f"  {url}")
        if len(urls) > 20:
            log(f"  ... and {len(urls) - 20} more")
        log(f"\nEstimated download: ~{len(urls) * 0.5:.0f} MB")
        return

    start = time.time()
    result = await download_and_process(urls)
    elapsed = int(time.time() - start)

    log("=" * 60)
    log(f"DONE in {elapsed}s")
    log(f"  Downloaded: {result['saved']}, Skipped: {result['skipped']}, Errors: {result['errors']}")
    log("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Download uncrawled PDFs by category")
    parser.add_argument(
        "--categories",
        nargs="+",
        choices=list(PDF_CATEGORIES.keys()),
        help=f"Categories to download. Available: {', '.join(PDF_CATEGORIES.keys())}",
    )
    parser.add_argument("--all", action="store_true", help="Download all categories")
    parser.add_argument("--dry-run", action="store_true", help="Preview without downloading")
    args = parser.parse_args()

    if args.all:
        categories = list(PDF_CATEGORIES.keys())
    elif args.categories:
        categories = args.categories
    else:
        parser.error("Specify --categories or --all")

    asyncio.run(run(categories=categories, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
