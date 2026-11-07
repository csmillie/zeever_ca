"""Remove the redundant parses a URL accumulated before supersede-by-URL existed.

    uv run python scripts/dedupe_parses.py                # dry run, changes nothing
    uv run python scripts/dedupe_parses.py --show 30      # more detail
    uv run python scripts/dedupe_parses.py --apply        # actually delete

Every re-crawl used to add a parallel copy of a page: run_parse_pipeline skipped
raw documents by raw_document_id, and a re-crawl gives the same URL a new raw
document, so the parser wrote a second ParsedDocument with its own chunks and
embeddings. Nothing removed the first. 590 URLs, 1,026 redundant copies.

The copies then compete for the same top-5 slots at near-identical similarity.
Three of them took ranks 1 to 3 on "How do I pay my water bill" and pushed the
page that answers it to rank 6, and all seven ranking misses in the retrieval
audit lost to a duplicate holding a slot.

The pipeline no longer creates these. This clears the ones already there.

Survivor is the newest parse by parsed_at, with the id as a tiebreak so a run is
reproducible. Deletions go through the same code path the pipeline uses, so
Turbopuffer is cleaned before Postgres and a failure there aborts the whole
transaction rather than leaving vectors in the live index with no row behind them.
"""
import argparse

from sqlalchemy import text as sql

from parser.supersede import retire_parsed_documents
from shared.config import settings
from shared.db import get_session

# Newest wins. NULLS LAST so a row that never recorded parsed_at loses to one that
# did; id breaks the remaining ties so two runs pick the same survivor.
_GROUPS = """
    SELECT url,
           array_agg(id ORDER BY parsed_at DESC NULLS LAST, id DESC) AS ids,
           array_agg(parsed_at ORDER BY parsed_at DESC NULLS LAST, id DESC) AS stamps
    FROM canadian_ai.parsed_documents
    WHERE url IS NOT NULL
    GROUP BY url
    HAVING count(*) > 1
    ORDER BY count(*) DESC, url
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="perform the deletion (default is a dry run)")
    ap.add_argument("--show", type=int, default=15, help="how many URLs to list")
    ap.add_argument("--url-contains", help="limit to URLs containing this")
    args = ap.parse_args()

    with get_session() as session:
        groups = [dict(r._mapping) for r in session.execute(sql(_GROUPS))]
        if args.url_contains:
            needle = args.url_contains.lower()
            groups = [g for g in groups if needle in (g["url"] or "").lower()]

        if not groups:
            print("No URL has more than one parse. Nothing to do.")
            return 0

        doomed = [i for g in groups for i in g["ids"][1:]]
        chunk_count = session.execute(sql("""
            SELECT count(*) FROM canadian_ai.document_chunks
            WHERE parsed_document_id = ANY(:ids)
        """), {"ids": doomed}).scalar() or 0
        embedded = session.execute(sql("""
            SELECT count(*) FROM canadian_ai.document_chunks
            WHERE parsed_document_id = ANY(:ids) AND embedding IS NOT NULL
        """), {"ids": doomed}).scalar() or 0

        print(f"{len(groups):,} URLs with more than one parse")
        print(f"{len(doomed):,} redundant parses to remove, {chunk_count:,} chunks "
              f"({embedded:,} with embeddings in Turbopuffer)\n")

        for g in groups[:args.show]:
            keep, *drop = g["ids"]
            newest = g["stamps"][0]
            print(f"  {len(g['ids'])}x  {g['url']}")
            print(f"        keep   {keep}  parsed {newest}")
            for pid, stamp in zip(drop, g["stamps"][1:]):
                print(f"        drop   {pid}  parsed {stamp}")
        if len(groups) > args.show:
            print(f"  ... and {len(groups) - args.show:,} more URLs")

        if not args.apply:
            print("\nDry run. Nothing was changed. Re-run with --apply to delete.")
            print("The surviving parse of each URL is the newest; the rest and their")
            print("chunks go, including their vectors in Turbopuffer.")
            return 0

        if settings.retrieval_backend != "turbopuffer":
            print(f"\nNote: retrieval_backend is {settings.retrieval_backend!r}, but the")
            print("Turbopuffer namespace is still cleaned so the two stores do not drift.")

        print(f"\nDeleting {len(doomed):,} parses...")
        try:
            parsed, chunks = retire_parsed_documents(session, doomed)
            session.commit()
        except Exception as exc:
            session.rollback()
            print(f"FAILED: {type(exc).__name__}: {exc}")
            print("Rolled back. Nothing was deleted from Postgres.")
            print("If this was the Turbopuffer step, some vectors may already be gone;")
            print("re-running is safe, and scripts/manage.py can re-sync what remains.")
            return 1

        print(f"Removed {parsed:,} parses and {chunks:,} chunks.")
        remaining = session.execute(sql("""
            SELECT count(*) FROM (
                SELECT url FROM canadian_ai.parsed_documents
                WHERE url IS NOT NULL GROUP BY url HAVING count(*) > 1
            ) t
        """)).scalar()
        print(f"URLs still parsed more than once: {remaining}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
