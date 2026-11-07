"""Profile Ollama hosts across several prompt sizes, repeatedly, and compare them.

    uv run python scripts/profile_ollama_sweep.py --model qwen2.5:7b-instruct \
        --host amd=http://HOST_1_TAILNET_IP:11434 --host nvidia=http://HOST_2_TAILNET_IP:11434

    uv run python scripts/profile_ollama_sweep.py --sizes 400 1600 3200 --repeats 5

check_ollama.py --profile answers "is this host healthy and roughly how fast". This answers
"which host is faster, and am I sure", which needs three things that one profile call cannot
give:

  * A warm model. The first run after a load under-reports prefill by about 25 percent while
    `load` still reads ~1ms, so nothing warns you. One discarded warm-up run per host per
    size.
  * Repeats. A single sample cannot tell a 3 percent difference from noise, and the first
    comparison run of this benchmark reported a 25 percent prefill gap that was entirely the
    cold-model artifact.
  * More than one prompt size. Prefill is a batched matrix multiply, so tokens per second
    climbs with prompt length until the GPU is saturated. Comparing two cards at one size
    measures them at one point on a curve that may cross.

Every run gets a fresh nonce at the front of the prompt. Ollama caches on the prompt prefix,
and without this the second run of a size reports its cache rather than its compute: 888ms of
prefill became 21ms between two identical runs, or 68,912 tok/s.

Reports the median rather than the mean, and the spread beside it, because one slow sample
from an unrelated process on the box should not decide which card is faster.
"""
import argparse
import asyncio
import statistics
import uuid

import httpx

# Roughly a token per 0.75 words for this text. The filler is deliberately prose
# rather than random characters: tokenisation, and therefore the real prompt
# length, differs sharply between the two.
_SENTENCE = ("Toronto utility bills cover water, wastewater and solid waste charges. "
             "Bills are issued on a four-month or monthly cycle depending on the property. "
             "Payment can be made online, by phone, through financial institutions, or by mail. ")
_TOKENS_PER_SENTENCE = 50

_SYSTEM = "You answer questions about City of Toronto services using only the context.\n\n"
# Asking for length keeps decode measurable. Left to itself the model answers this
# question in about 20 tokens, which is too short to time a rate over.
_QUESTION = ("\n\nQuestion: How do I pay my water bill? Answer in at least 150 words, "
             "covering every payment method in the context.")


def build_prompt(target_tokens: int) -> str:
    """A RAG-shaped prompt of roughly the requested size, unique to this call."""
    nonce = uuid.uuid4().hex
    body_tokens = max(0, target_tokens - 60)          # system, question and nonce overhead
    repeats = max(1, round(body_tokens / _TOKENS_PER_SENTENCE))
    per_source = max(1, repeats // 5)
    sources = "\n\n".join(
        f"[Source: https://www.toronto.ca/doc-{i}]\n" + _SENTENCE * per_source
        for i in range(5))
    return f"[run {nonce}]\n{_SYSTEM}{sources}{_QUESTION}"


async def one_run(client: httpx.AsyncClient, root: str, model: str, size: int) -> dict | None:
    payload = {"model": model, "prompt": build_prompt(size), "stream": False,
               "options": {"temperature": 0, "num_predict": 200}}
    try:
        r = await client.post(f"{root.rstrip('/')}/api/generate", json=payload)
        r.raise_for_status()
        d = r.json()
    except httpx.HTTPStatusError as exc:
        # Ollama puts the reason in the body. Printing only the status turned
        # "a quantised KV cache needs flash attention" into a bare 500, repeated
        # thirty-two times, which said nothing about what to change.
        detail = ""
        try:
            detail = exc.response.json().get("error", "")
        except Exception:
            detail = (exc.response.text or "")[:200]
        print(f"    [warn] HTTP {exc.response.status_code}: {detail or 'no detail in body'}")
        return None
    except Exception as exc:
        print(f"    [warn] {type(exc).__name__}: {exc}")
        return None
    pe_ns, ev_ns = d.get("prompt_eval_duration"), d.get("eval_duration")
    pe_tok, ev_tok = d.get("prompt_eval_count"), d.get("eval_count")
    if not (pe_ns and ev_ns and pe_tok and ev_tok):
        print("    [warn] host did not report token counters")
        return None
    return {"prompt_tokens": pe_tok, "out_tokens": ev_tok,
            "prefill": pe_tok / (pe_ns / 1e9), "decode": ev_tok / (ev_ns / 1e9)}


def _spread(values: list[float]) -> str:
    """Median plus the range, so a single outlier is visible rather than averaged away."""
    if len(values) < 2:
        return ""
    return f"  ({min(values):,.0f} to {max(values):,.0f})"


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", action="append", required=True, metavar="LABEL=URL",
                    help="repeatable, e.g. --host amd=http://10.0.0.1:11434")
    ap.add_argument("--model", required=True)
    ap.add_argument("--sizes", type=int, nargs="+", default=[400, 800, 1600, 3200],
                    help="approximate prompt sizes in tokens (default: 400 800 1600 3200)")
    ap.add_argument("--repeats", type=int, default=3, help="timed runs per size (default 3)")
    args = ap.parse_args()

    hosts = []
    for spec in args.host:
        if "=" not in spec:
            print(f"--host wants LABEL=URL, got {spec!r}")
            return 2
        label, url = spec.split("=", 1)
        hosts.append((label, url))

    print(f"model {args.model}, sizes {args.sizes}, {args.repeats} timed runs per size")
    print("one warm-up run per host per size, discarded\n")

    results: dict[tuple[str, int], dict] = {}
    async with httpx.AsyncClient(timeout=600.0) as client:
        for label, url in hosts:
            for size in args.sizes:
                print(f"  {label} @ ~{size} tokens: warming up...", flush=True)
                warm = await one_run(client, url, args.model, size)
                if warm is None:
                    # A host that cannot answer the warm-up will not answer the
                    # timed runs either. Stopping here costs one request instead
                    # of thirty-two and leaves the reason on screen.
                    print(f"    {label} failed its warm-up. Skipping this host.")
                    print(f"    If the error mentions flash attention or the KV cache: "
                          f"OLLAMA_KV_CACHE_TYPE=q8_0 requires OLLAMA_FLASH_ATTENTION=1, "
                          f"and Ollama fails the load rather than falling back.")
                    break
                runs = []
                for i in range(args.repeats):
                    r = await one_run(client, url, args.model, size)
                    if r:
                        runs.append(r)
                        print(f"    run {i+1}: {r['prompt_tokens']:,} in / {r['out_tokens']} out, "
                              f"prefill {r['prefill']:,.0f} tok/s, decode {r['decode']:,.0f} tok/s")
                if runs:
                    results[(label, size)] = {
                        "prefill": [r["prefill"] for r in runs],
                        "decode": [r["decode"] for r in runs],
                        "prompt_tokens": statistics.median(r["prompt_tokens"] for r in runs),
                    }

    print("\n" + "=" * 78)
    print("MEDIAN OF TIMED RUNS")
    print("=" * 78)
    for size in args.sizes:
        rows = [(label, results[(label, size)]) for label, _ in hosts if (label, size) in results]
        if not rows:
            continue
        actual = int(rows[0][1]["prompt_tokens"])
        print(f"\n~{size} tokens requested, {actual:,} actual")
        for label, r in rows:
            pf, dc = statistics.median(r["prefill"]), statistics.median(r["decode"])
            print(f"  {label:<10} prefill {pf:>8,.0f} tok/s{_spread(r['prefill']):<24}"
                  f"decode {dc:>6,.0f} tok/s{_spread(r['decode'])}")
        if len(rows) == 2:
            (a, ra), (b, rb) = rows
            pf = statistics.median(ra["prefill"]) / statistics.median(rb["prefill"])
            dc = statistics.median(ra["decode"]) / statistics.median(rb["decode"])
            print(f"  {a} vs {b}: prefill {pf:.2f}x, decode {dc:.2f}x")

    print("\nA ratio inside roughly 1.05x either way is not a result at this sample size.")
    print("Check the spreads before believing any of it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
