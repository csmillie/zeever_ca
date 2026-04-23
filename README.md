# Zeever.ca — Ask Toronto

A Canadian AI assistant that answers questions about any City of Toronto service using official content from Toronto.ca. Every answer is cited and grounded in public evidence.

Live at [zeever.ca](https://www.zeever.ca)

## What it does

Ask a question about any Toronto city service and get a cited, evidence-based answer:

```
Q: How do I dispute a parking ticket in Toronto?

A: You can request a review of a parking ticket within 15 days of the
   issue date through the City's online dispute portal or in person at
   a Court Services counter...
   [Source: toronto.ca/services-payments/streets-parking-transportation/...]
```

Covers property taxes, waste and recycling, parking, transit, housing, recreation, public health, permits and licences, bylaws, city government, and everything in between — every public section of Toronto.ca.

## Current stats

| Metric | Count |
|--------|-------|
| Parsed documents | 23,000+ |
| Searchable chunks | 112,000+ |
| Parsed PDFs | 10,700+ |
| Models benchmarked | 9 |
| Benchmark questions | 100 across 16 categories |
| Default model relevance | 0.94 |

## Architecture

```
User Query → Next.js Frontend → FastAPI Backend
                                      │
                                 Query Classifier
                                      │
                                 Model Router → Qwen2.5-7B (Together.ai, default)
                                                 Qwen3-8B (Fireworks, fallback)
                                                 Qwen3-32B (OVHcloud, free tier)
                                      │
                                  Retriever
                                   /      \
                            Vector RAG   GraphRAG
                                   \      /
                              pgvector + PostgreSQL
                                      │
                              Document Chunks (embedded)
                                      │
                              Parser / Normalizer
                                      │
                                   Crawler
                                      │
                              Toronto.ca (all sections)
```

### Key design decisions

- **PostgreSQL as the single store** — raw docs, parsed content, embeddings (pgvector), graph data, eval results. No separate vector database.
- **Open-source models only** — Qwen family via Together.ai (default), Fireworks.ai (fallback), and OVHcloud (free tier). Nomic Embed v1.5 for embeddings. No OpenAI or Google dependencies.
- **Heading-aware chunking** — HTML pages are split at section headings (h2/h3), producing focused chunks that match better than whole-page embeddings.
- **Full Toronto.ca coverage** — all sections crawled, not just building permits.
- **5-layer prompt injection hardening** — input sanitization, sandwich defense, output validation, context sanitization, and suspicious query logging.

## Tech stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | FastAPI (Python) |
| Database | PostgreSQL 16 + pgvector |
| LLM | Qwen2.5-7B-Instruct-Turbo via Together.ai (default, ~2.4s), Qwen3-8B via Fireworks.ai (fallback), Qwen3-32B via OVHcloud (free tier) |
| Embeddings | Nomic Embed v1.5 via Fireworks.ai (768 dim) |
| PDF parsing | PyMuPDF |
| Observability | Langfuse (LLM tracing) |
| Hosting | HostPapa VPS, ISPConfig, PM2, Apache |
| Package management | uv (Python), pnpm (Node) |

## Project structure

```
/apps
  /web                    # Next.js frontend — chat UI, research blog, admin dashboard

/packages
  /crawler                # Toronto.ca crawler with sitemap-based re-crawl
  /parser                 # HTML/PDF parsing, content classification, heading-aware chunking
  /indexer                # Embedding generation, pgvector storage and search
  /query-engine           # FastAPI API, query classification, retrieval, answer generation
  /graphrag               # Entity/relationship extraction, graph building
  /evals                  # 100 benchmark prompts, signal scorer, LLM-as-judge scorer
  /llm-router             # Provider abstraction (Together, Fireworks, OVHcloud, Claude)
  /shared                 # Database connection, config, SQLAlchemy ORM models

/db
  /migrations             # PostgreSQL schema (pgvector, 9 tables)

/scripts
  manage.py               # Unified crawl management CLI (see below)
  eval.py                 # Benchmark evaluation suite
  compare_models.py       # Multi-model comparison with CSV export
  build_graph.py          # Build knowledge graph from chunks
  pipeline.py             # Full data pipeline (crawl + parse + embed)
  recrawl.py              # Smart re-crawl from sitemap
  crawl_gaps.py           # Crawl missing HTML pages
  download_pdfs.py        # Download uncrawled PDFs by category
  gap_analysis.py         # Coverage gap analysis
  warm_cache.py           # Pre-populate semantic query cache
  provider_comparison.py  # 24-hour latency test across providers
  deploy-webhook.js       # GitHub webhook for auto-deploy
```

## Crawl management

All crawl operations are available through a unified CLI:

```bash
# System overview — stats, gaps, coverage
uv run python scripts/manage.py status

# Full pipeline — crawl + parse + embed + cleanup
uv run python scripts/manage.py pipeline
uv run python scripts/manage.py pipeline --skip-crawl    # parse + embed only
uv run python scripts/manage.py pipeline --dry-run        # show stats only

# Smart re-crawl — only pages changed since last crawl
uv run python scripts/manage.py recrawl
uv run python scripts/manage.py recrawl --since 7         # last 7 days
uv run python scripts/manage.py recrawl --section recreation
uv run python scripts/manage.py recrawl --dry-run

# Fill gaps — crawl and parse missing HTML pages
uv run python scripts/manage.py gaps
uv run python scripts/manage.py gaps --dry-run

# Download PDFs by category
uv run python scripts/manage.py download --categories guides forms policies building
uv run python scripts/manage.py download --all --dry-run

# PDF analysis — breakdown of uncrawled PDFs by category
uv run python scripts/manage.py pdfs
uv run python scripts/manage.py pdfs --samples 5

# Pre-populate query cache — instant responses for known questions
uv run python scripts/manage.py warmup              # all 130 questions
uv run python scripts/manage.py warmup --homepage    # 30 homepage questions
uv run python scripts/manage.py warmup --benchmark   # 100 benchmark questions
uv run python scripts/manage.py warmup --dry-run     # preview
```

The web admin dashboard at `/admin` provides the same stats plus pipeline controls, PDF download by category, and gap analysis.

## Query cache

Answers are cached using pgvector semantic similarity. Repeat and similar questions (cosine > 0.95) return cached answers in ~500ms instead of 3-5s.

- Cache auto-invalidates when content changes (chunk hash mismatch after re-crawl)
- 7-day TTL with `cleanup_cache()` function
- Skipped when model override is specified (benchmark runs)
- Warm the cache after deploys: `uv run python scripts/manage.py warmup`

## Evaluation

The benchmark suite includes 100 prompts across 16 categories covering all sections of Toronto.ca.

```bash
# Run against default model (Qwen2.5-7B via Together.ai)
uv run python scripts/eval.py

# Run against all 9 Fireworks models
uv run python scripts/eval.py --all-models

# Quick test — 3 questions across small models
uv run python scripts/eval.py --small -n 3

# With LLM-as-judge scoring
uv run python scripts/eval.py --all-models --judge

# Graph-enhanced mode
uv run python scripts/eval.py --mode graph --judge
```

Available models: `gpt-oss-120b`, `kimi-k2.5`, `glm-5`, `deepseek-v3.2`, `mixtral-8x22b`, `glm-4.7`, `deepseek-v3.1`, `qwen3-8b`, `llama3.3-70b`

### Latest benchmark results (100 questions, 9 models)

| Model | Relevance | Citation | Latency | Errors |
|-------|-----------|----------|---------|--------|
| **Qwen3-8B** | **0.94** | 0.80 | 5.7s | 0 |
| Kimi K2.5 | 0.89 | 0.87 | 18.7s | 2 |
| GLM-5 | 0.88 | 0.82 | 8.0s | 0 |
| DeepSeek v3.2 | 0.88 | 0.81 | 7.9s | 3 |
| DeepSeek v3.1 | 0.88 | 0.82 | 9.6s | 0 |
| Mixtral 8x22B | 0.86 | 0.81 | 4.6s | 0 |
| GLM-4.7 | 0.86 | 0.84 | 17.2s | 0 |
| Llama 3.3 70B | 0.86 | 0.81 | 3.6s | 0 |
| GPT-oss 120B | 0.82 | 0.82 | 8.9s | 0 |

Qwen3-8B (8B parameters) outperformed GPT-oss 120B (120B parameters) by 15% on relevance. See the [full analysis](https://www.zeever.ca/research/benchmark-suite).

## Security

5-layer prompt injection hardening:

1. **Input sanitization** — 34 regex patterns strip injection attempts from user queries
2. **Sandwich defense** — security rules at top and bottom of system prompt
3. **Output validation** — catches prompt leakage and role-breaking in LLM output
4. **Context sanitization** — strips LLM-framing markers from crawled content
5. **Suspicious query logging** — flags and logs queries with multiple injection indicators

Plus: rate limiting (20/min per IP), CORS allowlist, admin auth with timing-safe comparison, model allowlist validation, query mode regex validation.

## Research

Published at [zeever.ca/research](https://www.zeever.ca/research):

- [The Missing Layer: AI Inference in Canada](https://www.zeever.ca/research/canadian-inference)
- [100 Questions Across Toronto.ca](https://www.zeever.ca/research/benchmark-suite)
- [Scaling a RAG Pipeline to 35,000 Documents](https://www.zeever.ca/research/scaling-infrastructure)
- [How We Built an LLM-as-Judge](https://www.zeever.ca/research/llm-as-judge)
- [Comparing 7 Open-Source Models](https://www.zeever.ca/research/model-comparison)
- [Fixing Vector Search](https://www.zeever.ca/research/retrieval-improvements)
- [Vector RAG vs GraphRAG](https://www.zeever.ca/research/vector-vs-graph)
- [24-Hour Provider Latency Comparison](https://www.zeever.ca/research/provider-comparison)

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker (for PostgreSQL)
- Fireworks.ai API key
- uv and pnpm

### Setup

```bash
git clone <repo-url>
cd canadian-ai
cp .env.example .env
# Edit .env — add your FIREWORKS_API_KEY

# Install dependencies
uv sync
pnpm install

# Start PostgreSQL
docker compose up -d

# Run the full pipeline
uv run python scripts/manage.py pipeline

# Start the API
uv run uvicorn query_engine.api:app --port 3034

# Start the frontend (separate terminal)
cd apps/web && pnpm dev

# Open http://localhost:3033
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development workflow, and PR guidelines.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). **Do not open a public issue for security vulnerabilities.**

## License

[MIT](LICENSE)
