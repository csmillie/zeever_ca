"""PDF classification, and the URL filter that acts on it.

The corpus is 10,800 PDFs against 7,700 HTML pages. Measured over a 295-page
sample, resident-facing PDFs retrieve at 73 percent, reference and archive at 39,
and council papers alone at 15. Excluding the second group is the point of this
code, so the classification has to be right about which is which.

Every URL here is either taken from the corpus or built to the same shape,
including the ones that previously went to the wrong class.
"""
import pytest

from crawler.pdf_classes import (
    PDF_CLASSES, REFERENCE, RESIDENT, TRANSLATED, UNKNOWN, classify,
)
from crawler.url_filter import is_in_scope

UPLOADS = "https://www.toronto.ca/wp-content/uploads/2024/06/"


@pytest.mark.parametrize("filename,expected", [
    # Reference material, the group this exists to identify.
    ("aa11-Planning-and-Housing-Committee-Decisions.pdf", "council-meeting"),
    ("bb22-2024-06-20-ph13-Agenda-Decisions-Summary-Thursday.pdf", "council-meeting"),
    ("cc33-ex14-minutes.pdf", "council-meeting"),
    ("dd44-Eglinton-Connects-Phase-1-Final-Report.pdf", "project-doc"),
    ("ee55-appendix-b-traffic-counts.pdf", "project-doc"),
    ("ff66-CoT2026Winter-Ops-DMDigitalFinalAODA.pdf", "accessible-copy"),
    ("gg77-Fairbank-sewer-construction-Display-Panels-July-2022.pdf", "consultation"),
    # Resident material, which must not be caught by any of the above.
    ("hh88-Building-Permit-Guide-WEB.pdf", "form-application"),
    ("ii99-MonthlyUtilityBillingApplication.pdf", "form-application"),
    ("jj00-Fact-Sheet-CO-Alarm-Requirements-ENGLISH.pdf", "fact-sheet"),
    ("kk11-Baby-Point-Gates-BIA.pdf", "bia-profile"),
    ("ll22-ward-map.pdf", "map-plan"),
    # This was pinned to map-plan when "streetscape" was not in the project
    # vocabulary, with a note that both readings were defensible. Adding
    # streetscape to that vocabulary was deliberate, so the expectation moves with
    # it: a corridor streetscape plan is project documentation, not a map a
    # resident would look up.
    ("mm33-Eglinton-Connects-Streetscape-Plan.pdf", "project-doc"),
    # Unreachable rather than underperforming.
    ("nn44-09-0608-Punjabi-311overview.pdf", "translated"),
    ("oo55-09-0602-Farsi-3-1-1-Overview-translation.pdf", "translated"),
])
def test_classification(filename, expected):
    assert classify(UPLOADS + filename) == expected


@pytest.mark.parametrize("url,expected", [
    ("https://www.toronto.ca/legdocs/mmis/2025/ph/bgrd/backgroundfile-255126.pdf",
     "legdocs-mmis"),
    ("https://www.toronto.ca/legdocs/municode/1184_693.pdf", "legdocs-municode"),
    ("https://www.toronto.ca/wp-content/uploads/2020/09/9592-ecs-specs-pipeas-TS_7.30.pdf",
     "ecs-specs"),
])
def test_classification_outside_uploads(url, expected):
    assert classify(url) == expected


@pytest.mark.parametrize("filename", [
    # Corridor first, which the original pattern handled.
    "aa-Eglinton-Connects-Phase-1-Final-Report.pdf",
    "bb-Sheppard-East-Corridor-Update.pdf",
    # Report word first, which it did not: the pattern required the corridor to
    # come first, so these fell into the catch-all. After the reference prune the
    # unnamed filenames still led with eglinton 187 and blvd 153 beside final 229
    # and progress 109, which is what showed the gap.
    "cc-Progress-Report-Eglinton-2024.pdf",
    "dd-Final-Summary-Yonge-Street.pdf",
    "ee-Blvd-Cafe-Progress-Report.pdf",
])
def test_project_documents_match_in_either_order(filename):
    assert classify(UPLOADS + filename) == "project-doc"


def test_corridor_name_alone_is_not_a_project_document():
    """A resident page can mention a street; only report vocabulary makes it archive."""
    assert classify(UPLOADS + "xx-Queen-Street-Parking-Permit-Application.pdf") == "form-application"


def test_neighbourhood_names_are_not_languages():
    """GreekTown and Chinatown are BIAs. The language list would claim them."""
    assert classify(UPLOADS + "aa-GreekTown-on-the-Danforth-BIA.pdf") == "bia-profile"
    assert classify(UPLOADS + "bb-Chinatown-BIA.pdf") == "bia-profile"


def test_every_class_belongs_to_exactly_one_group():
    """translated once belonged to none, so its 925 chunks vanished from the totals."""
    names = {name for name, _, _ in PDF_CLASSES} | {"unclassified"}
    groups = [RESIDENT, REFERENCE, UNKNOWN, TRANSLATED]
    assert names == set().union(*groups)
    for i, a in enumerate(groups):
        for b in groups[i + 1:]:
            assert not (a & b), f"{a & b} is in two groups"


# --- the filter that acts on all of the above -------------------------------

@pytest.fixture
def exclusion(monkeypatch):
    """One switch on and the other explicitly off, so a host that sets either in
    .env cannot change what these tests are asserting about."""
    from crawler import url_filter
    monkeypatch.setattr(url_filter.settings, "exclude_reference_pdfs", True)
    monkeypatch.setattr(url_filter.settings, "exclude_translated_pdfs", False)


@pytest.fixture
def both_switches_off(monkeypatch):
    """Pin the filter to the shipped defaults.

    settings is a singleton over the deployment's .env, so a host that turns either
    switch on used to fail these — they asserted about that host's configuration
    rather than about the filter."""
    from crawler import url_filter
    monkeypatch.setattr(url_filter.settings, "exclude_reference_pdfs", False)
    monkeypatch.setattr(url_filter.settings, "exclude_translated_pdfs", False)


def _shipped(name):
    from shared.config import Settings
    return Settings.model_fields[name].default


def test_off_by_default(both_switches_off):
    """Turning this on changes what the corpus contains; it should follow evidence."""
    assert _shipped("exclude_reference_pdfs") is False
    assert is_in_scope(UPLOADS + "aa-Planning-Committee-Decisions.pdf")


def test_reference_pdf_excluded_when_on(exclusion):
    assert not is_in_scope(UPLOADS + "aa-Planning-Committee-Decisions.pdf")


def test_resident_pdf_kept_when_on(exclusion):
    assert is_in_scope(UPLOADS + "bb-Building-Permit-Guide-WEB.pdf")


def test_translated_kept_by_the_reference_switch(exclusion):
    """The two switches are independent: dropping the other languages is a product
    decision, not a retrieval one, so the reference switch must not take them."""
    assert is_in_scope(UPLOADS + "cc-09-0608-Punjabi-311overview.pdf")


@pytest.fixture
def translated_exclusion(monkeypatch):
    from crawler import url_filter
    monkeypatch.setattr(url_filter.settings, "exclude_translated_pdfs", True)
    monkeypatch.setattr(url_filter.settings, "exclude_reference_pdfs", False)


def test_translated_excluded_by_its_own_switch(translated_exclusion):
    assert not is_in_scope(UPLOADS + "cc-09-0608-Punjabi-311overview.pdf")


def test_translated_switch_leaves_reference_alone(translated_exclusion):
    """Turning one on must not silently turn on the other."""
    assert is_in_scope(UPLOADS + "dd-Planning-Committee-Decisions.pdf")


def test_translated_switch_leaves_resident_content_alone(translated_exclusion):
    assert is_in_scope(UPLOADS + "ee-Building-Permit-Guide-WEB.pdf")


def test_both_switches_off_by_default():
    assert _shipped("exclude_reference_pdfs") is False
    assert _shipped("exclude_translated_pdfs") is False


def test_html_never_filtered(exclusion):
    """The same words appear in HTML paths that genuinely are about the topic."""
    assert is_in_scope("https://www.toronto.ca/city-government/council/committee-decisions/")
    assert is_in_scope("https://www.toronto.ca/services-payments/streets-parking-transportation/")


def test_existing_exclusions_still_apply(exclusion):
    assert not is_in_scope("https://www.toronto.ca/wp-admin/index.php")
    assert not is_in_scope("https://example.com/anything.pdf")
