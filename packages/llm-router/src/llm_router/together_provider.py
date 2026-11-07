import openai
from llm_router.provider import LLMProvider, LLMResponse

# Together serves several Qwen reasoning models that place their answer in a
# `reasoning` field and return empty `content` unless thinking is disabled. A
# naive call spends the whole token budget and returns nothing, which reads as a
# bad answer rather than a broken one. Handled here rather than at the call sites
# because this provider is constructed in half a dozen places.
# Two families, two different switches, both verified against the live API.
# Qwen3 answers into a `reasoning` field unless thinking is disabled outright.
_THINKING_OFF = {"chat_template_kwargs": {"enable_thinking": False}}
_REASONING_MODEL_PREFIXES = ("Qwen/Qwen3.5", "Qwen/Qwen3.6", "Qwen/Qwen3.7", "Qwen/Qwen3-")

# gpt-oss always reasons and cannot be turned off, but defaults to an effort level
# that can consume the whole token budget before writing an answer: at 120 max
# tokens the default returns finish_reason='length' with empty content, while
# "low" answers in 43 tokens. Seen in a real run as 5 empty-content failures.
_LOW_EFFORT = {"reasoning_effort": "low"}
_EFFORT_MODEL_PREFIXES = ("openai/gpt-oss",)


def _default_extra_body(model: str) -> dict:
    """Options a given model needs to answer at all, absent an explicit override."""
    if model.startswith(_REASONING_MODEL_PREFIXES):
        return dict(_THINKING_OFF)
    if model.startswith(_EFFORT_MODEL_PREFIXES):
        return dict(_LOW_EFFORT)
    return {}


class TogetherProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.together.xyz/v1",
                 model: str = "Qwen/Qwen3.5-9B",
                 extra_body: dict | None = None):
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        # An explicit extra_body wins; otherwise apply whatever the model needs.
        self.extra_body = extra_body if extra_body is not None else _default_extra_body(model)

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
            **({"extra_body": self.extra_body} if self.extra_body else {}),
        )
        choice = response.choices[0]
        text = choice.message.content or ""
        if not text.strip():
            # Fail loudly. An empty answer served to a user looks like the assistant
            # had nothing to say, when in fact the call was misconfigured.
            raise ValueError(
                f"{self.model} returned empty content "
                f"(finish_reason={choice.finish_reason!r}). If this is a reasoning "
                f"model, thinking may need to be disabled via extra_body."
            )
        return LLMResponse(
            text=text,
            model=self.model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )
