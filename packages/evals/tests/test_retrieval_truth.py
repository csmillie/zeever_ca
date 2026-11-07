"""Benchmark A's retrieval ground truth, and the guards that keep it honest.

The file this covers exists because `expected_sources` is a URL substring, and
30 of the 100 benchmark prompts have one that matches an entire Toronto.ca
section -- bp-85's matches 1,653 pages. A question like that returns a hit for
any retrieval method at all, so it cannot show an improvement or a regression.
That was acceptable while every arm shared the same slack. It is not acceptable
for an experiment whose whole claim is about hard queries.

Two properties matter more than the schema:

  - a question that cannot distinguish two methods must be excluded from the
    headline rather than quietly averaged into it, and
  - a label nobody has checked must not be able to pass as one somebody has.
"""
import json
from datetime import datetime, timezone

import pytest

from evals.prompts import BENCHMARK_PROMPTS
from evals.retrieval_truth import (
    SOURCE_FROZEN,
    SOURCE_HUMAN,
    TRUTH_PATH,
    RetrievalTruth,
    coverage,
    load,
    save,
    scorable,
)


def _truth(**over) -> RetrievalTruth:
    base = dict(id="bp-01", query="q", category="c",
                relevant_url_patterns=["when-do-i-need-a-building-permit"],
                precision_band="exact", matched_url_count=1)
    base.update(over)
    return RetrievalTruth(**base)


# --- what may be scored -----------------------------------------------------

def test_a_precise_label_is_scorable():
    assert _truth().is_scorable


def test_a_section_wide_label_is_not_scorable():
    """bp-85 expects 'community-people', which matches 1,653 pages. Any method
    scores a hit, so including it moves the average without measuring anything
    -- and worse, it drags a real effect toward zero."""
    assert not _truth(precision_band="section", matched_url_count=1653).is_scorable


def test_a_refusal_question_is_not_scorable():
    """expects_refusal means the corpus deliberately cannot answer it. There is
    no correct chunk to find, so 'did retrieval find it' has no answer."""
    assert not _truth(expects_refusal=True).is_scorable


def test_a_label_with_nothing_in_it_is_not_scorable():
    assert not _truth(relevant_url_patterns=[]).is_scorable


def test_scorable_yields_only_those_and_in_id_order():
    truths = {
        "bp-03": _truth(id="bp-03"),
        "bp-01": _truth(id="bp-01"),
        "bp-02": _truth(id="bp-02", precision_band="section"),
    }
    assert [t.id for t in scorable(truths)] == ["bp-01", "bp-03"]


# --- what counts as verified ------------------------------------------------

def test_a_seeded_label_is_not_verified():
    """Everything starts unverified. Metrics over these are provisional, and the
    run report has to say so rather than presenting them as ground truth."""
    assert not _truth(label_source=SOURCE_FROZEN).is_verified


def test_a_label_is_verified_only_when_a_person_is_named():
    """Setting the source without naming anybody is how 'verified' quietly stops
    meaning checked."""
    assert not _truth(label_source=SOURCE_HUMAN, verified_by=None).is_verified
    assert _truth(label_source=SOURCE_HUMAN, verified_by="csmillie").is_verified


def test_an_llm_proposal_cannot_verify_itself():
    """The brief's rule, made mechanical: a model may propose a label and may
    not ratify it. Only SOURCE_HUMAN counts, whatever produced the candidate."""
    assert not _truth(label_source="url-term-overlap", verified_by="gpt-oss:20b").is_verified
    assert not _truth(label_source="prior-run-citations", verified_by="judge").is_verified


# --- persistence ------------------------------------------------------------

def test_round_trip_preserves_every_field(tmp_path):
    path = tmp_path / "truth.jsonl"
    original = _truth(
        relevant_pages=["https://www.toronto.ca/a/"],
        relevant_chunks=["11111111-1111-1111-1111-111111111111"],
        grades={"11111111-1111-1111-1111-111111111111": 2},
        hard_negatives=["https://www.toronto.ca/b/"],
        requirements=[{"type": "object", "value": "deck", "importance": "required"}],
        label_source=SOURCE_HUMAN, verified_by="csmillie",
        verified_at=datetime.now(timezone.utc).isoformat(),
        difficulty="hard", notes="n",
    )
    save({original.id: original}, path)
    assert load(path)[original.id] == original


def test_a_missing_file_is_empty_rather_than_an_error(tmp_path):
    assert load(tmp_path / "nope.jsonl") == {}


def test_rows_are_written_in_id_order(tmp_path):
    """So a relabelling shows up as a one-line diff rather than a reordering."""
    path = tmp_path / "t.jsonl"
    save([_truth(id="bp-09"), _truth(id="bp-02"), _truth(id="bp-05")], path)
    ids = [json.loads(l)["id"] for l in path.read_text(encoding="utf-8").splitlines()]
    assert ids == ["bp-02", "bp-05", "bp-09"]


# --- the shipped file -------------------------------------------------------

@pytest.fixture(scope="module")
def shipped():
    truths = load()
    if not truths:
        pytest.skip("sidecar not built; run scripts/build_retrieval_truth.py")
    return truths


def test_every_benchmark_prompt_has_a_row(shipped):
    """A prompt with no row would be silently dropped from every retrieval
    metric, and the total would still look like a round number."""
    missing = {bp.id for bp in BENCHMARK_PROMPTS} - set(shipped)
    assert not missing, f"no ground truth for: {sorted(missing)}"


def test_no_rows_for_questions_that_do_not_exist(shipped):
    extra = set(shipped) - {bp.id for bp in BENCHMARK_PROMPTS}
    assert not extra, f"ground truth for unknown prompts: {sorted(extra)}"


def test_the_frozen_questions_are_unchanged(shipped):
    """Benchmark A's value is that previous Zeever results stay comparable.
    Editing a question here would break that silently, since the sidecar carries
    its own copy of the text."""
    by_id = {bp.id: bp for bp in BENCHMARK_PROMPTS}
    for t in shipped.values():
        assert t.query == by_id[t.id].prompt, f"{t.id} query drifted from prompts.py"
        assert t.category == by_id[t.id].category


def test_refusal_flags_agree_with_the_benchmark(shipped):
    by_id = {bp.id: bp for bp in BENCHMARK_PROMPTS}
    for t in shipped.values():
        assert t.expects_refusal == by_id[t.id].expects_refusal


def test_the_scorable_subset_is_reported_not_assumed(shipped):
    """This is the number that decides how much any Benchmark A result is worth.

    It is asserted as a range rather than a value because the corpus grows and a
    label's precision moves with it. What must not happen is the excluded set
    quietly emptying -- that would mean the section-wide labels started counting
    again.
    """
    c = coverage(shipped)
    assert c["total"] == 100
    # Zero since bp-35, bp-57 and bp-70 lost their refusal flags: toronto.ca
    # answers all three in the 311 knowledge base the crawler never reaches.
    assert c["excluded_refusal"] == 0
    assert c["excluded_section"] > 0, (
        "No prompts excluded for section-wide labels. Either every label was "
        "narrowed -- in which case update this test -- or the exclusion stopped "
        "working and unfalsifiable questions are back in the headline number."
    )
    assert 50 <= c["scorable"] <= 90


# --- a pattern that matches nothing -----------------------------------------

def test_a_label_matching_no_corpus_url_is_not_scorable():
    """The quiet one. A section label is satisfied by anything; this is
    satisfied by nothing, so every arm scores a miss.

    It does not corrupt a comparison -- a constant zero applies to all arms --
    but it reports a retrieval failure for what is actually an uncrawled page.
    The fact worth surfacing is the corpus gap, and it only surfaces if this
    lands in the excluded list rather than the average.
    """
    assert not _truth(precision_band="missing", matched_url_count=0).is_scorable


def test_named_pages_outrank_a_broad_pattern():
    """How narrowing is supposed to work.

    Somebody reviewing bp-81 names the vaccination page. The original 'health'
    substring still matches 793 URLs and the band still reads 'section', so
    scoring on the band would throw the narrowing away.
    """
    t = _truth(precision_band="section", matched_url_count=793,
               relevant_url_patterns=["health"],
               relevant_pages=["https://www.toronto.ca/.../vaccines/"])
    assert t.is_scorable


def test_named_chunks_also_outrank_the_band():
    t = _truth(precision_band="section", matched_url_count=1653,
               relevant_chunks=["11111111-1111-1111-1111-111111111111"])
    assert t.is_scorable


def test_coverage_separates_the_two_exclusion_reasons():
    """They need different fixes: a section label needs narrowing, a missing one
    needs a crawl. One combined count would hide which."""
    truths = {
        "a": _truth(id="a", precision_band="section", matched_url_count=900),
        "b": _truth(id="b", precision_band="missing", matched_url_count=0),
        "c": _truth(id="c", precision_band="exact", matched_url_count=1),
        "d": _truth(id="d", precision_band="exact", expects_refusal=True),
    }
    c = coverage(truths)
    assert c["excluded_section"] == 1
    assert c["excluded_missing"] == 1
    assert c["excluded_refusal"] == 1
    assert c["scorable"] == 1


# --- what a rebuild is allowed to destroy -----------------------------------

def test_a_row_being_narrowed_counts_as_human_content():
    """Narrowing happens in passes -- pages, then chunks, then grades -- and the
    row is unverified for all of it."""
    assert _truth(relevant_pages=["https://x/"]).has_human_content
    assert _truth(relevant_chunks=["c1"]).has_human_content
    assert _truth(grades={"c1": 2}).has_human_content
    assert _truth(hard_negatives=["https://y/"]).has_human_content
    assert _truth(requirements=[{"type": "object", "value": "deck"}]).has_human_content


def test_a_freshly_seeded_row_has_no_human_content():
    """Otherwise the rebuild would preserve everything and never pick up a
    corrected label from prompts.py."""
    assert not _truth().has_human_content


def test_rebuilding_does_not_destroy_unverified_narrowing(tmp_path, monkeypatch):
    """The bug this covers: build() kept rows only when `is_verified`.

    A reviewer who named the pages for bp-81 but had not yet marked the row
    verified -- which is every row, for as long as the narrowing is in progress
    -- lost that work to the next rebuild. This file is the only copy.
    """
    import scripts.build_retrieval_truth as build_mod

    path = tmp_path / "truth.jsonl"
    in_progress = RetrievalTruth(
        id=BENCHMARK_PROMPTS[0].id,
        query=BENCHMARK_PROMPTS[0].prompt,
        category=BENCHMARK_PROMPTS[0].category,
        relevant_url_patterns=list(BENCHMARK_PROMPTS[0].expected_sources),
        relevant_pages=["https://www.toronto.ca/the-page-somebody-found/"],
        grades={"https://www.toronto.ca/the-page-somebody-found/": 2},
        precision_band="section", matched_url_count=900,
        label_source=SOURCE_FROZEN,          # NOT verified
    )
    save({in_progress.id: in_progress}, path)

    # Rebuild against a corpus that knows nothing about the narrowing.
    monkeypatch.setattr(build_mod, "TRUTH_PATH", path)
    monkeypatch.setattr(build_mod, "load", lambda p=None: load(path))
    monkeypatch.setattr(build_mod, "save", lambda t, p=None: save(t, path))
    monkeypatch.setattr(build_mod, "_match_counts",
                        lambda pats: ({p: 900 for p in pats}, ["https://u/"]))

    rebuilt = build_mod.build(dry_run=False)
    row = rebuilt[in_progress.id]

    assert row.relevant_pages == in_progress.relevant_pages, "narrowing was destroyed"
    assert row.grades == in_progress.grades, "grades were destroyed"
    # Corpus-derived fields are still refreshed underneath the preserved label.
    assert row.matched_url_count == 900
