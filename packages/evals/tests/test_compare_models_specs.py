"""Guards for the model comparison table.

A field was once added to the MODELS tuples and one of the two unpack sites was
missed, so a full benchmark run completed, wrote its CSV, and then died printing
the summary. These tests make that failure mode cheap to catch.
"""
import importlib.util
from pathlib import Path

import pytest

_SPEC_PATH = Path(__file__).resolve().parents[3] / "scripts" / "compare_models.py"


def _load():
    spec = importlib.util.spec_from_file_location("compare_models", _SPEC_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module




@pytest.fixture(scope="module")
def mod():
    return _load()


def test_every_model_is_a_named_spec(mod):
    """Named fields mean adding one cannot silently break positional unpacking."""
    for spec in mod.MODELS:
        assert isinstance(spec, mod.ModelSpec), f"{spec} is not a ModelSpec"


def test_every_model_has_credentials_wired(mod):
    for spec in mod.MODELS:
        assert spec.provider in mod.PROVIDER_CREDS, (
            f"{spec.name} uses provider {spec.provider!r} with no entry in PROVIDER_CREDS"
        )


def test_every_currency_is_convertible(mod):
    """to_usd raises on unknown currencies, so catch it here rather than mid-run."""
    for spec in mod.MODELS:
        assert mod.to_usd(1.0, spec.currency) > 0


def test_cad_models_are_converted_not_passed_through(mod):
    cad = [s for s in mod.MODELS if s.currency == "CAD"]
    assert cad, "expected at least one CAD-priced model (Augure)"
    assert mod.to_usd(1.0, "CAD") == pytest.approx(mod.CAD_TO_USD)
    assert mod.to_usd(1.0, "USD") == 1.0


def test_unknown_currency_raises(mod):
    with pytest.raises(ValueError):
        mod.to_usd(1.0, "EUR")


def test_augure_models_present_and_priced_in_cad(mod):
    augure = {s.name: s for s in mod.MODELS if s.provider == "augure"}
    assert {"ossington-5", "rosedale-1", "tofino-3"} <= set(augure)
    for spec in augure.values():
        assert spec.currency == "CAD", f"{spec.name} should be priced in CAD"
        assert spec.output_price > spec.input_price


def test_ollama_models_are_free_and_gated_on_base_url(mod):
    """Ollama has no API key, so the skip guard must look at OLLAMA_BASE_URL."""
    ollama = [s for s in mod.MODELS if s.provider == "ollama"]
    assert ollama, "expected local Ollama models in the comparison table"
    for spec in ollama:
        assert spec.input_price == 0.0 and spec.output_price == 0.0
    api_key, _ = mod.PROVIDER_CREDS["ollama"]
    assert api_key, "ollama needs a placeholder key so the OpenAI client constructs"


def test_reasoning_model_disables_thinking(mod):
    """Qwen3.5-9B returns empty content unless thinking is turned off."""
    qwen = [s for s in mod.MODELS if s.model_id == "Qwen/Qwen3.5-9B"]
    assert qwen, "expected Qwen3.5-9B among the replacement candidates"
    assert qwen[0].extra_body == {"chat_template_kwargs": {"enable_thinking": False}}


def test_retired_together_model_is_gone(mod):
    """Qwen2.5-7B-Instruct-Turbo is dedicated-endpoint only now and 400s."""
    ids = [s.model_id for s in mod.MODELS]
    assert "Qwen/Qwen2.5-7B-Instruct-Turbo" not in ids
