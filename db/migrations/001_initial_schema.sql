CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS canadian_ai;

-- Crawl execution tracking
CREATE TABLE canadian_ai.crawl_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'running',
    pages_found     INT DEFAULT 0,
    pages_crawled   INT DEFAULT 0,
    pdfs_downloaded INT DEFAULT 0,
    config          JSONB,
    error           TEXT
);

-- Raw documents as fetched
CREATE TABLE canadian_ai.raw_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_run_id    UUID REFERENCES canadian_ai.crawl_runs(id),
    url             TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    raw_content     BYTEA,
    http_status     INT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    headers         JSONB,
    UNIQUE(url, content_hash)
);

-- Parsed + normalized documents
CREATE TABLE canadian_ai.parsed_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_document_id UUID REFERENCES canadian_ai.raw_documents(id),
    url             TEXT NOT NULL,
    title           TEXT,
    content_text    TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    source_format   TEXT NOT NULL,
    word_count      INT,
    parsed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB
);

-- Chunks with embeddings
CREATE TABLE canadian_ai.document_chunks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parsed_document_id UUID REFERENCES canadian_ai.parsed_documents(id),
    chunk_index       INT NOT NULL,
    chunk_text        TEXT NOT NULL,
    token_count       INT,
    embedding         vector(1536),
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_embedding ON canadian_ai.document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- Graph nodes (Phase 4)
CREATE TABLE canadian_ai.graph_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    node_type       TEXT NOT NULL,
    description     TEXT,
    source_chunk_id UUID REFERENCES canadian_ai.document_chunks(id),
    properties      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Graph edges (Phase 4)
CREATE TABLE canadian_ai.graph_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id  UUID REFERENCES canadian_ai.graph_nodes(id),
    target_node_id  UUID REFERENCES canadian_ai.graph_nodes(id),
    relationship    TEXT NOT NULL,
    weight          FLOAT DEFAULT 1.0,
    properties      JSONB,
    source_chunk_id UUID REFERENCES canadian_ai.document_chunks(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extracted workflows (Phase 4)
CREATE TABLE canadian_ai.workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    permit_type     TEXT NOT NULL,
    steps           JSONB NOT NULL,
    source_urls     TEXT[] NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eval prompts and results
CREATE TABLE canadian_ai.eval_prompts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_text     TEXT NOT NULL,
    category        TEXT NOT NULL,
    expected_signals TEXT[] NOT NULL,
    expected_sources TEXT[]
);

CREATE TABLE canadian_ai.eval_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_prompt_id  UUID REFERENCES canadian_ai.eval_prompts(id),
    run_label       TEXT NOT NULL,
    model_used      TEXT NOT NULL,
    answer_text     TEXT NOT NULL,
    sources_cited   TEXT[],
    relevance_score FLOAT,
    groundedness    FLOAT,
    citation_score  FLOAT,
    latency_ms      INT,
    cost_usd        FLOAT,
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB
);
