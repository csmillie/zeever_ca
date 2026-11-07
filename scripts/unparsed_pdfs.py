"""Analyze what the 13,695 unparsed PDF URLs actually are."""
from shared.db import get_session
from sqlalchemy import text

with get_session() as s:
    print("=== UNPARSED PDF URLs BY CATEGORY ===")
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
        WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
        AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
        GROUP BY category
        ORDER BY cnt DESC
    """)).fetchall()
    total = 0
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
        total += r[1]
    print(f"  TOTAL: {total}")

    print()
    print("=== SAMPLE URLs PER CATEGORY (top 5 each) ===")
    for cat_row in rows[:6]:
        cat = cat_row[0]
        like_clause = {
            'Bylaws': "rd.url LIKE '%bylaw%'",
            'Agendas & Minutes': "(rd.url LIKE '%/agenda%' OR rd.url LIKE '%/minutes%')",
            'Legal Documents': "rd.url LIKE '%legdocs%'",
            'Budget': "rd.url LIKE '%budget%'",
            'Reports': "rd.url LIKE '%report%'",
            'Other': "rd.url NOT LIKE '%bylaw%' AND rd.url NOT LIKE '%/agenda%' AND rd.url NOT LIKE '%/minutes%' AND rd.url NOT LIKE '%legdocs%' AND rd.url NOT LIKE '%budget%' AND rd.url NOT LIKE '%report%' AND rd.url NOT LIKE '%consultation%' AND rd.url NOT LIKE '%permit%' AND rd.url NOT LIKE '%building%' AND rd.url NOT LIKE '%form%' AND rd.url NOT LIKE '%application%' AND rd.url NOT LIKE '%policy%' AND rd.url NOT LIKE '%procedure%' AND rd.url NOT LIKE '%plan%' AND rd.url NOT LIKE '%strategy%' AND rd.url NOT LIKE '%map%' AND rd.url NOT LIKE '%guide%' AND rd.url NOT LIKE '%handbook%'",
        }.get(cat)
        if not like_clause:
            continue
        print(f"\n  --- {cat} ---")
        samples = s.execute(text(f"""
            SELECT DISTINCT rd.url FROM canadian_ai.raw_documents rd
            WHERE (rd.url ILIKE '%wp-content%' OR rd.url ILIKE '%.pdf')
            AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
            AND {like_clause}
            LIMIT 5
        """)).fetchall()
        for sr in samples:
            print(f"    {sr[0]}")

    print()
    print("=== ESTIMATED DOWNLOAD SIZE ===")
    print("  At ~500KB average per PDF:")
    print(f"  {total} PDFs x 0.5MB = ~{total * 0.5 / 1000:.1f} GB download")
    print(f"  Storage after cleanup: minimal (text only)")
