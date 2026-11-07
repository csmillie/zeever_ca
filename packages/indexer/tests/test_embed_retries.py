"""A momentary provider fault must not throw away a 40 minute run.

On 2026-09-09 a re-crawl of 2,269 pages crawled and parsed cleanly, then died at
embedding batch 67 of 127 with "upstream connect error or disconnect/reset before
headers". 6,003 chunks were left with no embedding, and retrieval filters on
`embedding IS NOT NULL`, so a large part of one section was unsearchable until
someone counted rows.

What matters here is the distinction between faults worth retrying and faults
worth reporting: retrying a rejected API key five times only delays the message
that would have fixed it.
"""
from unittest.mock import MagicMock, patch

import httpx
import openai
import pytest

from indexer import embedder


def _vectors(n):
    return MagicMock(data=[MagicMock(embedding=[0.1] * 768) for _ in range(n)])


def _response(status):
    return httpx.Response(status, request=httpx.Request("POST", "https://x/v1/embeddings"))


@pytest.fixture(autouse=True)
def no_sleeping():
    """The backoff is real and the test should not wait for it."""
    with patch.object(embedder.time, "sleep"):
        yield


def _single_endpoint(client):
    """Pin the chain to one endpoint whose client is the mock.

    These tests are about what happens *within* one endpoint -- what gets
    retried, what does not, and what the message says when it gives up. Failover
    between endpoints is test_embedding_failover.py. Forcing a one-endpoint
    chain keeps each file testing one thing, and keeps these assertions on
    call_count meaningful.
    """
    ep = embedder.Endpoint("test", "http://x/v1", "k", "m", limit=None)
    ep.client = lambda: client
    return patch.object(embedder, "build_endpoints", return_value=[ep])


def test_a_transient_upstream_error_is_retried():
    client = MagicMock()
    client.embeddings.create.side_effect = [
        openai.InternalServerError("upstream connect error", response=_response(500), body=None),
        _vectors(2),
    ]
    with _single_endpoint(client):
        vectors = embedder.embed_texts(["a", "b"])
    assert len(vectors) == 2
    assert client.embeddings.create.call_count == 2


def test_a_connection_reset_is_retried():
    """The failure that actually happened arrived as a dropped connection."""
    client = MagicMock()
    client.embeddings.create.side_effect = [
        openai.APIConnectionError(request=httpx.Request("POST", "https://x")),
        openai.APITimeoutError(request=httpx.Request("POST", "https://x")),
        _vectors(1),
    ]
    with _single_endpoint(client):
        assert len(embedder.embed_texts(["a"])) == 1
    assert client.embeddings.create.call_count == 3


def test_a_rejected_key_is_not_retried():
    """401 will not fix itself. Retrying it five times with backoff only delays
    the message that names the problem."""
    client = MagicMock()
    client.embeddings.create.side_effect = openai.AuthenticationError(
        "invalid key", response=_response(401), body=None)
    with _single_endpoint(client):
        with pytest.raises(openai.AuthenticationError):
            embedder.embed_texts(["a"])
    assert client.embeddings.create.call_count == 1


def test_a_persistent_failure_says_the_work_so_far_is_saved():
    """The caller writes embeddings per batch, so an abort keeps what it had. The
    message has to say so, or the next person re-runs from the beginning."""
    client = MagicMock()
    client.embeddings.create.side_effect = openai.InternalServerError(
        "still down", response=_response(503), body=None)
    with _single_endpoint(client):
        with pytest.raises(RuntimeError, match="re-run to continue"):
            embedder.embed_texts(["a"])
    assert client.embeddings.create.call_count == embedder.MAX_ATTEMPTS
