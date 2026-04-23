import openai
from llm_router.provider import LLMProvider, LLMResponse


class OvhProvider(LLMProvider):
    def __init__(self, api_key: str = "none", base_url: str = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
                 model: str = "Qwen3-32B"):
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
        # Qwen3 uses <think> tags for reasoning; strip them from the answer
        text = choice.message.content or ""
        if "<think>" in text:
            parts = text.split("</think>")
            text = parts[-1].strip() if len(parts) > 1 else text
        return LLMResponse(
            text=text,
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )
