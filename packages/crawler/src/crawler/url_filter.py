from urllib.parse import urlparse

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

    return True
