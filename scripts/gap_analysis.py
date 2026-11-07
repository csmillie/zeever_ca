"""Analyze gaps in crawl/parse coverage."""
from shared.db import get_session
from sqlalchemy import text


def main():
    with get_session() as s:
        print("=== URL PATTERN BREAKDOWN (unparsed) ===")
        rows = s.execute(text("""
            SELECT
              CASE
                WHEN rd.url ILIKE '%wp-content%' THEN 'PDF'
                WHEN rd.url ILIKE '%.pdf' THEN 'PDF'
                WHEN rd.url LIKE '%#%' THEN 'Anchor fragment'
                WHEN rd.url LIKE '%?%' THEN 'Query param'
                ELSE 'HTML page'
              END as url_type,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (
                SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url
            )
            GROUP BY url_type
            ORDER BY cnt DESC
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]}")

        print()
        print("=== CONTENT STATUS (unparsed URLs) ===")
        rows = s.execute(text("""
            SELECT
              CASE WHEN raw_content IS NOT NULL THEN 'has content' ELSE 'no content (cleaned or never crawled)' END as status,
              count(*) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (
                SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url
            )
            GROUP BY status
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]}")

        print()
        print("=== SAMPLE UNPARSED HTML URLs ===")
        rows = s.execute(text("""
            SELECT DISTINCT rd.url
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (
                SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url
            )
            AND rd.url NOT ILIKE '%wp-content%'
            AND rd.url NOT ILIKE '%.pdf'
            LIMIT 20
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}")

        print()
        print("=== DUPLICATE RAW ROWS ===")
        row = s.execute(text("""
            SELECT count(*) FROM (
                SELECT url, count(*) as cnt
                FROM canadian_ai.raw_documents
                GROUP BY url
                HAVING count(*) > 1
            ) dupes
        """)).scalar()
        print(f"  URLs with multiple raw_document rows: {row}")

        print()
        print("=== AWAITING PARSE (have content, no parsed doc) ===")
        row = s.execute(text("""
            SELECT count(*) FROM canadian_ai.raw_documents rd
            WHERE raw_content IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()
        print(f"  Documents with content awaiting parse: {row}")

        print()
        print("=== EMPTY CHUNKS ===")
        row = s.execute(text("""
            SELECT count(*) FROM canadian_ai.document_chunks
            WHERE (chunk_text IS NULL OR chunk_text = '') AND embedding IS NULL
        """)).scalar()
        print(f"  Empty chunks (scanned PDFs): {row}")

        # --- PDF URL mismatch check ---
        print()
        print("=== PDF URL MISMATCH CHECK ===")
        print("  (Do 'unparsed' PDFs actually have parsed docs under similar URLs?)")
        row = s.execute(text("""
            SELECT count(DISTINCT rd.url)
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        """)).scalar()
        print(f"  Unparsed PDF URLs (exact match): {row}")

        row2 = s.execute(text("""
            SELECT count(DISTINCT rd.url)
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND NOT EXISTS (
                SELECT 1 FROM canadian_ai.parsed_documents pd2
                WHERE split_part(pd2.url, '/', -1) != ''
                AND rd.url LIKE '%' || split_part(pd2.url, '/', -1) || '%'
                AND pd2.source_format = 'pdf'
            )
        """)).scalar()
        print(f"  Truly unparsed (no filename match either): {row2}")
        print(f"  Likely already parsed under different URL: {row - row2}")

        # Check if unparsed PDFs ever had content
        rows = s.execute(text("""
            SELECT
              CASE WHEN raw_content IS NOT NULL THEN 'still has content' ELSE 'content cleaned up' END as status,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            GROUP BY status
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]}")

        # --- HTML gap analysis ---
        print()
        print("=== UNPARSED HTML PAGES BY SECTION ===")
        rows = s.execute(text("""
            SELECT
              split_part(rd.url, '/', 4) as section,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%'
            AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%'
            AND rd.url NOT LIKE '%?%'
            GROUP BY section
            ORDER BY cnt DESC
            LIMIT 20
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]}")

        print()
        print("=== UNPARSED HTML - CONTENT STATUS ===")
        rows = s.execute(text("""
            SELECT
              CASE WHEN raw_content IS NOT NULL THEN 'has content (ready to parse)' ELSE 'needs crawl' END as status,
              count(DISTINCT rd.url) as cnt
            FROM canadian_ai.raw_documents rd
            WHERE NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND rd.url NOT ILIKE '%wp-content%'
            AND rd.url NOT ILIKE '%.pdf'
            AND rd.url NOT LIKE '%#%'
            AND rd.url NOT LIKE '%?%'
            GROUP BY status
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]}")


if __name__ == "__main__":
    main()
