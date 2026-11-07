"""Check that configured Ollama hosts are reachable, loaded, and GPU-backed.

Run this from wherever the app runs (the VPS), not from the Ollama box itself:
the thing worth testing is the path the API will actually take.

    uv run python scripts/check_ollama.py
    uv run python scripts/check_ollama.py --model qwen3:14b   # test a specific tag

Checks per host:
  1. reachable at all, and Ollama's version
  2. which model tags are installed
  3. a real generation through the OpenAI-compatible /v1 path the app uses
  4. whether the loaded model is on the GPU or has fallen back to CPU

Point 4 matters most on a new box: Ollama runs happily on CPU when the GPU
runtime is missing, so a host can pass every other check and still be far too
slow to use. On AMD that usually means ROCm is not seeing the card.
"""
import argparse
import asyncio
import uuid
import json
import sys
import time
from urllib.parse import urlparse

import httpx

from llm_router.ollama_provider import _default_extra_body
from shared.config import settings

PROMPT = "Reply with exactly: OK"


def _root(base_url: str) -> str:
    """Ollama's native API sits at the root; our config points at the /v1 path."""
    return base_url.rstrip("/").removesuffix("/v1")


async def _diagnose_thinking(root: str, model: str) -> str | None:
    """Find a way to make a thinking model return content.

    Ollama auto-enables thinking for capable models, and `think: false` is not
    honoured on the OpenAI-compatible route, so which switch works depends on the
    Ollama version and the model. Try each and report the first that answers.
    """
    msg = [{"role": "user", "content": PROMPT}]
    variants: list[tuple[str, str, dict]] = [
        ("reasoning_effort=none (/v1)", f"{root}/v1/chat/completions",
         {"model": model, "messages": msg, "max_tokens": 20, "temperature": 0,
          "reasoning_effort": "none"}),
        ("reasoning_effort=low (/v1)", f"{root}/v1/chat/completions",
         {"model": model, "messages": msg, "max_tokens": 20, "temperature": 0,
          "reasoning_effort": "low"}),
        ("chat_template_kwargs.enable_thinking=false (/v1)", f"{root}/v1/chat/completions",
         {"model": model, "messages": msg, "max_tokens": 20, "temperature": 0,
          "chat_template_kwargs": {"enable_thinking": False}}),
        ("/nothink prompt suffix (/v1)", f"{root}/v1/chat/completions",
         {"model": model, "max_tokens": 20, "temperature": 0,
          "messages": [{"role": "user", "content": PROMPT + " /nothink"}]}),
        ("native /api/chat with think=false", f"{root}/api/chat",
         {"model": model, "messages": msg, "stream": False, "think": False}),
    ]

    async with httpx.AsyncClient(timeout=120.0) as client:
        for label, url, payload in variants:
            try:
                r = await client.post(url, json=payload)
                if r.status_code != 200:
                    print(f"         - {label}: HTTP {r.status_code}")
                    continue
                body = r.json()
                if "choices" in body:
                    text = (body["choices"][0]["message"].get("content") or "").strip()
                else:  # native /api/chat
                    text = (body.get("message", {}).get("content") or "").strip()
                if text:
                    print(f"         - {label}: OK {text[:30]!r}")
                    return label
                print(f"         - {label}: still empty")
            except Exception as exc:
                print(f"         - {label}: {type(exc).__name__}")
    return None


# Roughly what a real query looks like: five retrieved chunks of context, a short
# question, a few hundred tokens of answer. Timing a two-token "OK" tells you
# nothing about the workload the app actually runs.
_RAG_CONTEXT = ("You answer questions about City of Toronto services using only the context.\n\n"
                + "\n\n".join(
                    f"[Source: https://www.toronto.ca/doc-{i}]\n" + ("Toronto utility bills cover water, "
                    "wastewater and solid waste charges. Bills are issued on a four-month or monthly "
                    "cycle depending on the property. Payment can be made online, by phone, through "
                    "financial institutions, or by mail. ") * 6
                    for i in range(5)))


async def _resident(root: str, settle: bool = False) -> dict[str, int]:
    """Model name -> the context length its loaded instance was created with.

    Ollama keys a loaded instance partly on its context length, so the same tag at
    two context sizes is two instances, not one. On a card that can hold only one
    of them, each caller evicts the other and pays a reload.

    With settle=True, an empty answer is retried. Unloading a model and loading
    its replacement are not atomic, and a single read can land in the gap and
    report nothing resident on a host that is busy rather than idle.
    """
    for attempt in range(3 if settle else 1):
        if attempt:
            await asyncio.sleep(1.0)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{root}/api/ps")
                r.raise_for_status()
                loaded = {m["name"]: m.get("context_length") or 0
                          for m in r.json().get("models", [])}
        except Exception:
            return {}
        if loaded:
            return loaded
    return {}


def _fmt_rate(tokens: int | None, ns: int | None) -> str:
    if not tokens or not ns:
        return "n/a"
    return f"{tokens / (ns / 1e9):,.0f} tok/s"


async def _profile_host(root: str, model: str) -> None:
    """Split the wall clock into network, prefill and decode using Ollama's own counters.

    /api/generate reports prompt_eval_duration and eval_duration in nanoseconds, so
    whatever is left over after those is time spent outside the model: the tunnel,
    the HTTP round trip, and scheduling. On a link across a VPN that remainder is
    often the part worth attacking, and no amount of quantisation will touch it.
    """
    # A unique prefix per run, or the measurement lies. Ollama caches the KV for a
    # prompt prefix, so sending the same text twice makes the second prefill look
    # almost free: 888ms became 21ms between two identical runs, reported as
    # 68,912 tok/s, which is a cache hit rather than a compute rate. The nonce goes
    # first because caching matches on the prefix; appending it would leave the
    # shared head cached and measure only the tail.
    nonce = uuid.uuid4().hex
    payload = {"model": model,
               "prompt": f"[run {nonce}]\n{_RAG_CONTEXT}\n\nQuestion: How do I pay my water bill?",
               "stream": False, "options": {"temperature": 0, "num_predict": 200}}
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            t0 = time.perf_counter()
            r = await client.post(f"{root}/api/generate", json=payload)
            r.raise_for_status()
            wall_ms = (time.perf_counter() - t0) * 1000
            d = r.json()
    except Exception as exc:
        print(f"  [warn] profile failed: {type(exc).__name__}: {exc}")
        return

    load_ms = (d.get("load_duration") or 0) / 1e6
    pe_ms = (d.get("prompt_eval_duration") or 0) / 1e6
    ev_ms = (d.get("eval_duration") or 0) / 1e6
    other_ms = max(0.0, wall_ms - load_ms - pe_ms - ev_ms)
    pe_tok, ev_tok = d.get("prompt_eval_count"), d.get("eval_count")

    print(f"  profile ({pe_tok or '?'} in / {ev_tok or '?'} out, {wall_ms:,.0f}ms total, cold prompt)")
    print(f"      load     {load_ms:>8,.0f}ms   model already resident if ~0")
    print(f"      prefill  {pe_ms:>8,.0f}ms   {_fmt_rate(pe_tok, d.get('prompt_eval_duration'))}")
    print(f"      decode   {ev_ms:>8,.0f}ms   {_fmt_rate(ev_tok, d.get('eval_duration'))}")
    print(f"      other    {other_ms:>8,.0f}ms   network, HTTP and scheduling")
    if ev_ms > 0.6 * wall_ms:
        print("      ^ decode dominates. It is bandwidth-bound: the whole model is read per")
        print("        token, so flags will not move it much. A model with fewer ACTIVE")
        print("        parameters will, which is why an MoE beats a larger dense model here.")
    if other_ms > 0.25 * wall_ms:
        print("      ^ over a quarter of the time is outside the model. Check the network path")
        print("        first: tailscale status should say 'direct', not 'relay'.")


async def _check_host(label: str, base_url: str, model: str, want_model: str | None,
                      profile: bool = False) -> bool:
    root = _root(base_url)
    host = urlparse(root).hostname or root
    model = want_model or model
    print(f"\n=== {label}: {root} ===")
    ok = True
    # Bound here, not where it is filled: the comparison below runs even when an
    # earlier check fails, and an unbound name would turn a reported failure into
    # a traceback.
    before: dict[str, int] = {}

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. reachable
        try:
            r = await client.get(f"{root}/api/version")
            r.raise_for_status()
            print(f"  [ok]   reachable, ollama {r.json().get('version', '?')}")
        except Exception as exc:
            print(f"  [FAIL] not reachable: {type(exc).__name__}: {exc}")
            print(f"         - is ollama running on {host}?")
            print(f"         - is it bound beyond localhost? OLLAMA_HOST=0.0.0.0 ollama serve")
            print(f"         - firewall/tunnel between here and {host}?")
            return False

        # 2. installed tags
        try:
            r = await client.get(f"{root}/api/tags")
            r.raise_for_status()
            tags = [m["name"] for m in r.json().get("models", [])]
            print(f"  [ok]   {len(tags)} model(s): {', '.join(tags) if tags else '(none)'}")
            if model not in tags:
                hint = " (from --model, which applies to every host)" if want_model else ""
                print(f"  [FAIL] '{model}' is not installed{hint} — run: ollama pull {model}")
                ok = False
        except Exception as exc:
            print(f"  [FAIL] could not list models: {exc}")
            return False

    # 3. a real generation over the path the app uses, with the same options the
    #    provider would send — otherwise a thinking model warns on every run even
    #    though the app handles it correctly.
    if ok:
        # What was resident before we asked for anything. Compared afterwards: if
        # our request changed the model's context length, it evicted and reloaded
        # somebody else's instance, and theirs will evict ours right back.
        before = await _resident(root)
        extra = _default_extra_body(model)
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                t0 = time.perf_counter()
                r = await client.post(
                    f"{root}/v1/chat/completions",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": PROMPT}],
                        "max_tokens": 20,
                        "temperature": 0,
                        **extra,
                    },
                )
                r.raise_for_status()
                ms = int((time.perf_counter() - t0) * 1000)
                text = (r.json()["choices"][0]["message"]["content"] or "").strip()
            if text:
                note = f" (with {', '.join(f'{k}={v!r}' for k, v in extra.items())})" if extra else ""
                print(f"  [ok]   generated in {ms}ms{note}: {text[:60]!r}")
            else:
                what = "even with the provider's usual options" if extra else "thinking model"
                print(f"  [warn] empty response in {ms}ms — {what}; probing for a working switch")
                winner = await _diagnose_thinking(root, model)
                if winner:
                    print(f"  [ok]   workaround found: {winner}")
                else:
                    print("  [FAIL] no working way to disable thinking found for this model/version")
                    ok = False
        except Exception as exc:
            print(f"  [FAIL] generation failed: {type(exc).__name__}: {exc}")
            ok = False

    # 3b. where the time actually goes
    if ok and profile:
        await _profile_host(root, model)

    # 4. GPU or CPU
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{root}/api/ps")
            r.raise_for_status()
            running = r.json().get("models", [])
        if not running:
            print("  [warn] nothing resident; cannot tell GPU from CPU (model may have unloaded)")

        # A settled read, not the one above: that one is a single sample and can
        # land between an unload and the load that replaces it, which reads as
        # "nothing resident" on a host that is merely busy.
        after = await _resident(root, settle=True)
        was = before.get(model)
        now = after.get(model)
        if was and now == was:
            print(f"  [ok]   {model} resident at context {now}, unchanged by our request")
        elif was:
            # Either it came back at a different size, or it is gone. Both mean the
            # same thing: our request did not land on the instance that was already
            # there.
            became = f"{was} -> {now}" if now else f"{was} -> evicted"
            print(f"  [FAIL] our request displaced the resident {model}: {became}")
            print("         Something else on this host runs this model at another")
            print("         context length, so each caller evicts the other and pays a")
            print("         full reload. The app cannot fix this from its side: Ollama's")
            print("         OpenAI-compatible /v1 route accepts num_ctx and ignores it")
            print("         (verified against 0.33.1, both nested in options and at top")
            print("         level). The server default is the only lever, so set")
            print(f"         OLLAMA_CONTEXT_LENGTH={was} in the ollama systemd unit on")
            print("         this host and restart it.")
            ok = False
        for m in running:
            total, gpu = m.get("size", 0), m.get("size_vram", 0)
            if not total:
                continue
            pct = 100 * gpu / total
            gb = total / 1e9
            if pct >= 99:
                print(f"  [ok]   {m['name']}: {gb:.1f}GB fully on GPU")
            elif pct > 0:
                print(f"  [warn] {m['name']}: {gb:.1f}GB, only {pct:.0f}% in VRAM — partially on CPU, expect slowness")
            else:
                print(f"  [FAIL] {m['name']}: running on CPU, not GPU")
                print("         AMD: check ROCm sees the card (rocminfo), and that the")
                print("         ollama service user can access /dev/kfd and /dev/dri")
                ok = False
    except Exception as exc:
        print(f"  [warn] could not read /api/ps: {exc}")

    return ok


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", help="test this tag instead of the configured one")
    ap.add_argument("--url", help="test an arbitrary host instead of the configured ones")
    ap.add_argument("--profile", action="store_true",
                    help="time a realistic RAG-sized request and split network, prefill and decode")
    args = ap.parse_args()

    if args.url:
        hosts = [("adhoc", args.url, args.model or settings.ollama_model)]
    else:
        hosts = [
            ("host 1 (OLLAMA_BASE_URL)", settings.ollama_base_url, settings.ollama_model),
            ("host 2 (OLLAMA_BASE_URL_2)", settings.ollama_base_url_2,
             settings.ollama_model_2 or settings.ollama_model),
        ]
        hosts = [h for h in hosts if h[1]]

    if not hosts:
        print("No Ollama hosts configured. Set OLLAMA_BASE_URL and/or OLLAMA_BASE_URL_2,")
        print("or pass --url http://host:11434/v1")
        return 2

    results = [await _check_host(label, url, model, args.model, args.profile)
               for label, url, model in hosts]

    print()
    if all(results):
        print(f"All {len(results)} host(s) healthy.")
        return 0
    print(f"{sum(1 for r in results if not r)} of {len(results)} host(s) have problems (see above).")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
