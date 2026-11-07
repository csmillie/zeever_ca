"""How much of the corpus is the same text repeated on different pages.

    uv run python scripts/audit_duplicate_chunks.py
    uv run python scripts/audit_duplicate_chunks.py --show 25 --min-chars 200

A missed-PDF diagnosis found one chunk with 2,236 near-copies on other pages: an
authority table that appears in every Delegated Approval Form the City publishes.
Copies like that cost three separate things. They occupy rows and an index. They
compete for the five context slots on any query they resemble, so a resident
asking about real estate authority can receive five renderings of one paragraph
instead of five sources. And they make the breadth eval unreadable on those
pages, because a question written from one copy has hundreds of correct answers
and the eval credits exactly one.

This measures the exact-duplicate case, which needs no embeddings and is the
floor: near-duplicates are strictly more numerous. Text is normalised for
whitespace only, so two chunks count as identical when they truly are.

It reports what to do about it rather than only the size: the largest families,
their sample URLs, and how much of the corpus would remain if each family kept
one copy.
"""
import argparse
import hashlib
import re
from collections import defaultdict

from sqlalchemy import text as sql

from shared.db import get_session

_ALL = sql("""
    SELECT dc.id, dc.chunk_text, pd.url
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
""")


def normalise(body: str) -> str:
    """Whitespace only. Anything cleverer would merge chunks that differ."""
    return re.sub(r"\s+", " ", (body or "")).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--show", type=int, default=15, help="how many families to list")
    ap.add_argument("--min-chars", type=int, default=100,
                    help="ignore families shorter than this; a repeated heading is "
                         "not the problem, a repeated page of policy is")
    args = ap.parse_args()

    families: dict[str, list[str]] = defaultdict(list)
    sample_text: dict[str, str] = {}
    total = 0

    with get_session() as session:
        for row in session.execute(_ALL):
            body = normalise(row.chunk_text)
            if len(body) < args.min_chars:
                continue
            total += 1
            key = hashlib.md5(body.encode()).hexdigest()
            families[key].append(row.url)
            sample_text.setdefault(key, body)

    if not total:
        print("No chunks above the length floor. Is the corpus embedded?")
        return 2

    dupes = {k: urls for k, urls in families.items() if len(urls) > 1}
    duplicated_chunks = sum(len(u) for u in dupes.values())
    # What one copy per family would leave. The saving is every copy after the
    # first, which is also every copy that can crowd a result list.
    redundant = duplicated_chunks - len(dupes)

    print(f"chunks considered (>= {args.min_chars} chars): {total:,}")
    print(f"distinct texts:                                {len(families):,}")
    print(f"chunks that are a copy of another:             {duplicated_chunks:,} "
          f"({duplicated_chunks / total:.1%})")
    print(f"redundant copies, keeping one of each:         {redundant:,} "
          f"({redundant / total:.1%} of the corpus)\n")

    big = sorted(dupes.items(), key=lambda kv: -len(kv[1]))
    in_large = sum(len(u) for _, u in big if len(u) >= 10)
    print(f"chunks in families of 10 or more: {in_large:,} ({in_large / total:.1%})\n")

    print(f"LARGEST FAMILIES")
    for key, urls in big[:args.show]:
        body = sample_text[key]
        # Distinct pages, not occurrences: a paragraph repeated three times on one
        # page is a different problem from one appearing on three hundred pages.
        pages = len(set(urls))
        print(f"\n  {len(urls):>5} copies on {pages:>5} pages, {len(body):>5} chars")
        print(f"        {body[:150]}")
        print(f"        e.g. {sorted(set(urls))[0]}")

    print("\nWhat this implies")
    print("  Each redundant copy is a row, an index entry, and a candidate for the")
    print("  five context slots. Collapsing a family to one copy removes none of the")
    print("  information and all of the crowding.")
    print("  Families that are whole documents rather than shared paragraphs are an")
    print("  ingestion question instead: see crawler/pdf_classes.py, which already")
    print("  excludes reference material by URL and does not yet name these.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
