import re
from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from parser.models import ParsedContent

HEADING_TAGS = {"h1", "h2", "h3", "h4"}
SKIP_TEXTS = {"Skip to content", "Skip to main content", "stopindex", "startindex", "endbuild"}


def _extract_structured_text(element: Tag) -> str:
    """Extract text with double-newlines before headings to create natural section breaks."""
    parts: list[str] = []

    # `descendants` yields a heading Tag AND the strings inside it. The Tag branch
    # below renders the heading as "## Text"; without this the string branch then
    # renders it a second time, so every heading in the corpus was stored twice.
    #
    # That is not cosmetic. Headings are short, generic and navigational — "Create a
    # New Account", "Pay Your Bill", "Contact Us" — and doubling them doubles their
    # weight in the chunk embedding. It is why a parks-recreation registration page
    # scored 0.748 on "How do I set up a new water account in Toronto?", outranking
    # every water chunk: half that chunk's content was the phrase "Create a New
    # Account", twice.
    heading_string_ids = {
        id(s)
        for h in element.find_all(HEADING_TAGS)
        for s in h.descendants
        if isinstance(s, NavigableString)
    }

    for child in element.descendants:
        # Comment is a subclass of NavigableString, so the branch below treats one
        # as body text unless it is caught here. The corpus is full of the result:
        # 203 chunks containing "From here to the next endbuild tag, all the
        # files...", 58 containing "Include <span>'s in <figcaption> if you want
        # left *and* right alignment". Those are notes between developers, indexed
        # and embedded as though the City had written them for residents.
        if isinstance(child, Comment):
            continue
        if isinstance(child, NavigableString):
            if id(child) in heading_string_ids:
                continue
            text = child.strip()
            if text and text not in SKIP_TEXTS:
                parts.append(text)
        elif isinstance(child, Tag):
            if child.name in HEADING_TAGS:
                # Double newline before headings to create section boundaries
                # Join on a space: get_text(strip=True) concatenates without one, so a
                # heading containing a link or <em> came out as "Pay YourUtilityBill".
                parts.append(f"\n\n## {child.get_text(' ', strip=True)}\n")
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

    # And the comments, before anything reads the tree. Removed here as well as
    # skipped during extraction: this is the copy that protects `headings`, and a
    # caller that walks the soup itself.
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()

    # Prefer <main> content, fall back to <body>
    main = soup.find("main") or soup.find("body") or soup
    headings = [h.get_text(" ", strip=True) for h in main.find_all(HEADING_TAGS)]

    text = _extract_structured_text(main)

    # Clean up excessive whitespace while preserving section breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return ParsedContent(url=url, title=title, text=text, headings=headings, source_format="html")
