import pymupdf
from parser.models import ParsedContent


def parse_pdf(pdf_bytes: bytes, url: str) -> ParsedContent:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n\n".join(pages_text).replace("\x00", "")
    # Derive title from URL filename
    title = url.split("/")[-1].replace(".pdf", "").replace("-", " ").replace("_", " ").title()

    return ParsedContent(url=url, title=title, text=full_text, headings=[], source_format="pdf")
