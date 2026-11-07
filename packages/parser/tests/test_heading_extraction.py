"""Headings must appear once, and their words must not be glued together.

`descendants` yields a heading Tag and then the strings inside it. The Tag branch
renders "## Text"; the string branch rendered it again, so every heading in the
corpus was stored twice. Headings are short, generic and navigational, so
doubling them doubles their weight in the chunk embedding — which is how a
parks-recreation registration page scored 0.748 on "How do I set up a new water
account in Toronto?" and outranked every water chunk.
"""
import pytest

from parser.html_parser import parse_html

TEMPLATE = "<html><body><main>{}</main></body></html>"


def _text(inner: str) -> str:
    return parse_html(TEMPLATE.format(inner), "https://example.test/x").text


def test_heading_appears_once():
    text = _text("<h2>Create a New Account</h2><p>Go to booking.</p>")
    assert text.count("Create a New Account") == 1


@pytest.mark.parametrize("tag", ["h1", "h2", "h3", "h4"])
def test_every_heading_level_is_deduplicated(tag):
    text = _text(f"<{tag}>Pay Your Bill</{tag}><p>Detail.</p>")
    assert text.count("Pay Your Bill") == 1


def test_heading_still_carries_its_section_marker():
    """The ## marker is what chunker._split_into_sections splits on."""
    assert "## Create a New Account" in _text("<h2>Create a New Account</h2><p>Body.</p>")


def test_body_text_is_untouched():
    text = _text("<h2>Water Rates</h2><p>Rates rise on January 1.</p>")
    assert "Rates rise on January 1." in text


def test_inline_markup_in_a_heading_keeps_its_spaces():
    """get_text(strip=True) concatenates: 'Pay Your <em>Utility</em> Bill' glued up."""
    text = _text("<h3>Pay Your <em>Utility</em> Bill</h3><p>Detail.</p>")
    assert "Pay Your Utility Bill" in text
    assert "YourUtility" not in text


def test_a_linked_heading_keeps_its_spaces():
    """Toronto.ca headings frequently wrap part of the text in an anchor."""
    text = _text('<h2>Water <a href="/r">Rates</a> and Fees</h2><p>Detail.</p>')
    assert "Water Rates and Fees" in text


def test_headings_list_matches_the_body_rendering():
    parsed = parse_html(
        TEMPLATE.format('<h2>Water <a href="/r">Rates</a> and Fees</h2><p>D.</p>'),
        "https://example.test/x",
    )
    assert parsed.headings == ["Water Rates and Fees"]


def test_repeated_heading_text_elsewhere_is_preserved():
    """Deduplication must be positional, not a blanket removal of the phrase."""
    text = _text("<h2>Contact Us</h2><p>Use Contact Us to reach the team.</p>")
    assert text.count("Contact Us") == 2


def test_the_realistic_case_that_caused_it():
    """The parks-recreation chunk that hijacked bp-35, as the page renders it."""
    text = _text(
        "<h2>Create a New Account</h2>"
        "<p>Go to Online Registration and Booking</p>"
        "<p>Select Create an Account</p>"
    )
    assert text.count("Create a New Account") == 1
    # "Create an Account" in the body is different text and must survive.
    assert "Select Create an Account" in text
