"""One embedding endpoint being down must not take the site down.

Retrieval embeds the question before it can search, and before it can even ask
the semantic cache whether the answer is already known. So an unreachable
embedding endpoint is not a crawling problem that waits for morning -- it is
every query on the site failing, including the ones whose answers are already
cached.

The retry logic in test_embed_retries.py covers a provider having a bad second.
It cannot cover a host being switched off, which is what a chain is for.
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
    with patch.object(embedder.time, "sleep"):
        yield


def _endpoint(label, client, limit=None):
    ep = embedder.Endpoint(label, "http://x/v1", "k", "m", limit=limit)
    ep.client = lambda: client
    return ep


def _settings(**over):
    base = dict(
        embedding_base_url="", embedding_base_url_2="",
        embedding_model="nomic-embed-text", embedding_api_key="ollama",
        fireworks_api_key="", fireworks_base_url="https://fw/v1",
    )
    base.update(over)
    return MagicMock(**base)


# --- the chain itself -------------------------------------------------------

def test_no_configuration_at_all_says_so():
    """Rather than a failure from inside the OpenAI client about a blank URL."""
    with patch.object(embedder, "settings", _settings()):
        with pytest.raises(RuntimeError, match="No embedding endpoint is configured"):
            embedder.build_endpoints()


def test_fireworks_alone_is_the_old_behaviour():
    with patch.object(embedder, "settings", _settings(fireworks_api_key="fw-key")):
        chain = embedder.build_endpoints()
    assert [e.label for e in chain] == ["fireworks"]
    assert chain[0].limit is None


def test_self_hosted_comes_first_and_fireworks_last():
    with patch.object(embedder, "settings", _settings(
            embedding_base_url="http://nvidia:11434/v1",
            embedding_base_url_2="http://amd:11434/v1",
            fireworks_api_key="fw-key")):
        chain = embedder.build_endpoints()
    assert [e.label for e in chain] == ["self-hosted-1", "self-hosted-2", "fireworks"]


def test_the_self_hosted_endpoints_use_ollamas_name_for_the_model():
    """Same weights, different name. Sending Fireworks' spelling to Ollama 404s."""
    with patch.object(embedder, "settings", _settings(
            embedding_base_url="http://nvidia:11434/v1", fireworks_api_key="fw-key")):
        chain = embedder.build_endpoints()
    assert chain[0].model == "nomic-embed-text"
    assert chain[1].model == embedder.DEFAULT_MODEL


# --- failing over -----------------------------------------------------------

def test_a_dead_first_endpoint_falls_through_to_the_second():
    dead = MagicMock()
    dead.embeddings.create.side_effect = openai.APIConnectionError(
        request=httpx.Request("POST", "http://nvidia:11434/v1"))
    alive = MagicMock()
    alive.embeddings.create.return_value = _vectors(2)

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", dead),
                                    _endpoint("fireworks", alive)]):
        vectors = embedder.embed_texts(["a", "b"])

    assert len(vectors) == 2
    assert alive.embeddings.create.call_count == 1


def test_the_whole_batch_is_re_embedded_on_the_endpoint_that_works():
    """Not resumed from where the dead one stopped.

    Splitting one batch across two providers would be defensible if it were
    recorded anywhere. It is not, so a half-written batch would leave the corpus
    in a state the logs cannot explain. Re-embedding 100 chunks costs seconds.
    """
    half_dead = MagicMock()
    half_dead.embeddings.create.side_effect = [
        _vectors(100),
        openai.APIConnectionError(request=httpx.Request("POST", "http://x")),
        openai.APIConnectionError(request=httpx.Request("POST", "http://x")),
        openai.APIConnectionError(request=httpx.Request("POST", "http://x")),
        openai.APIConnectionError(request=httpx.Request("POST", "http://x")),
        openai.APIConnectionError(request=httpx.Request("POST", "http://x")),
    ]
    alive = MagicMock()
    alive.embeddings.create.side_effect = lambda model, input: _vectors(len(input))

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", half_dead),
                                    _endpoint("fireworks", alive)]):
        vectors = embedder.embed_texts([f"t{i}" for i in range(150)])

    assert len(vectors) == 150
    # 100 + 50: the full list, not the 50 the first endpoint had left.
    assert [len(c.kwargs["input"]) for c in alive.embeddings.create.call_args_list] == [100, 50]


def test_when_everything_is_down_the_real_error_survives():
    """"Every endpoint failed" is not a diagnosis. The rejected key is."""
    bad_key = MagicMock()
    bad_key.embeddings.create.side_effect = openai.AuthenticationError(
        "invalid key", response=_response(401), body=None)

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", bad_key),
                                    _endpoint("fireworks", bad_key)]):
        with pytest.raises(openai.AuthenticationError, match="invalid key"):
            embedder.embed_texts(["a"])


# --- the truncation guard ---------------------------------------------------

def test_text_over_the_self_hosted_limit_is_refused_not_truncated():
    """The failure this exists for is silent.

    Ollama accepts 3,000 tokens, embeds the first 2,048, and returns a
    well-formed 768-dimension vector. Nothing errors. The vector is simply for a
    different document than the one stored beside it -- measured at 0.53 cosine
    against the untruncated version, which is what two unrelated pages score.
    """
    client = MagicMock()
    client.embeddings.create.return_value = _vectors(1)
    ep = _endpoint("self-hosted-1", client, limit=embedder.OLLAMA_INPUT_LIMIT)

    with patch.object(embedder, "build_endpoints", return_value=[ep]):
        with pytest.raises(ValueError, match="would be truncated|over self-hosted-1"):
            embedder.embed_texts(["word " * (embedder.OLLAMA_INPUT_LIMIT + 1)])

    assert client.embeddings.create.call_count == 0


def test_oversized_text_does_not_fail_over_to_the_provider_with_room():
    """Falling through to Fireworks here would work, and would be wrong.

    It would turn a chunker bug into a silent bill, and the corpus would end up
    with a handful of chunks embedded by a provider nobody chose, discovered
    when the invoice arrives rather than when the chunk is written.
    """
    local = MagicMock()
    remote = MagicMock()
    remote.embeddings.create.return_value = _vectors(1)

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", local,
                                              limit=embedder.OLLAMA_INPUT_LIMIT),
                                    _endpoint("fireworks", remote)]):
        with pytest.raises(ValueError):
            embedder.embed_texts(["word " * 5000])

    assert remote.embeddings.create.call_count == 0


def test_text_under_the_limit_is_embedded_normally():
    client = MagicMock()
    client.embeddings.create.return_value = _vectors(1)
    ep = _endpoint("self-hosted-1", client, limit=embedder.OLLAMA_INPUT_LIMIT)

    with patch.object(embedder, "build_endpoints", return_value=[ep]):
        assert len(embedder.embed_texts(["word " * 100])) == 1


def test_fireworks_has_no_limit_applied():
    """Its window is 8,192, so the guard must not fire on text it can handle."""
    client = MagicMock()
    client.embeddings.create.return_value = _vectors(1)

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("fireworks", client, limit=None)]):
        assert len(embedder.embed_texts(["word " * 5000])) == 1


def test_an_empty_list_asks_nobody():
    with patch.object(embedder, "build_endpoints", side_effect=AssertionError("built a chain")):
        assert embedder.embed_texts([]) == []


# --- how long failing over is allowed to take -------------------------------

def test_a_dead_endpoint_with_somewhere_to_go_is_not_retried_five_times():
    """Sixteen seconds of backoff in front of a query nobody can answer yet.

    Every question embeds before retrieval starts and before the cache can be
    consulted, so this call is in front of the entire site. A host that is
    switched off refuses in a millisecond and will not recover during the
    backoff, so the patience is wasted in the one place it is most expensive.
    """
    dead = MagicMock()
    dead.embeddings.create.side_effect = openai.APIConnectionError(
        request=httpx.Request("POST", "http://nvidia:11434/v1"))
    alive = MagicMock()
    alive.embeddings.create.return_value = _vectors(1)

    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", dead),
                                    _endpoint("fireworks", alive)]):
        assert len(embedder.embed_texts(["a"])) == 1

    assert dead.embeddings.create.call_count == embedder.FAILOVER_ATTEMPTS
    assert embedder.FAILOVER_ATTEMPTS < embedder.MAX_ATTEMPTS


def test_the_last_endpoint_is_given_the_full_retry_budget():
    """Where there is nowhere to fall through to, a provider shedding load for a
    few seconds is worth waiting out -- that is the 2026-09-09 failure, and
    giving up early would re-create it."""
    flaky = MagicMock()
    flaky.embeddings.create.side_effect = (
        [openai.InternalServerError("busy", response=_response(503), body=None)] * 4
        + [_vectors(1)]
    )
    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("fireworks", flaky)]):
        assert len(embedder.embed_texts(["a"])) == 1
    assert flaky.embeddings.create.call_count == embedder.MAX_ATTEMPTS


def test_a_single_endpoint_chain_still_gets_full_patience():
    """Configuring only a self-hosted endpoint must not quietly halve its
    resilience just because it happens to be first as well as last."""
    flaky = MagicMock()
    flaky.embeddings.create.side_effect = (
        [openai.APITimeoutError(request=httpx.Request("POST", "http://x"))] * 4
        + [_vectors(1)]
    )
    with patch.object(embedder, "build_endpoints",
                      return_value=[_endpoint("self-hosted-1", flaky,
                                              limit=embedder.OLLAMA_INPUT_LIMIT)]):
        assert len(embedder.embed_texts(["a"])) == 1
    assert flaky.embeddings.create.call_count == embedder.MAX_ATTEMPTS
