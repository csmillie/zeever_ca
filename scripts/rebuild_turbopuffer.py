"""Rebuild the Turbopuffer index from Postgres, into a fresh namespace.

    uv run python scripts/rebuild_turbopuffer.py --dry-run
    uv run python scripts/rebuild_turbopuffer.py --namespace zeever-v2
    uv run python scripts/rebuild_turbopuffer.py --namespace zeever-v2 --verify

Postgres is the authority for what the corpus contains. Turbopuffer is a copy,
and the two have drifted: 57,847 embedded chunks against 71,035 rows indexed, so
roughly 13,000 rows describe chunks that no longer exist. Those can be returned
as sources, citing pages the corpus deliberately dropped, which is the failure
the offsite prune existed to prevent arriving from the other direction.

They cannot be reconciled by diffing. The Turbopuffer SDK has no export or list
call, so there is no way to ask which ids it holds and delete the extras. The
only way to a known-correct index is to build one from Postgres.

Doing that in place would mean delete_all followed by a refill, leaving search
empty for the length of the run and partial if it failed part way. So this writes
to a new namespace while the live one keeps serving. Switching is one line of
config:

    TURBOPUFFER_NAMESPACE=zeever-v2      # in .env, then restart the API

and switching back is the same line, which is what makes this safe to do on a
live site. Delete the old namespace once the new one has served for a while.

Why not just prevent the drift: because the drift already exists and the
prevention does not remove it. index_pipeline dual-writes best-effort and treats
a failed sync as a warning, so the two stores can separate again. That is worth
fixing separately; this fixes the state they are in now.
"""
import argparse

from sqlalchemy import text as sql

from indexer.turbopuffer_store import chunk_row_to_tpuf, get_namespace, upsert_rows
from shared.config import settings
from shared.db import get_session

BATCH = 500

_COUNT = "SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL"

# Keyset pagination on id rather than LIMIT/OFFSET. An OFFSET scan re-reads every
# preceding row, so the last batches of a 57,000-row rebuild cost far more than
# the first, and any concurrent insert shifts the window and silently skips a row.
_PAGE = """
    SELECT dc.id, dc.chunk_text, dc.metadata,
           pd.url, pd.title, pd.content_type, dc.embedding
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL AND dc.id > :after
    ORDER BY dc.id
    LIMIT :limit
"""

# Every id sorts after this, so the first page needs no special case.
_START = "00000000-0000-0000-0000-000000000000"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--namespace", help="write here instead of the configured namespace")
    ap.add_argument("--dry-run", action="store_true", help="report the plan, write nothing")
    ap.add_argument("--verify", action="store_true",
                    help="after writing, compare the namespace row count against Postgres")
    args = ap.parse_args()

    target = args.namespace or settings.turbopuffer_namespace
    live = settings.turbopuffer_namespace

    with get_session() as session:
        expected = session.execute(sql(_COUNT)).scalar() or 0

    print(f"Postgres embedded chunks   {expected:>9,}")
    print(f"Target namespace           {target}")
    if target == live:
        print("\nThis is the namespace currently serving queries. Writing here is an")
        print("upsert, so nothing breaks, but rows for chunks Postgres no longer has")
        print("will survive and keep being returned as sources. Pass --namespace to")
        print("build a clean index instead.")
    else:
        print(f"Live namespace             {live}  (untouched)")

    if args.dry_run:
        print(f"\nDry run. Would write {expected:,} chunks in batches of {BATCH}.")
        if target != live:
            print(f"Then: set TURBOPUFFER_NAMESPACE={target} in .env and restart the API.")
        return 0

    after, total = _START, 0
    while True:
        with get_session() as session:
            rows = [dict(r._mapping) for r in
                    session.execute(sql(_PAGE), {"after": after, "limit": BATCH})]
        if not rows:
            break
        upsert_rows([chunk_row_to_tpuf(r) for r in rows], namespace=target)
        after = str(rows[-1]["id"])
        total += len(rows)
        print(f"  {total:>7,}/{expected:,}")

    print(f"\nWrote {total:,} chunks to {target}.")
    if total != expected:
        # Not fatal: a chunk embedded while the rebuild was running is a legitimate
        # reason to differ. A large gap is not, and silently reporting success
        # over a short index is how the current drift went unnoticed.
        print(f"WARNING: expected {expected:,}. Difference of {abs(expected - total):,}.")

    if args.verify:
        indexed = get_namespace(target).metadata().approx_row_count
        print(f"\nNamespace reports        {indexed:>9,} rows (approximate)")
        print(f"Postgres has             {expected:>9,} embedded chunks")
        drift = indexed - expected
        if abs(drift) <= 50:
            print("These agree within the estimate. The index is a faithful copy.")
        else:
            print(f"Off by {drift:+,}, which is beyond the estimate. Do not switch to this")
            print("namespace until that is understood.")

    if target != live:
        print(f"\nTo put it in service: set TURBOPUFFER_NAMESPACE={target} in .env,")
        print("restart the API, then confirm a query cites the pages you expect.")
        print(f"To roll back, set it to {live} and restart. Delete the old namespace")
        print("only once the new one has served long enough to trust.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
