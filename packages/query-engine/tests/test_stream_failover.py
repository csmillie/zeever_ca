"""Failover while streaming, which is only safe before the first token ships.

Once a delta has reached the client the bytes are gone. Restarting on another
provider would splice two different answers together, so the chain commits at the
first "text" event and reports a later break instead of retrying it.
"""
import asyncio
import pytest

from query_engine.provider_chain import Link, AllProvidersFailed, stream_with_failover


def _chain(*labels, timeout_s=1.0):
    return [Link(label=l, provider=object(), timeout_s=timeout_s) for l in labels]


def _scripted(script: dict):
    """Build a stream fn whose behaviour depends on the link it is called with."""
    async def stream(question, chunks, provider, graph_context=None):
        for item in script[id(provider)]:
            if isinstance(item, Exception):
                raise item
            if item == "hang":
                await asyncio.sleep(10)
            else:
                yield item
    return stream


@pytest.mark.asyncio
async def test_falls_over_when_the_first_link_dies_before_any_token():
    chain = _chain("ollama-1", "together")
    script = {
        id(chain[0].provider): [("sources", ["u"]), RuntimeError("connection refused")],
        id(chain[1].provider): [("sources", ["u"]), ("text", "hello"),
                                ("final", {"answer": "hello"})],
    }
    got = [e async for e in stream_with_failover(_scripted(script), "q", [], chain)]

    assert ("provider", "together") in got
    assert "".join(v for k, v in got if k == "text") == "hello"


@pytest.mark.asyncio
async def test_sources_are_emitted_once_across_a_failover():
    """Both links yield sources; the client must not see the list twice."""
    chain = _chain("ollama-1", "together")
    script = {
        id(chain[0].provider): [("sources", ["u"]), RuntimeError("boom")],
        id(chain[1].provider): [("sources", ["u"]), ("text", "hi")],
    }
    got = [e async for e in stream_with_failover(_scripted(script), "q", [], chain)]

    assert [k for k, _ in got].count("sources") == 1


@pytest.mark.asyncio
async def test_a_break_after_the_first_token_is_reported_not_retried():
    chain = _chain("ollama-1", "together")
    script = {
        id(chain[0].provider): [("text", "half an ans"), RuntimeError("socket closed")],
        id(chain[1].provider): [("text", "a whole different answer")],
    }
    got = [e async for e in stream_with_failover(_scripted(script), "q", [], chain)]

    text = "".join(v for k, v in got if k == "text")
    assert text == "half an ans", "must not splice a second provider's answer on"
    assert any(k == "error" for k, _ in got)
    assert ("provider", "together") not in got


@pytest.mark.asyncio
async def test_timeout_applies_to_time_to_first_token():
    chain = _chain("ollama-1", "together", timeout_s=0.05)
    script = {
        id(chain[0].provider): ["hang"],
        id(chain[1].provider): [("text", "fast")],
    }
    got = [e async for e in stream_with_failover(_scripted(script), "q", [], chain)]

    assert ("provider", "together") in got


@pytest.mark.asyncio
async def test_all_links_failing_raises_with_every_reason():
    chain = _chain("ollama-1", "together")
    script = {
        id(chain[0].provider): [RuntimeError("refused")],
        id(chain[1].provider): [RuntimeError("429 rate limited")],
    }
    with pytest.raises(AllProvidersFailed) as exc:
        [e async for e in stream_with_failover(_scripted(script), "q", [], chain)]

    assert "refused" in str(exc.value)
    assert "rate limited" in str(exc.value)


@pytest.mark.asyncio
async def test_empty_chain_raises_rather_than_yielding_nothing():
    with pytest.raises(AllProvidersFailed, match="no providers configured"):
        [e async for e in stream_with_failover(_scripted({}), "q", [], [])]
