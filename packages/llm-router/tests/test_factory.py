import pytest
from unittest.mock import patch
from llm_router.factory import build_provider
from llm_router.cohere_provider import CohereProvider
from llm_router.together_provider import TogetherProvider


def test_build_provider_cohere():
    with patch("openai.AsyncOpenAI"):
        p = build_provider("cohere", api_key="k",
                           base_url="https://api.cohere.ai/compatibility/v1",
                           model="command-r-08-2024")
    assert isinstance(p, CohereProvider)
    assert p.model == "command-r-08-2024"


def test_build_provider_together():
    with patch("openai.AsyncOpenAI"):
        p = build_provider("together", api_key="k",
                           base_url="https://api.together.xyz/v1",
                           model="Qwen/Qwen2.5-7B-Instruct-Turbo")
    assert isinstance(p, TogetherProvider)


def test_build_provider_unknown_raises():
    with pytest.raises(ValueError):
        build_provider("nope", api_key="k", base_url="u", model="m")
