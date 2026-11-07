"""Which indexed documents produced too little text to be retrievable.

    uv run python scripts/audit_thin_parses.py
    uv run python scripts/audit_thin_parses.py --show 30 --format pdf

A breadth-eval run over 628 resident-facing PDFs found only 528 of them had a
usable chunk. The other 100 are in parsed_documents with a row each and nothing
worth searching, so they cannot be retrieved no matter how good retrieval gets.
They are also invisible in every measurement taken so far: the eval skips them
rather than scoring them as misses, which is right, and the audit counts them as
pages, which hides them among documents that work.

The likely cause for PDFs is a scan with no text layer. parse_pdf calls
page.get_text() and there is no OCR fallback, so an image of a page yields an
empty string and a document that exists but says nothing. This cannot be
confirmed from the database, because raw_content is cleared after parsing, so the
evidence here is circumstantial: a PDF with pages and no words.

Reported by audience class, because 100 broken resident guides matter and 100
broken council appendices do not.
"""
import argparse
from collections import Counter

from sqlalchemy import text as sql

from crawler.pdf_classes import RESIDENT, classify
from shared.db import get_session

# The breadth eval only considers chunks over 400 characters, so a document whose
# every chunk is shorter is unreachable by it and, in practice, by a reader.
USABLE_CHUNK_CHARS = 400

_QUERY = """
    SELECT pd.url,
           pd.source_format,
           coalesce(pd.word_count, 0)                                   AS words,
           count(dc.id)                                                 AS chunks,
           count(dc.id) FILTER (WHERE length(dc.chunk_text) > :chars)   AS usable,
           count(dc.id) FILTER (WHERE dc.embedding IS NOT NULL)         AS embedded
    FROM canadian_ai.parsed_documents pd
    LEFT JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
    WHERE pd.url IS NOT NULL
      {fmt}
    GROUP BY pd.url, pd.source_format, pd.word_count
"""


def diagnosis(row: dict) -> str | None:
    """Why this document cannot be retrieved, or None if it can."""
    if row["usable"]:
        return None
    if row["chunks"] == 0 and row["words"] == 0:
        return "no text extracted"
    if row["chunks"] == 0:
        return "text but no chunks"
    if row["embedded"] == 0:
        return "chunks but none embedded"
    return f"only short chunks (under {USABLE_CHUNK_CHARS} chars)"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--show", type=int, default=15, help="examples per group")
    ap.add_argument("--exclude-class", nargs="*", default=[],
                    help="hide these classes from the listing, e.g. bia-profile map-plan")
    ap.add_argument("--format", choices=["pdf", "html"], help="restrict to one source format")
    args = ap.parse_args()

    fmt = ""
    params = {"chars": USABLE_CHUNK_CHARS}
    if args.format:
        fmt = "AND pd.source_format = :fmt"
        params["fmt"] = args.format

    with get_session() as session:
        rows = [dict(r._mapping) for r in
                session.execute(sql(_QUERY.format(fmt=fmt)), params)]
    if not rows:
        print("No parsed documents matched.")
        return 2

    thin = [(r, d) for r in rows if (d := diagnosis(r))]
    print(f"{len(rows):,} parsed documents, {len(thin):,} with nothing retrievable "
          f"({len(thin) / len(rows) * 100:.1f}%)\n")
    if not thin:
        print("Every document has at least one chunk long enough to be searched.")
        return 0

    print("WHY")
    for reason, count in Counter(d for _, d in thin).most_common():
        print(f"  {count:>6,}  {reason}")

    print("\nBY SOURCE FORMAT")
    for fmt_name, count in Counter(r["source_format"] or "?" for r, _ in thin).most_common():
        total = sum(1 for r in rows if (r["source_format"] or "?") == fmt_name)
        print(f"  {count:>6,} of {total:,}  {fmt_name}")

    # The number that decides whether this is worth fixing.
    pdfs = [(r, d) for r, d in thin if (r["source_format"] or "") == "pdf"]
    resident = [(r, d) for r, d in pdfs if classify(r["url"]) in RESIDENT]
    print("\nBY AUDIENCE (PDFs only)")
    print(f"  {len(resident):>6,}  resident facing   <- these are the ones that matter")
    print(f"  {len(pdfs) - len(resident):>6,}  everything else")

    if resident:
        print(f"\nRESIDENT-FACING DOCUMENTS THAT CANNOT BE RETRIEVED")
        by_class = Counter(classify(r["url"]) for r, _ in resident)
        for name, count in by_class.most_common():
            print(f"  {count:>5}  {name}")
        hidden = set(args.exclude_class)
        listed = [(r, d) for r, d in resident if classify(r["url"]) not in hidden]
        if hidden:
            print(f"\n  hiding {len(resident) - len(listed)} rows from "
                  f"{', '.join(sorted(hidden))}")
        print()
        # Sorted so the text-bearing documents come first. A BIA boundary map with
        # five words is not a broken parse, it is a picture, and 93 of these are
        # maps. The ones worth looking at are the guides and forms buried under
        # them, and without the class on each row they are impossible to pick out.
        for r, d in sorted(listed, key=lambda x: (-x[0]["words"], x[0]["url"])):
            cls = classify(r["url"])
            print(f"  {cls:<17} {d:<34} {r['words']:>5}w  {r['url'][-62:]}")


    no_text = [r for r, d in thin if d == "no text extracted"
               and (r["source_format"] or "") == "pdf"]
    if no_text:
        print(f"\n{len(no_text):,} PDFs extracted no text at all. parse_pdf uses")
        print("page.get_text() with no OCR fallback, so a scanned page returns an empty")
        print("string. raw_content is cleared after parsing, so confirming that needs a")
        print("re-fetch of a few of these:")
        for r in no_text[:3]:
            print(f"  curl -sI {r['url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
