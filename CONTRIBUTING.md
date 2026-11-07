# Contributing to Zeever

Thanks for your interest in contributing! Zeever is a RAG-based AI assistant for City of Toronto services. Contributions of all kinds are welcome — bug reports, feature requests, code, and documentation.

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 22
- Docker (for PostgreSQL)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (Node package manager)

### LLM Setup

You need an inference source. Two options:

**Option A: Ollama (no API key needed)**

1. Install [Ollama](https://ollama.com)
2. Pull a model: `ollama pull qwen2.5:7b-instruct`
3. Set in `.env`: `OLLAMA_BASE_URL=http://localhost:11434/v1`

**Option B: API key**

Sign up for any supported provider and add the key to `.env`:
- [Together.ai](https://together.ai) — `TOGETHER_API_KEY`
- [Fireworks.ai](https://fireworks.ai) — `FIREWORKS_API_KEY` (also needed for embeddings)
- [OVHcloud](https://endpoints.ai.cloud.ovh.net) — free, no key needed

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/zeever_ca.git
cd zeever_ca

# Copy environment config
cp .env.example .env
# Edit .env — configure your LLM provider (see above)

# Install dependencies
uv sync
pnpm install

# Start PostgreSQL
docker compose up -d

# Run the data pipeline (crawl + parse + embed)
uv run python scripts/manage.py pipeline

# Start the API (terminal 1)
uv run uvicorn query_engine.api:app --port 3034

# Start the frontend (terminal 2)
pnpm dev

# Open http://localhost:3033
```

## Development Workflow

1. **Fork** the repo and clone your fork
2. **Branch** from `main`: `git checkout -b feature/your-feature`
3. **Make changes** — follow existing code patterns
4. **Test** — see testing requirements below
5. **Commit** — use descriptive commit messages
6. **Push** to your fork and open a Pull Request

## Testing Requirements

Before submitting a PR, verify:

```bash
# Python tests must pass
uv run pytest

# Frontend must build
pnpm build
```

## Pull Request Guidelines

- Link to a related issue if one exists
- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Don't include secrets, API keys, or credentials in code
- Don't include unrelated refactoring or style changes

## Reporting Bugs

Use the [bug report template](https://github.com/csmillie/zeever_ca/issues/new?template=bug_report.md). Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Python version, Node version)

## Requesting Features

Use the [feature request template](https://github.com/csmillie/zeever_ca/issues/new?template=feature_request.md). Describe:
- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

## Code Style

- **Python:** Follow existing patterns. No strict linter enforced yet.
- **TypeScript:** Follow existing patterns. Next.js conventions.
- Don't add unnecessary abstractions or premature optimizations.
- Keep changes minimal and focused.

## Questions?

Open a [discussion](https://github.com/csmillie/zeever_ca/discussions) or file an issue.
