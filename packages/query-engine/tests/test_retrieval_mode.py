"""Which search a query actually runs, given backend and mode.

search_hybrid has existed in turbopuffer_store since the Turbopuffer experiment
and was never called: retrieve() only ever ran search_vector. Dense search cannot
insist that a term in the question appears in the chunk, which is how a
parks-recreation registration page scored 0.748 on "How do I set up a new water
account in Toronto?" — "set up a new account" dominates the query and the page is
about creating accounts. BM25 is what anchors "water".

Hybrid needs a lexical index, so it is Turbopuffer-only. Asking for it on pgvector
must fall back loudly, or a later A/B compares two identical runs.
"""
import pytest
from unittest.mock import patch

from query_engine import retriever
from query_engine.retriever import _effective_mode, retrieve

EMBEDDING = [0.1] * 768
CHUNK = {"url": "https://www.toronto.ca/x", "chunk_text": "text", "similarity": 0.9}


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setattr(retriever.settings, "retrieval_backend", "turbopuffer")
    monkeypatch.setattr(retriever.settings, "retrieval_mode", "vector")
    return retriever.settings


def test_default_mode_is_vector(settings):
    assert _effective_mode() == "vector"


def test_hybrid_selected_on_turbopuffer(settings, monkeypatch):
    monkeypatch.setattr(settings, "retrieval_mode", "hybrid")
    assert _effective_mode() == "hybrid"


def test_hybrid_falls_back_on_pgvector(settings, monkeypatch):
    """pgvector has no lexical index; silently running dense would hide the fact."""
    monkeypatch.setattr(settings, "retrieval_mode", "hybrid")
    monkeypatch.setattr(settings, "retrieval_backend", "pgvector")
    assert _effective_mode() == "vector"


def test_unknown_mode_falls_back(settings, monkeypatch):
    monkeypatch.setattr(settings, "retrieval_mode", "bm25-only")
    assert _effective_mode() == "vector"


def test_empty_mode_falls_back(settings, monkeypatch):
    monkeypatch.setattr(settings, "retrieval_mode", "")
    assert _effective_mode() == "vector"


@pytest.mark.parametrize("mode,hybrid_calls,vector_calls", [
    ("vector", 0, 1),
    ("hybrid", 1, 0),
])
def test_mode_picks_the_search_function(settings, monkeypatch, mode, hybrid_calls, vector_calls):
    monkeypatch.setattr(settings, "retrieval_mode", mode)
    with patch.object(retriever, "embed_texts", return_value=[EMBEDDING]), \
         patch.object(retriever, "search_hybrid", return_value=[CHUNK]) as hybrid, \
         patch.object(retriever, "search_vector", return_value=[CHUNK]) as vector:
        chunks, emb = retrieve("How do I set up a new water account?", limit=5)

    assert hybrid.call_count == hybrid_calls
    assert vector.call_count == vector_calls
    assert chunks == [CHUNK]
    assert emb == EMBEDDING


def test_hybrid_receives_the_query_text_not_only_the_embedding(settings, monkeypatch):
    """BM25 needs the words; passing only the vector would make it dense again."""
    monkeypatch.setattr(settings, "retrieval_mode", "hybrid")
    question = "How do I set up a new water account in Toronto?"
    with patch.object(retriever, "embed_texts", return_value=[EMBEDDING]), \
         patch.object(retriever, "search_hybrid", return_value=[CHUNK]) as hybrid:
        retrieve(question, limit=5)

    args, kwargs = hybrid.call_args
    assert question in args or question in kwargs.values()


def test_hybrid_over_fetches_for_the_dedupe_pass(settings, monkeypatch):
    """The per-URL cap needs headroom, same as the dense path."""
    monkeypatch.setattr(settings, "retrieval_mode", "hybrid")
    with patch.object(retriever, "embed_texts", return_value=[EMBEDDING]), \
         patch.object(retriever, "search_hybrid", return_value=[CHUNK]) as hybrid:
        retrieve("q", limit=5)

    assert hybrid.call_args.kwargs["limit"] == 15


def test_hybrid_failure_falls_back_to_pgvector(settings, monkeypatch):
    """A Turbopuffer outage must not take the endpoint down."""
    monkeypatch.setattr(settings, "retrieval_mode", "hybrid")
    with patch.object(retriever, "embed_texts", return_value=[EMBEDDING]), \
         patch.object(retriever, "search_hybrid", side_effect=RuntimeError("tpuf down")), \
         patch.object(retriever, "search_similar", return_value=[CHUNK]) as pg:
        chunks, _ = retrieve("q", limit=5)

    assert pg.call_count == 1
    assert chunks == [CHUNK]


# --- per-URL cap ---------------------------------------------------------------
# 2 was a guess. Every ranking miss in the 2026-08-29 audit lost to a duplicate of
# a page already holding a slot, by 0.008 to 0.052 similarity, and on bp-08 two
# pages held four of the five slots. The cap is now measurable.

from query_engine.retriever import _dedupe, _max_per_url  # noqa: E402


def _chunks(*urls):
    return [{"url": u, "chunk_text": f"text {i}"} for i, u in enumerate(urls)]


def test_cap_defaults_to_one(settings):
    """Swept over 100 prompts: 89 hits at 1, 88 at 2, 87 at 3, nothing lost."""
    assert _max_per_url() == 1


@pytest.mark.parametrize("cap,expected", [
    (1, ["text 0", "text 3"]),
    (2, ["text 0", "text 1", "text 3"]),
    (3, ["text 0", "text 1", "text 2", "text 3"]),
])
def test_cap_limits_one_page(settings, monkeypatch, cap, expected):
    monkeypatch.setattr(settings, "max_chunks_per_url", cap)
    got = _dedupe(_chunks("a", "a", "a", "b"), limit=10)
    assert [c["chunk_text"] for c in got] == expected


def test_cap_of_zero_is_clamped(settings, monkeypatch):
    """A cap of 0 would return nothing at all; treat it as the minimum of 1."""
    monkeypatch.setattr(settings, "max_chunks_per_url", 0)
    assert _max_per_url() == 1
    assert len(_dedupe(_chunks("a", "a"), limit=10)) == 1


def test_unset_falls_back_to_the_default(settings, monkeypatch):
    """Distinct from an explicit 0, which clamps rather than reverting."""
    monkeypatch.setattr(settings, "max_chunks_per_url", None)
    assert _max_per_url() == 1
    assert len(_dedupe(_chunks("a", "a"), limit=10)) == 1


def test_best_scoring_copy_survives_the_cap(settings, monkeypatch):
    """Order is similarity order, so the cap must keep the earliest, not the last."""
    monkeypatch.setattr(settings, "max_chunks_per_url", 1)
    got = _dedupe(_chunks("a", "a", "b"), limit=10)
    assert got[0]["chunk_text"] == "text 0"


def test_exact_duplicate_text_dropped_regardless_of_cap(settings, monkeypatch):
    """Two URLs serving identical content is a case the per-URL cap cannot see."""
    monkeypatch.setattr(settings, "max_chunks_per_url", 3)
    same = [{"url": "a", "chunk_text": "identical"}, {"url": "b", "chunk_text": "identical"}]
    assert len(_dedupe(same, limit=10)) == 1


# --- near-duplicate text across different URLs ---------------------------------
# The per-URL cap cannot see this case: on bp-38 ranks 4 and 5 were both "My
# Business Licence & Permit Account", published under /business-economy/... and
# /services-payments/.... Exact matching misses them because the copies differ by a
# heading or a trailing sentence.

from query_engine.retriever import _is_near_duplicate, _tokens  # noqa: E402

LONG = ("the city of toronto is making it easier for you to access information about "
        "your business licence or permit watch the video below to learn how to set up "
        "and link your business licence and permit account today")
OTHER = ("apply for a building permit online using the toronto building online services "
         "application submission tool which lets you submit drawings and documents "
         "electronically for review by plan examiners before construction starts")


def test_near_duplicate_across_two_urls_is_dropped(settings):
    out = _dedupe([
        {"url": "https://x/business-economy/acct", "chunk_text": LONG},
        {"url": "https://x/services-payments/acct", "chunk_text": LONG + " starting january 19"},
    ], limit=5)
    assert len(out) == 1


def test_the_first_copy_survives(settings):
    """Order is similarity order, so the better-scoring copy must be the keeper."""
    out = _dedupe([
        {"url": "https://x/first", "chunk_text": LONG},
        {"url": "https://x/second", "chunk_text": LONG + " starting january 19"},
    ], limit=5)
    assert out[0]["url"] == "https://x/first"


def test_genuinely_different_pages_both_survive(settings):
    out = _dedupe([
        {"url": "https://x/a", "chunk_text": LONG},
        {"url": "https://x/b", "chunk_text": OTHER},
    ], limit=5)
    assert len(out) == 2


def test_short_chunks_are_exempt(settings):
    """Two short chunks can hit the threshold on stopwords alone; losing a distinct
    source is worse than keeping a near-copy."""
    a, b = "pay your water bill online", "pay your water bill by mail"
    out = _dedupe([{"url": "https://x/a", "chunk_text": a},
                   {"url": "https://x/b", "chunk_text": b}], limit=5)
    assert len(out) == 2


def test_threshold_needs_real_overlap():
    assert _is_near_duplicate(_tokens(LONG), [_tokens(LONG + " extra words here")])
    assert not _is_near_duplicate(_tokens(LONG), [_tokens(OTHER)])


def test_empty_kept_list_is_never_a_duplicate():
    assert not _is_near_duplicate(_tokens(LONG), [])
