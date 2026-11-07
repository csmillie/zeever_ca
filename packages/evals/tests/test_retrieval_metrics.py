"""Retrieval metrics, and the places a plausible number would be wrong.

Small formulas, so the tests are mostly about what the numbers mean rather than
whether the arithmetic runs. Two things they are guarding:

  - Recall@K over one relevant page is hit@K, and must not quietly become
    something else when a question carries several labels;
  - MRR must reward promotion, because that is the effect this experiment is
    looking for. A method that moves the right page from rank 4 to rank 1 gains
    nothing on Recall@5 and a great deal on MRR, and if MRR did not move we
    would be unable to see the improvement we are testing for.
"""
import pytest

from evals.retrieval_metrics import (
    aggregate, by_category, hit_rank, recall_at_k, reciprocal_rank, score_query,
)
from evals.retrieval_truth import RetrievalTruth


def _truth(**over):
    base = dict(id="bp-01", query="q", category="building-permits",
                relevant_url_patterns=["when-do-i-need-a-building-permit"],
                precision_band="exact", matched_url_count=1)
    base.update(over)
    return RetrievalTruth(**base)


def _chunks(*urls):
    return [{"id": f"c{i}", "url": u} for i, u in enumerate(urls)]


RIGHT = "https://www.toronto.ca/x/when-do-i-need-a-building-permit/"
WRONG = "https://www.toronto.ca/x/green-bin-collection/"


# --- rank -------------------------------------------------------------------

def test_rank_is_one_based():
    """Rank 0 would make reciprocal rank divide by zero, and 1/1 is the best
    possible score rather than an error."""
    assert hit_rank(_chunks(RIGHT, WRONG), _truth()) == 1


def test_rank_finds_the_first_match_not_the_best():
    assert hit_rank(_chunks(WRONG, WRONG, RIGHT), _truth()) == 3


def test_no_match_is_none_not_zero():
    """None and 0 mean different things downstream: absent versus found at the
    top. Returning 0 here would make every miss look like a perfect hit."""
    assert hit_rank(_chunks(WRONG, WRONG), _truth()) is None


# --- MRR --------------------------------------------------------------------

def test_reciprocal_rank_rewards_promotion():
    """The property the experiment depends on. Moving the right page from 4 to 1
    is invisible to Recall@5 and quadruples MRR."""
    t = _truth()
    at4 = _chunks(WRONG, WRONG, WRONG, RIGHT)
    at1 = _chunks(RIGHT, WRONG, WRONG, WRONG)
    assert recall_at_k(at4, t, 5) == recall_at_k(at1, t, 5) == 1.0
    assert reciprocal_rank(at4, t) == 0.25
    assert reciprocal_rank(at1, t) == 1.0


def test_reciprocal_rank_of_a_miss_is_zero():
    assert reciprocal_rank(_chunks(WRONG), _truth()) == 0.0


# --- recall -----------------------------------------------------------------

def test_recall_at_k_respects_the_cut_off():
    t = _truth()
    chunks = _chunks(WRONG, WRONG, WRONG, RIGHT)
    assert recall_at_k(chunks, t, 3) == 0.0
    assert recall_at_k(chunks, t, 5) == 1.0


def test_recall_with_two_labels_is_a_real_fraction():
    """Ten Benchmark A questions name two pages. Scoring those as hit@k would
    credit a method that found one of two as fully correct."""
    t = _truth(relevant_url_patterns=["pool-fence", "when-do-i-need"])
    one = _chunks("https://t.ca/a/pool-fence/", WRONG)
    assert recall_at_k(one, t, 5) == 0.5
    both = _chunks("https://t.ca/a/pool-fence/", RIGHT)
    assert recall_at_k(both, t, 5) == 1.0


def test_a_label_matched_twice_counts_once():
    """Two chunks from the same page are one page found, not two. Without the
    break, a page contributing three chunks would score recall above 1.0."""
    t = _truth()
    assert recall_at_k(_chunks(RIGHT, RIGHT, RIGHT), t, 5) == 1.0


def test_no_labels_scores_zero_rather_than_one():
    """An empty target list dividing into itself would be 1.0, which reads as a
    perfect score for a question with no ground truth at all."""
    assert recall_at_k(_chunks(RIGHT), _truth(relevant_url_patterns=[]), 5) == 0.0


# --- chunk ids outrank url patterns ----------------------------------------

def test_chunk_labels_are_used_when_present():
    """A chunk id names one passage; a URL pattern names a page that may hold
    dozens. Once somebody has done the finer work, scoring must use it."""
    t = _truth(relevant_chunks=["c1"])
    assert hit_rank([{"id": "c0", "url": RIGHT}, {"id": "c1", "url": WRONG}], t) == 2


def test_a_url_match_does_not_satisfy_a_chunk_label():
    """Otherwise chunk-level truth would be strictly weaker than the page-level
    truth it replaced."""
    t = _truth(relevant_chunks=["c9"])
    assert hit_rank(_chunks(RIGHT, RIGHT), t) is None


# --- aggregation ------------------------------------------------------------

def test_aggregate_reports_n_beside_every_figure():
    """The scorable subset moves as the corpus does, so a mean without its n is
    two numbers that cannot be compared."""
    t = _truth()
    rs = [score_query("bp-01", "c", _chunks(RIGHT), t),
          score_query("bp-02", "c", _chunks(WRONG), t)]
    agg = aggregate(rs)
    assert agg["n"] == 2 and agg["found"] == 1 and agg["missed"] == 1
    assert agg["mrr"] == 0.5


def test_mean_rank_ignores_the_misses():
    """Counting a miss as any rank at all invents a number. Reported only over
    the ones that were found, with the miss count beside it."""
    t = _truth()
    rs = [score_query("a", "c", _chunks(WRONG, RIGHT), t),
          score_query("b", "c", _chunks(WRONG), t)]
    assert aggregate(rs)["mean_rank_when_found"] == 2.0


def test_empty_results_do_not_divide_by_zero():
    assert aggregate([])["n"] == 0


def test_by_category_splits_the_aggregate():
    """The hypothesis is about compositional questions. An aggregate that rises
    while one category collapses is the result this must not hide."""
    t = _truth()
    rs = [score_query("a", "permits", _chunks(RIGHT), t),
          score_query("b", "water", _chunks(WRONG), t)]
    cats = by_category(rs)
    assert cats["permits"]["mrr"] == 1.0
    assert cats["water"]["mrr"] == 0.0
