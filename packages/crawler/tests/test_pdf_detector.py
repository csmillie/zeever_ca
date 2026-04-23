from crawler.pdf_detector import extract_pdf_links

SAMPLE_HTML = """
<html><body>
<a href="/wp-content/uploads/permit-guide.pdf">Guide</a>
<a href="/services-payments/building-construction/">Building</a>
<a href="https://www.toronto.ca/docs/form.pdf">Form</a>
</body></html>
"""

def test_extract_pdf_links():
    links = extract_pdf_links(SAMPLE_HTML, "https://www.toronto.ca/test/")
    assert len(links) == 2
    assert all(link.endswith(".pdf") for link in links)
    assert all(link.startswith("https://") for link in links)

def test_no_pdfs():
    html = "<html><body><a href='/page'>Page</a></body></html>"
    links = extract_pdf_links(html, "https://www.toronto.ca/")
    assert len(links) == 0

def test_deduplicates():
    html = """<html><body>
    <a href="/doc.pdf">Link 1</a>
    <a href="/doc.pdf">Link 2</a>
    </body></html>"""
    links = extract_pdf_links(html, "https://www.toronto.ca/")
    assert len(links) == 1
