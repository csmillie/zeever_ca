"""Official City bodies on their own domains are fetched, and cited as themselves.

The Ombudsman and the Auditor General are accountability officers of the City,
independent by design and on separate domains for that reason. The offsite rule
blocked them correctly — toronto.ca/.../ombudsman-toronto/ is a redirect, so
there was no City page to index — and the measured cost was that "how do I file
a complaint with the Ombudsman" returned an answer citing an insurance claims
page, because nothing better existed in the corpus.

The allowlist lets those two through. What it must not do is file their content
under the toronto.ca URL that pointed at them, which would be the same
misattribution the offsite rule exists to prevent.
"""
import httpx
import pytest

from crawler.fetcher import (CITY_AFFILIATED_DOMAINS, Fetcher, OffsiteRedirect,
                             is_city_affiliated)

OMBUDSMAN_PAGE = ("https://www.toronto.ca/city-government/"
                  "accountability-operations-customer-service/"
                  "accountability-officers/ombudsman-toronto/")


def _fetcher(destination):
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == OMBUDSMAN_PAGE:
            return httpx.Response(301, headers={"location": destination})
        return httpx.Response(200, text="<html>the Ombudsman's own page</html>",
                              headers={"content-type": "text/html"})
    f = Fetcher(rate_limit_ms=0)
    f._client = httpx.AsyncClient(transport=httpx.MockTransport(handler),
                                  follow_redirects=True)
    return f


@pytest.mark.parametrize("host,expected", [
    ("www.ombudsmantoronto.ca", True),
    ("ombudsmantoronto.ca", True),
    ("www.torontoauditor.ca", True),
    # Not the City speaking: an independent youth organisation, a councillor's
    # office site, a booking vendor, and a lookalike that is not the same domain.
    ("www.thetyc.ca", False),
    ("www.mayoroliviachow.ca", False),
    ("reservation.frontdesksuite.ca", False),
    ("ombudsmantoronto.ca.example.com", False),
])
def test_is_city_affiliated(host, expected):
    assert is_city_affiliated(host) is expected


def test_the_list_stays_short():
    """A long allowlist means the rule has stopped being a judgement about whose
    words these are. Raise this deliberately, not by accident."""
    assert len(CITY_AFFILIATED_DOMAINS) <= 5


@pytest.mark.asyncio
async def test_affiliated_redirect_is_followed():
    f = _fetcher("https://www.ombudsmantoronto.ca/")
    result = await f.fetch(OMBUDSMAN_PAGE)
    assert result.status_code == 200
    await f.close()


@pytest.mark.asyncio
async def test_content_is_stored_under_the_publisher_url():
    """The whole point. Storing this under the toronto.ca URL would cite the City
    for the Ombudsman's words, which is what the offsite rule prevents."""
    f = _fetcher("https://www.ombudsmantoronto.ca/")
    result = await f.fetch(OMBUDSMAN_PAGE)
    assert result.url == "https://www.ombudsmantoronto.ca/"
    assert result.requested_url == OMBUDSMAN_PAGE
    await f.close()


@pytest.mark.asyncio
async def test_an_unlisted_domain_is_still_refused():
    f = _fetcher("https://www.thetyc.ca/")
    with pytest.raises(OffsiteRedirect):
        await f.fetch(OMBUDSMAN_PAGE)
    await f.close()


@pytest.mark.asyncio
async def test_ordinary_pages_keep_their_own_url():
    """A page that does not redirect must be unaffected by any of this."""
    def handler(request):
        return httpx.Response(200, text="<html>a real City page</html>",
                              headers={"content-type": "text/html"})
    f = Fetcher(rate_limit_ms=0)
    f._client = httpx.AsyncClient(transport=httpx.MockTransport(handler),
                                  follow_redirects=True)
    result = await f.fetch(OMBUDSMAN_PAGE)
    assert result.url == OMBUDSMAN_PAGE
    assert result.requested_url == OMBUDSMAN_PAGE
    await f.close()


@pytest.mark.asyncio
async def test_the_exception_carries_both_hosts():
    """Callers need the destination to record the handoff. Reading it back out of
    the message with a string split truncated it to "https://www" once already,
    which hid that City subdomains were being deleted alongside third parties."""
    f = _fetcher("https://reservation.frontdesksuite.ca/x/")
    with pytest.raises(OffsiteRedirect) as exc:
        await f.fetch(OMBUDSMAN_PAGE)
    assert exc.value.landed == "reservation.frontdesksuite.ca"
    assert exc.value.asked == "www.toronto.ca"
    await f.close()


# --- the City page still needs a record of its own ----------------------------
# Content from an affiliated redirect is stored under the publisher's URL, which
# is the point. But that leaves the toronto.ca URL with a raw_documents row and
# no parsed document, so it stays in the gap list and is re-fetched on every run.
# Measured: gaps fell 47 -> 9 after the first run, and those 9 included these 4
# pages, unchanged and permanent.

@pytest.mark.asyncio
async def test_requested_url_survives_so_a_handoff_can_be_recorded():
    """Both addresses have to come back, or the caller cannot tell that a
    redirect was followed and cannot record the City page as a pointer."""
    f = _fetcher("https://www.ombudsmantoronto.ca/how-to-make-a-complaint/")
    result = await f.fetch(OMBUDSMAN_PAGE)
    assert result.requested_url != result.url
    assert result.requested_url == OMBUDSMAN_PAGE
    assert result.url == "https://www.ombudsmantoronto.ca/how-to-make-a-complaint/"
    await f.close()


@pytest.mark.asyncio
async def test_no_redirect_leaves_the_two_urls_equal():
    """The handoff record is written only when the two differ, so an ordinary
    page must not produce one."""
    def handler(request):
        return httpx.Response(200, text="<html>a real City page</html>",
                              headers={"content-type": "text/html"})
    f = Fetcher(rate_limit_ms=0)
    f._client = httpx.AsyncClient(transport=httpx.MockTransport(handler),
                                  follow_redirects=True)
    result = await f.fetch(OMBUDSMAN_PAGE)
    assert result.requested_url == result.url
    await f.close()
