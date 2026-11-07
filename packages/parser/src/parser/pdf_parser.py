import re

import pymupdf
from parser.models import ParsedContent

# Toronto prefixes every upload with four hex characters, so a filename-derived
# title starts with noise: "9594 Generalutilitybrochure".
_UPLOAD_PREFIX = re.compile(r"^[0-9a-f]{4}[-_]", re.I)

# Titles a PDF writer left behind rather than titles anyone chose. "Microsoft Word
# - 9594.docx" is the common one, and it is worse than the filename because it
# looks deliberate.
_JUNK_TITLE = re.compile(
    r"^(microsoft\s+word|microsoft\s+powerpoint|untitled|document\d*|print|"
    r"adobe|slide\s*\d+|page\s*\d+)\b|"
    r"\.(docx?|pptx?|indd|pdf|pub|xlsx?)\s*$",
    re.I,
)


def _from_filename(url: str) -> str:
    stem = url.split("/")[-1].removesuffix(".pdf")
    stem = _UPLOAD_PREFIX.sub("", stem)
    return stem.replace("-", " ").replace("_", " ").strip(" .").title()


def _usable_metadata_title(raw: str | None, url: str) -> str | None:
    """The document's own title, when it is a title and not an artefact.

    Worth trying before the filename because the filename is frequently
    unreadable: the utility billing application is stored as
    8ccb-MonthlyUtilityBillingApplication.pdf and carries the metadata title
    "Monthly Utility Billing Option". That string is both embedded and shown to a
    reader as the citation, so the difference is not cosmetic.
    """
    title = " ".join((raw or "").split())
    if len(title) < 4 or len(title) > 200:
        return None
    if _JUNK_TITLE.search(title):
        return None
    # A title that is just the filename adds nothing and hides nothing.
    stem = url.split("/")[-1].removesuffix(".pdf").lower()
    if title.lower().replace(" ", "") in (stem.replace("-", "").replace("_", ""),):
        return None
    # All digits, or no letters at all, is an identifier rather than a title.
    if not any(c.isalpha() for c in title):
        return None
    return title


def parse_pdf(pdf_bytes: bytes, url: str) -> ParsedContent:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    metadata = doc.metadata or {}
    doc.close()

    full_text = "\n\n".join(pages_text).replace("\x00", "")
    title = _usable_metadata_title(metadata.get("title"), url) or _from_filename(url)

    return ParsedContent(url=url, title=title, text=full_text, headings=[], source_format="pdf")
