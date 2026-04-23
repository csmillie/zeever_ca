from abc import ABC, abstractmethod
from pydantic import BaseModel

class LLMResponse(BaseModel):
    text: str
    model: str
    input_tokens: int
    output_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system: str = "", max_tokens: int = 2048) -> LLMResponse:
        ...
