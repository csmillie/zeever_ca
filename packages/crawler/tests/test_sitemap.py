from crawler.sitemap import parse_sitemap_index, parse_sitemap, extract_permit_urls

SAMPLE_INDEX = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.toronto.ca/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.toronto.ca/page-sitemap2.xml</loc></sitemap>
</sitemapindex>"""

SAMPLE_SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.toronto.ca/services-payments/building-construction/building-permit/</loc></url>
  <url><loc>https://www.toronto.ca/explore-enjoy/recreation/</loc></url>
</urlset>"""

def test_parse_sitemap_index():
    urls = parse_sitemap_index(SAMPLE_INDEX)
    assert len(urls) == 2
    assert "page-sitemap.xml" in urls[0]

def test_parse_sitemap():
    urls = parse_sitemap(SAMPLE_SITEMAP)
    assert len(urls) == 2

def test_extract_permit_urls():
    urls = extract_permit_urls(SAMPLE_SITEMAP)
    # Both URLs are toronto.ca so both are in scope now
    assert len(urls) == 2
    assert any("building-permit" in u for u in urls)
    assert any("recreation" in u for u in urls)
