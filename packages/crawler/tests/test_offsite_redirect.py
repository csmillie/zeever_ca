"""A fetch that leaves the host it was aimed at must fail, not return content.

Toronto.ca redirects some of its own pages to third parties. The Better Buildings
Partnership member pages send

    /services-payments/water-environment/net-zero-homes-buildings/
    better-buildings-partnership/green-will-initiative/members/university-of-toronto/

to utoronto.ca, and there are equivalents for Cadillac Fairview, Humber College,
Minto, First Capital, Realstar and the Catholic school board.

The fetcher followed those and stored the result under the toronto.ca URL, so an
unrelated organisation's homepage would enter the corpus as City of Toronto
content and be cited as though the City had published it. In a re-crawl of 1,342
pages on 2026-08-31 about a dozen pages did this, and nothing was stored only
because the destinations returned 403. A partner site without that protection
would have been indexed.
"""
import httpx
import pytest

from crawler.fetcher import Fetcher, OffsiteRedirect

TORONTO = "https://www.toronto.ca/services-payments/x/"


def _fetcher(handler, **kwargs):
    """A Fetcher whose transport is scripted, so no network is touched."""
    f = Fetcher(rate_limit_ms=0, **kwargs)
    f._client = httpx.AsyncClient(transport=httpx.MockTransport(handler),
                                  follow_redirects=True)
    return f


def _redirect_to(destination):
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == TORONTO:
            return httpx.Response(301, headers={"location": destination})
        return httpx.Response(200, text="<html>somebody else's page</html>",
                              headers={"content-type": "text/html"})
    return handler


@pytest.mark.asyncio
async def test_offsite_redirect_raises():
    f = _fetcher(_redirect_to("https://www.utoronto.ca/"))
    with pytest.raises(OffsiteRedirect, match="utoronto.ca"):
        await f.fetch(TORONTO)
    await f.close()


@pytest.mark.asyncio
async def test_the_message_names_both_hosts():
    """It has to be obvious which page sent the crawler where."""
    f = _fetcher(_redirect_to("https://www.cadillacfairview.com/"))
    with pytest.raises(OffsiteRedirect) as exc:
        await f.fetch(TORONTO)
    assert "cadillacfairview.com" in str(exc.value)
    assert "toronto.ca" in str(exc.value)
    await f.close()


@pytest.mark.asyncio
async def test_same_host_redirect_is_fine():
    """Toronto.ca redirects internally constantly; only leaving the host matters."""
    f = _fetcher(_redirect_to("https://www.toronto.ca/services-payments/y/"))
    result = await f.fetch(TORONTO)
    assert result.status_code == 200
    # Stored under the URL that was asked for, which is the point of the check.
    assert result.url == TORONTO
    await f.close()


@pytest.mark.asyncio
async def test_no_redirect_is_fine():
    def handler(request):
        return httpx.Response(200, text="<html>a real page</html>",
                              headers={"content-type": "text/html"})
    f = _fetcher(handler)
    assert (await f.fetch(TORONTO)).status_code == 200
    await f.close()


@pytest.mark.asyncio
async def test_opt_out_exists_for_callers_that_want_it():
    """Kept because a link checker legitimately wants to know where a page lands."""
    f = _fetcher(_redirect_to("https://www.utoronto.ca/"), allow_offsite_redirects=True)
    assert (await f.fetch(TORONTO)).status_code == 200
    await f.close()


def test_blocking_is_the_default():
    assert Fetcher().allow_offsite_redirects is False


# --- subdomains of the same organisation --------------------------------------
# Comparing hostnames exactly was too strict and cost real content. The City runs
# jobs.toronto.ca, haveyoursay.toronto.ca and secure.toronto.ca; treating a
# redirect to those as offsite deleted the Auditor General, the Ombudsman and
# every jobs page before it was caught.

from crawler.fetcher import registrable_domain, same_site  # noqa: E402


@pytest.mark.parametrize("host,expected", [
    ("www.toronto.ca", "toronto.ca"),
    ("jobs.toronto.ca", "toronto.ca"),
    ("toronto.ca", "toronto.ca"),
    ("www.cadillacfairview.com", "cadillacfairview.com"),
])
def test_registrable_domain(host, expected):
    assert registrable_domain(host) == expected


@pytest.mark.parametrize("landed,expected", [
    ("jobs.toronto.ca", True),
    ("haveyoursay.toronto.ca", True),
    ("secure.toronto.ca", True),
    ("toronto.ca", True),
    ("www.utoronto.ca", False),
    ("torontozoo.com", False),
    ("reservation.frontdesksuite.ca", False),
])
def test_same_site(landed, expected):
    assert same_site("www.toronto.ca", landed) is expected


@pytest.mark.asyncio
async def test_city_subdomain_redirect_is_allowed():
    f = _fetcher(_redirect_to("https://jobs.toronto.ca/"))
    result = await f.fetch(TORONTO)
    assert result.status_code == 200
    await f.close()
