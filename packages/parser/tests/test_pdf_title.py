"""PDF titles come from the document, not from the filename, when that is better.

The title is embedded alongside the chunk text and shown to a reader as the
citation, so "8Ccb Monthlyutilitybillingapplication" is bad twice over. Checked
against four real Toronto PDFs:

    8ccb-MonthlyUtilityBillingApplication.pdf -> Monthly Utility Billing Option
    9594-GeneralUtilityBrochure.pdf           -> Water & Solid Waste Utility Bill
    8f06-CDIP_HomeSafetyBrochureENG_2017..pdf -> Tips to make your home safer...
    9273-Building-Permit-Guide-WEB.pdf        -> Building Permit Guide Web

The last one has no metadata title, so it falls back to the filename with
Toronto's four-hex-character upload prefix stripped.
"""
import pytest

from parser.pdf_parser import _from_filename, _usable_metadata_title

URL = "https://www.toronto.ca/wp-content/uploads/2023/01/8ccb-MonthlyUtilityBillingApplication.pdf"


@pytest.mark.parametrize("raw,expected", [
    ("Monthly Utility Billing Option", "Monthly Utility Billing Option"),
    ("Water & Solid Waste Utility Bill ", "Water & Solid Waste Utility Bill"),
    ("  Spaced   Out  Title  ", "Spaced Out Title"),
])
def test_real_titles_are_used(raw, expected):
    assert _usable_metadata_title(raw, URL) == expected


@pytest.mark.parametrize("raw", [
    "",
    "   ",
    None,
    "Microsoft Word - 9594.docx",
    "Microsoft PowerPoint - deck.pptx",
    "untitled",
    "Document1",
    "report.indd",
    "Slide 1",
    "20-1224",          # an identifier, no letters
    "abc",              # too short to be a title
    "x" * 250,          # too long
])
def test_artefacts_are_rejected(raw):
    """A writer's leftover is worse than the filename, because it looks deliberate."""
    assert _usable_metadata_title(raw, URL) is None


def test_title_that_is_just_the_filename_is_rejected():
    assert _usable_metadata_title("8ccbMonthlyUtilityBillingApplication", URL) is None


def test_filename_fallback_strips_the_upload_prefix():
    """Toronto prefixes every upload with four hex characters."""
    assert _from_filename(
        "https://www.toronto.ca/wp-content/uploads/2017/11/9273-Building-Permit-Guide-WEB.pdf"
    ) == "Building Permit Guide Web"


def test_filename_fallback_handles_underscores_and_trailing_dots():
    assert _from_filename(
        "https://www.toronto.ca/wp-content/uploads/2019/07/8f06-CDIP_HomeSafetyBrochureENG_2017..pdf"
    ) == "Cdip Homesafetybrochureeng 2017"


def test_filename_without_a_prefix_is_left_alone():
    assert _from_filename("https://www.toronto.ca/x/building-permit-guide.pdf") == "Building Permit Guide"


def test_parse_pdf_prefers_metadata(monkeypatch):
    """End to end, without needing a real PDF on disk."""
    import parser.pdf_parser as mod

    class _Doc:
        metadata = {"title": "Monthly Utility Billing Option"}
        def __iter__(self):
            return iter([type("P", (), {"get_text": lambda self: "some text"})()])
        def close(self):
            pass

    monkeypatch.setattr(mod.pymupdf, "open", lambda **kw: _Doc())
    assert mod.parse_pdf(b"x", URL).title == "Monthly Utility Billing Option"


def test_parse_pdf_falls_back_when_metadata_is_junk(monkeypatch):
    import parser.pdf_parser as mod

    class _Doc:
        metadata = {"title": "Microsoft Word - 8ccb.docx"}
        def __iter__(self):
            return iter([type("P", (), {"get_text": lambda self: "some text"})()])
        def close(self):
            pass

    monkeypatch.setattr(mod.pymupdf, "open", lambda **kw: _Doc())
    assert mod.parse_pdf(b"x", URL).title == "Monthlyutilitybillingapplication"
