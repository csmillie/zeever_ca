"""The request field itself: accepted values, and what the API does with them."""
import pytest
from pydantic import ValidationError

from query_engine.models import QueryRequest


def test_provider_defaults_to_none():
    assert QueryRequest(question="q").provider is None


def test_local_is_accepted():
    assert QueryRequest(question="q", provider="local").provider == "local"


@pytest.mark.parametrize("value", ["together", "fireworks", "claude", "ollama", "LOCAL", ""])
def test_no_other_provider_can_be_named(value):
    """A Literal, not a free string. The field exists to say "must not cost
    money", not to let a caller pick a backend — and a caller that could name
    "together" would be choosing to spend, from an endpoint that may have no
    authentication at all."""
    with pytest.raises(ValidationError):
        QueryRequest(question="q", provider=value)
