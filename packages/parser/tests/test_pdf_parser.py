import pymupdf
from parser.pdf_parser import parse_pdf


def make_test_pdf(text: str) -> bytes:
    """Create a minimal PDF with the given text."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_parse_pdf_extracts_text():
    pdf = make_test_pdf("Building permit application guide for Toronto.")
    result = parse_pdf(pdf, "https://www.toronto.ca/docs/permit-guide.pdf")
    assert "Building permit" in result.text or "permit" in result.text.lower()


def test_parse_pdf_sets_format():
    pdf = make_test_pdf("Test content")
    result = parse_pdf(pdf, "https://www.toronto.ca/docs/test.pdf")
    assert result.source_format == "pdf"


def test_parse_pdf_derives_title():
    pdf = make_test_pdf("Test")
    result = parse_pdf(pdf, "https://www.toronto.ca/docs/building-permit-guide.pdf")
    assert result.title == "Building Permit Guide"


def test_parse_pdf_url():
    pdf = make_test_pdf("Test")
    result = parse_pdf(pdf, "https://www.toronto.ca/docs/test.pdf")
    assert result.url == "https://www.toronto.ca/docs/test.pdf"
