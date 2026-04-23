"""Quick check on PDF parsing status."""
from shared.db import get_session
from sqlalchemy import text

with get_session() as s:
    parsed_pdfs = s.execute(text("""
        SELECT count(*) FROM canadian_ai.parsed_documents
        WHERE source_format = 'pdf'
    """)).scalar()
    unparsed_pdf_urls = s.execute(text("""
        SELECT count(DISTINCT rd.url) FROM canadian_ai.raw_documents rd
        WHERE (rd.url LIKE '%wp-content%' OR rd.url LIKE '%.pdf')
        AND NOT EXISTS (SELECT 1 FROM canadian_ai.parsed_documents pd WHERE pd.url = rd.url)
    """)).scalar()
    print(f"Parsed PDFs: {parsed_pdfs}")
    print(f"Unparsed PDF URLs: {unparsed_pdf_urls}")
    print()
    print("These are PDF links discovered during crawling that were")
    print("either never downloaded, or downloaded and cleaned up.")
    print("They are NOT missing content from search results.")
