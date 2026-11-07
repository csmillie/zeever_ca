"""A City page that only redirects still answers a resident's question.

Twelve immunization and clinic pages send visitors to reservation.frontdesksuite.ca,
recreation booking goes to activecommunities.com, job applications to sapsf.com.
The fetcher refuses to store what comes back, correctly: that content belongs to
the operator. But refusing left nothing, and "how do I book a vaccine
appointment" had no source at all.

These tests cover the record that replaces the silence: what the service is, and
where the City sends you, with no borrowed content.
"""
from unittest.mock import MagicMock

import pytest

from crawler.redirects import SOURCE_FORMAT, redirect_text, service_name

CLINIC = ("https://www.toronto.ca/community-people/health-wellness-care/"
          "health-programs-advice/immunization/"
          "toronto-public-health-appointment-booking-system/"
          "covid-19-vaccination-clinics/")
BOOKING = "https://reservation.frontdesksuite.ca/"


@pytest.mark.parametrize("url,expected", [
    (CLINIC, "Covid 19 Vaccination Clinics"),
    ("https://www.toronto.ca/explore-enjoy/parks-recreation/"
     "booking-parks-recreation-facilities/", "Booking Parks Recreation Facilities"),
    # A page whose last segment only says "this is a redirect" describes nothing.
    # Fall back to the segment before it, which names the actual subject.
    ("https://www.toronto.ca/community-people/health-wellness-care/"
     "health-programs-advice/toronto-public-health-echat/echat-redirect-page/",
     "Toronto Public Health Echat"),
    # The booking-system segment is structure, not service.
    ("https://www.toronto.ca/a/toronto-public-health-appointment-booking-system/",
     "A"),
    ("https://www.toronto.ca/", "City of Toronto service"),
])
def test_service_name(url, expected):
    assert service_name(url) == expected


def test_text_names_the_operator_not_the_city():
    """An answer built from this must not read as though the City published the
    destination. That is the misattribution the offsite rule exists to prevent,
    and recording the redirect must not reintroduce it."""
    text = redirect_text(CLINIC, BOOKING)
    assert "reservation.frontdesksuite.ca" in text
    assert "not by the City of Toronto" in text
    assert "does not run this service on toronto.ca" in text


def test_text_carries_both_addresses():
    """The useful content of a redirect page is the address it sends you to."""
    text = redirect_text(CLINIC, BOOKING)
    assert CLINIC in text
    assert BOOKING in text


def test_text_is_short():
    """These have to lose to a real page whenever one exists. Length is the
    simplest lever: a long record would compete for retrieval slots against
    pages that actually answer the question."""
    assert len(redirect_text(CLINIC, BOOKING).split()) < 120


def test_no_destination_content_appears():
    """Only the URL is taken. Nothing is fetched from the destination, so nothing
    of theirs can end up in the corpus."""
    text = redirect_text(CLINIC, BOOKING)
    assert "<" not in text and "</" not in text


def _session_with(existing=None):
    """A session whose ParsedDocument lookup returns what the test wants."""
    session = MagicMock()
    session.execute.return_value.scalars.return_value.first.return_value = existing
    return session


def test_new_redirect_is_added_with_a_chunk():
    from crawler.redirects import record_redirect
    session = _session_with(None)
    doc = record_redirect(session, CLINIC, BOOKING)
    assert doc.url == CLINIC
    assert doc.source_format == SOURCE_FORMAT
    assert doc.extra_metadata["redirects_to"] == BOOKING
    # A document and a chunk: without the chunk there is nothing to embed and
    # nothing to retrieve, which is how the restored pages ended up invisible.
    assert session.add.call_count == 2


def test_missing_urls_record_nothing():
    from crawler.redirects import record_redirect
    session = _session_with(None)
    assert record_redirect(session, "", BOOKING) is None
    assert record_redirect(session, CLINIC, "") is None
    session.add.assert_not_called()


def test_an_existing_record_is_rewritten_not_appended():
    """Destinations move. The health chat provider and the recreation booking
    system have both changed. Appending would leave the old address retrievable
    beside the new one, which is worse than having neither."""
    from crawler.redirects import record_redirect
    old_chunk = MagicMock()
    existing = MagicMock()
    existing.chunks = [old_chunk]
    session = _session_with(existing)

    record_redirect(session, CLINIC, "https://newbooking.example.ca/")

    session.delete.assert_called_once_with(old_chunk)
    assert existing.extra_metadata["redirects_to"] == "https://newbooking.example.ca/"
    assert "newbooking.example.ca" in existing.content_text
    # One add: the replacement chunk. The document is updated in place.
    assert session.add.call_count == 1


def test_record_does_not_commit():
    """The caller owns the transaction, so a crawl that fails part way does not
    leave half its redirects recorded."""
    from crawler.redirects import record_redirect
    session = _session_with(None)
    record_redirect(session, CLINIC, BOOKING)
    session.commit.assert_not_called()
