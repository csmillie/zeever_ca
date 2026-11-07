"""The Langfuse spans are attached to the functions they claim to measure.

A decorator sits on the line above a `def`, so inserting a new function between
the two silently moves it. That happened in #281: `_is_overridden` was added
directly beneath `@observe(name="generate", as_type="generation")`, and the span
that carries model, token usage and cost spent three weeks measuring a boolean
comparison. Every "generate" observation in Langfuse read latency 0ms, model
None, usage None, output true/false, and the actual call to the LLM was not
traced at all.

Nothing caught it. `@observe` returns whatever the wrapped function returns, so
`test_cache_override.py` kept passing while asserting on a decorated
`_is_overridden`, and the API tests never look at telemetry. A wrong answer in
an observability tool is worse than a missing one: the dashboard was populated,
so it looked like it was working.

These tests assert placement rather than behaviour, because placement is what
broke and behaviour cannot see it.
"""
import pytest

from query_engine import api


def _is_traced(fn) -> bool:
    """True when Langfuse's @observe wraps this function.

    The decorator uses functools.wraps, so it leaves __wrapped__ behind. That is
    the only externally visible mark it makes: the name and signature are
    deliberately preserved, which is why the misplacement was invisible.
    """
    return hasattr(fn, "__wrapped__")


# The one that matters most. as_type="generation" tells Langfuse to expect a
# model name and token usage, which only exist on the call that generates.
def test_generate_is_traced():
    assert _is_traced(api.traced_generate), (
        "traced_generate lost its @observe decorator. The generation span is the "
        "only one carrying model, tokens and cost; without it Langfuse records "
        "retrieval timings and nothing about inference."
    )


@pytest.mark.parametrize("name", ["traced_classify", "traced_retrieve", "traced_retrieve_graph"])
def test_the_pipeline_stages_are_traced(name):
    assert _is_traced(getattr(api, name)), f"{name} lost its @observe decorator"


# The other half of the same failure: a span landing somewhere it does not
# belong. _is_overridden is a boolean test on a request body, called up to twice
# per request, and it must never appear in a trace.
def test_the_cache_guard_is_not_traced():
    assert not _is_traced(api._is_overridden), (
        "_is_overridden is decorated. It is a microsecond boolean check, and a "
        "span on it means a decorator slid off the function below."
    )
