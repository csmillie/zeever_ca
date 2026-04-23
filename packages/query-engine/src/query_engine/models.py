from pydantic import BaseModel, Field

ALLOWED_MODELS = {
    # Original comparison models
    "accounts/fireworks/models/gpt-oss-120b",
    "accounts/fireworks/models/kimi-k2p5",
    "accounts/fireworks/models/glm-5",
    "accounts/fireworks/models/deepseek-v3p2",
    "accounts/fireworks/models/mixtral-8x22b-instruct",
    "accounts/fireworks/models/glm-4p7",
    "accounts/fireworks/models/deepseek-v3p1",
    # Smaller / alternative models
    "accounts/fireworks/models/qwen3-8b",
    "accounts/fireworks/models/llama-v3p3-70b-instruct",
    # Together.ai models
    "Qwen/Qwen2.5-7B-Instruct-Turbo",
    # OVHcloud models
    "Qwen3-32B",
    # Ollama (self-hosted)
    "qwen2.5:7b-instruct",
}

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    model: str | None = Field(default=None, description="Override the default model (must be an allowed model ID)")

class Source(BaseModel):
    url: str
    title: str | None = None

class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int

class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    query_class: str
    model_used: str
    usage: TokenUsage | None = None
