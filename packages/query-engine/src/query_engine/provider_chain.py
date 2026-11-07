"""Ordered inference providers with failover.

The API used to *select* one provider by config precedence and had no fallback: if
that provider failed, the request failed. That is how Together retiring
Qwen2.5-7B-Instruct-Turbo from serverless could have taken production down while
four working providers sat configured and unused.

This module builds the ordered chain and tries each link in turn. A provider that
errors or exceeds its timeout is skipped and the next is tried; only when every
link fails does the caller see an error, and then it carries the reason from each.
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable

from llm_router.claude_provider import ClaudeProvider
from llm_router.fireworks_provider import FireworksProvider
from llm_router.ollama_provider import OllamaProvider
from llm_router.ovh_provider import OvhProvider
from llm_router.together_provider import TogetherProvider

logger = logging.getLogger(__name__)

# A local box that is powered off will hang rather than refuse, so every link gets a
# deadline. Local models are slower per token but on the LAN, hence the wider budget.
LOCAL_TIMEOUT_S = 120.0
HOSTED_TIMEOUT_S = 60.0


@dataclass
class Link:
    """One provider in the chain, with the label used in logs and telemetry."""
    label: str
    provider: object
    timeout_s: float


def build_chain(
    settings,
    requested_model: str | None = None,
    provider: str | None = None,
) -> list[Link]:
    """Ordered providers, best first. Only configured providers appear.

    `requested_model` comes from the API caller and is validated against the
    allowlist upstream. It applies only to the link it makes sense for, so a
    caller asking for a hosted model does not accidentally send that id to Ollama.

    `provider="local"` returns the Ollama links and nothing else. The hosted
    links are never constructed, so there is no ordering subtlety to get wrong
    later and no path by which such a request can reach a metered provider. An
    empty chain is a valid outcome: with no Ollama host configured the caller
    gets AllProvidersFailed, which is the intended answer. Failing is cheaper
    than answering, for the endpoints that pass this.
    """
    local_only = provider == "local"
    chain: list[Link] = []

    # Local first: free, private, and no rate limits.
    # A second host with no model of its own falls back to the first host's tag,
    # because setting only OLLAMA_BASE_URL_2 is the obvious thing to do and an
    # empty model id would otherwise fail every request to that host.
    default_local_model = settings.ollama_model
    for idx, (base_url, model) in enumerate(
        (
            (settings.ollama_base_url, settings.ollama_model),
            (getattr(settings, "ollama_base_url_2", ""),
             getattr(settings, "ollama_model_2", "") or default_local_model),
        ),
        start=1,
    ):
        if base_url:
            chain.append(Link(
                label=f"ollama-{idx}",
                provider=OllamaProvider(
                    api_key=getattr(settings, "ollama_api_key", "") or "ollama",
                    base_url=base_url,
                    model=model,
                    reasoning_effort=getattr(settings, "ollama_reasoning_effort", None),
                ),
                timeout_s=LOCAL_TIMEOUT_S,
            ))

    if local_only:
        return chain

    if settings.together_api_key:
        chain.append(Link(
            label="together",
            provider=TogetherProvider(
                api_key=settings.together_api_key,
                base_url=settings.together_base_url,
                model=requested_model or settings.together_model,
            ),
            timeout_s=HOSTED_TIMEOUT_S,
        ))

    if settings.fireworks_api_key:
        chain.append(Link(
            label="fireworks",
            provider=FireworksProvider(
                api_key=settings.fireworks_api_key,
                base_url=settings.fireworks_base_url,
                model=settings.fireworks_model,
            ),
            timeout_s=HOSTED_TIMEOUT_S,
        ))

    if settings.ovh_api_key:
        chain.append(Link(
            label="ovh",
            provider=OvhProvider(
                api_key=settings.ovh_api_key,
                base_url=settings.ovh_base_url,
                model=settings.ovh_model,
            ),
            timeout_s=HOSTED_TIMEOUT_S,
        ))

    if settings.anthropic_api_key:
        chain.append(Link(
            label="claude",
            provider=ClaudeProvider(api_key=settings.anthropic_api_key),
            timeout_s=HOSTED_TIMEOUT_S,
        ))

    return chain


class AllProvidersFailed(RuntimeError):
    """Every configured provider failed. Carries the per-provider reasons."""

    def __init__(self, failures: list[tuple[str, str]]):
        self.failures = failures
        detail = "; ".join(f"{label}: {err}" for label, err in failures) or "no providers configured"
        super().__init__(f"All inference providers failed ({detail})")


async def generate_with_failover(
    generate: Callable[..., Awaitable[dict]],
    question: str,
    chunks: list[dict],
    chain: list[Link],
    graph_context: dict | None = None,
) -> tuple[dict, str]:
    """Try each link in order. Returns (result, label_of_provider_that_answered)."""
    failures: list[tuple[str, str]] = []

    for link in chain:
        try:
            result = await asyncio.wait_for(
                generate(question, chunks, link.provider, graph_context=graph_context),
                timeout=link.timeout_s,
            )
        except asyncio.TimeoutError:
            failures.append((link.label, f"timeout after {link.timeout_s:.0f}s"))
            logger.warning("provider %s timed out after %.0fs, trying next", link.label, link.timeout_s)
            continue
        except Exception as exc:  # noqa: BLE001 - any provider failure should fall through
            failures.append((link.label, f"{type(exc).__name__}: {exc}"))
            logger.warning("provider %s failed (%s), trying next", link.label, exc)
            continue

        if failures:
            # Worth noticing: the primary is down and something else is serving.
            logger.warning("served by fallback provider %s after %d failure(s)", link.label, len(failures))
        return result, link.label

    raise AllProvidersFailed(failures)


async def stream_with_failover(
    stream: Callable[..., object],
    question: str,
    chunks: list[dict],
    chain: list[Link],
    graph_context: dict | None = None,
):
    """Stream from the first link that answers, yielding `(kind, payload)`.

    Failover is only safe before the caller has seen any answer text. Once a
    delta has been forwarded the bytes are gone — retrying on another provider
    would splice two different answers together — so this commits to a link at
    its first "text" event. A failure after that is reported as an "error" event
    rather than silently restarting, which matches the rule against retrying an
    inference that has already begun.

    A link's timeout applies to time-to-first-token, not to the whole generation.
    A long generation is normal; a host that accepts the connection and then says
    nothing is not, and that is what the deadline is for.

    Emits "provider" with the winning label at the moment of commitment.
    """
    failures: list[tuple[str, str]] = []
    sent_sources = False

    for link in chain:
        agen = stream(question, chunks, link.provider, graph_context=graph_context)
        committed = False
        try:
            while True:
                step = agen.__anext__()
                if not committed:
                    step = asyncio.wait_for(step, timeout=link.timeout_s)
                try:
                    kind, payload = await step
                except StopAsyncIteration:
                    break

                if kind == "sources":
                    if sent_sources:
                        continue
                    sent_sources = True
                elif kind == "text" and not committed:
                    committed = True
                    if failures:
                        logger.warning("streaming from fallback provider %s after %d failure(s)",
                                       link.label, len(failures))
                    yield "provider", link.label

                yield kind, payload
            return

        except asyncio.CancelledError:
            await agen.aclose()
            raise

        except Exception as exc:  # noqa: BLE001 - any provider failure should fall through
            await agen.aclose()
            reason = ("time-to-first-token exceeded %.0fs" % link.timeout_s
                      if isinstance(exc, asyncio.TimeoutError)
                      else f"{type(exc).__name__}: {exc}")
            if committed:
                logger.error("provider %s broke mid-stream (%s)", link.label, reason)
                yield "error", f"The answer was cut short: {reason}"
                return
            failures.append((link.label, reason))
            logger.warning("provider %s failed before first token (%s), trying next",
                           link.label, reason)
            continue

    raise AllProvidersFailed(failures)
