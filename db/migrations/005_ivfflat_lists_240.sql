-- Rebuild the vector index with enough lists to be usable.
--
-- 002 created it with lists = 20, correct for the few thousand chunks the corpus
-- held then. At 58,022 chunks that is ~2,900 vectors per list, so probes = 10
-- (set on every query by vector_store.search_similar) reads about half of a
-- 226MB index. On the production VPS, which has roughly 1.2GB free, that thrashes.
--
-- Measured before this change, on production:
--   planner's choice, seq scan over 58,022 rows   575 - 845 ms
--   index scan, forced with enable_seqscan=off     12,500 ms
--   pg_stat_user_indexes.idx_scan                          1
--
-- The planner was right to refuse it, and that single scan was a diagnostic
-- EXPLAIN. The index had never once been used to answer a query: every retrieval
-- since the corpus outgrew 20 lists has been a sequential scan.
--
-- Measured after, same query, same host:
--   index scan   4.4 ms, median 4.9 ms warm, 74 ms cold
--
-- 240 lists follows pgvector's guidance of roughly sqrt(rows) at this scale, and
-- puts ~240 vectors in each list. Revisit it if the corpus grows by an order of
-- magnitude; the failure is silent, because a too-small index does not error, it
-- just stops being chosen.
--
-- CONCURRENTLY cannot run inside a transaction block, which means it cannot go in
-- a migration file that is executed as one. Run this by hand on a live database:
--
--   PGOPTIONS='-c maintenance_work_mem=256MB' psql "$DATABASE_URL" -c \
--     "CREATE INDEX CONCURRENTLY idx_chunks_embedding_v2 ON canadian_ai.document_chunks \
--      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 240);"
--   psql "$DATABASE_URL" -c "DROP INDEX canadian_ai.idx_chunks_embedding;"
--   psql "$DATABASE_URL" -c "ALTER INDEX canadian_ai.idx_chunks_embedding_v2 RENAME TO idx_chunks_embedding;"
--
-- The statement below is the same index without CONCURRENTLY, for a fresh database
-- or a maintenance window. It takes a lock that blocks writes while it builds.

DROP INDEX IF EXISTS canadian_ai.idx_chunks_embedding;
CREATE INDEX idx_chunks_embedding ON canadian_ai.document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 240);
