import openai
from shared.config import settings


def _get_client() -> openai.OpenAI:
    """Return an OpenAI-compatible client pointing at Fireworks."""
    if not settings.fireworks_api_key:
        raise RuntimeError("FIREWORKS_API_KEY is required for embeddings (Nomic Embed v1.5)")
    return openai.OpenAI(
        api_key=settings.fireworks_api_key,
        base_url=settings.fireworks_base_url,
    )


DEFAULT_MODEL = "nomic-ai/nomic-embed-text-v1.5"


def embed_texts(texts: list[str], model: str = DEFAULT_MODEL) -> list[list[float]]:
    """Embed a list of texts using an OpenAI-compatible embeddings API. Batches in groups of 100."""
    client = _get_client()
    all_vectors = []
    for i in range(0, len(texts), 100):
        batch = texts[i:i+100]
        response = client.embeddings.create(model=model, input=batch)
        all_vectors.extend([item.embedding for item in response.data])
    return all_vectors
