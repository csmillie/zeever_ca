from urllib.parse import urlparse

from crawler.pdf_classes import REFERENCE, TRANSLATED, classify
from shared.config import settings

# Paths to exclude (login pages, apps, API endpoints, media assets)
EXCLUDE_PATTERNS = [
    "/account/",
    "/wp-admin/",
    "/wp-json/",
    "/feed/",
    "/wp-login",
]


def is_in_scope(url: str) -> bool:
    """Allow all toronto.ca pages except excluded paths."""
    parsed = urlparse(url)
    if parsed.hostname not in ("www.toronto.ca", "toronto.ca"):
        return False
    path = parsed.path.lower()

    # Exclude known non-content paths
    if any(path.startswith(exc) for exc in EXCLUDE_PATTERNS):
        return False

    # Reference and archive PDFs, when switched on. A resident does not ask a
    # service assistant what a committee decided on a Thursday in June, so these
    # documents cost storage and embedding, compete for the five context slots,
    # and cannot usefully answer anything. Only PDFs are considered: the same
    # words appear in HTML page paths that are genuinely about the topic.
    if path.endswith(".pdf"):
        klass = classify(url)
        if getattr(settings, "exclude_reference_pdfs", False) and klass in REFERENCE:
            return False
        # Separate switch, because dropping the other languages is a product
        # decision rather than a retrieval one.
        if getattr(settings, "exclude_translated_pdfs", False) and klass in TRANSLATED:
            return False

    return True
