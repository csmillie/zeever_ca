from unittest.mock import MagicMock
from parser.pipeline import parse_document
import uuid


def _make_raw_doc(url: str, content_type: str, content: bytes) -> MagicMock:
    doc = MagicMock()
    doc.id = uuid.uuid4()
    doc.url = url
    doc.content_type = content_type
    doc.raw_content = content
    return doc


def test_parse_html_document():
    html = b"""<html><head><title>Building Permit Fees</title></head>
    <body><main><h1>Fees</h1><p>The fee for a residential permit is $500.</p></main></body></html>"""

    raw_doc = _make_raw_doc("https://toronto.ca/fees", "text/html", html)
    parsed_doc, chunks = parse_document(raw_doc)

    assert parsed_doc.title == "Building Permit Fees"
    assert parsed_doc.content_type == "fee_schedule"
    assert parsed_doc.source_format == "html"
    assert len(chunks) >= 1
    assert chunks[0].chunk_text != ""


def test_parse_pdf_document():
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Building permit application guide")
    pdf_bytes = doc.tobytes()
    doc.close()

    raw_doc = _make_raw_doc("https://toronto.ca/guide.pdf", "application/pdf", pdf_bytes)
    parsed_doc, chunks = parse_document(raw_doc)

    assert parsed_doc.source_format == "pdf"
    assert len(chunks) >= 1


def test_chunks_have_metadata():
    html = b"""<html><head><title>Test Page</title></head>
    <body><main><p>Content here</p></main></body></html>"""

    raw_doc = _make_raw_doc("https://toronto.ca/test", "text/html", html)
    parsed_doc, chunks = parse_document(raw_doc)

    assert chunks[0].extra_metadata["url"] == "https://toronto.ca/test"
    assert chunks[0].extra_metadata["title"] == "Test Page"
