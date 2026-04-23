#!/usr/bin/env python3
"""Zeever.ca crawl management CLI.

Unified tool for managing the Toronto.ca content pipeline: crawling,
parsing, embedding, gap analysis, and system status.

Usage:
    uv run python scripts/manage.py status                  # system overview + gaps
    uv run python scripts/manage.py pipeline                # full crawl + parse + embed
    uv run python scripts/manage.py pipeline --skip-crawl   # parse + embed only
    uv run python scripts/manage.py recrawl                 # re-crawl changed pages
    uv run python scripts/manage.py recrawl --since 7       # changed in last 7 days
    uv run python scripts/manage.py gaps                    # crawl missing HTML pages
    uv run python scripts/manage.py gaps --dry-run          # preview missing pages
    uv run python scripts/manage.py pdfs                    # analyze uncrawled PDFs
"""
import argparse
import asyncio
import sys


def cmd_status(args):
    """Show system status: stats, gaps, and coverage."""
    from shared.db import get_session
    from sqlalchemy import text

    with get_session() as s:
        # Core stats
        raw = s.execute(text("SELECT count(*) FROM canadian_ai.raw_documents")).scalar()
        parsed = s.execute(text("SELECT count(*) FROM canadian_ai.parsed_documents")).scalar()
        embedded = s.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")).scalar()
        unembedded = s.execute(text("SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NULL")).scalar()
        graph_nodes = s.execute(text("SELECT count(*) FROM canadian_ai.graph_nodes")).scalar()

        print("=== SYSTEM STATUS ===")
        print(f"  Raw documents:    {raw:,}")
        print(f"  Parsed documents: {parsed:,}")
        print(f"  Embedded chunks:  {embedded:,}")
        print(f"  Unembedded:       {unembedded:,}")
        print(f"  Graph nodes:      {graph_nodes:,}")

        # Parsed PDFs
        parsed_pdfs = s.execute(text("""
            SELECT count(*) FROM canadian_ai.parsed_documents WHERE source_format = 'pdf'
        """)).scalar()
        parsed_html = parsed - parsed_pdfs
        print(f"\n  Parsed HTML:      {parsed_html:,}")
        print(f"  Parsed PDFs:      {parsed_pdfs:,}")

        # Gaps
        awaiting_parse = s.execute(text("""
            SELECT count(*) FROM canadian_ai.raw_documents rd
            WHERE raw_content IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()

        unparsed_html = s.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT LIKE '%wp-content%' AND rd.url NOT LIKE '%.pdf'
            AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
        """)).scalar()

        unparsed_pdfs = s.execute(text("""
            SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
            WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()

        empty_chunks = s.execute(text("""
            SELECT count(*) FROM canadian_ai.document_chunks
            WHERE (chunk_text IS NULL OR chunk_text = '') AND embedding IS NULL
        """)).scalar()

        dupes = s.execute(text("""
            SELECT count(*) FROM (
                SELECT url, count(*) as cnt FROM canadian_ai.raw_documents
                GROUP BY url HAVING count(*) > 1
            ) d
        """)).scalar()

        print(f"\n=== GAPS ===")
        if awaiting_parse > 0:
            print(f"  Awaiting parse:   {awaiting_parse:,}  (run: manage.py pipeline --skip-crawl)")
        if unparsed_html > 0:
            print(f"  Unparsed HTML:    {unparsed_html:,}  (run: manage.py gaps)")
        if unparsed_pdfs > 0:
            print(f"  Uncrawled PDFs:   {unparsed_pdfs:,}  (run: manage.py pdfs for breakdown)")
        if unembedded > 0:
            print(f"  Unembedded:       {unembedded:,}  (run: manage.py pipeline --skip-crawl)")
        if empty_chunks > 0:
            print(f"  Empty chunks:     {empty_chunks:,}  (scanned PDFs, no action needed)")
        if dupes > 0:
            print(f"  Duplicate URLs:   {dupes:,}  (from re-crawls, no action needed)")
        if awaiting_parse == 0 and unparsed_html == 0 and unembedded == 0:
            print("  No actionable gaps.")

        # Unparsed HTML by section
        if unparsed_html > 0:
            rows = s.execute(text("""
                SELECT split_part(rd.url, '/', 4) as section, count(DISTINCT rd.url) as cnt
                FROM canadian_ai.raw_documents rd
                WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
                AND rd.url NOT LIKE '%wp-content%' AND rd.url NOT LIKE '%.pdf'
                AND rd.url NOT LIKE '%#%' AND rd.url NOT LIKE '%?%'
                GROUP BY section ORDER BY cnt DESC LIMIT 10
            """)).fetchall()
            print(f"\n=== UNPARSED HTML BY SECTION ===")
            for r in rows:
                print(f"  {r[0]}: {r[1]}")


def cmd_pipeline(args):
    """Run the full data pipeline."""
    from pipeline import run_pipeline
    asyncio.run(run_pipeline(
        skip_crawl=args.skip_crawl,
        skip_cleanup=args.skip_cleanup,
        dry_run=args.dry_run,
    ))


def cmd_recrawl(args):
    """Smart re-crawl of changed pages."""
    from recrawl import run_recrawl
    asyncio.run(run_recrawl(
        since_days=args.since,
        section=args.section,
        dry_run=args.dry_run,
    ))


def cmd_gaps(args):
    """Crawl missing HTML pages."""
    from crawl_gaps import run
    asyncio.run(run(dry_run=args.dry_run))


def cmd_warmup(args):
    """Pre-populate the query cache."""
    from warm_cache import run as warmup_run, HOMEPAGE_QUESTIONS
    if args.benchmark:
        from evals.prompts import BENCHMARK_PROMPTS
        questions = [bp.prompt for bp in BENCHMARK_PROMPTS]
    elif args.homepage:
        questions = HOMEPAGE_QUESTIONS
    else:
        from evals.prompts import BENCHMARK_PROMPTS
        benchmark = [bp.prompt for bp in BENCHMARK_PROMPTS]
        seen = set()
        questions = []
        for q in HOMEPAGE_QUESTIONS + benchmark:
            if q not in seen:
                questions.append(q)
                seen.add(q)
    asyncio.run(warmup_run(questions, dry_run=args.dry_run))


def cmd_download(args):
    """Download uncrawled PDFs by category."""
    from download_pdfs import run as download_run, PDF_CATEGORIES
    if args.all:
        categories = list(PDF_CATEGORIES.keys())
    elif args.categories:
        categories = args.categories
    else:
        print("Specify --categories or --all")
        sys.exit(1)
    asyncio.run(download_run(categories=categories, dry_run=args.dry_run))


def cmd_pdfs(args):
    """Analyze uncrawled PDF URLs by category."""
    from shared.db import get_session
    from sqlalchemy import text

    with get_session() as s:
        print("=== UNCRAWLED PDFs BY CATEGORY ===")
        rows = s.execute(text("""
            SELECT
              CASE
                WHEN rd.url LIKE '%/bylaws/%' OR rd.url LIKE '%bylaw%' THEN 'Bylaws'
                WHEN rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%' THEN 'Agendas & Minutes'
                WHEN rd.url LIKE '%legdocs%' THEN 'Legal Documents'
                WHEN rd.url LIKE '%budget%' THEN 'Budget'
                WHEN rd.url LIKE '%report%' THEN 'Reports'
                WHEN rd.url LIKE '%consultation%' OR rd.url LIKE '%engagement%' THEN 'Consultations'
                WHEN rd.url LIKE '%permit%' OR rd.url LIKE '%building%' THEN 'Building & Permits'
                WHEN rd.url LIKE '%form%' OR rd.url LIKE '%application%' THEN 'Forms & Applications'
                WHEN rd.url LIKE '%policy%' OR rd.url LIKE '%procedure%' THEN 'Policies'
                WHEN rd.url LIKE '%plan%' OR rd.url LIKE '%strategy%' THEN 'Plans & Strategies'
                WHEN rd.url LIKE '%map%' THEN 'Maps'
                WHEN rd.url LIKE '%guide%' OR rd.url LIKE '%handbook%' THEN 'Guides'
                ELSE 'Other'
              END as category,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            GROUP BY category ORDER BY cnt DESC
        """)).fetchall()
        total = 0
        for r in rows:
            print(f"  {r[0]}: {r[1]:,}")
            total += r[1]
        print(f"  TOTAL: {total:,}")

        if args.samples:
            print(f"\n=== SAMPLE URLs (top {args.samples} per category) ===")
            for cat_row in rows[:6]:
                cat = cat_row[0]
                like_map = {
                    'Bylaws': "rd.url LIKE '%bylaw%'",
                    'Agendas & Minutes': "(rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%')",
                    'Legal Documents': "rd.url LIKE '%legdocs%'",
                    'Budget': "rd.url LIKE '%budget%'",
                    'Reports': "rd.url LIKE '%report%'",
                    'Consultations': "(rd.url LIKE '%consultation%' OR rd.url LIKE '%engagement%')",
                    'Building & Permits': "(rd.url LIKE '%permit%' OR rd.url LIKE '%building%')",
                    'Forms & Applications': "(rd.url LIKE '%form%' OR rd.url LIKE '%application%')",
                    'Policies': "(rd.url LIKE '%policy%' OR rd.url LIKE '%procedure%')",
                    'Plans & Strategies': "(rd.url LIKE '%plan%' OR rd.url LIKE '%strategy%')",
                    'Maps': "rd.url LIKE '%map%'",
                    'Guides': "(rd.url LIKE '%guide%' OR rd.url LIKE '%handbook%')",
                    'Other': " AND ".join(f"rd.url NOT LIKE '%{k}%'" for k in [
                        'bylaw', '/agenda', '/minutes', 'legdocs', 'budget', 'report',
                        'consultation', 'permit', 'building', 'form', 'application',
                        'policy', 'procedure', 'plan', 'strategy', 'map', 'guide', 'handbook',
                    ]),
                }
                clause = like_map.get(cat)
                if not clause:
                    continue
                print(f"\n  --- {cat} ---")
                samples = s.execute(text(f"""
                    SELECT DISTINCT rd.url FROM canadian_ai.raw_documents rd
                    WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
                    AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
                    AND {clause}
                    LIMIT :n
                """), {"n": args.samples}).fetchall()
                for sr in samples:
                    print(f"    {sr[0]}")

        print(f"\n=== ESTIMATED DOWNLOAD SIZE ===")
        print(f"  At ~500KB average per PDF:")
        print(f"  {total:,} PDFs x 0.5MB = ~{total * 0.5 / 1000:.1f} GB download")
        print(f"  Storage after cleanup: minimal (text only)")


def main():
    parser = argparse.ArgumentParser(
        description="Zeever.ca crawl management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
commands:
  status       System overview, gaps, and coverage stats
  pipeline     Run the full data pipeline (crawl + parse + embed)
  recrawl      Smart re-crawl of pages changed since last run
  gaps         Crawl and parse missing HTML pages
  pdfs         Analyze uncrawled PDF URLs by category
  download     Download uncrawled PDFs by category
  warmup       Pre-populate the query cache with known questions
        """,
    )
    sub = parser.add_subparsers(dest="command")

    # status
    sub.add_parser("status", help="System overview and gap analysis")

    # pipeline
    p_pipe = sub.add_parser("pipeline", help="Run the full data pipeline")
    p_pipe.add_argument("--skip-crawl", action="store_true", help="Skip crawl (parse + embed only)")
    p_pipe.add_argument("--skip-cleanup", action="store_true", help="Keep raw content after parsing")
    p_pipe.add_argument("--dry-run", action="store_true", help="Show stats without changes")

    # recrawl
    p_recrawl = sub.add_parser("recrawl", help="Re-crawl changed pages from sitemap")
    p_recrawl.add_argument("--since", type=int, help="Only pages changed in last N days")
    p_recrawl.add_argument("--section", type=str, help="Filter by URL path (e.g. 'recreation')")
    p_recrawl.add_argument("--dry-run", action="store_true", help="Preview without crawling")

    # gaps
    p_gaps = sub.add_parser("gaps", help="Crawl missing HTML pages")
    p_gaps.add_argument("--dry-run", action="store_true", help="Preview without crawling")

    # pdfs
    p_pdfs = sub.add_parser("pdfs", help="Analyze uncrawled PDF URLs")
    p_pdfs.add_argument("--samples", type=int, default=0, help="Show N sample URLs per category")

    # download
    from download_pdfs import PDF_CATEGORIES
    p_dl = sub.add_parser("download", help="Download uncrawled PDFs by category")
    p_dl.add_argument(
        "--categories",
        nargs="+",
        choices=list(PDF_CATEGORIES.keys()),
        help=f"Categories: {', '.join(PDF_CATEGORIES.keys())}",
    )
    p_dl.add_argument("--all", action="store_true", help="Download all categories")
    p_dl.add_argument("--dry-run", action="store_true", help="Preview without downloading")

    # warmup
    p_warm = sub.add_parser("warmup", help="Pre-populate query cache")
    p_warm.add_argument("--benchmark", action="store_true", help="Warm 100 benchmark questions")
    p_warm.add_argument("--homepage", action="store_true", help="Warm 30 homepage questions")
    p_warm.add_argument("--dry-run", action="store_true", help="Show questions without warming")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "status": cmd_status,
        "pipeline": cmd_pipeline,
        "recrawl": cmd_recrawl,
        "gaps": cmd_gaps,
        "pdfs": cmd_pdfs,
        "download": cmd_download,
        "warmup": cmd_warmup,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
