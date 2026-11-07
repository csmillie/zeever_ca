import openai
from llm_router.provider import LLMProvider, LLMResponse


class AugureProvider(LLMProvider):
    """Augure sovereign Canadian models via the OpenAI-compatible endpoint.

    Requests enter through Augure's gateway in Beauharnois, Quebec; inference runs
    in Canada and with vetted EU partners under zero-retention terms, never through
    US providers. API keys are issued through a gated application process, so this
    provider is expected to be unavailable (and skipped) until a key is set.

    Note that Augure publishes its rates in CAD, unlike every other provider wired
    into this repo. Anything computing cost from this provider must carry the
    currency explicitly — see scripts/compare_models.py.
    """

    def __init__(self, api_key: str, base_url: str = "https://api.augureai.ca/v1",
                 model: str = "ossington-5"):
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def generate(self, prompt: str, system: str = "", max_tokens: int = 2048) -> LLMResponse:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=messages,
            temperature=0,
        )
        choice = response.choices[0]
        return LLMResponse(
            text=choice.message.content,
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )
