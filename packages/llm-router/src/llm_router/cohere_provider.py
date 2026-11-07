import openai
from llm_router.provider import LLMProvider, LLMResponse


class CohereProvider(LLMProvider):
    """Cohere Command models via the OpenAI-compatible endpoint."""

    def __init__(self, api_key: str, base_url: str = "https://api.cohere.ai/compatibility/v1",
                 model: str = "command-a-03-2025"):
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
