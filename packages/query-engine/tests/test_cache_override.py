"""The cache is shared across callers, so an overridden request must not touch it.

/a2a and /api/mcp pin themselves to a small self-hosted model. Without this
guard those answers would be written into the semantic cache and then served to
people on the website, which is the same failure the model override already
carries a comment about.
"""
from types import SimpleNamespace

from query_engine.api import _is_overridden


def _body(**over):
    base = dict(question="q", model=None, provider=None)
    base.update(over)
    return SimpleNamespace(**base)


def test_a_default_request_uses_the_cache():
    assert _is_overridden(_body()) is False


def test_a_model_override_bypasses_the_cache():
    assert _is_overridden(_body(model="Qwen/Qwen3.5-9B")) is True


def test_a_provider_override_bypasses_the_cache():
    """The one this change adds. A local answer must not become what the site
    serves, and a cached hosted answer must not be returned as a local one."""
    assert _is_overridden(_body(provider="local")) is True


def test_both_overrides_together_bypass_the_cache():
    assert _is_overridden(_body(model="Qwen/Qwen3.5-9B", provider="local")) is True
