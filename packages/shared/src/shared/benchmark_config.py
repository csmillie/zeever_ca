"""Configuration for the retrieval comparison, in its own module on purpose.

Importing shared.config constructs Settings() at module load, and Settings
requires database_url. A benchmark host is exactly the machine that has no
application .env: it gets Postgres, the vectorscale extension, one connection
string, and nothing else. Importing the app's config there fails before the
script can print anything useful, which is how "PGVECTORSCALE_DATABASE_URL is
not set" turned into a pydantic ValidationError about an unrelated variable.

shared.config imports this module, not the other way round, so nothing here
triggers that construction.
"""
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class BenchmarkSettings(BaseSettings):
    """Settings the retrieval comparison needs, and nothing else.

    Separate from Settings because Settings requires database_url, so importing it
    on a machine that has no application .env fails at import time. The benchmark
    is set up on such machines: a fresh host gets the extension, one connection
    string, and nothing else. It should not have to invent a DATABASE_URL to run
    --check.

    extra is ignored here rather than forbidden. This class deliberately sees only
    two of the keys in a full .env, so forbidding the rest would reject every real
    deployment's file.
    """

    # Empty means the pgvectorscale arm refuses to run rather than falling back to
    # database_url, which would benchmark production and report the result as
    # pgvectorscale. Never read by the production retriever.
    pgvectorscale_database_url: str = ""
    # Query-time accuracy knob for that arm. None leaves the extension default,
    # which is what an out-of-the-box comparison should measure.
    pgvectorscale_query_rescore: int | None = None
    # Read by the production retriever through Settings, which inherits this class,
    # and by the benchmark arm through BenchmarkSettings directly. It is declared
    # here rather than on Settings because the benchmark store cannot import
    # shared.config: that would require the application's DATABASE_URL on a host
    # that has only the benchmark database.
    #
    # How much of an ivfflat index a query reads: probes / lists of it. The pair
    # only means something together. At lists=20 ten probes read half the index and
    # the planner refused it entirely; at lists=240 (migration 005) ten read 4%.
    #
    # Swept over the 300-page breadth eval, against an exact sequential scan at
    # 58.3% and 295ms:
    #
    #   probes   recall   p50    p95
    #       10    53.0%   37ms   85ms
    #       20    55.1%   36ms   65ms
    #       40    57.1%   35ms  128ms
    #       80    57.8%   67ms  117ms
    #
    # 40 is the knee. Against the exact scan it loses 3 pages of 295, McNemar
    # p=0.45, which is indistinguishable from exhaustive search at a tenth of the
    # latency. 80 doubles the median and buys 2 pages, well inside the noise.
    ivfflat_probes: int = Field(40, ge=1)

    @field_validator("pgvectorscale_query_rescore", mode="before")
    @classmethod
    def _blank_is_the_default(cls, v):
        """PGVECTORSCALE_QUERY_RESCORE= in .env means "leave it at the extension's
        default", which is how .env.example ships it and how the runbook says to
        leave it. Pydantic reads that as the string "" and fails to parse an int,
        and because shared.config imports this module at load, that failure takes
        down every process that imports any config at all. It did: the whole test
        suite failed to collect, and the API would have failed the same way on its
        next restart."""
        if isinstance(v, str) and not v.strip():
            return None
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


benchmark_settings = BenchmarkSettings()
