-- Semantic query cache: stores answers keyed by question embedding + chunk hash.
-- Cache hit when a similar question (cosine similarity > 0.95) was asked and
-- the same chunks would be retrieved (chunk_hash matches).

CREATE TABLE canadian_ai.query_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question        TEXT NOT NULL,
    question_embedding vector(768) NOT NULL,
    chunk_hash      TEXT NOT NULL,          -- hash of retrieved chunk IDs, invalidates on content change
    answer          TEXT NOT NULL,
    sources         JSONB NOT NULL,         -- array of source URLs
    model_used      TEXT NOT NULL,
    query_class     TEXT,
    tokens_used     INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    hit_count       INT DEFAULT 0,
    last_hit_at     TIMESTAMPTZ
);

-- Index for fast semantic similarity search on cached questions
CREATE INDEX idx_query_cache_embedding ON canadian_ai.query_cache
    USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 10);

-- Index for expiry cleanup
CREATE INDEX idx_query_cache_created ON canadian_ai.query_cache (created_at);
