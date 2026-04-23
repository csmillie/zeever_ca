from parser.html_parser import parse_html

SAMPLE_PAGE = """
<html><head><title>When Do I Need a Building Permit</title></head>
<body>
<nav>Menu items here</nav>
<main>
<h1>When Do I Need a Building Permit?</h1>
<p>You need a building permit for most construction projects.</p>
<h2>Projects That Need a Permit</h2>
<ul><li>New construction</li><li>Additions</li></ul>
<h3>Exemptions</h3>
<p>Minor repairs may not need a permit.</p>
</main>
<footer>Footer content here</footer>
</body></html>
"""


def test_parse_html_extracts_title():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert result.title == "When Do I Need a Building Permit"


def test_parse_html_strips_nav_footer():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert "Menu items" not in result.text
    assert "Footer content" not in result.text


def test_parse_html_preserves_content():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert "building permit for most construction" in result.text
    assert "New construction" in result.text


def test_parse_html_captures_headings():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert "When Do I Need a Building Permit?" in result.headings
    assert "Projects That Need a Permit" in result.headings
    assert "Exemptions" in result.headings


def test_parse_html_sets_format():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert result.source_format == "html"


def test_parse_html_sets_url():
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert result.url == "https://www.toronto.ca/test/"


def test_parse_html_creates_section_breaks():
    """Headings should create double-newline section breaks for chunking."""
    result = parse_html(SAMPLE_PAGE, "https://www.toronto.ca/test/")
    assert "\n\n## Projects That Need a Permit" in result.text
    assert "\n\n## Exemptions" in result.text


def test_parse_html_strips_skip_to_content():
    html = """<html><body><main>
    <a href="#content">Skip to content</a>
    <h1>Title</h1>
    <p>Content here.</p>
    </main></body></html>"""
    result = parse_html(html, "https://www.toronto.ca/test/")
    assert "Skip to content" not in result.text
    assert "Content here" in result.text
