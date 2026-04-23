import re
from bs4 import BeautifulSoup, NavigableString, Tag
from parser.models import ParsedContent

HEADING_TAGS = {"h1", "h2", "h3", "h4"}
SKIP_TEXTS = {"Skip to content", "Skip to main content", "stopindex", "startindex", "endbuild"}


def _extract_structured_text(element: Tag) -> str:
    """Extract text with double-newlines before headings to create natural section breaks."""
    parts: list[str] = []

    for child in element.descendants:
        if isinstance(child, NavigableString):
            text = child.strip()
            if text and text not in SKIP_TEXTS:
                parts.append(text)
        elif isinstance(child, Tag):
            if child.name in HEADING_TAGS:
                # Double newline before headings to create section boundaries
                parts.append(f"\n\n## {child.get_text(strip=True)}\n")
            elif child.name in ("p", "li", "tr", "div"):
                # Single newline for block elements
                if parts and not parts[-1].endswith("\n"):
                    parts.append("\n")

    return "\n".join(parts)


def parse_html(html: str, url: str) -> ParsedContent:
    soup = BeautifulSoup(html, "lxml")

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    # Remove nav, footer, header, script, style, aside
    for tag in soup.find_all(["nav", "footer", "header", "script", "style", "aside"]):
        tag.decompose()

    # Prefer <main> content, fall back to <body>
    main = soup.find("main") or soup.find("body") or soup
    headings = [h.get_text(strip=True) for h in main.find_all(HEADING_TAGS)]

    text = _extract_structured_text(main)

    # Clean up excessive whitespace while preserving section breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return ParsedContent(url=url, title=title, text=text, headings=headings, source_format="html")
