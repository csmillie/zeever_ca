"""Record where a City page hands a resident off, when it hands them off entirely.

Some toronto.ca pages are not pages. They are redirects to a service run by
somebody else: twelve immunization and clinic pages go to
reservation.frontdesksuite.ca, recreation booking goes to activecommunities.com,
job applications go to career17.sapsf.com, the health chat goes to comm100.com.

The fetcher refuses to store what comes back, and it is right to. That content
belongs to the operator, not the City, and filing it under a toronto.ca URL would
cite the City for words it did not write.

But refusing leaves nothing at all, and the question a resident actually asks is
"how do I book a vaccine appointment". The honest answer is not silence; it is
"the City sends you here". So this stores the handoff itself: what the City page
was for, and where it goes. No content from the destination is fetched or kept.

These records are deliberately thin. They are meant to be retrieved when someone
asks for a service that lives elsewhere, and to lose to a real page whenever one
exists, which shorter text does naturally.
"""
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select

from shared.models import DocumentChunk, ParsedDocument

# Its own source_format so these can be counted, excluded from a corpus audit, or
# removed wholesale without touching parsed pages.
SOURCE_FORMAT = "redirect"

# Path segments that describe the site's structure rather than the service, and
# would otherwise turn "immunization/.../rsv-vaccination-clinics" into a title
# repeating words nobody searched for.
_SKIP_SEGMENTS = {
    "home", "index", "en", "www", "toronto-public-health-appointment-booking-system",
}


def service_name(url: str) -> str:
    """A readable name for the service, from the last meaningful path segment.

    The last segment is the specific thing: covid-19-vaccination-clinics rather
    than the immunization section holding it. A redirect page that ends in a
    structural segment falls back to the one before it.
    """
    segments = [s for s in urlparse(url or "").path.split("/") if s]
    for segment in reversed(segments):
        # "redirect" anywhere in the segment, not just as a suffix. The real
        # ones are echat-redirect-page, whats-new-redirect-2 and
        # ombudsman-website-redirect; a suffix test catches only the last.
        if segment.lower() in _SKIP_SEGMENTS or "redirect" in segment.lower():
            continue
        words = re.split(r"[-_]+", segment)
        return " ".join(w.capitalize() if w.islower() else w for w in words if w)
    return "City of Toronto service"


def redirect_text(asked_url: str, landed_url: str) -> str:
    """What gets indexed: the handoff, stated plainly and without borrowed content.

    Written so an answer built from it is honest on its own. It names the operator
    rather than implying the City wrote the destination, and it gives the address
    a resident needs, which is the entire useful content of a redirect page.
    """
    name = service_name(asked_url)
    operator = urlparse(landed_url).hostname or "an external service"
    return (
        f"{name}\n\n"
        f"The City of Toronto does not run this service on toronto.ca. The City page "
        f"for {name.lower()} redirects to {operator}, which is where the service is "
        f"actually provided.\n\n"
        f"City page: {asked_url}\n"
        f"Service is provided at: {landed_url}\n\n"
        f"To use this service, go to {landed_url}. That site is operated by "
        f"{operator}, not by the City of Toronto, so its content is not part of "
        f"the City's published information."
    )


def record_redirect(session, asked_url: str, landed_url: str) -> ParsedDocument | None:
    """Store, or refresh, the record of one City page redirecting off-site.

    Returns the ParsedDocument, or None if the arguments were unusable.

    Rewrites in place when the record already exists. A redirect destination
    changes — the health chat provider and the recreation booking system have
    both moved — and appending instead would leave the old address retrievable
    beside the new one, which is worse than not having it.

    Does not commit. The caller owns the transaction, so a crawl that fails part
    way does not leave half its redirects recorded.
    """
    if not asked_url or not landed_url:
        return None

    existing = session.execute(
        select(ParsedDocument).where(
            ParsedDocument.url == asked_url,
            ParsedDocument.source_format == SOURCE_FORMAT,
        )
    ).scalars().first()

    text = redirect_text(asked_url, landed_url)
    title = f"{service_name(asked_url)} (City of Toronto redirect)"
    now = datetime.now(timezone.utc)

    if existing is not None:
        # Drop the old chunk rather than update it: a stale embedding for the
        # previous destination would keep matching and keep citing the old
        # address. The embed step picks the replacement up on its next run.
        for chunk in list(existing.chunks):
            session.delete(chunk)
        existing.title = title
        existing.content_text = text
        existing.word_count = len(text.split())
        existing.parsed_at = now
        existing.extra_metadata = {"redirects_to": landed_url}
        doc = existing
    else:
        doc = ParsedDocument(
            url=asked_url,
            title=title,
            content_text=text,
            content_type="service_redirect",
            source_format=SOURCE_FORMAT,
            word_count=len(text.split()),
            parsed_at=now,
            extra_metadata={"redirects_to": landed_url},
        )
        session.add(doc)
    session.flush()

    # One chunk. The text is short by design and splitting it would separate the
    # service name from the address, leaving a chunk that says a redirect exists
    # without saying where it goes.
    session.add(DocumentChunk(
        parsed_document_id=doc.id,
        chunk_index=0,
        chunk_text=text,
        token_count=len(text.split()),
        created_at=now,
        extra_metadata={
            "title": title,
            "url": asked_url,
            "content_type": "service_redirect",
            "redirects_to": landed_url,
        },
    ))
    return doc
