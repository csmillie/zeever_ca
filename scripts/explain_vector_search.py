"""Run the application's own vector query under EXPLAIN ANALYZE.

    uv run python scripts/explain_vector_search.py
    uv run python scripts/explain_vector_search.py --backend pgvectorscale --repeat 5
    uv run python scripts/explain_vector_search.py --force-index

Doing this by hand means pasting a 768-dimension vector into psql, which is a
9KB shell literal that has failed on quoting every time it has been attempted.
Here the vector is bound as a parameter, from Python, exactly as the retriever
binds it.

The SQL is copied from vector_store.search_similar, including the
ivfflat.probes it sets, so the plan shown is the plan production gets rather
than a simplified stand-in. A query written for the occasion can take a
different plan from the real one: a scalar subquery for the vector produces an
InitPlan parameter, and that alone can change whether the index is used.

--force-index sets enable_seqscan=off. If the plan changes to an index scan
under that, the index is usable and the planner was choosing against it on
cost, which is a different problem from an index that cannot be used at all.

Read two things: whether the plan says Index Scan or Seq Scan, and the
Execution Time. Everything else in this comparison has been measured through a
client and a network, and this is the only figure that is neither.
"""
import argparse
import statistics

from sqlalchemy import text

# The query production runs, verbatim from vector_store.search_similar.
SEARCH = """
    SELECT dc.id, dc.chunk_text, dc.metadata,
           pd.url, pd.title, pd.content_type,
           1 - (dc.embedding <=> cast(:embedding AS vector)) AS similarity
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> cast(:embedding AS vector)
    LIMIT :limit
"""

SAMPLE = ("SELECT embedding FROM canadian_ai.document_chunks "
          "WHERE embedding IS NOT NULL LIMIT 1")


def _session_for(backend: str):
    """A Session, not a context manager.

    shared.get_session is decorated with @contextmanager, so calling it returns a
    wrapper with no .execute. SessionLocal is the sessionmaker behind it, and the
    benchmark store's _session already returns a Session, so both arms end up with
    the same kind of object and the caller closes it once.
    """
    if backend == "pgvector":
        from shared.db import SessionLocal
        return SessionLocal()
    from indexer.pgvectorscale_store import _session
    return _session()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--backend", choices=["pgvector", "pgvectorscale"], default="pgvector",
                    help="which database: the application's, or the benchmark host's")
    ap.add_argument("--repeat", type=int, default=3, help="runs; the first is cold")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--probes", type=int, default=10, help="ivfflat.probes, as production sets it")
    ap.add_argument("--force-index", action="store_true",
                    help="set enable_seqscan=off, to see whether the index can be used at all")
    args = ap.parse_args()

    session = _session_for(args.backend)
    try:
        indexes = session.execute(text(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE schemaname = 'canadian_ai' AND tablename = 'document_chunks'")).all()
        print("indexes on document_chunks:")
        for name, definition in indexes:
            print(f"  {name}")
            print(f"    {definition}")

        # A real embedding from the table rather than a synthetic vector: a vector
        # of zeros or of random noise is equidistant from everything and can take a
        # different path through an approximate index than a real query does.
        vector = session.execute(text(SAMPLE)).scalar()

        session.execute(text(f"SET ivfflat.probes = {int(args.probes)}"))
        if args.force_index:
            session.execute(text("SET enable_seqscan = off"))

        times = []
        plan = ""
        for run in range(args.repeat):
            rows = session.execute(
                text("EXPLAIN (ANALYZE, BUFFERS) " + SEARCH),
                {"embedding": str(vector), "limit": args.limit}).all()
            plan = "\n".join(r[0] for r in rows)
            for line in plan.splitlines():
                if "Execution Time:" in line:
                    times.append(float(line.split(":")[1].strip().split()[0]))

        print(f"\nplan (last of {args.repeat} runs, probes={args.probes}"
              f"{', enable_seqscan=off' if args.force_index else ''}):")
        for line in plan.splitlines():
            print(f"  {line}")

        if times:
            scan = "Index Scan" if "Index Scan" in plan else "Seq Scan"
            print(f"\n{scan}.  first {times[0]:.1f}ms, "
                  f"median of {len(times)} {statistics.median(times):.1f}ms")
            if scan == "Seq Scan":
                print("A sequential scan reads every row. The index is present but not")
                print("being used; re-run with --force-index to see whether it can be.")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
