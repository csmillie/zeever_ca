from typing import Literal

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
    # Qwen2.5-7B-Instruct-Turbo was retired from serverless in 2026 (dedicated
    # endpoint only, returns HTTP 400), and is deliberately not listed.
    "Qwen/Qwen3.5-9B",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    # OVHcloud models
    "Qwen3-32B",
    # Ollama (self-hosted)
    "qwen2.5:7b-instruct",
}

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    model: str | None = Field(default=None, description="Override the default model (must be an allowed model ID)")
    # Pin a request to self-hosted inference.
    #
    # The machine-facing endpoints (/a2a and /api/mcp) send this. They are
    # reachable by anything that can make an HTTP request, so a bill run up
    # there is a bill nobody chose to spend. "local" builds a chain of Ollama
    # links only: if no Ollama host is configured or reachable, the request
    # fails rather than quietly falling through to a paid provider, because an
    # outage that silently moves machine traffic onto metered inference is the
    # exact cost this field exists to prevent.
    #
    # Deliberately a Literal rather than a free provider name. The point is to
    # express "must not cost money", not to let a caller choose any backend.
    provider: Literal["local"] | None = Field(
        default=None,
        description="Pin this request to self-hosted inference. Fails rather than falling back to a paid provider.",
    )

class Source(BaseModel):
    url: str
    title: str | None = None

class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int

class ResponseTime(BaseModel):
    seconds: float
    milliseconds: int

class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    query_class: str
    model_used: str
    usage: TokenUsage | None = None
    response_time: ResponseTime | None = None
