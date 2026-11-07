"""Embeddings through an OpenAI-compatible API, with retries and failover.

A single upstream error used to abort a whole run. On 2026-09-09 a re-crawl of
2,269 pages crawled and parsed cleanly, then died 40 minutes in at embedding
batch 67 of 127 with "upstream connect error or disconnect/reset before headers".

That left 6,003 chunks in the corpus with no embedding, and retrieval filters on
`embedding IS NOT NULL`, so a large part of one section was silently unsearchable
until someone thought to count. The parse work was fine; a momentary fault at the
provider threw away the rest of the run and left the corpus in a state nothing
reported.

## Why there is a chain

Retrieval embeds the question before it can search, and before it can even ask
the semantic cache whether the answer is already known. One unreachable
embedding endpoint therefore takes down every query on the site, not just
crawling. Retries cover a provider having a bad second; they do not cover a host
being off.

Endpoints are tried in order and the first working one wins:

    EMBEDDING_BASE_URL     self-hosted, preferred
    EMBEDDING_BASE_URL_2   self-hosted, second card
    FIREWORKS_BASE_URL     paid, last resort

Unset the first two and this behaves exactly as it did before: Fireworks only.

## Why failing over mid-corpus is safe

All three serve nomic-embed-text-v1.5. Measured on real chunks, vectors from the
self-hosted copies agree with Fireworks at cosine 0.99994 or better, and with
each other at 0.999988 -- against 0.52 for two unrelated Toronto passages. The
vectors are the same vectors, so a corpus embedded partly by one endpoint and
partly by another is not a corpus with two coordinate systems in it.

## The one thing that is not interchangeable

Ollama truncates input at 2048 tokens and `num_ctx` does not lift it, while
Fireworks accepts the model's full 8192. Past that point the two disagree
completely -- 0.53 cosine at 7,239 tokens, which is the same score as unrelated
text. A truncated embedding is not a worse embedding, it is a vector for a
different document, and nothing about it looks wrong from the outside.

`assert_embeddable` refuses those rather than embedding them quietly. The
chunker keeps text under the limit; this is the check that the chunker did.
"""
import logging
import random
import time

import openai
from shared.config import settings

logger = logging.getLogger(__name__)

# Retried: the provider is briefly unavailable or rate limiting, and the same
# request will work shortly. Not retried: a bad request or a rejected key, where
# repeating it wastes time and hides the real message.
_RETRYABLE = (
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.InternalServerError,
    openai.RateLimitError,
)
MAX_ATTEMPTS = 5

# How hard to try an endpoint that is not the last one in the chain.
#
# The full five attempts take about sixteen seconds to exhaust, because the
# backoff assumes the thing it is waiting for might recover. A host that is
# switched off refuses in a millisecond and will not recover in sixteen seconds,
# and every query on the site is blocked on this call -- retrieval cannot start
# and the cache cannot even be consulted until the question is embedded.
#
# So patience is spent where it pays. With somewhere else to go, try twice and
# go there; on the last endpoint, where failing means failing, try all five.
FAILOVER_ATTEMPTS = 2

DEFAULT_MODEL = "nomic-ai/nomic-embed-text-v1.5"

# What a self-hosted Ollama will accept before it silently truncates. Measured,
# not read off a datasheet: agreement with Fireworks holds at 0.9999 up to 2,064
# tokens and collapses to 0.81 by 2,378.
OLLAMA_INPUT_LIMIT = 2048


# Configuration problems found while building the chain, kept so /health can
# report them. A bad endpoint is skipped rather than fatal -- crashing the API
# over a malformed URL would turn a degraded site into a down one -- but skipping
# quietly is what let a misconfiguration run for two days, so it is recorded.
CONFIG_PROBLEMS: list[str] = []

# Which endpoint most recently served, so "are we actually self-hosting?" is
# answerable without reading a log at the moment it happened.
LAST_SERVED_BY: str | None = None


class MisconfiguredEndpoint(ValueError):
    """A base URL that cannot be what the operator meant."""


def clean_base_url(raw: str, label: str) -> str:
    """Validate an embedding base URL, loudly.

    On 2026-09-21 EMBEDDING_BASE_URL was set to

        http://10.0.0.1:11434/v1    # NVIDIA, faster

    Dotenv strips a trailing comment; PM2, which is what actually supplies the
    environment in production, does not. So the comment became part of the URL,
    every request 404'd against both self-hosted endpoints, and the chain fell
    through to the paid provider exactly as designed. Nothing errored, nothing
    alerted, and the only symptom was that embeddings took 584ms instead of
    102ms -- inside a response that takes seconds anyway.

    A failover that works perfectly is what makes a misconfiguration invisible.
    This is the check that says so out loud instead.
    """
    url = raw.strip()
    if not url:
        return ""

    if any(c.isspace() for c in url):
        raise MisconfiguredEndpoint(
            f"{label} contains whitespace: {url!r}. The usual cause is a "
            f"trailing comment in .env -- dotenv strips those, PM2 does not, so "
            f"this works locally and 404s in production. Remove everything after "
            f"the URL."
        )

    if not url.startswith(("http://", "https://")):
        raise MisconfiguredEndpoint(
            f"{label} is not an http(s) URL: {url!r}"
        )

    # The OpenAI client appends /embeddings, so the base has to be the /v1 root.
    # Pointing it at Ollama's native /api path is the other easy mistake, and it
    # fails the same silent way.
    if url.rstrip("/").endswith("/api"):
        raise MisconfiguredEndpoint(
            f"{label} ends in /api: {url!r}. This client speaks the "
            f"OpenAI-compatible protocol, so the base URL must end in /v1."
        )

    return url.rstrip("/")


class Endpoint:
    """One embeddings API, and the model name that provider knows it by."""

    def __init__(self, label: str, base_url: str, api_key: str, model: str, limit: int | None):
        self.label = label
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.limit = limit          # None means the provider takes the full 8192

    def client(self) -> openai.OpenAI:
        return openai.OpenAI(api_key=self.api_key, base_url=self.base_url)


def build_endpoints(model: str = DEFAULT_MODEL) -> list[Endpoint]:
    """The chain, in preference order.

    `model` names the Fireworks copy. The self-hosted ones use
    EMBEDDING_MODEL, because Ollama knows the same weights by a different name
    ("nomic-embed-text", not "nomic-ai/nomic-embed-text-v1.5").
    """
    local_model = settings.embedding_model
    chain: list[Endpoint] = []

    CONFIG_PROBLEMS.clear()
    for idx, base in enumerate(
        (settings.embedding_base_url, settings.embedding_base_url_2), start=1
    ):
        label = f"self-hosted-{idx}"
        try:
            url = clean_base_url(base or "", f"EMBEDDING_BASE_URL{'' if idx == 1 else '_2'}")
        except MisconfiguredEndpoint as exc:
            # Logged at error level and recorded, not raised. A malformed URL
            # should not take the site down when a working endpoint exists --
            # but it must not be the silent no-op it was either.
            CONFIG_PROBLEMS.append(str(exc))
            logger.error("embedding endpoint %s is misconfigured and will be "
                         "skipped: %s", label, exc)
            continue
        if url:
            chain.append(Endpoint(
                label=label,
                base_url=url,
                api_key=settings.embedding_api_key or "ollama",
                model=local_model,
                limit=OLLAMA_INPUT_LIMIT,
            ))

    if settings.fireworks_api_key:
        chain.append(Endpoint(
            label="fireworks",
            base_url=settings.fireworks_base_url,
            api_key=settings.fireworks_api_key,
            model=model,
            limit=None,
        ))

    if not chain:
        raise RuntimeError(
            "No embedding endpoint is configured. Set EMBEDDING_BASE_URL for a "
            "self-hosted one, or FIREWORKS_API_KEY for the paid fallback."
        )
    return chain


def assert_embeddable(texts: list[str], endpoint: Endpoint) -> None:
    """Refuse text this endpoint would truncate.

    Word count is a floor on token count -- a token is never more than a word --
    so this only fires on text that is definitely too long, never on text that
    merely might be. Being conservative in that direction is deliberate: a false
    alarm costs a re-chunk, a missed one writes a vector for a document nobody
    submitted and no test can see.
    """
    if endpoint.limit is None:
        return
    for i, text in enumerate(texts):
        words = len(text.split())
        if words > endpoint.limit:
            raise ValueError(
                f"Chunk {i} is at least {words} tokens, over {endpoint.label}'s "
                f"{endpoint.limit}-token limit. It would be truncated, and a "
                f"truncated embedding is a vector for different text, not a "
                f"worse vector for this one. Re-chunk before embedding."
            )


def _embed_batch(client, batch: list[str], model: str,
                 max_attempts: int = MAX_ATTEMPTS) -> list[list[float]]:
    """One batch against one endpoint, retried on transient upstream failures.

    Exponential backoff with jitter, because a provider that just dropped a
    connection is often shedding load, and a fleet of retries arriving in lockstep
    is what it is shedding.

    `max_attempts` is lower when another endpoint is waiting. See FAILOVER_ATTEMPTS.
    """
    for attempt in range(1, max_attempts + 1):
        try:
            response = client.embeddings.create(model=model, input=batch)
            return [item.embedding for item in response.data]
        except _RETRYABLE as exc:
            if attempt == max_attempts:
                # Raised with the attempt count, so the failure reads as durable
                # rather than as the momentary fault it was tried against.
                raise RuntimeError(
                    f"Embedding failed after {max_attempts} attempts: "
                    f"{type(exc).__name__}: {exc}. Chunks already embedded are "
                    f"saved; re-run to continue from where this stopped."
                ) from exc
            delay = min(2 ** (attempt - 1), 30) + random.uniform(0, 0.5)
            message = (f"  embedding attempt {attempt}/{max_attempts} failed "
                       f"({type(exc).__name__}: {exc}); retrying in {delay:.1f}s")
            logger.warning(message)
            print(message, flush=True)
            time.sleep(delay)


def embed_texts(texts: list[str], model: str = DEFAULT_MODEL) -> list[list[float]]:
    """Embed a list of texts, batching in groups of 100.

    Tries each endpoint in turn. An endpoint that exhausts its retries is
    considered down and the next one is tried; the whole list is re-embedded
    against it rather than resumed, so one batch never ends up split across two
    providers for reasons nothing records.

    A ValueError is not a failover. Text too long for a self-hosted endpoint
    would also be wrong on the next one, and quietly sending it to the provider
    with the larger window would hide a chunker bug behind a bill.
    """
    if not texts:
        return []

    chain = build_endpoints(model)
    last_error: Exception | None = None

    for endpoint in chain:
        assert_embeddable(texts, endpoint)
        try:
            client = endpoint.client()
            is_last = endpoint is chain[-1]
            attempts = MAX_ATTEMPTS if is_last else FAILOVER_ATTEMPTS
            vectors: list[list[float]] = []
            for i in range(0, len(texts), 100):
                vectors.extend(
                    _embed_batch(client, texts[i:i + 100], endpoint.model, attempts))
            global LAST_SERVED_BY
            if LAST_SERVED_BY != endpoint.label:
                # Stated on every change, including the first success of a
                # process, so the log answers "what is actually serving these?"
                # rather than only "something went wrong once".
                if endpoint is chain[0]:
                    logger.info("embeddings served by %s (%s)",
                                endpoint.label, endpoint.base_url)
                else:
                    logger.warning(
                        "embeddings served by %s (%s) -- earlier endpoints "
                        "unavailable, so this is a fallback, not the intended path",
                        endpoint.label, endpoint.base_url)
                LAST_SERVED_BY = endpoint.label
            return vectors
        except (RuntimeError, openai.APIError) as exc:
            last_error = exc
            # Logged, not printed: the retry messages inside _embed_batch have
            # already said what went wrong, and saying it twice made the failover
            # look like two failures.
            logger.warning("embedding endpoint %s unavailable: %s", endpoint.label, exc)

    # The last endpoint's own exception, not a wrapper around it. A rejected key
    # says "invalid key"; "every endpoint failed" says nothing and buries the one
    # sentence that names the cause. Which endpoints were tried is logged above
    # and repeated here, where it belongs -- in the log, not in place of the error.
    logger.error("every embedding endpoint failed: %s",
                 ", ".join(e.label for e in chain))
    raise last_error
