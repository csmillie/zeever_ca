import pytest
from evals.scorer import score_signal_coverage, score_source_coverage, score_groundedness

def test_signal_coverage_all_present():
    answer = "You need a permit for a deck over a certain height and size."
    assert score_signal_coverage(answer, ["permit", "deck", "height", "size"]) == 1.0

def test_signal_coverage_partial():
    answer = "You need a permit for construction."
    score = score_signal_coverage(answer, ["permit", "deck", "height"])
    assert score == pytest.approx(1/3)

def test_signal_coverage_none():
    answer = "I don't know."
    assert score_signal_coverage(answer, ["permit", "deck"]) == 0.0

def test_signal_coverage_empty_signals():
    assert score_signal_coverage("anything", []) == 1.0

def test_source_coverage_full():
    cited = ["https://toronto.ca/services/when-do-i-need-a-building-permit/"]
    expected = ["when-do-i-need-a-building-permit"]
    assert score_source_coverage(cited, expected) == 1.0

def test_source_coverage_none():
    cited = ["https://toronto.ca/other-page/"]
    expected = ["when-do-i-need-a-building-permit"]
    assert score_source_coverage(cited, expected) == 0.0

def test_source_coverage_empty_expected():
    assert score_source_coverage([], []) == 1.0

def test_groundedness_no_context():
    assert score_groundedness("some answer", []) == 0.0

def test_groundedness_with_context():
    score = score_groundedness("building permit required", ["building permit information"])
    assert score > 0.0
