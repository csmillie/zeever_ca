"""Vector search against a pgvectorscale (StreamingDiskANN) index.

    PGVECTORSCALE_DATABASE_URL=postgresql://USER:PASSWORD@BENCHMARK_HOST:5432/canadianai

The real value belongs in .env or a local runbook, not here. A working connection
string in a source file survives in git history after the host is gone and the
password is rotated, and it teaches the next person that this is where such
things live.

This is a benchmark arm, not a production path. It talks to its own database on
its own engine rather than the app's, because the point is to compare a second
Postgres carrying a different index type against the one already in service, and
running the experiment on the production box was ruled out: that host is shared
with several other sites and was already faulting pages back from swap.

The SQL is deliberately identical to the pgvector arm in vector_store.py. The
only difference between them is which index the planner has available, which is
the whole comparison. If these two queries ever drift apart, the measurement
stops being about the index.

pgvectorscale's diskann index uses relaxed ordering: results may come back
slightly out of distance order, in the way pgvector's iterative scan does. That
is worth knowing before reading a recall number off it, because a rank-sensitive
metric will score it differently from an exact scan even when the same chunks
come back.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from shared.benchmark_config import benchmark_settings

_engine = None
_Session = None


def _session():
    global _engine, _Session
    if _Session is None:
        # Through pydantic settings rather than os.getenv, so .env is honoured the
        # way it is everywhere else here: reading the environment directly meant the
        # value could sit correctly in .env and this would still refuse. Through the
        # benchmark settings specifically, so importing this module does not require
        # the application's DATABASE_URL on a host that only runs the comparison.
        dsn = benchmark_settings.pgvectorscale_database_url
        if not dsn:
            raise RuntimeError(
                "PGVECTORSCALE_DATABASE_URL is not set. This arm points at a separate "
                "database, deliberately, so it cannot fall back to the app's."
            )
        # A small pool: the benchmark is sequential and a large one only hides
        # connection cost that a production deployment would still pay.
        _engine = create_engine(dsn, pool_size=2, max_overflow=2, pool_pre_ping=True)
        _Session = sessionmaker(bind=_engine)
    return _Session()


_SEARCH = """
    SELECT dc.id, dc.chunk_text, dc.metadata,
           pd.url, pd.title, pd.content_type,
           1 - (dc.embedding <=> cast(:embedding AS vector)) AS similarity
    FROM canadian_ai.document_chunks dc
    JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> cast(:embedding AS vector)
    LIMIT :limit
"""


def search_vector(query_embedding: list[float], limit: int = 5) -> list[dict]:
    """Nearest chunks by cosine distance, served by the diskann index."""
    session = _session()
    try:
        # The production store sets this on every query (vector_store.py:19) and
        # this one did not, so an ivfflat index here searched at pgvector's default
        # of one probe while production searched with ten. That is not a smaller
        # difference than the index type: it cost 19 points of recall in a run that
        # was reported as an index comparison. The GUC is meaningless to diskann,
        # which is the point — the arm has to carry the same session as production
        # whatever index the benchmark host currently holds, or "identical SQL" is
        # not the same thing as an identical query.
        # set_config rather than SET, because SET takes no bind parameters and
        # this value would otherwise be interpolated into the statement. The
        # pydantic field is an int with ge=1 so a hostile value cannot reach
        # here, but the embedding and the limit in the same query are bound and
        # this should not be the one place that differs.
        session.execute(text("SELECT set_config('ivfflat.probes', :probes, false)"),
                        {"probes": str(benchmark_settings.ivfflat_probes)})
        if benchmark_settings.pgvectorscale_query_rescore is not None:
            # Bound for the same reason as the probes above.
            session.execute(
                text("SELECT set_config('diskann.query_rescore', :rescore, false)"),
                {"rescore": str(benchmark_settings.pgvectorscale_query_rescore)})
        rows = session.execute(text(_SEARCH),
                               {"embedding": str(query_embedding), "limit": limit})
        return [dict(r._mapping) for r in rows]
    finally:
        session.close()


def index_status() -> dict:
    """What the planner actually has, rather than what we think we built.

    Reported before any run. An index that failed to build, or that exists but is
    not diskann, produces a sequential scan and a benchmark that silently
    measures brute force.
    """
    session = _session()
    try:
        row = session.execute(text("""
            SELECT c.relname AS index_name,
                   am.amname AS access_method,
                   pg_size_pretty(pg_relation_size(c.oid)) AS size
            FROM pg_class c
            JOIN pg_am am ON am.oid = c.relam
            JOIN pg_index i ON i.indexrelid = c.oid
            JOIN pg_class t ON t.oid = i.indrelid
            WHERE t.relname = 'document_chunks'
        """)).fetchall()
        ext = session.execute(text(
            "SELECT extversion FROM pg_extension WHERE extname = 'vectorscale'"
        )).scalar()
        return {"extension_version": ext,
                "indexes": [dict(r._mapping) for r in row]}
    finally:
        session.close()
