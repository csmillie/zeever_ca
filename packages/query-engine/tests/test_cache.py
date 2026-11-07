from query_engine.cache import _compute_chunk_hash


def test_chunk_hash_deterministic():
    chunks = [{"id": "abc"}, {"id": "def"}]
    h1 = _compute_chunk_hash(chunks)
    h2 = _compute_chunk_hash(chunks)
    assert h1 == h2


def test_chunk_hash_order_independent():
    chunks_a = [{"id": "abc"}, {"id": "def"}]
    chunks_b = [{"id": "def"}, {"id": "abc"}]
    assert _compute_chunk_hash(chunks_a) == _compute_chunk_hash(chunks_b)


def test_chunk_hash_changes_with_different_chunks():
    chunks_a = [{"id": "abc"}, {"id": "def"}]
    chunks_b = [{"id": "abc"}, {"id": "xyz"}]
    assert _compute_chunk_hash(chunks_a) != _compute_chunk_hash(chunks_b)


def test_chunk_hash_uses_url_fallback():
    chunks = [{"url": "https://toronto.ca/test"}]
    h = _compute_chunk_hash(chunks)
    assert len(h) == 16


# --- the key has to cover everything that changes the answer ------------------
# It hashed the retrieved chunk IDs alone, which catches a re-crawl and nothing
# else. Two other inputs change an answer for identical chunks.

from unittest.mock import patch  # noqa: E402

CHUNKS = [{"id": "a", "url": "https://www.toronto.ca/x/"},
          {"id": "b", "url": "https://www.toronto.ca/y/"}]


def test_mode_changes_the_key():
    """mode=graph adds graph context to the prompt, so its answer is not
    interchangeable with a vector answer over the same chunks. Latent today,
    because the graph has never been built, and live the moment it is."""
    assert _compute_chunk_hash(CHUNKS, "vector") != _compute_chunk_hash(CHUNKS, "graph")


def test_the_prompt_variant_changes_the_key():
    """Switching system_prompt_variant in .env has to invalidate what was written
    under the old prompt. Otherwise the operator changes the prompt, sees cached
    answers unchanged, and concludes the prompt does not matter."""
    a = _compute_chunk_hash(CHUNKS, "vector", prompt_variant="v1")
    b = _compute_chunk_hash(CHUNKS, "vector", prompt_variant="grounded")
    assert a != b


def test_the_same_inputs_give_the_same_key():
    assert _compute_chunk_hash(CHUNKS, "vector") == _compute_chunk_hash(CHUNKS, "vector")


def test_chunk_order_does_not_change_the_key():
    """Retrieval order varies between backends; the content is what matters."""
    assert _compute_chunk_hash(CHUNKS, "vector") == \
        _compute_chunk_hash(list(reversed(CHUNKS)), "vector")


def test_different_chunks_change_the_key():
    """The original purpose, still working: a re-crawl invalidates the entry."""
    other = [{"id": "a", "url": "https://www.toronto.ca/x/"}]
    assert _compute_chunk_hash(CHUNKS, "vector") != _compute_chunk_hash(other, "vector")


def test_the_variant_falls_back_to_settings():
    """Callers do not pass the variant; it is read from settings, so the key
    tracks the deployed prompt without every call site knowing about it."""
    with patch.object(__import__("query_engine.cache", fromlist=["settings"]),
                      "settings", type("S", (), {"system_prompt_variant": "grounded"})()):
        assert _compute_chunk_hash(CHUNKS, "vector") == \
            _compute_chunk_hash(CHUNKS, "vector", prompt_variant="grounded")
