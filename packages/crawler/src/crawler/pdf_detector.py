from urllib.parse import urljoin
from bs4 import BeautifulSoup

def extract_pdf_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        if full_url.lower().endswith(".pdf"):
            pdf_links.append(full_url)
    return list(set(pdf_links))
