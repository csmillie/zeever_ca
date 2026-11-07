import asyncio
import hashlib
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

MAX_RESPONSE_SIZE = 50 * 1024 * 1024  # 50MB


class OffsiteRedirect(Exception):
    """A request left the host it was aimed at.

    Toronto.ca redirects some of its own pages to third parties. The Better
    Buildings Partnership member pages send /services-payments/.../members/
    university-of-toronto/ to utoronto.ca, and there are similar ones for
    Cadillac Fairview, Humber College, Minto and the Catholic school board.

    Following those and storing what comes back under the toronto.ca URL would
    put an unrelated company's homepage in the corpus as City of Toronto content,
    where it would be retrieved and cited as though the City had published it. In
    a re-crawl of 1,342 pages on 2026-08-31, roughly a dozen pages did this and
    were saved only because the destinations returned 403.

    It also means fetching third-party sites that never invited us.

    Carries the two hostnames as attributes. Callers need to know where a page
    landed in order to record the handoff, and the first one that wanted this
    read it back out of the message with a string split, which truncated
    "https://www.ombudsmantoronto.ca" to "https://www" and hid that City
    subdomains were being deleted along with third parties.
    """

    def __init__(self, message: str, asked: str = "", landed: str = ""):
        super().__init__(message)
        self.asked = asked
        self.landed = landed


@dataclass
class FetchResult:
    url: str
    status_code: int
    content_type: str
    raw_content: bytes
    content_hash: str
    headers: dict
    # Where the fetch actually ended up. Equal to url for the ordinary case; it
    # differs when a City-affiliated redirect was followed, and then url holds
    # the destination so the content is stored and cited under the address that
    # actually published it.
    requested_url: str = ""

def registrable_domain(host: str) -> str:
    """The last two labels of a hostname, which is the site for our purposes.

    Comparing hostnames exactly was too strict and cost real content. The City
    runs jobs.toronto.ca, haveyoursay.toronto.ca and secure.toronto.ca, and a
    redirect from www.toronto.ca to any of them is the same organisation, not a
    third party. Treating those as offsite deleted the Auditor General, Ombudsman
    and every jobs page before this was caught.

    Two labels is right for the one site this crawler visits. It would be wrong
    against something under a multi-part suffix such as .gov.on.ca, so if the
    crawler is ever pointed elsewhere this wants a real public suffix list.
    """
    parts = [p for p in (host or "").lower().split(".") if p]
    return ".".join(parts[-2:]) if len(parts) >= 2 else (host or "").lower()


def same_site(asked: str, landed: str) -> bool:
    """Whether a redirect stayed within the organisation that was asked."""
    return registrable_domain(asked) == registrable_domain(landed)


# Official City of Toronto bodies that publish on their own domains.
#
# The Ombudsman and the Auditor General are accountability officers of the City,
# independent by design and on separate domains for exactly that reason. The
# offsite rule is about not passing one organisation's words off as another's,
# and it was doing that correctly here: toronto.ca/.../ombudsman-toronto/ is a
# redirect, so there was no City page to index and no way to answer "how do I
# file a complaint with the Ombudsman". The measured result was an answer citing
# an insurance claims page instead.
#
# So these are fetched, but stored and cited under their own URLs rather than
# under the toronto.ca address that pointed at them. The provenance stays true;
# only the reachability changes.
#
# Deliberately short, and it is not a list of everything the City links to.
# Adding a domain here is a statement that its content is official City material
# a resident would expect a City assistant to know. thetyc.ca and
# mayoroliviachow.ca are not: one is an independent youth organisation, the
# other a councillor's office site. Service platforms such as
# reservation.frontdesksuite.ca are not either; they are covered by recording
# the redirect instead.
CITY_AFFILIATED_DOMAINS = frozenset({
    "ombudsmantoronto.ca",
    "torontoauditor.ca",
})


def is_city_affiliated(host: str) -> bool:
    """Whether a host is an official City body publishing on its own domain."""
    return registrable_domain(host) in CITY_AFFILIATED_DOMAINS


class Fetcher:
    def __init__(self, rate_limit_ms: int = 1000, user_agent: str = "CanadianAI/0.1",
                 allow_offsite_redirects: bool = False):
        self.rate_limit_s = rate_limit_ms / 1000
        self.user_agent = user_agent
        self.allow_offsite_redirects = allow_offsite_redirects
        self._last_fetch: float = 0
        self._client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=30,
            headers={"User-Agent": user_agent},
        )

    async def fetch(self, url: str) -> FetchResult:
        now = asyncio.get_event_loop().time()
        wait = self._last_fetch + self.rate_limit_s - now
        if wait > 0:
            await asyncio.sleep(wait)

        response = await self._client.get(url)
        self._last_fetch = asyncio.get_event_loop().time()

        # A redirect that leaves the requested host means the content is not the
        # page we asked for, whatever the status code says. Three outcomes:
        # it stayed on the site, it reached an official City body on its own
        # domain, or it left for someone else entirely.
        final_url = str(response.url)
        stored_url = url
        if not self.allow_offsite_redirects:
            asked = urlparse(url).hostname or ""
            landed = urlparse(final_url).hostname or ""
            if landed and not same_site(asked, landed):
                if is_city_affiliated(landed):
                    # Store it under the address that actually published it. The
                    # City page was only a pointer, and citing its URL for this
                    # content would be the same misattribution the check exists
                    # to prevent, just with a more sympathetic destination.
                    stored_url = final_url
                else:
                    raise OffsiteRedirect(
                        f"{url} redirected to {landed}. Storing that would put {landed} "
                        f"content in the corpus under a {asked} URL.",
                        asked=asked, landed=landed,
                    )

        # Fix #9 (pipeline): Raise on HTTP errors (4xx/5xx)
        response.raise_for_status()

        # Fix #8 (pipeline): Check response size
        raw = response.content
        if len(raw) > MAX_RESPONSE_SIZE:
            raise ValueError(f"Response too large ({len(raw)} bytes) for {url}")

        content_type = response.headers.get("content-type", "").split(";")[0].strip()

        return FetchResult(
            url=stored_url,
            status_code=response.status_code,
            content_type=content_type,
            raw_content=raw,
            content_hash=hashlib.sha256(raw).hexdigest(),
            headers=dict(response.headers),
            requested_url=url,
        )

    async def close(self):
        await self._client.aclose()
