from parser.chunker import chunk_text, Chunk, _estimate_tokens, _split_into_sections


def test_short_text_single_chunk():
    chunks = chunk_text("Short text.", max_tokens=500, overlap_tokens=50)
    assert len(chunks) == 1
    assert chunks[0].text == "Short text."
    assert chunks[0].chunk_index == 0


def test_long_text_multiple_chunks():
    paragraphs = ["This is paragraph number %d with some content." % i for i in range(50)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_text(text, max_tokens=50, overlap_tokens=10)
    assert len(chunks) > 1


def test_chunk_indices_sequential():
    paragraphs = ["Paragraph %d content here." % i for i in range(30)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_text(text, max_tokens=30, overlap_tokens=5)
    for i, chunk in enumerate(chunks):
        assert chunk.chunk_index == i


def test_chunks_have_content():
    paragraphs = ["Content block %d." % i for i in range(20)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_text(text, max_tokens=30, overlap_tokens=5)
    for chunk in chunks:
        assert chunk.text.strip() != ""
        assert chunk.token_count > 0


def test_estimate_tokens():
    assert _estimate_tokens("hello world") > 0
    assert _estimate_tokens("one two three four five") > _estimate_tokens("one two")


def test_empty_paragraphs_skipped():
    text = "First paragraph.\n\n\n\nSecond paragraph."
    chunks = chunk_text(text, max_tokens=500)
    assert len(chunks) == 1
    assert "First paragraph" in chunks[0].text
    assert "Second paragraph" in chunks[0].text


def test_heading_aware_chunking():
    text = """Introduction paragraph.

## Building Permits
You need a building permit for construction.

## Fees
The fee is calculated based on square footage.

## Inspections
Inspections are required at various stages."""

    chunks = chunk_text(text, max_tokens=30, overlap_tokens=5)
    assert len(chunks) > 1
    # Each heading section should be in its own chunk when small enough
    all_text = " ".join(c.text for c in chunks)
    assert "Building Permits" in all_text
    assert "Fees" in all_text
    assert "Inspections" in all_text


def test_heading_preserved_in_chunk():
    text = """## When Do You Need a Permit
You need a permit for decks, fences, and renovations. This includes structural work, electrical, plumbing, and HVAC modifications.

## Express Permits
Small projects may qualify for express processing. This includes minor renovations under a certain threshold."""

    chunks = chunk_text(text, max_tokens=20)
    assert len(chunks) >= 2
    assert any(c.heading for c in chunks)


def test_split_into_sections():
    text = """Intro text.

## Section One
Content one.

## Section Two
Content two."""

    sections = _split_into_sections(text)
    assert len(sections) == 3  # intro + 2 headed sections
    assert sections[0][0] == ""  # intro has no heading
    assert sections[1][0] == "Section One"
    assert sections[2][0] == "Section Two"
