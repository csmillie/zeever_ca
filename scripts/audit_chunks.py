"""How much of the stored corpus carries the duplicated-heading defect.

    uv run python scripts/audit_chunks.py
    uv run python scripts/audit_chunks.py --show 20
    uv run python scripts/audit_chunks.py --url-contains parks-recreation

The HTML parser emitted every heading twice: `descendants` yields a heading Tag
and then the strings inside it, and both branches rendered it. The chunker then
prepends the heading to a body that already began with it. Headings are short and
navigational, so the duplicate is a large share of a small chunk and inflates its
embedding toward exactly the generic phrases most likely to hijack an unrelated
query.

The parser is fixed, but the fix only reaches the corpus through a re-parse. This
says whether that is worth doing — how many chunks are affected, and how much of
their text is the wasted copy — and whether it needs a re-crawl to get there.

Detection is positional, matching how the defect is produced: the chunk opens with
a line, and the next non-blank line repeats it. Text that merely mentions the same
phrase later is not counted.

It also reports the two facts that decide how the corpus gets rebuilt: whether
raw_content survived (a re-parse, minutes) or was cleared (a re-crawl, hours), and
whether any URL was parsed more than once. Duplicate parses put duplicate chunks in
the index, which is what pushed the correct page below the top-5 cut on the
utilities query and forced the per-URL cap in retriever.py. A rebuild that does not
address it bakes the duplicates back in.
"""
import argparse
import statistics
from collections import Counter

from sqlalchemy import text as sql

from shared.db import get_session


def duplicated_opening(chunk_text: str) -> str | None:
    """The repeated heading, if this chunk opens with one twice. Else None."""
    lines = [ln.strip() for ln in (chunk_text or "").split("\n")]
    lines = [ln for ln in lines if ln]
    if len(lines) < 2:
        return None
    first, second = lines[0], lines[1]
    # Headings are short; a repeated long line is a different phenomenon.
    if first and first == second and len(first) <= 120:
        return first
    return None


def _corpus_health(session, show: int) -> None:
    """Print what the rebuild path depends on: retained HTML, and duplicate parses."""
    q = lambda stmt: session.execute(sql(stmt)).scalar()  # noqa: E731

    total = q("SELECT count(*) FROM canadian_ai.raw_documents") or 0
    kept = q("SELECT count(*) FROM canadian_ai.raw_documents "
             "WHERE raw_content IS NOT NULL") or 0
    kept_html = q("SELECT count(*) FROM canadian_ai.raw_documents "
                  "WHERE raw_content IS NOT NULL AND url NOT ILIKE '%.pdf'") or 0
    parsed_html = q("SELECT count(*) FROM canadian_ai.parsed_documents "
                    "WHERE url NOT ILIKE '%.pdf'") or 0

    print("REBUILD PATH")
    print(f"  raw documents:            {total:>8,}")
    pct = f"  ({kept / total * 100:.1f}%)" if total else ""
    print(f"  still holding content:    {kept:>8,}{pct}")
    print(f"  of those, HTML:           {kept_html:>8,}")
    print(f"  parsed HTML pages:        {parsed_html:>8,}   <- the pages needing a re-parse")
    # Only HTML is affected: PDFs go through parse_pdf, which never touches
    # _extract_structured_text.
    if parsed_html and kept_html >= parsed_html * 0.9:
        print("\n  Nearly all HTML still has its raw content. This is a re-parse and")
        print("  re-embed, no re-fetch:")
        print("    uv run python scripts/manage.py pipeline --skip-crawl")
    elif kept_html:
        missing = max(parsed_html - kept_html, 0)
        print(f"\n  {missing:,} HTML pages have had raw_content cleared and must be fetched")
        print("  again; the rest can be re-parsed in place.")
    else:
        print("\n  No raw content retained. Rebuilding means a full re-crawl of the HTML")
        print("  pages. At the configured 1s rate limit that is roughly "
              f"{parsed_html / 3600:.1f} hours of fetching.")

    dupes = session.execute(sql("""
        SELECT url, count(*) AS n
        FROM canadian_ai.parsed_documents
        GROUP BY url HAVING count(*) > 1
        ORDER BY n DESC
    """)).fetchall()

    print("\nDUPLICATE PARSES")
    if not dupes:
        print("  No URL is parsed more than once.")
    else:
        extra = sum(n - 1 for _, n in dupes)
        print(f"  {len(dupes):,} URLs parsed more than once, {extra:,} redundant copies.")
        print("  Each copy is chunked and embedded separately, so they compete with each")
        print("  other for the top-5 slots at identical similarity. retriever.py caps")
        print("  chunks per URL at read time, which limits the damage but leaves the")
        print("  duplicates in the index.")
        for url, n in dupes[:show]:
            print(f"    {n:>3}x  {url}")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--show", type=int, default=10, help="how many examples to print")
    ap.add_argument("--url-contains", help="only chunks whose URL contains this")
    args = ap.parse_args()

    where = "WHERE pd.url ILIKE :pat" if args.url_contains else ""
    params = {"pat": f"%{args.url_contains}%"} if args.url_contains else {}

    with get_session() as session:
        if not args.url_contains:
            _corpus_health(session, args.show)
        rows = session.execute(sql(f"""
            SELECT dc.chunk_text, pd.url
            FROM canadian_ai.document_chunks dc
            JOIN canadian_ai.parsed_documents pd ON pd.id = dc.parsed_document_id
            {where}
        """), params).fetchall()

    if not rows:
        print("No chunks found. Is the database populated, and does --url-contains match?")
        return 2

    affected = []
    for chunk_text, url in rows:
        dup = duplicated_opening(chunk_text)
        if dup:
            waste = len(dup) / max(len(chunk_text), 1)
            affected.append((waste, dup, url, len(chunk_text)))

    total = len(rows)
    n = len(affected)
    print(f"{total:,} chunks scanned\n")
    if not n:
        print("No chunk opens with a duplicated heading. Either the corpus was parsed")
        print("after the fix, or the defect does not reach these rows.")
        return 0

    share = n / total * 100
    wastes = [w for w, _, _, _ in affected]
    print(f"{n:,} chunks ({share:.1f}%) open with a duplicated heading")
    print(f"  wasted text: median {statistics.median(wastes) * 100:.1f}% of the chunk, "
          f"worst {max(wastes) * 100:.1f}%")

    # Short chunks are where this does damage: the duplicate dominates the embedding.
    heavy = [a for a in affected if a[0] >= 0.25]
    if heavy:
        print(f"  {len(heavy):,} of them are at least a quarter duplicated text — these are")
        print("  the ones that will outrank genuinely relevant chunks")

    print(f"\nMOST AFFECTED PAGES")
    by_page = Counter(url for _, _, url, _ in affected)
    for url, count in by_page.most_common(args.show):
        print(f"  {count:>4} chunks  {url}")

    print(f"\nWORST CHUNKS (by share of text that is the duplicate)")
    for waste, dup, url, length in sorted(affected, reverse=True)[:args.show]:
        print(f"  {waste * 100:>5.1f}%  {length:>5} chars  {dup[:60]!r}")
        print(f"          {url}")

    print("\nThese are fixed by parsing the affected pages again. See REBUILD PATH")
    print("above for whether that needs a re-crawl or only a re-parse.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
