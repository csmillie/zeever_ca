"""Compare what Postgres has embedded against what Turbopuffer can actually search.

    uv run python scripts/audit_turbopuffer_drift.py
    uv run python scripts/audit_turbopuffer_drift.py --url-like ombudsman
    uv run python scripts/audit_turbopuffer_drift.py --url-like ombudsman --sync

With RETRIEVAL_BACKEND=turbopuffer, a chunk that exists in document_chunks with an
embedding is not retrievable unless it was also written to Turbopuffer. Those two
stores can disagree, and nothing reports it when they do:

  * index_pipeline dual-writes to Turbopuffer, but best-effort. A failure prints
    "WARN: Turbopuffer sync failed for batch" and the run continues and reports
    success, so the pgvector side is complete while the searchable side is short.
  * Anything that writes chunks without going through index_pipeline never syncs.
  * retire_parsed_documents deletes from both, so a delete-then-restore leaves
    Postgres whole and Turbopuffer missing whatever came back.

That last case is why this exists. Restoring 57 wrongly deleted documents put 355
embedded chunks back into Postgres while the answer for "how do I file a complaint
with the Ombudsman" still cited an insurance page, because the restored chunks
were not in the index being searched.

The count comparison is the headline. --url-like checks a specific set of pages
by id, which is what you want after restoring or re-parsing something in
particular, since a few hundred missing chunks do not move the total much.
"""
import argparse

from sqlalchemy import text as sql

from indexer.turbopuffer_store import _field, get_namespace, sync_chunk_ids
from shared.config import settings
from shared.db import get_session

# Turbopuffer's id filter is sent in one request. Chunk ids are UUID strings, so
# a few thousand is fine; beyond that the URL pattern is too broad to be a useful
# check anyway.
MAX_IDS = 2000

_EMBEDDED_TOTAL = """
    SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL
"""

_MATCHING_IDS = """
    SELECT dc.id::text
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL AND pd.url ILIKE :pattern
    ORDER BY dc.id
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url-like", help="check only chunks whose page URL contains this")
    ap.add_argument("--sync", action="store_true",
                    help="write the missing chunks to Turbopuffer (default reports only)")
    args = ap.parse_args()

    if settings.retrieval_backend != "turbopuffer":
        print(f"RETRIEVAL_BACKEND is {settings.retrieval_backend!r}, so Turbopuffer is not")
        print("serving queries and drift here costs nothing today. Reporting anyway,")
        print("because it would matter the moment the backend is switched.\n")

    with get_session() as session:
        pg_total = session.execute(sql(_EMBEDDED_TOTAL)).scalar() or 0

    tpuf_total = get_namespace().metadata().approx_row_count

    print(f"Postgres embedded chunks   {pg_total:>9,}")
    print(f"Turbopuffer rows (approx)  {tpuf_total:>9,}")
    drift = pg_total - tpuf_total
    # approx_row_count is Turbopuffer's own estimate, so a handful either way is
    # the estimate rather than a real gap. Anything larger is a real gap.
    if abs(drift) <= 50:
        print("These agree within the row-count estimate.\n")
    elif drift > 0:
        print(f"Turbopuffer is short by about {drift:,}. Those chunks are in Postgres")
        print("and cannot be retrieved.\n")
    else:
        print(f"Turbopuffer holds about {-drift:,} more than Postgres has embedded, so it")
        print("is carrying rows for chunks that no longer exist. They can still be")
        print("returned as sources and would cite pages the corpus has dropped.\n")

    if not args.url_like:
        print("Totals only. Pass --url-like to check a specific set of pages by id,")
        print("which is what catches a few hundred missing chunks that the totals hide.")
        return 0

    with get_session() as session:
        ids = [r[0] for r in session.execute(sql(_MATCHING_IDS),
                                             {"pattern": f"%{args.url_like}%"})]
    print(f"{len(ids):,} embedded chunks on pages matching {args.url_like!r}")
    if not ids:
        print("Nothing matches, so there is nothing to compare.")
        return 0
    if len(ids) > MAX_IDS:
        print(f"That is more than {MAX_IDS}, too broad to check by id. Narrow the pattern.")
        return 2

    # Ask Turbopuffer which of these ids it actually holds. No ranking involved:
    # a page can be present and still lose to a better match, and conflating the
    # two is how "the answer cited the wrong page" gets misread as a bug in
    # retrieval when the document was simply absent.
    found = set()
    result = get_namespace().query(filters=("id", "In", ids), top_k=len(ids),
                                   include_attributes=["url"])
    # _field because the SDK exposes a row's fields by item access in some
    # versions and attribute access in others, which the store already handles.
    for row in result.rows:
        found.add(str(_field(row, "id")))

    missing = [i for i in ids if i not in found]
    print(f"  in Turbopuffer  {len(found):,}")
    print(f"  missing         {len(missing):,}")

    if not missing:
        print("\nEvery one is indexed. If a query is not citing these pages, they are")
        print("being outranked rather than being absent, which is a retrieval question")
        print("and not a sync one.")
        return 0

    if not args.sync:
        print(f"\n{len(missing):,} chunks are searchable in name only. Re-run with --sync")
        print("to write them, or run scripts/backfill_turbopuffer.py to mirror everything.")
        return 0

    written = sync_chunk_ids(missing)
    print(f"\nWrote {written:,} chunks to Turbopuffer.")
    print("Re-run without --sync to confirm the gap closed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
