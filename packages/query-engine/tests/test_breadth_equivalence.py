"""The breadth eval decides which retrieval work is worth doing, so what it
counts as a hit has to be defensible.

Two changes are tested here. Crediting a different URL carrying near-identical
text, because the City publishes the same authority table in hundreds of
Delegated Approval Forms and a question written from one of them has hundreds of
correct answers. And refusing to score a question that names nothing, because
"What is the process" was generated from a real page, scored 0.427 against it,
and was counted as a retrieval failure.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import eval_retrieval_breadth as breadth  # noqa: E402


def test_a_question_naming_nothing_is_not_scored():
    """These are generator failures. Counting them as retrieval failures blames
    the wrong component and makes the number look worse than the system is."""
    assert breadth._too_vague("What is the process")
    assert breadth._too_vague("How do I apply?")
    assert breadth._too_vague("")


def test_a_real_question_is_scored():
    """The floor has to sit below every genuine question in the corpus, or the
    eval quietly stops measuring the pages it finds hardest."""
    assert not breadth._too_vague(
        "How do I apply for delegated approval for a real estate transaction in Toronto?")
    assert not breadth._too_vague("Who has authority to sign expropriation notices?")
    assert not breadth._too_vague("What are the compensation limits for acquisitions?")


def test_the_first_equivalent_chunk_is_found_by_position():
    """Position, not a boolean: an equivalent answer at rank 1 and one at rank 5
    are different outcomes and a run should be able to tell them apart."""
    chunks = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    sims = {"a": 0.40, "b": 0.97, "c": 0.99}
    assert breadth._first_equivalent(chunks, sims) == 2


def test_merely_similar_is_not_equivalent():
    """0.80 is a good retrieval result and a different document. Crediting it
    would turn this eval into one that cannot fail."""
    chunks = [{"id": "a"}, {"id": "b"}]
    sims = {"a": 0.80, "b": 0.94}
    assert breadth._first_equivalent(chunks, sims) is None
    assert breadth._first_equivalent(chunks, sims, threshold=0.90) == 2


def test_chunks_without_a_similarity_do_not_count():
    """A store that returns ids this query cannot resolve must not silently score
    as equivalent."""
    assert breadth._first_equivalent([{"id": "x"}, {}], {}) is None


def test_ids_are_compared_as_strings():
    """Chunk ids arrive as UUIDs from one store and strings from another. A type
    mismatch here would silently return None for every page and the change would
    look like it did nothing."""
    import uuid

    ident = uuid.uuid4()
    assert breadth._first_equivalent([{"id": ident}], {str(ident): 0.99}) == 1


def test_a_null_similarity_is_not_equivalent():
    """A similarity comes back NULL when either side has no embedding. float(None)
    raised, and because the call sits after retrieval and outside the per-row
    try/except, one such page ended the whole run before the CSV was written. Not
    equivalent is the right answer and a survivable one."""
    chunks = [{"id": "a"}, {"id": "b"}]
    assert breadth._first_equivalent(chunks, {"a": None, "b": 0.99}) == 2


def test_the_sample_only_takes_indexed_chunks():
    """The source chunk is the thing every equivalence is measured against, so a
    page that was never embedded cannot be scored at all. It is also unretrievable,
    and scoring it as a miss would blame retrieval for an ingestion gap."""
    assert "dc.embedding IS NOT NULL" in breadth._SAMPLE


def test_a_failed_lookup_withholds_credit_rather_than_ending_the_run(monkeypatch):
    """The strict rank is already known by the time this runs, so the worst
    outcome of a failure here should be a missing credit, never a lost run."""
    def explode(*args, **kwargs):
        raise RuntimeError("connection reset")

    monkeypatch.setattr(breadth, "get_session", explode)
    breadth._warned.clear()
    assert breadth._equivalent_rank("some-id", [{"id": "a"}]) is None
