-- Add lastmod tracking for smart re-crawl
ALTER TABLE canadian_ai.raw_documents ADD COLUMN IF NOT EXISTS sitemap_lastmod TIMESTAMPTZ;
ALTER TABLE canadian_ai.raw_documents ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;

-- Index for finding stale pages
CREATE INDEX IF NOT EXISTS idx_raw_documents_sitemap_lastmod
ON canadian_ai.raw_documents (sitemap_lastmod);
