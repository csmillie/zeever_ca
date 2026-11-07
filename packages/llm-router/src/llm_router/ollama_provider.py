"""Ollama through its OpenAI-compatible route, with streaming.

Ollama exposes two APIs that must not be mixed: a native one at `/api/chat`
taking Ollama's own request shape, and an OpenAI-compatible one at
`/v1/chat/completions`. This project speaks the OpenAI shape through the
`openai` SDK, so every request has to land under `/v1`.

That distinction caused a live 404. `OLLAMA_BASE_URL` was set to the bare host,
the SDK appended `/chat/completions` to it, and Ollama answered 404 for every
generation. It went unnoticed because `scripts/check_ollama.py` normalises the
URL itself before probing, so the health check passed while production failed.
`_normalize_base_url` moves that tolerance into the provider, where the app
actually depends on it.
"""
import httpx
import openai

from llm_router.provider import LLMProvider, LLMResponse

# A dead box accepts the TCP connection and then says nothing, so connect and read
# need different budgets. Connect is a LAN round trip and should fail fast; read
# has to cover a long generation, which is normal rather than a fault.
CONNECT_TIMEOUT_S = 5.0
READ_TIMEOUT_S = 300.0

# `keep_alive` is deliberately not sent. It is a native-API field; Ollama's
# OpenAI-compatible handler does not document it, and passing an unsupported key
# through extra_body risks a 400 on some versions. Residency is set on the server
# instead, with OLLAMA_KEEP_ALIVE=-1 in the systemd unit, which is already in
# place — /api/ps shows the models loaded indefinitely.

# `num_ctx` is the same story, and worse, because it fails silently. Ollama keys a
# loaded instance partly on its context length, so the same tag at two context
# lengths is two instances competing for the same VRAM. This route cannot set it:
# tested against 0.33.1 on 2026-09-07, both nested as {"options": {"num_ctx": N}}
# and at the top level, each returned 200 and each loaded the model at the server
# default instead. The native /api/chat route honours it; /v1 does not.
#
# So the context this app gets is whatever OLLAMA_CONTEXT_LENGTH says on the host,
# and if anything else on that host asks for a different one, the two evict each
# other on every call. scripts/check_ollama.py detects exactly that by comparing
# what was resident before and after its own request.

# Ollama auto-enables thinking for models that support it, and returns the answer
# in a `reasoning` field with empty `content`. The native `think: false` switch is
# not honoured on the OpenAI-compatible route; that route uses `reasoning_effort`,
# and "none" is what actually works — confirmed against Ollama 0.33.1 with
# qwen3:14b by scripts/check_ollama.py, which probes the alternatives.
_THINKING_OFF = {"reasoning_effort": "none"}

# gpt-oss always reasons; it cannot be switched off, only turned down. At default
# effort it can spend the entire token budget thinking and return empty content
# with finish_reason='length' — four such failures in one benchmark run.
_DEFAULT_EFFORT = "low"

# Matched on the tag name before the colon, so qwen2.5 is not caught by qwen3.
_REASONING_TAGS = ("qwen3", "qwq", "deepseek-r1")
_EFFORT_TAGS = ("gpt-oss",)

VALID_EFFORTS = ("none", "low", "medium", "high")


class OllamaError(RuntimeError):
    """An Ollama request that failed, with enough detail to act on.

    Carries the effective endpoint and API mode because the most common failure
    here is a configuration mistake rather than a server fault, and the two are
    indistinguishable from the message the SDK raises on its own.
    """

    def __init__(self, message: str, *, status: int | None = None,
                 endpoint: str = "", api_mode: str = "openai-compatible",
                 body: str = ""):
        self.status = status
        self.endpoint = endpoint
        self.api_mode = api_mode
        self.body = body
        super().__init__(message)


def _normalize_base_url(base_url: str) -> str:
    """Return a base URL that ends in exactly one `/v1`.

    Accepts the bare host, a trailing slash, or an already-correct URL, so a
    `.env` written either way works. `removesuffix` before appending is what
    prevents `/v1/v1`.
    """
    trimmed = (base_url or "").strip().rstrip("/")
    if not trimmed:
        return ""
    return trimmed.removesuffix("/v1") + "/v1"


def native_root(base_url: str) -> str:
    """The root Ollama serves its native API from, for `/api/tags` and friends."""
    return _normalize_base_url(base_url).removesuffix("/v1")


def _default_extra_body(model: str, effort: str | None = None) -> dict:
    """Options a given local model needs to answer at all, absent an override."""
    tag = model.split(":", 1)[0].lower()
    if tag.startswith(_REASONING_TAGS):
        return dict(_THINKING_OFF)
    if tag.startswith(_EFFORT_TAGS):
        return {"reasoning_effort": effort or _DEFAULT_EFFORT}
    return {}


def _describe(exc: Exception, endpoint: str) -> OllamaError:
    """Turn an SDK exception into something that names the likely cause."""
    if isinstance(exc, openai.APIStatusError):
        body = ""
        try:
            body = (exc.response.text or "")[:300]
        except Exception:
            pass
        if exc.status_code == 404:
            msg = (
                f"Ollama returned 404 for {endpoint}. The OpenAI-compatible API "
                f"lives under /v1, so the base URL must end in /v1 — check "
                f"OLLAMA_BASE_URL. A 404 here almost always means a missing /v1 "
                f"prefix rather than a missing model."
            )
        elif exc.status_code == 400:
            msg = (
                f"Ollama rejected the request to {endpoint} (400). Usually an "
                f"unsupported option for this model, or a model tag that is not "
                f"pulled on this host. Server said: {body}"
            )
        else:
            msg = f"Ollama returned HTTP {exc.status_code} for {endpoint}: {body}"
        return OllamaError(msg, status=exc.status_code, endpoint=endpoint, body=body)

    if isinstance(exc, openai.APITimeoutError):
        return OllamaError(
            f"Ollama timed out at {endpoint} after {READ_TIMEOUT_S:.0f}s. The model "
            f"may still be loading into VRAM, or the generation is longer than the "
            f"read timeout allows. Not retried, because a retry after generation "
            f"has started duplicates the work.",
            endpoint=endpoint,
        )

    if isinstance(exc, openai.APIConnectionError):
        return OllamaError(
            f"Could not reach Ollama at {endpoint}. The host may be off, the "
            f"service stopped, or it may be bound to loopback rather than the "
            f"address configured here.",
            endpoint=endpoint,
        )

    return OllamaError(f"Ollama request to {endpoint} failed: {exc}", endpoint=endpoint)


class OllamaProvider(LLMProvider):
    def __init__(self, api_key: str = "ollama",
                 base_url: str = "http://localhost:11434/v1",
                 model: str = "qwen2.5:7b-instruct",
                 extra_body: dict | None = None,
                 reasoning_effort: str | None = None,
                 connect_timeout_s: float = CONNECT_TIMEOUT_S,
                 read_timeout_s: float = READ_TIMEOUT_S):
        self.base_url = _normalize_base_url(base_url)
        self.endpoint = f"{self.base_url}/chat/completions"
        # Ollama ignores the key but the OpenAI client requires one, and taking it
        # as an argument keeps this constructible through the same factory path as
        # every hosted provider.
        self.client = openai.AsyncOpenAI(
            api_key=api_key or "ollama",
            base_url=self.base_url,
            timeout=httpx.Timeout(read_timeout_s, connect=connect_timeout_s),
            max_retries=0,  # a retry mid-generation is a second inference, not a repair
        )
        self.model = model
        self.extra_body = (extra_body if extra_body is not None
                           else _default_extra_body(model, reasoning_effort))

    def _messages(self, prompt: str, system: str) -> list[dict]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _kwargs(self, prompt: str, system: str, max_tokens: int) -> dict:
        return dict(
            model=self.model,
            max_tokens=max_tokens,
            messages=self._messages(prompt, system),
            temperature=0,
            **({"extra_body": self.extra_body} if self.extra_body else {}),
        )

    async def generate(self, prompt: str, system: str = "", max_tokens: int = 2048) -> LLMResponse:
        try:
            response = await self.client.chat.completions.create(
                **self._kwargs(prompt, system, max_tokens)
            )
        except Exception as exc:
            raise _describe(exc, self.endpoint) from exc

        choice = response.choices[0]
        text = choice.message.content or ""
        if not text.strip():
            raise ValueError(
                f"{self.model} returned empty content from Ollama "
                f"(finish_reason={choice.finish_reason!r}). If this is a thinking "
                f"model, run scripts/check_ollama.py to find the switch it honours."
            )
        return LLMResponse(
            text=text,
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )

    async def stream(self, prompt: str, system: str = "", max_tokens: int = 2048):
        """Yield `(kind, payload)` as the model produces it.

        `kind` is one of:
          "text"      — a visible answer fragment
          "reasoning" — internal reasoning, emitted separately so the caller can
                        show, collapse or drop it without parsing the answer
          "usage"     — a dict of token counts, once, at the end

        Cancellation is the caller's: closing the generator (or cancelling the
        surrounding task) closes the underlying HTTP response, which is what
        stops Ollama generating.
        """
        try:
            stream = await self.client.chat.completions.create(
                **self._kwargs(prompt, system, max_tokens),
                stream=True,
                # Ollama only reports token counts on the final chunk, and only if
                # asked. Without this the streamed path could not report usage and
                # cost would silently read as zero.
                stream_options={"include_usage": True},
            )
        except Exception as exc:
            raise _describe(exc, self.endpoint) from exc

        try:
            async for chunk in stream:
                usage = getattr(chunk, "usage", None)
                if usage:
                    yield "usage", {
                        "input_tokens": usage.prompt_tokens or 0,
                        "output_tokens": usage.completion_tokens or 0,
                    }
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                # Ollama has used both spellings across versions; neither is in the
                # OpenAI schema, so read them defensively rather than by attribute.
                reasoning = (getattr(delta, "reasoning", None)
                             or getattr(delta, "reasoning_content", None))
                if reasoning:
                    yield "reasoning", reasoning
                if delta.content:
                    yield "text", delta.content
        except Exception as exc:
            if isinstance(exc, OllamaError):
                raise
            raise _describe(exc, self.endpoint) from exc
        finally:
            await stream.close()
