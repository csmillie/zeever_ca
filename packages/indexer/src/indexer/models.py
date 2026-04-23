from dataclasses import dataclass


@dataclass
class EmbeddingResult:
    chunk_id: str
    embedding: list[float]
    token_count: int
