from dataclasses import dataclass, field

@dataclass
class BenchmarkPrompt:
    id: str
    prompt: str
    category: str
    expected_signals: list[str]
    expected_sources: list[str] = field(default_factory=list)

@dataclass
class EvalScore:
    prompt_id: str
    prompt_text: str
    answer: str
    sources_cited: list[str]
    relevance_score: float
    citation_score: float
    groundedness: float
    latency_ms: int
    model_used: str
    cost_usd: float = 0.0
    # LLM-as-judge scores (optional, filled when --judge is used)
    judge_relevance: float = -1.0  # -1 means not judged
    judge_completeness: float = -1.0
    judge_groundedness: float = -1.0
    judge_citation: float = -1.0
    judge_reasoning: str = ""
