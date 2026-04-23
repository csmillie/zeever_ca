from dataclasses import dataclass

@dataclass
class ModelConfig:
    name: str
    provider: str  # "claude" or "qwen"
    model_id: str
    max_tokens: int = 2048
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0

CLAUDE_SONNET = ModelConfig(
    name="claude-sonnet",
    provider="claude",
    model_id="claude-sonnet-4-20250514",
    cost_per_1k_input=0.003,
    cost_per_1k_output=0.015,
)

QWEN_72B = ModelConfig(
    name="qwen-72b",
    provider="qwen",
    model_id="Qwen/Qwen2.5-72B-Instruct",
    cost_per_1k_input=0.0009,
    cost_per_1k_output=0.0009,
)

DEEPSEEK_V3 = ModelConfig(
    name="deepseek-v3",
    provider="fireworks",
    model_id="accounts/fireworks/models/deepseek-v3p1",
    cost_per_1k_input=0.0002,
    cost_per_1k_output=0.0008,
)

GPT_OSS_120B = ModelConfig(
    name="gpt-oss-120b",
    provider="fireworks",
    model_id="accounts/fireworks/models/gpt-oss-120b",
    cost_per_1k_input=0.00007,
    cost_per_1k_output=0.0003,
)
