import httpx
from llm_router.provider import LLMProvider, LLMResponse

class QwenProvider(LLMProvider):
    """Qwen via OpenAI-compatible hosted inference (e.g., Together, Fireworks)."""

    def __init__(self, api_url: str, api_key: str, model: str = "Qwen/Qwen2.5-72B-Instruct"):
        self.api_url = api_url
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str, system: str = "", max_tokens: int = 2048) -> LLMResponse:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.api_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "max_tokens": max_tokens},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        usage = data["usage"]
        return LLMResponse(
            text=choice["message"]["content"],
            model=self.model,
            input_tokens=usage["prompt_tokens"],
            output_tokens=usage["completion_tokens"],
        )
