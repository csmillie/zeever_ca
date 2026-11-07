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


def test_html_comments_are_not_indexed_as_content():
    """Comment subclasses NavigableString, so the text branch treated developer
    notes as body copy. The corpus carries the evidence: 203 chunks contain "From
    here to the next endbuild tag, all the files...", 58 contain "Include <span>'s
    in <figcaption> if you want left *and* right alignment". Those are notes
    between developers, embedded as though the City wrote them for residents, and
    they were identical across hundreds of pages, so they also competed with each
    other for context slots."""
    html = """
    <html><body><main>
      <h2>Apply for a Building Permit</h2>
      <!-- From here to the next endbuild tag, all the files are cached -->
      <p>Submit your application online.</p>
      <!-- Include <span>'s in <figcaption> if you want left *and* right alignment -->
    </main></body></html>
    """
    parsed = parse_html(html, "https://www.toronto.ca/x/")
    assert "Submit your application online." in parsed.text
    assert "endbuild" not in parsed.text
    assert "figcaption" not in parsed.text
    assert "cached" not in parsed.text


def test_a_comment_does_not_take_a_heading_with_it():
    """The comments are removed from the tree before headings are read, so the
    removal must not disturb the surrounding content."""
    html = """
    <html><body><main>
      <!-- nav starts -->
      <h2>Garbage Collection</h2>
      <p>Bins go out Tuesday.</p>
      <!-- nav ends -->
    </main></body></html>
    """
    parsed = parse_html(html, "https://www.toronto.ca/y/")
    assert parsed.headings == ["Garbage Collection"]
    assert "Bins go out Tuesday." in parsed.text
    assert "nav starts" not in parsed.text


def test_conditional_comments_do_not_survive_either():
    """Old templates carry IE conditionals. They are comments too, and their
    contents are markup that reads as gibberish once flattened."""
    html = """
    <html><body><main>
      <!--[if lt IE 9]><script src="html5shiv.js"></script><![endif]-->
      <p>Pay your utility bill online.</p>
    </main></body></html>
    """
    parsed = parse_html(html, "https://www.toronto.ca/z/")
    assert "Pay your utility bill online." in parsed.text
    assert "html5shiv" not in parsed.text
    assert "IE 9" not in parsed.text
