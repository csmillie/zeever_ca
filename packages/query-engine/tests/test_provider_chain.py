"""The chain exists so one dead provider cannot take /api/query down.

Before it, the API picked a provider by config precedence and had no fallback, so
Together retiring a model from serverless would have failed every request while
four working providers sat configured and unused.
"""
import asyncio
from types import SimpleNamespace

import pytest

from query_engine.provider_chain import (
    AllProvidersFailed,
    Link,
    build_chain,
    generate_with_failover,
)


def _settings(**over):
    base = dict(
        ollama_base_url="", ollama_model="m1",
        ollama_base_url_2="", ollama_model_2="m2",
        together_api_key="", together_base_url="u", together_model="tm",
        fireworks_api_key="", fireworks_base_url="u", fireworks_model="fm",
        ovh_api_key="", ovh_base_url="u", ovh_model="om",
        anthropic_api_key="",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _link(label, *, fails=False, hangs=False):
    async def gen(question, chunks, provider, graph_context=None):
        if hangs:
            await asyncio.sleep(10)
        if fails:
            raise RuntimeError(f"{label} is down")
        return {"answer": f"from {label}", "model": label}

    return Link(label=label, provider=gen, timeout_s=0.05 if hangs else 5.0)


async def _dispatch(question, chunks, provider, graph_context=None):
    """Stand-in for traced_generate: the provider *is* the callable in these tests."""
    return await provider(question, chunks, provider, graph_context=graph_context)


@pytest.mark.asyncio
async def test_first_healthy_provider_answers():
    chain = [_link("a"), _link("b")]
    result, served_by = await generate_with_failover(_dispatch, "q", [], chain)
    assert served_by == "a"
    assert result["answer"] == "from a"


@pytest.mark.asyncio
async def test_falls_through_a_failing_provider():
    chain = [_link("a", fails=True), _link("b")]
    result, served_by = await generate_with_failover(_dispatch, "q", [], chain)
    assert served_by == "b", "a failing primary must not fail the request"
    assert result["answer"] == "from b"


@pytest.mark.asyncio
async def test_falls_through_a_hanging_provider():
    """A powered-off local box hangs rather than refusing, so timeouts matter."""
    chain = [_link("dead-box", hangs=True), _link("b")]
    result, served_by = await generate_with_failover(_dispatch, "q", [], chain)
    assert served_by == "b"


@pytest.mark.asyncio
async def test_all_failing_raises_with_every_reason():
    chain = [_link("a", fails=True), _link("b", fails=True)]
    with pytest.raises(AllProvidersFailed) as exc:
        await generate_with_failover(_dispatch, "q", [], chain)
    assert [label for label, _ in exc.value.failures] == ["a", "b"]
    assert "a is down" in str(exc.value) and "b is down" in str(exc.value)


@pytest.mark.asyncio
async def test_empty_chain_is_a_clear_error_not_an_index_error():
    with pytest.raises(AllProvidersFailed, match="no providers configured"):
        await generate_with_failover(_dispatch, "q", [], [])


def test_chain_is_empty_when_nothing_configured():
    assert build_chain(_settings()) == []


def test_both_ollama_hosts_appear_in_order():
    chain = build_chain(_settings(
        ollama_base_url="http://xps:11434/v1",
        ollama_base_url_2="http://amd:11434/v1",
        together_api_key="k",
    ))
    assert [l.label for l in chain] == ["ollama-1", "ollama-2", "together"]


def test_second_ollama_alone_still_registers():
    """Host 2 must not depend on host 1 being configured."""
    chain = build_chain(_settings(ollama_base_url_2="http://amd:11434/v1"))
    assert [l.label for l in chain] == ["ollama-2"]


def test_local_providers_get_a_longer_deadline():
    chain = build_chain(_settings(ollama_base_url="http://xps:11434/v1", together_api_key="k"))
    local = next(l for l in chain if l.label == "ollama-1")
    hosted = next(l for l in chain if l.label == "together")
    assert local.timeout_s > hosted.timeout_s


def test_requested_model_only_reaches_the_hosted_link():
    """An allowlisted hosted model id must not be sent to a local Ollama tag."""
    chain = build_chain(
        _settings(ollama_base_url="http://xps:11434/v1", ollama_model="qwen2.5:7b-instruct",
                  together_api_key="k"),
        requested_model="Qwen/Qwen3.5-9B",
    )
    by_label = {l.label: l.provider for l in chain}
    assert by_label["ollama-1"].model == "qwen2.5:7b-instruct"
    assert by_label["together"].model == "Qwen/Qwen3.5-9B"


def test_second_host_without_its_own_model_falls_back_to_the_first_tag():
    """Setting only OLLAMA_BASE_URL_2 is the obvious thing to do; an empty model
    id would otherwise fail every request to that host."""
    chain = build_chain(_settings(
        ollama_base_url_2="http://amd:11434/v1",
        ollama_model="qwen2.5:7b-instruct",
        ollama_model_2="",
    ))
    assert chain[0].provider.model == "qwen2.5:7b-instruct"


def test_second_host_model_is_used_when_given():
    chain = build_chain(_settings(
        ollama_base_url_2="http://amd:11434/v1",
        ollama_model="qwen2.5:7b-instruct",
        ollama_model_2="qwen3:14b",
    ))
    assert chain[0].provider.model == "qwen3:14b"


# --- provider="local" -------------------------------------------------------
#
# /a2a and /api/mcp pin themselves to self-hosted inference. Both treat a
# missing API key as "no auth required", so anything that can make an HTTP
# request can reach them, and a bill run up there is one nobody chose to spend.


def test_local_only_returns_just_the_ollama_links():
    settings = _settings(
        ollama_base_url="http://ollama:11434",
        ollama_base_url_2="http://ollama2:11434",
        together_api_key="k", fireworks_api_key="k",
        ovh_api_key="k", anthropic_api_key="k",
    )
    labels = [link.label for link in build_chain(settings, provider="local")]
    assert labels == ["ollama-1", "ollama-2"]


def test_local_only_excludes_every_paid_provider_even_when_all_are_configured():
    """The guarantee, stated as a test: no metered provider can appear.

    Asserted by exclusion rather than by listing what is expected, so a provider
    added to build_chain later cannot quietly start serving these endpoints.
    """
    settings = _settings(
        ollama_base_url="http://ollama:11434",
        together_api_key="k", fireworks_api_key="k",
        ovh_api_key="k", anthropic_api_key="k",
    )
    chain = build_chain(settings, provider="local")
    assert all(link.label.startswith("ollama") for link in chain), [l.label for l in chain]


def test_local_only_with_no_ollama_configured_is_an_empty_chain():
    """Fail closed. An empty chain reaches the caller as AllProvidersFailed,
    which the API turns into a 503 — the intended answer when the local box is
    off. Falling through to a paid provider is the cost this is preventing."""
    settings = _settings(
        together_api_key="k", fireworks_api_key="k", anthropic_api_key="k",
    )
    assert build_chain(settings, provider="local") == []


def test_local_only_never_falls_back_to_a_paid_provider_when_ollama_fails():
    settings = _settings(
        ollama_base_url="http://ollama:11434",
        together_api_key="k", fireworks_api_key="k", anthropic_api_key="k",
    )
    chain = build_chain(settings, provider="local")
    served = []

    async def generate(question, chunks, provider, graph_context=None):
        served.append(provider)
        raise RuntimeError("ollama is down")

    with pytest.raises(AllProvidersFailed):
        asyncio.run(generate_with_failover(generate, "q", [{}], chain))
    assert len(served) == 1, "only the local link should ever have been tried"


def test_default_requests_still_get_the_whole_chain():
    """The website must be unaffected: no provider argument, no change."""
    settings = _settings(
        ollama_base_url="http://ollama:11434",
        together_api_key="k", fireworks_api_key="k",
        ovh_api_key="k", anthropic_api_key="k",
    )
    labels = [link.label for link in build_chain(settings)]
    assert labels == ["ollama-1", "together", "fireworks", "ovh", "claude"]
