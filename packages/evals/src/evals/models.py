from dataclasses import dataclass, field

@dataclass
class BenchmarkPrompt:
    id: str
    prompt: str
    category: str
    expected_signals: list[str]
    expected_sources: list[str] = field(default_factory=list)
    # True when the corpus cannot answer this, so declining IS the right answer.
    # The default judge rubric scores "says it cannot help" as 0.0 relevance, which
    # rewards a model for inventing a procedure and penalises one for being honest
    # about thin evidence — the opposite of this product's stated rule. Setting this
    # swaps in a rubric that scores the refusal instead.
    #
    # It is a claim about the corpus, not the question, so it can go stale: if a
    # later crawl adds the missing page, clear the flag. Verify with
    # `scripts/inspect_retrieval.py --prompt-id <id>` before setting or clearing it.
    expects_refusal: bool = False

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
