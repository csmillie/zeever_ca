from llm_router.provider import LLMProvider
from llm_router.together_provider import TogetherProvider
from llm_router.fireworks_provider import FireworksProvider
from llm_router.cohere_provider import CohereProvider
from llm_router.augure_provider import AugureProvider
from llm_router.ollama_provider import OllamaProvider

_PROVIDERS = {
    "together": TogetherProvider,
    "fireworks": FireworksProvider,
    "cohere": CohereProvider,
    "augure": AugureProvider,
    "ollama": OllamaProvider,
    # Second Ollama host; same class, different credentials entry.
    "ollama2": OllamaProvider,
}


def build_provider(name: str, api_key: str, base_url: str, model: str, **kwargs) -> LLMProvider:
    """Construct a provider by short name. Raises ValueError on unknown name.

    Extra keyword arguments are passed through to the provider, which is how
    model-specific options such as `extra_body` reach the client.
    """
    if name not in _PROVIDERS:
        raise ValueError(f"Unknown provider: {name!r}. Known: {sorted(_PROVIDERS)}")
    return _PROVIDERS[name](api_key=api_key, base_url=base_url, model=model, **kwargs)
