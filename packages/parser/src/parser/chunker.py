import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    chunk_index: int
    token_count: int
    heading: str = ""


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~1.33 tokens per word."""
    return int(len(text.split()) * 1.33)


def _split_into_sections(text: str) -> list[tuple[str, str]]:
    """Split text into (heading, body) sections at ## markers.

    Returns a list of (heading, section_text) tuples.
    Sections without headings get an empty string heading.
    """
    # Split on lines that start with ##
    parts = re.split(r'\n\n(?=## )', text)
    sections = []

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if part.startswith("## "):
            lines = part.split("\n", 1)
            heading = lines[0].replace("## ", "").strip()
            body = lines[1].strip() if len(lines) > 1 else ""
            sections.append((heading, f"{heading}\n{body}" if body else heading))
        else:
            sections.append(("", part))

    return sections


def chunk_text(text: str, max_tokens: int = 500, overlap_tokens: int = 50) -> list[Chunk]:
    """Chunk text, preferring heading boundaries when available."""
    if _estimate_tokens(text) <= max_tokens:
        return [Chunk(text=text, chunk_index=0, token_count=_estimate_tokens(text))]

    sections = _split_into_sections(text)

    # If no sections found, fall back to paragraph splitting
    if len(sections) <= 1:
        return _chunk_by_paragraphs(text, max_tokens, overlap_tokens)

    # Group sections into chunks that fit within max_tokens
    chunks: list[Chunk] = []
    current_parts: list[str] = []
    current_heading = ""
    current_tokens = 0

    for heading, section_text in sections:
        section_tokens = _estimate_tokens(section_text)

        # If this section alone exceeds max_tokens, sub-chunk it
        if section_tokens > max_tokens:
            # Flush current buffer
            if current_parts:
                chunk_text_str = "\n\n".join(current_parts)
                chunks.append(Chunk(
                    text=chunk_text_str,
                    chunk_index=len(chunks),
                    token_count=_estimate_tokens(chunk_text_str),
                    heading=current_heading,
                ))
                current_parts = []
                current_tokens = 0
                current_heading = ""

            # Sub-chunk the oversized section
            sub_chunks = _chunk_by_paragraphs(section_text, max_tokens, overlap_tokens)
            for sc in sub_chunks:
                sc.chunk_index = len(chunks)
                sc.heading = heading
                chunks.append(sc)
            continue

        # Would adding this section exceed the limit?
        if current_tokens + section_tokens > max_tokens and current_parts:
            chunk_text_str = "\n\n".join(current_parts)
            chunks.append(Chunk(
                text=chunk_text_str,
                chunk_index=len(chunks),
                token_count=_estimate_tokens(chunk_text_str),
                heading=current_heading,
            ))
            current_parts = []
            current_tokens = 0
            current_heading = ""

        if not current_heading and heading:
            current_heading = heading
        current_parts.append(section_text)
        current_tokens += section_tokens

    if current_parts:
        chunk_text_str = "\n\n".join(current_parts)
        chunks.append(Chunk(
            text=chunk_text_str,
            chunk_index=len(chunks),
            token_count=_estimate_tokens(chunk_text_str),
            heading=current_heading,
        ))

    return chunks


def _chunk_by_paragraphs(text: str, max_tokens: int, overlap_tokens: int) -> list[Chunk]:
    """Fallback: chunk by double-newline paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks: list[Chunk] = []
    current_parts: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_tokens = _estimate_tokens(para)

        if current_tokens + para_tokens > max_tokens and current_parts:
            chunk_text_str = "\n\n".join(current_parts)
            chunks.append(Chunk(
                text=chunk_text_str,
                chunk_index=len(chunks),
                token_count=_estimate_tokens(chunk_text_str),
            ))
            overlap_text = current_parts[-1] if current_parts else ""
            if _estimate_tokens(overlap_text) <= overlap_tokens:
                current_parts = [overlap_text]
                current_tokens = _estimate_tokens(overlap_text)
            else:
                current_parts = []
                current_tokens = 0

        current_parts.append(para)
        current_tokens += para_tokens

    if current_parts:
        chunk_text_str = "\n\n".join(current_parts)
        chunks.append(Chunk(
            text=chunk_text_str,
            chunk_index=len(chunks),
            token_count=_estimate_tokens(chunk_text_str),
        ))

    return chunks
