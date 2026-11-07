"""A misconfigured embedding endpoint must be noisy, not merely survivable.

On 2026-09-21 production had been embedding through the paid US provider for two
days while the configuration said otherwise. EMBEDDING_BASE_URL was:

    http://10.0.0.1:11434/v1    # NVIDIA, faster

Dotenv strips a trailing comment. PM2, which is what supplies the environment in
production, does not. So the comment became part of the URL, both self-hosted
endpoints 404'd, and the chain fell through to Fireworks exactly as designed.

Nothing errored. Nothing alerted. The site answered every question correctly.
The only symptom was embeddings taking 584ms instead of 102ms, inside a response
that takes seconds anyway -- and it was checked, with a command that read .env
through dotenv and therefore could not see the problem.

The failover working perfectly is what made it invisible. These tests cover the
three things that now make it visible: the URL is rejected at build time, the
endpoint is skipped rather than silently 404ing, and the log says which endpoint
is really serving rather than only complaining when something breaks.
"""
import logging
from unittest.mock import MagicMock, patch

import pytest

from indexer import embedder
from indexer.embedder import MisconfiguredEndpoint, clean_base_url


def _settings(**over):
    base = dict(
        embedding_base_url="", embedding_base_url_2="",
        embedding_model="nomic-embed-text", embedding_api_key="ollama",
        fireworks_api_key="fw-key", fireworks_base_url="https://fw/v1",
    )
    base.update(over)
    return MagicMock(**base)


# --- the exact production failure -------------------------------------------

def test_the_url_that_actually_shipped_is_rejected():
    with pytest.raises(MisconfiguredEndpoint) as exc:
        clean_base_url("http://10.0.0.1:11434/v1    # NVIDIA, faster",
                       "EMBEDDING_BASE_URL")
    message = str(exc.value)
    # The message has to name the cause. "Invalid URL" would have sent the
    # reader to the network, which is where two days went.
    assert "EMBEDDING_BASE_URL" in message
    assert "comment" in message.lower()
    assert "PM2" in message


def test_a_commented_endpoint_is_skipped_and_recorded_not_used():
    with patch.object(embedder, "settings", _settings(
            embedding_base_url="http://nvidia:11434/v1  # faster",
            embedding_base_url_2="http://amd:11434/v1")):
        chain = embedder.build_endpoints()

    assert [e.label for e in chain] == ["self-hosted-2", "fireworks"]
    assert len(embedder.CONFIG_PROBLEMS) == 1
    assert "EMBEDDING_BASE_URL" in embedder.CONFIG_PROBLEMS[0]


def test_a_bad_endpoint_does_not_take_the_site_down():
    """Skipped, not fatal. Raising here would turn a degraded site into a down
    one, and every question embeds before it can be answered."""
    with patch.object(embedder, "settings", _settings(
            embedding_base_url="http://nvidia:11434/v1  # faster")):
        chain = embedder.build_endpoints()
    assert [e.label for e in chain] == ["fireworks"]


def test_the_misconfiguration_is_logged_at_error_level(caplog):
    with caplog.at_level(logging.ERROR, logger="indexer.embedder"):
        with patch.object(embedder, "settings", _settings(
                embedding_base_url="http://nvidia:11434/v1  # faster")):
            embedder.build_endpoints()
    assert any("misconfigured" in r.message or "misconfigured" in r.getMessage()
               for r in caplog.records)


# --- the other spellings that fail the same silent way ----------------------

def test_ollamas_native_api_path_is_rejected():
    """The other easy mistake. This client speaks the OpenAI protocol and
    appends /embeddings, so /api 404s in exactly the same quiet way."""
    with pytest.raises(MisconfiguredEndpoint, match="/v1"):
        clean_base_url("http://nvidia:11434/api", "EMBEDDING_BASE_URL")


def test_a_url_with_no_scheme_is_rejected():
    with pytest.raises(MisconfiguredEndpoint, match="http"):
        clean_base_url("nvidia:11434/v1", "EMBEDDING_BASE_URL")


@pytest.mark.parametrize("raw,expected", [
    ("http://nvidia:11434/v1", "http://nvidia:11434/v1"),
    ("  http://nvidia:11434/v1  ", "http://nvidia:11434/v1"),   # surrounding space is fine
    ("http://nvidia:11434/v1/", "http://nvidia:11434/v1"),      # trailing slash trimmed
    ("", ""),                                                   # unset stays unset
])
def test_valid_urls_pass_through(raw, expected):
    assert clean_base_url(raw, "EMBEDDING_BASE_URL") == expected


# --- saying which endpoint actually served ----------------------------------

def _endpoint(label, client):
    ep = embedder.Endpoint(label, f"http://{label}/v1", "k", "m", limit=None)
    ep.client = lambda: client
    return ep


@pytest.fixture(autouse=True)
def _reset_state():
    embedder.LAST_SERVED_BY = None
    embedder.CONFIG_PROBLEMS.clear()
    yield
    embedder.LAST_SERVED_BY = None
    embedder.CONFIG_PROBLEMS.clear()


def test_the_first_success_says_which_endpoint_served(caplog):
    """Previously only failures were logged, so a log with nothing in it meant
    either "the preferred endpoint is working" or "nobody has looked"."""
    client = MagicMock()
    client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 768)])
    with caplog.at_level(logging.INFO, logger="indexer.embedder"):
        with patch.object(embedder, "build_endpoints",
                          return_value=[_endpoint("self-hosted-1", client)]):
            embedder.embed_texts(["a"])
    assert any("served by self-hosted-1" in r.getMessage() for r in caplog.records)
    assert embedder.LAST_SERVED_BY == "self-hosted-1"


def test_serving_from_a_fallback_is_a_warning_not_an_info(caplog):
    """Answering from the paid provider when a local one was configured is the
    state that went unnoticed. It is not routine."""
    import httpx
    import openai

    dead = MagicMock()
    dead.embeddings.create.side_effect = openai.APIConnectionError(
        request=httpx.Request("POST", "http://x"))
    alive = MagicMock()
    alive.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 768)])

    with caplog.at_level(logging.INFO, logger="indexer.embedder"), \
         patch.object(embedder.time, "sleep"):
        with patch.object(embedder, "build_endpoints",
                          return_value=[_endpoint("self-hosted-1", dead),
                                        _endpoint("fireworks", alive)]):
            embedder.embed_texts(["a"])

    fallback = [r for r in caplog.records if "served by fireworks" in r.getMessage()]
    assert fallback and fallback[0].levelno == logging.WARNING
    assert "fallback" in fallback[0].getMessage()


def test_the_endpoint_is_named_only_when_it_changes(caplog):
    """Every request would otherwise log a line, and a line printed constantly
    is one nobody reads."""
    client = MagicMock()
    client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 768)])
    with caplog.at_level(logging.INFO, logger="indexer.embedder"):
        with patch.object(embedder, "build_endpoints",
                          return_value=[_endpoint("self-hosted-1", client)]):
            for _ in range(4):
                embedder.embed_texts(["a"])
    assert len([r for r in caplog.records if "served by" in r.getMessage()]) == 1
