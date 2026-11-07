"""The verdicts this diagnostic assigns decide what gets worked on next.

A missed PDF can be missed for three reasons that look identical in a recall
number and need entirely different fixes: it ranked below the cut, it does not
resemble a question written from its own text, or it was never indexed. Getting
the classification backwards would send the next week of work at the parser when
the problem was ranking, or the reverse.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import diagnose_pdf_retrieval as diag  # noqa: E402
from query_engine.retriever import SIMILARITY_THRESHOLD  # noqa: E402


def test_a_page_with_no_chunks_is_an_ingestion_problem():
    """Checked before similarity, because a page with nothing indexed has no
    similarity to report and would otherwise be filed under the parser."""
    assert diag.classify(None, 0) == "NO CHUNKS"
    assert diag.classify(0.9, 0) == "NO CHUNKS"


def test_a_chunk_below_the_serving_threshold_is_not_a_ranking_problem():
    """The threshold is the retriever's own: below it the chunk would be dropped
    even if it were ranked first, so no amount of reranking recovers the page."""
    assert diag.classify(SIMILARITY_THRESHOLD - 0.01, 3) == "NOT SIMILAR"
    assert diag.classify(SIMILARITY_THRESHOLD, 3) == "RANKED OUT"


def test_a_similar_chunk_that_still_missed_is_a_ranking_problem():
    assert diag.classify(0.72, 5) == "RANKED OUT"


def test_glued_text_is_visible_in_the_signals():
    """Extraction that loses its spaces embeds badly, because every token is
    wrong. It has to be distinguishable from prose that is merely dense."""
    glued = diag.text_signals("Application" + "x" * 40 + " for a permit")
    prose = diag.text_signals("Apply for a building permit before starting work.")
    assert glued["glued"] > 0.2
    assert prose["glued"] == 0.0
    assert prose["mean_word"] < glued["mean_word"]


def test_a_flattened_table_reads_as_digits_not_language():
    table = diag.text_signals("2019 2020 2021 14.2 15.8 16.1 3,200 4,100 5,000")
    prose = diag.text_signals("The city collects garbage on alternating weeks.")
    assert table["digit"] > prose["digit"]
    assert prose["alpha"] > table["alpha"]


def test_empty_text_does_not_divide_by_zero():
    """Runs against whatever the parser produced, including nothing."""
    s = diag.text_signals("")
    assert s["chars"] == 0 and s["mean_word"] == 0.0 and s["glued"] == 0.0
