"""Ping every model in the benchmark table before committing to a long run.

    uv run python scripts/check_models.py
    uv run python scripts/check_models.py --models command-a command-r
    uv run python scripts/check_models.py --provider cohere

A full benchmark is hours and dollars. Twice in recent memory a model in the
table had been retired by its provider and every one of its 100 prompts failed:
Together moved Qwen2.5-7B-Instruct-Turbo to dedicated endpoints, and Cohere
retired a set of model ids in April 2026. Both produced a table row that looked
like a terrible model rather than a missing one.

This sends one tiny request per model and reports what came back, in seconds
rather than hours. Exit code is non-zero if any configured model fails, so it can
gate a run.
"""
import argparse
import asyncio
import importlib.util
import pathlib
import time

from shared.config import settings

_SPEC = pathlib.Path(__file__).with_name("compare_models.py")


def _load_table():
    spec = importlib.util.spec_from_file_location("compare_models", _SPEC)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def _probe(mod, spec) -> tuple[str, str]:
    """Returns (status, detail). Status is one of ok, skip, FAIL."""
    api_key, base_url = mod.PROVIDER_CREDS[spec.provider]
    if spec.provider.startswith("ollama"):
        if not base_url:
            var = "OLLAMA_BASE_URL" if spec.provider == "ollama" else "OLLAMA_BASE_URL_2"
            return "skip", f"{var} not set"
    elif not api_key or api_key == "none":
        return "skip", f"{spec.provider.upper()}_API_KEY not set"

    extras = {"extra_body": spec.extra_body} if spec.extra_body else {}
    try:
        provider = mod.build_provider(spec.provider, api_key, base_url, spec.model_id, **extras)
    except Exception as exc:
        return "FAIL", f"could not construct: {type(exc).__name__}: {exc}"

    try:
        t0 = time.perf_counter()
        result = await asyncio.wait_for(
            provider.generate(prompt="Reply with exactly: OK", max_tokens=16), timeout=120
        )
        ms = int((time.perf_counter() - t0) * 1000)
    except asyncio.TimeoutError:
        return "FAIL", "timed out after 120s"
    except Exception as exc:
        msg = str(exc).replace("\n", " ")
        return "FAIL", f"{type(exc).__name__}: {msg[:120]}"

    return "ok", f"{ms}ms, {result.output_tokens} tok: {result.text.strip()[:28]!r}"


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", nargs="*", help="only these short names")
    ap.add_argument("--provider", help="only this provider, e.g. cohere")
    args = ap.parse_args()

    mod = _load_table()
    table = mod.MODELS
    if args.models:
        table = [s for s in table if s.name in args.models]
    if args.provider:
        table = [s for s in table if s.provider == args.provider]
    if not table:
        print("No models matched. Available: " + ", ".join(s.name for s in mod.MODELS))
        return 2

    print(f"Probing {len(table)} model(s)\n")
    results = []
    for spec in table:
        status, detail = await _probe(mod, spec)
        results.append((status, spec, detail))
        mark = {"ok": "[ok]  ", "skip": "[skip]", "FAIL": "[FAIL]"}[status]
        print(f"  {mark} {spec.name:<22} {spec.provider:<9} {detail}")

    ok = sum(1 for s, _, _ in results if s == "ok")
    skipped = sum(1 for s, _, _ in results if s == "skip")
    failed = [(spec, detail) for s, spec, detail in results if s == "FAIL"]

    print(f"\n{ok} ok, {skipped} skipped (not configured), {len(failed)} failed")
    if failed:
        print("\nThese would waste a full run — fix or drop them from --models:")
        for spec, detail in failed:
            print(f"  {spec.name} ({spec.model_id}): {detail}")
        return 1
    if ok:
        names = " ".join(s.name for st, s, _ in results if st == "ok")
        print(f"\nReady. To benchmark exactly what works:\n  uv run python -u scripts/compare_models.py --models {names}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
