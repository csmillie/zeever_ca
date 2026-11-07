"""Create the vectorscale extension and build a StreamingDiskANN index.

    PGVECTORSCALE_DATABASE_URL=postgresql://USER:PASSWORD@BENCHMARK_HOST:5432/canadianai \
      uv run python scripts/setup_pgvectorscale.py --check
    ... uv run python scripts/setup_pgvectorscale.py --build

--check reports what is actually there and changes nothing. --build creates the
index, which takes minutes and holds a lock, so it is never the default.

Set the URL from .env or your shell, not from a value committed here. Run this
against the benchmark database, not production. The extension is a
separate install and the index is a second copy of the vectors; neither belongs
on a host shared with other people's sites.
"""
import argparse
import os
import time

from sqlalchemy import create_engine, text

from shared.benchmark_config import benchmark_settings

INDEX_NAME = "document_chunks_embedding_diskann"

# Verified against the extension's own documentation rather than recalled. Cosine
# ops because the app compares with <=>, and an index built for a different
# operator class is simply not used, silently.
CREATE_INDEX = f"""
    CREATE INDEX {INDEX_NAME}
    ON canadian_ai.document_chunks
    USING diskann (embedding vector_cosine_ops)
"""

# The default of 64MB is documented as too low for a build of this size. The
# benchmark host has 28GB free, so this costs nothing there and would be
# irresponsible on the production box.
BUILD_MEM = os.getenv("PGVECTORSCALE_BUILD_MEM", "2GB")


def engine():
    dsn = benchmark_settings.pgvectorscale_database_url
    if not dsn:
        raise SystemExit(
            "PGVECTORSCALE_DATABASE_URL is not set, in .env or the environment. "
            "Refusing to guess a database."
        )
    return create_engine(dsn, pool_pre_ping=True)


def report(conn) -> None:
    ext = conn.execute(text(
        "SELECT extversion FROM pg_extension WHERE extname = 'vectorscale'")).scalar()
    print(f"  vectorscale extension: {ext or 'NOT INSTALLED'}")

    embedded = conn.execute(text(
        "SELECT count(*) FROM canadian_ai.document_chunks WHERE embedding IS NOT NULL")).scalar()
    print(f"  embedded chunks:       {embedded:,}")

    rows = conn.execute(text("""
        SELECT c.relname AS name, am.amname AS method,
               pg_size_pretty(pg_relation_size(c.oid)) AS size
        FROM pg_class c
        JOIN pg_am am ON am.oid = c.relam
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_class t ON t.oid = i.indrelid
        WHERE t.relname = 'document_chunks'
        ORDER BY c.relname
    """)).fetchall()
    print("  indexes on document_chunks:")
    for r in rows:
        print(f"    {r.method:<10} {r.size:>10}  {r.name}")
    if not rows:
        print("    none")


def explain(conn) -> None:
    """Does the planner actually use it? An index nobody chooses proves nothing.

    A benchmark that reports fast numbers from a sequential scan is worse than no
    benchmark, because it looks like a result.
    """
    zero = "[" + ",".join(["0"] * 768) + "]"
    plan = conn.execute(text(
        "EXPLAIN SELECT id FROM canadian_ai.document_chunks "
        "WHERE embedding IS NOT NULL "
        f"ORDER BY embedding <=> '{zero}'::vector LIMIT 5")).fetchall()
    text_plan = "\n".join(r[0] for r in plan)
    used = "diskann" in text_plan.lower() or INDEX_NAME in text_plan
    print(f"\n  planner uses the diskann index: {used}")
    if not used:
        print("  PLAN:")
        for line in text_plan.split("\n"):
            print(f"    {line}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true", help="report state, change nothing")
    g.add_argument("--build", action="store_true", help="create the extension and index")
    args = ap.parse_args()

    with engine().begin() as conn:
        if args.check:
            print("BEFORE")
            report(conn)
            explain(conn)
            return 0

        print("BEFORE")
        report(conn)
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE"))
        conn.execute(text(f"SET maintenance_work_mem = '{BUILD_MEM}'"))
        print(f"\nBuilding {INDEX_NAME} with maintenance_work_mem={BUILD_MEM}...")
        t0 = time.time()
        conn.execute(text(CREATE_INDEX))
        print(f"  built in {time.time() - t0:,.0f}s")

        print("\nAFTER")
        report(conn)
        explain(conn)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
