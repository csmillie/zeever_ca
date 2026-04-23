import xml.etree.ElementTree as ET
from crawler.url_filter import is_in_scope

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

def parse_sitemap_index(xml_content: str) -> list[str]:
    root = ET.fromstring(xml_content)
    return [loc.text for loc in root.findall(".//sm:sitemap/sm:loc", NS) if loc.text]

def parse_sitemap(xml_content: str) -> list[str]:
    root = ET.fromstring(xml_content)
    return [loc.text for loc in root.findall(".//sm:url/sm:loc", NS) if loc.text]

def parse_sitemap_with_dates(xml_content: str) -> list[dict]:
    """Parse sitemap and return URLs with their lastmod dates."""
    root = ET.fromstring(xml_content)
    results = []
    for url_el in root.findall(".//sm:url", NS):
        loc = url_el.find("sm:loc", NS)
        lastmod = url_el.find("sm:lastmod", NS)
        if loc is not None and loc.text:
            results.append({
                "url": loc.text,
                "lastmod": lastmod.text if lastmod is not None else None,
            })
    return results

def extract_permit_urls(xml_content: str) -> list[str]:
    return [url for url in parse_sitemap(xml_content) if is_in_scope(url)]

def extract_urls_with_dates(xml_content: str) -> list[dict]:
    """Extract in-scope URLs with their lastmod dates."""
    return [entry for entry in parse_sitemap_with_dates(xml_content) if is_in_scope(entry["url"])]
