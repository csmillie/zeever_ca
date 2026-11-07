"""Remove already-indexed PDFs that are reference material rather than answers.

    uv run python scripts/prune_reference_pdfs.py                    # dry run
    uv run python scripts/prune_reference_pdfs.py --group translated
    uv run python scripts/prune_reference_pdfs.py --apply

The crawler filter stops fetching these, but it does nothing about the ones
already in the corpus. This removes those, through the same code path a re-parse
uses, so Turbopuffer is cleaned before Postgres and a failure there aborts the
whole transaction rather than leaving vectors in the live index with no row
behind them.

Measured over a 295-page sample, by audience:

    resident facing      73 percent
    reference/archive    39 percent    council-meeting alone: 15 percent
    translated            0 percent    unreachable by an English query

Be clear about what this does and does not buy. It does not improve retrieval for
the documents that remain: dropping low scorers raises the blended average
without changing a single answer, and quoting that as an improvement would be
dishonest. What it plausibly buys is less competition for the five context slots
an answer is built from, plus a smaller embedding and storage bill. The first of
those is testable and should be tested:

    uv run python scripts/audit_pdf_corpus.py --urls-out resident.txt --only resident
    uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json
    uv run python scripts/prune_reference_pdfs.py --apply
    uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json

Same pages, same questions, one variable. If resident-facing recall does not move,
the exclusion was worth doing for cost and nothing else, and that is worth knowing
rather than assuming.

translated is a separate group on purpose. Those documents are not underperforming,
they are unreachable: an English query cannot match a Punjabi article. Whether to
drop them or to support the languages is a product decision, so it is not included
in the default group and has to be asked for.
"""
import argparse
from collections import Counter

from sqlalchemy import text as sql

from crawler.pdf_classes import REFERENCE, TRANSLATED, classify
from parser.supersede import retire_parsed_documents
from shared.db import get_session

GROUPS = {"reference": REFERENCE, "translated": TRANSLATED}

_PDFS = """
    SELECT pd.id, pd.url, count(dc.id) AS chunks
    FROM canadian_ai.parsed_documents pd
    LEFT JOIN canadian_ai.document_chunks dc ON dc.parsed_document_id = pd.id
    WHERE pd.url ILIKE '%.pdf'
    GROUP BY pd.id, pd.url
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="perform the deletion (default is a dry run)")
    ap.add_argument("--group", choices=sorted(GROUPS), default="reference",
                    help="which audience group to remove (default reference)")
    ap.add_argument("--show", type=int, default=12, help="classes to list")
    args = ap.parse_args()

    target = GROUPS[args.group]

    with get_session() as session:
        rows = [dict(r._mapping) for r in session.execute(sql(_PDFS))]
        doomed = [r for r in rows if classify(r["url"]) in target]

        if not doomed:
            print(f"No indexed PDFs fall in the {args.group} group. Nothing to do.")
            return 0

        by_class = Counter(classify(r["url"]) for r in doomed)
        chunks = sum(r["chunks"] or 0 for r in doomed)
        total_chunks = sum(r["chunks"] or 0 for r in rows)

        print(f"{len(rows):,} indexed PDFs, {total_chunks:,} chunks")
        print(f"{len(doomed):,} of them are {args.group}, holding {chunks:,} chunks "
              f"({chunks / max(total_chunks, 1) * 100:.1f}% of the PDF corpus)\n")
        for name, count in by_class.most_common(args.show):
            cls_chunks = sum(r["chunks"] or 0 for r in doomed if classify(r["url"]) == name)
            print(f"  {count:>6,} pages  {cls_chunks:>7,} chunks  {name}")

        if not args.apply:
            print("\nDry run. Nothing was changed.")
            print("Capture the baseline BEFORE applying this, or the comparison is lost:")
            print("  uv run python scripts/audit_pdf_corpus.py --urls-out resident.txt --only resident")
            print("  uv run python scripts/eval_retrieval_breadth.py --urls resident.txt --questions q.json")
            print("\nThen re-run this with --apply.")
            return 0

        print(f"\nRemoving {len(doomed):,} documents and {chunks:,} chunks...")
        try:
            parsed, removed = retire_parsed_documents(session, [r["id"] for r in doomed])
            session.commit()
        except Exception as exc:
            session.rollback()
            print(f"FAILED: {type(exc).__name__}: {exc}")
            print("Rolled back. Nothing was deleted from Postgres.")
            print("If the Turbopuffer step is what failed, some vectors may already be")
            print("gone; re-running is safe.")
            return 1

    print(f"Removed {parsed:,} documents and {removed:,} chunks.")
    print("\nNow re-run the eval with the SAME urls and questions files. If resident")
    print("recall does not move, this was a cost saving and not a quality change.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
