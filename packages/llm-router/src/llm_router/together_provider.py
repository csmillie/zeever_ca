import openai
from llm_router.provider import LLMProvider, LLMResponse


class TogetherProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.together.xyz/v1",
                 model: str = "Qwen/Qwen2.5-7B-Instruct-Turbo"):
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
