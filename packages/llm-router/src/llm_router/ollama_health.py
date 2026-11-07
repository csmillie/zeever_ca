"""A cheap reachability check for an Ollama host.

`scripts/check_ollama.py` is the operator's tool and does a lot: GPU placement,
thinking-switch probing, latency profiling. This is the part the application
needs — enough to tell a misconfigured URL from a stopped service from a missing
model, fast enough to call from a health endpoint.

Deliberately not a long generation. The streamed step asks for a handful of
tokens only, because the question is whether the pipe works end to end, not how
fast the model is.
"""
import time
from dataclasses import dataclass, field

import httpx

from llm_router.ollama_provider import OllamaProvider, _normalize_base_url, native_root

PROBE_TIMEOUT_S = 10.0
PROBE_MAX_TOKENS = 8


@dataclass
class OllamaHealth:
    ok: bool
    base_url: str = ""
    native_root: str = ""
    api_mode: str = "openai-compatible"
    reachable: bool = False
    model: str = ""
    model_available: bool = False
    models: list[str] = field(default_factory=list)
    loaded: list[str] = field(default_factory=list)
    streamed: bool = False
    latency_ms: int | None = None
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        if self.ok:
            return (f"Ollama at {self.native_root} is serving {self.model} "
                    f"over the {self.api_mode} API ({self.latency_ms}ms to first tokens)")
        return f"Ollama at {self.native_root or '(unset)'} is not usable: " + "; ".join(self.errors)


async def check_ollama_health(base_url: str, model: str) -> OllamaHealth:
    """Verify a host is reachable, has the model, and can complete a short stream."""
    normalized = _normalize_base_url(base_url)
    root = native_root(base_url)
    health = OllamaHealth(ok=False, base_url=normalized, native_root=root, model=model)

    if not normalized:
        health.errors.append("no base URL configured (set OLLAMA_BASE_URL)")
        return health

    async with httpx.AsyncClient(timeout=PROBE_TIMEOUT_S) as client:
        try:
            tags = await client.get(f"{root}/api/tags")
            tags.raise_for_status()
            health.reachable = True
            health.models = sorted(m["name"] for m in tags.json().get("models", []))
        except httpx.HTTPStatusError as exc:
            health.errors.append(f"GET {root}/api/tags returned HTTP {exc.response.status_code}")
            return health
        except httpx.HTTPError as exc:
            health.errors.append(f"cannot reach {root}: {type(exc).__name__}")
            return health

        # Which models are resident. Not a failure either way; a cold model just
        # means the first real request pays to load it.
        try:
            ps = await client.get(f"{root}/api/ps")
            ps.raise_for_status()
            health.loaded = sorted(m["name"] for m in ps.json().get("models", []))
        except httpx.HTTPError:
            pass

    health.model_available = model in health.models
    if not health.model_available:
        health.errors.append(
            f"model {model!r} is not pulled on this host (has: {', '.join(health.models) or 'none'})"
        )
        return health

    # End to end through the same client the app uses, so a URL that is wrong for
    # the OpenAI route fails here rather than in production.
    provider = OllamaProvider(base_url=normalized, model=model,
                              connect_timeout_s=PROBE_TIMEOUT_S,
                              read_timeout_s=PROBE_TIMEOUT_S)
    t0 = time.perf_counter()
    try:
        async for kind, _ in provider.stream(prompt="Reply with exactly: OK",
                                             max_tokens=PROBE_MAX_TOKENS):
            if kind == "text":
                health.streamed = True
                break
    except Exception as exc:
        health.errors.append(str(exc))
        return health
    health.latency_ms = int((time.perf_counter() - t0) * 1000)

    if not health.streamed:
        health.errors.append(
            f"{model} produced no visible text. If it is a reasoning model it may "
            f"have spent the probe budget of {PROBE_MAX_TOKENS} tokens thinking."
        )
        return health

    health.ok = True
    return health
