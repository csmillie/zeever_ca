"""Duplicate chunks were taking three of the five context slots.

For "How do I pay my water bill in Toronto?" retrieval returned the same
connection-and-disconnection page three times at identical similarity (0.786),
which pushed the actual Pay Your Utility Bill page to rank 6 — below the top 5
the app reads. Every model then answered from context that could not contain the
answer, and the ones that said so scored worst.
"""
from query_engine.retriever import _dedupe, _max_per_url


def _c(url, text, sim=0.8):
    return {"url": url, "chunk_text": text, "similarity": sim}


def test_exact_duplicates_are_dropped():
    chunks = [_c("a", "same text"), _c("a", "same text"), _c("a", "same text"), _c("b", "other")]
    out = _dedupe(chunks, limit=5)
    assert [c["url"] for c in out] == ["a", "b"]


def test_the_real_case_lets_the_right_page_into_the_top_five():
    """Reproduces bp-33: three copies of one page, the answer sitting at rank 6."""
    chunks = [
        _c("connection", "note: both the water service and meter must be sized", 0.786),
        _c("connection", "note: both the water service and meter must be sized", 0.786),
        _c("connection", "note: both the water service and meter must be sized", 0.786),
        _c("budgets", "toronto water division provides water services", 0.766),
        _c("storm", "payment and municipal services application", 0.765),
        _c("pay-your-utility-bill", "find information on utility bill payment options", 0.763),
    ]
    out = _dedupe(chunks, limit=5)
    urls = [c["url"] for c in out]
    assert "pay-your-utility-bill" in urls, "the page that answers the question must survive"
    assert urls.index("pay-your-utility-bill") < 5


def test_page_cap_applies_to_distinct_chunks_of_one_page():
    """Different text from the same page still should not take every slot."""
    chunks = [_c("a", f"paragraph {i}") for i in range(5)] + [_c("b", "other"), _c("c", "another")]
    out = _dedupe(chunks, limit=5)
    assert sum(1 for c in out if c["url"] == "a") == _max_per_url()
    assert {"b", "c"} <= {c["url"] for c in out}


def test_order_is_preserved_so_the_best_scoring_copy_survives():
    chunks = [_c("a", "best", 0.9), _c("a", "best", 0.9), _c("b", "next", 0.8)]
    out = _dedupe(chunks, limit=5)
    assert out[0]["similarity"] == 0.9 and out[1]["url"] == "b"


def test_limit_is_respected():
    chunks = [_c(f"u{i}", f"t{i}") for i in range(20)]
    assert len(_dedupe(chunks, limit=5)) == 5


def test_empty_and_missing_fields_do_not_crash():
    assert _dedupe([], limit=5) == []
    assert len(_dedupe([{"similarity": 0.5}, {"similarity": 0.4}], limit=5)) >= 1
