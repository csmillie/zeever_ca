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
