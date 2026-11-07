"""The pgvectorscale arm must be a fair comparison, and must not leak into prod.

Two properties matter more than the search itself. The arm has to apply the same
similarity threshold as every other arm, or it gets a free recall edge and the
comparison means nothing. And it must not be reachable from the production path,
because it points at a separate database that only exists for the benchmark.
"""
import os
from unittest.mock import patch

import pytest

from query_engine.experiment_retriever import SIMILARITY_THRESHOLD, retrieve_arm

EMB = [0.1] * 768


def _chunks():
    return [
        {"id": "a", "url": "https://www.toronto.ca/a/", "similarity": 0.9},
        {"id": "b", "url": "https://www.toronto.ca/b/", "similarity": 0.05},
    ]


def test_the_arm_is_reachable():
    with patch("indexer.pgvectorscale_store.search_vector", return_value=_chunks()) as s:
        chunks, _ = retrieve_arm("q", "pgvectorscale", "vector", limit=5, query_embedding=EMB)
    s.assert_called_once()
    assert [c["id"] for c in chunks] == ["a"]


def test_it_gets_no_free_recall_edge():
    """The low-similarity chunk is dropped here exactly as it is for pgvector and
    Turbopuffer. An arm that skipped this filter would look better by returning
    more, which is the easiest way to fake a win."""
    with patch("indexer.pgvectorscale_store.search_vector", return_value=_chunks()):
        chunks, _ = retrieve_arm("q", "pgvectorscale", "vector", limit=5, query_embedding=EMB)
    assert all(c["similarity"] >= SIMILARITY_THRESHOLD for c in chunks)


def test_hybrid_is_refused_rather_than_silently_downgraded():
    """Only Turbopuffer does hybrid. Quietly serving dense results under a hybrid
    label would put two different retrieval strategies in the same column."""
    with pytest.raises(ValueError, match="only mode='vector'"):
        retrieve_arm("q", "pgvectorscale", "hybrid", limit=5, query_embedding=EMB)


def test_an_unknown_backend_still_raises():
    with pytest.raises(ValueError, match="unknown backend"):
        retrieve_arm("q", "milvus", "vector", limit=5, query_embedding=EMB)


def test_the_store_refuses_to_guess_a_database():
    """Without its own URL it must fail loudly. Falling back to the app's database
    would point the benchmark at production and report the result as pgvectorscale.

    The URL is read through settings, not os.environ, so that .env is honoured the
    way it is everywhere else here. Patch what the code actually reads: an earlier
    version of this test cleared os.environ, which the store no longer consults, so
    it would have passed against a store that had no guard at all."""
    import indexer.pgvectorscale_store as store

    store._engine = None
    store._Session = None
    try:
        with patch.object(store.benchmark_settings, "pgvectorscale_database_url", ""):
            with pytest.raises(RuntimeError, match="PGVECTORSCALE_DATABASE_URL"):
                store.search_vector(EMB)
    finally:
        store._engine = None
        store._Session = None


def test_the_benchmark_config_does_not_drag_in_the_application_config(tmp_path):
    """A benchmark host has Postgres, the extension, and one connection string. It
    has no application .env, and should not need to invent a DATABASE_URL to run
    --check. shared.config constructs Settings() at import and Settings requires
    database_url, so reading the URL through it turned a missing benchmark variable
    into a pydantic ValidationError about an unrelated one.

    Run out of process with a cleared environment, because the settings objects are
    module-level singletons built at import: patching after the fact would not
    exercise the import that was failing.
    """
    import subprocess
    import sys

    (tmp_path / ".env").write_text(
        "PGVECTORSCALE_DATABASE_URL=postgresql://u:p@example.invalid:5432/db\n"
        "SOMETHING_THE_APP_DEFINES=1\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c",
         "from shared.benchmark_config import benchmark_settings;"
         "print(benchmark_settings.pgvectorscale_database_url)"],
        cwd=tmp_path,
        env={"PATH": os.environ.get("PATH", ""), "PYTHONPATH": os.pathsep.join(sys.path)},
        capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "postgresql://u:p@example.invalid:5432/db"


def test_a_blank_rescore_means_the_extension_default():
    """PGVECTORSCALE_QUERY_RESCORE= is how .env.example ships and how the runbook
    says to leave it. Pydantic reads the blank as "" and cannot parse an int from
    it, and shared.config imports this module at load, so that one blank line took
    down every process that imports any config: the whole suite failed to collect,
    and the API would have failed the same way on its next restart."""
    from shared.benchmark_config import BenchmarkSettings

    with patch.dict(os.environ, {"PGVECTORSCALE_QUERY_RESCORE": ""}):
        assert BenchmarkSettings().pgvectorscale_query_rescore is None
    with patch.dict(os.environ, {"PGVECTORSCALE_QUERY_RESCORE": "  "}):
        assert BenchmarkSettings().pgvectorscale_query_rescore is None


def test_a_set_rescore_is_still_parsed_and_a_bad_one_still_fails():
    """Blank is not the same as wrong. A value that is present but unparseable
    should still be a loud error, or the knob could be misspelled and silently
    never applied."""
    import pydantic
    from shared.benchmark_config import BenchmarkSettings

    with patch.dict(os.environ, {"PGVECTORSCALE_QUERY_RESCORE": "400"}):
        assert BenchmarkSettings().pgvectorscale_query_rescore == 400
    with patch.dict(os.environ, {"PGVECTORSCALE_QUERY_RESCORE": "lots"}):
        with pytest.raises(pydantic.ValidationError):
            BenchmarkSettings()


def test_the_ranked_arm_over_fetches_then_dedupes_like_production():
    """Every arm has to be ranked the same way, or the comparison measures the
    post-processing as much as the store. Production over-fetches three-for-one and
    then drops crowding, and a raw top-5 from one arm against a deduped top-5 from
    another is not a comparison."""
    from query_engine.experiment_retriever import retrieve_arm_ranked

    crowding = [
        {"id": "1", "url": "https://www.toronto.ca/same/", "chunk_text": "a", "similarity": 0.9},
        {"id": "2", "url": "https://www.toronto.ca/same/", "chunk_text": "b", "similarity": 0.8},
        {"id": "3", "url": "https://www.toronto.ca/other/", "chunk_text": "c", "similarity": 0.7},
    ]
    with patch("indexer.pgvectorscale_store.search_vector", return_value=crowding) as s:
        chunks, _ = retrieve_arm_ranked("q", "pgvectorscale", "vector", limit=2,
                                        query_embedding=EMB)
    assert s.call_args.kwargs["limit"] == 6, "asked for limit, not limit*3"
    assert [c["url"] for c in chunks] == [
        "https://www.toronto.ca/same/", "https://www.toronto.ca/other/"
    ], "one page took both slots"


def test_the_ranked_arm_does_not_fall_back_to_another_store():
    """retriever.retrieve falls back to pgvector when Turbopuffer errors, which is
    right for serving and wrong for measuring: the run would report a pgvector
    result in the Turbopuffer column."""
    from query_engine.experiment_retriever import retrieve_arm_ranked

    with patch("query_engine.experiment_retriever.search_vector",
               side_effect=RuntimeError("tpuf down")), \
         patch("query_engine.experiment_retriever.search_similar") as pg:
        with pytest.raises(RuntimeError, match="tpuf down"):
            retrieve_arm_ranked("q", "turbopuffer", "vector", limit=5, query_embedding=EMB)
    pg.assert_not_called()


def test_an_impossible_arm_is_refused_before_any_work():
    """The breadth eval writes a question per page with a local model before it
    retrieves anything. An arm that cannot run should say so first, not after all
    of that, with every row erroring and the reason left in the CSV."""
    from query_engine.experiment_retriever import check_arm

    check_arm("pgvector", "vector")
    check_arm("turbopuffer", "hybrid")
    with pytest.raises(ValueError, match="only mode='vector'"):
        check_arm("pgvectorscale", "hybrid")
    with pytest.raises(ValueError, match="unknown backend"):
        check_arm("milvus", "vector")
    with pytest.raises(ValueError, match="unknown mode"):
        check_arm("turbopuffer", "sparse")


def test_the_guard_is_the_same_rule_the_retrieval_enforces():
    """One rule, not two. A second copy would eventually disagree with this one,
    and the copy that was wrong would be the one letting a bad arm through."""
    from query_engine import experiment_retriever as er

    with patch.object(er, "check_arm", side_effect=ValueError("refused")) as guard:
        with pytest.raises(ValueError, match="refused"):
            er.retrieve_arm("q", "pgvector", "vector", limit=5, query_embedding=EMB)
    guard.assert_called_once_with("pgvector", "vector")


def test_the_arm_carries_the_same_session_settings_as_production():
    """search_similar sets ivfflat.probes on every query and this store did not,
    so when the benchmark host held an ivfflat index it searched with pgvector's
    default of one probe against production's ten, and the run reported the
    resulting 19-point recall gap as a property of the index.

    The number is deliberately not asserted here: what matters is that the arm
    sends the setting at all. The value it should send is production's, whatever
    that currently is, which the next test pins."""
    import indexer.pgvectorscale_store as store

    executed = []

    class _Session:
        def execute(self, statement, params=None, *args, **kwargs):
            executed.append((str(statement), params))
            return []

        def close(self):
            pass

    with patch.object(store, "_session", return_value=_Session()):
        store.search_vector(EMB)
    assert any("ivfflat.probes" in sql for sql, _ in executed), executed


def test_probes_is_configurable_on_both_paths():
    """The production retriever and the benchmark arm have to read the same value,
    or a sweep moves one of them and reports the other. They see one field:
    Settings inherits it from BenchmarkSettings."""
    from shared.benchmark_config import BenchmarkSettings
    from shared.config import Settings

    shipped = Settings.model_fields["ivfflat_probes"].default
    assert shipped == 40, "the swept knee; see benchmark_config for the curve"
    assert BenchmarkSettings.model_fields["ivfflat_probes"].default == shipped

    # Derived from the default rather than written out, so this cannot go vacuous
    # the way it did when the default moved from 10 to 40 and the override in this
    # test still said 40: it then passed whether or not the variable was read.
    override = shipped + 7
    with patch.dict(os.environ, {"IVFFLAT_PROBES": str(override)}):
        assert BenchmarkSettings().ivfflat_probes == override


def test_the_arm_sends_the_configured_probes_not_a_fixed_number():
    """Patched to a value the default cannot supply, for the same reason as above:
    asserting the arm sends the default proves nothing about whether it read it."""
    import indexer.pgvectorscale_store as store

    executed = []

    class _Session:
        def execute(self, statement, params=None, *args, **kwargs):
            executed.append((str(statement), params))
            return []

        def close(self):
            pass

    with patch.object(store, "_session", return_value=_Session()), \
         patch.object(store.benchmark_settings, "ivfflat_probes", 7):
        store.search_vector(EMB)

    # The value travels as a bound parameter, so it is not in the SQL text. A test
    # that searched the statement for "7" would pass against an unparameterised
    # implementation and fail against this one, which is backwards.
    sent = [params for sql, params in executed if "ivfflat.probes" in sql]
    assert sent == [{"probes": "7"}], executed
    assert not any("7" in sql for sql, _ in executed), "value interpolated into SQL"


def test_a_nonsense_probes_value_is_refused_at_load():
    """ge=1 on the field, so a bad value fails when settings are built rather than
    reaching Postgres. probes=0 is not a slower search, it is an error from the
    database on every query."""
    import pydantic
    from shared.benchmark_config import BenchmarkSettings

    with patch.dict(os.environ, {"IVFFLAT_PROBES": "0"}):
        with pytest.raises(pydantic.ValidationError):
            BenchmarkSettings()
    with patch.dict(os.environ, {"IVFFLAT_PROBES": "-5"}):
        with pytest.raises(pydantic.ValidationError):
            BenchmarkSettings()
