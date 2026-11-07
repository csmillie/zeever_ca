-- Migrate embedding column from OpenAI ada-002 (1536-dim) to Nomic embed-text-v1.5 (768-dim)
-- Requires re-embedding all existing chunks after running this migration.

ALTER TABLE canadian_ai.document_chunks
    ALTER COLUMN embedding TYPE vector(768);

DROP INDEX IF EXISTS canadian_ai.idx_chunks_embedding;
-- lists = 20 was right for the corpus size at the time. See 005, which raises it
-- to 240: at 58,022 chunks this index stopped being used at all, silently.
CREATE INDEX idx_chunks_embedding ON canadian_ai.document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
