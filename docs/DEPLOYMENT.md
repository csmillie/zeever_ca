# Ask Toronto — Deployment Guide

Deployment to HostPapa VPS (Progress plan: 4GB RAM, 4 CPU, 100GB NVMe) running ISPConfig + Apache + PM2.

## Architecture on the VPS

```
Internet → Apache (port 80/443, SSL via ISPConfig)
              │
              ├── /  →  proxy to PM2/Next.js (port 3033)
              │
              └── /api/ →  proxy to PM2/FastAPI (port 3034)
                              │
                              └── PostgreSQL + pgvector (port 5432, local only)
                                     │
                                     └── Fireworks.ai API (external, for LLM + embeddings)
```

## Port assignments

| Port | Service | Notes |
|------|---------|-------|
| 3033 | Next.js frontend | Registered in port registry |
| 3034 | FastAPI backend | Internal, proxied via Apache |
| 5432 | PostgreSQL | Local only, no external access |

## Prerequisites

SSH into the server as root or a sudo user.

### 1. Install PostgreSQL 16 + pgvector

```bash
# Add PostgreSQL 16 repo
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-16 postgresql-server-dev-16

# Install pgvector
sudo apt-get install -y git build-essential
cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Create database and user
sudo -u postgres psql <<'SQL'
CREATE USER canadianai WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE canadianai OWNER canadianai;
\c canadianai
CREATE EXTENSION vector;
CREATE SCHEMA canadian_ai AUTHORIZATION canadianai;
SQL
```

### 2. Apply the database schema

After cloning the repo (see "Deploy the application" below):

```bash
cd /var/www/canadian-ai
sudo -u postgres psql -d canadianai -f db/migrations/001_initial_schema.sql
sudo -u postgres psql -d canadianai -f db/migrations/002_nomic_embeddings.sql
```

### 3. Install Python 3.12 + uv

```bash
# Install Python 3.12
sudo apt-get install -y python3.12 python3.12-venv python3.12-dev

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### 4. Install Node.js 18+ (if not already installed)

```bash
# Check existing version
node --version

# If needed, install via nvm or nodesource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Ensure pnpm is installed
npm install -g pnpm
```

## Deploy the application

### 1. Clone the repo

```bash
# As the web user (not root)
cd /var/www
git clone git@github.com:csmillie/canadian-ai.git
cd canadian-ai
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Set these values:

```bash
# Database — use the password you set above
DATABASE_URL=postgresql://canadianai:CHANGE_THIS_PASSWORD@localhost:5432/canadianai

# Fireworks.ai — required for LLM and embeddings
FIREWORKS_API_KEY=fw_your_key_here
FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1
FIREWORKS_MODEL=accounts/fireworks/models/gpt-oss-120b

# Optional — only needed if you want to use OpenAI embeddings or Claude as fallback
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 3. Install Python dependencies

```bash
cd /var/www/canadian-ai
uv sync
```

### 4. Install Node dependencies and build frontend

```bash
cd /var/www/canadian-ai/apps/web
pnpm install
pnpm build
```

### 5. Run the data pipeline (first time only)

```bash
cd /var/www/canadian-ai

# Crawl Toronto.ca permits (~20 min)
uv run python scripts/crawl.py

# Parse into chunks (~1 min)
uv run python scripts/parse.py

# Embed chunks via Fireworks (~5 min)
uv run python scripts/index.py
```

### 6. Build the knowledge graph (optional)

The knowledge graph extracts entities (permit types, documents, requirements, inspections)
and relationships from the crawled content. It improves answers for structured questions
about processes and requirements but adds latency to queries. The app works fine without it.

```bash
cd /var/www/canadian-ai

# Build graph from guide and inspection content (~20 min, uses Fireworks API)
uv run python scripts/build_graph.py --content-types guide inspection

# To build from all content types (slower, more comprehensive):
# uv run python scripts/build_graph.py

# To test with a small batch first:
# uv run python scripts/build_graph.py --max-chunks 20
```

Verify the graph was built:

```bash
psql $DATABASE_URL -c "SELECT count(*) FROM canadian_ai.graph_nodes;"
psql $DATABASE_URL -c "SELECT count(*) FROM canadian_ai.graph_edges;"
```

To enable graph-enhanced retrieval, pass `?mode=graph` to the API:

```bash
curl -X POST http://127.0.0.1:3034/api/query?mode=graph \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the process for applying for a building permit?"}'
```

The default mode is `vector` (plain RAG without graph context). To make graph mode
the default, update the API endpoint in `packages/query-engine/src/query_engine/api.py`
and change `default="vector"` to `default="graph"`.

**Cost note:** Building the graph makes LLM API calls for each chunk processed.
With GPT-oss-120B on Fireworks, expect roughly $0.01 for 500 chunks.

## PM2 Process Management

### 1. Create PM2 ecosystem config

Create `/var/www/canadian-ai/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'ask-toronto-web',
      cwd: '/var/www/canadian-ai/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3033',
      env: {
        NODE_ENV: 'production',
        PORT: '3033',
        API_URL: 'http://127.0.0.1:3034',
      },
    },
    {
      name: 'ask-toronto-api',
      cwd: '/var/www/canadian-ai',
      interpreter: '/var/www/canadian-ai/.venv/bin/python',
      script: '-m',
      args: 'uvicorn query_engine.api:app --host 127.0.0.1 --port 3034',
      env: {
        PATH: '/var/www/canadian-ai/.venv/bin:' + process.env.PATH,
      },
    },
  ],
};
```

### 2. Start services

```bash
cd /var/www/canadian-ai
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow instructions to enable on boot
```

### 3. Verify services are running

```bash
pm2 status
curl http://127.0.0.1:3034/health    # API should return {"status":"ok"}
curl http://127.0.0.1:3033           # Frontend should return HTML
```

## Apache Configuration

### 1. Create Apache vhost via ISPConfig

In ISPConfig, create a new website for `zeever.ca` (or your domain). Then add the Apache directives.

### 2. Add proxy directives

In ISPConfig under the website's **Apache Directives** field, add:

```apache
ProxyPreserveHost On

# API routes go to FastAPI
ProxyPass /api/ http://127.0.0.1:3034/api/
ProxyPassReverse /api/ http://127.0.0.1:3034/api/

# Everything else goes to Next.js
ProxyPass / http://127.0.0.1:3033/
ProxyPassReverse / http://127.0.0.1:3033/
```

### 3. Enable required Apache modules

```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

### 4. SSL

ISPConfig handles Let's Encrypt SSL automatically. Enable it in the website settings under the SSL tab.

## Update the port registry

On the server, add to `/etc/node-ports.conf`:

```
3033 | ask-toronto-web      | zeever.ca             | Next.js web
3034 | ask-toronto-api      | zeever.ca             | FastAPI backend
```

On your local machine, add port 3034 to `~/.node-ports.conf`:

```
3034 | ask-toronto-api      | zeever.ca             | FastAPI backend
```

## Updating the deployment

```bash
cd /var/www/canadian-ai

# Pull latest code
git pull

# Update Python deps if changed
uv sync

# Update Node deps and rebuild if frontend changed
cd apps/web && pnpm install && pnpm build && cd ../..

# Restart services
pm2 restart all
```

## Auto-deploy from GitHub

A webhook listener runs on port 9033 and automatically deploys when you push to main.

### Setup

1. Generate a webhook secret:

```bash
openssl rand -hex 32
```

2. Add it to your `.env` on the server:

```bash
DEPLOY_WEBHOOK_SECRET=your_generated_secret
```

3. The webhook is already in the PM2 ecosystem config. Start it:

```bash
pm2 restart ask-toronto-deploy
```

4. Add an Apache proxy rule for the webhook (in ISPConfig Apache Directives):

```apache
ProxyPass /deploy http://127.0.0.1:9033/deploy
ProxyPassReverse /deploy http://127.0.0.1:9033/deploy
```

5. In GitHub, go to your repo Settings > Webhooks > Add webhook:
   - Payload URL: `https://zeever.ca/deploy`
   - Content type: `application/json`
   - Secret: the same secret from step 1
   - Events: Just the push event
   - Active: checked

Now every push to `main` will automatically pull, rebuild, and restart the services.

### Verify

```bash
# Check webhook is running
curl http://127.0.0.1:9033/health

# Check deploy logs
pm2 logs ask-toronto-deploy --lines 20
```

## Data pipeline

The data pipeline (crawl, parse, embed) can be triggered three ways:

### 1. Unified pipeline script (recommended)

```bash
cd /var/www/canadian-ai
uv run python scripts/pipeline.py              # full pipeline: crawl + parse + embed
uv run python scripts/pipeline.py --skip-crawl  # parse + embed only
uv run python scripts/pipeline.py --dry-run     # show stats without making changes
```

### 2. Via webhook endpoint

```bash
# Trigger full pipeline remotely (requires webhook secret)
curl -X POST https://www.zeever.ca/pipeline \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{}' | openssl dgst -sha256 -hmac 'YOUR_SECRET' | cut -d' ' -f2)" \
  -d '{}'

# Skip crawl (parse + embed only)
curl -X POST https://www.zeever.ca/pipeline \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"skip_crawl":true}' | openssl dgst -sha256 -hmac 'YOUR_SECRET' | cut -d' ' -f2)" \
  -d '{"skip_crawl":true}'

# Check pipeline status
curl https://www.zeever.ca/pipeline/status
```

### 3. Cron schedule

Add to crontab to run automatically (e.g., weekly on Sunday at 3am):

```bash
crontab -e
# Add:
0 3 * * 0 cd /var/www/canadian-ai && /usr/local/bin/uv run python scripts/pipeline.py >> /var/log/zeever-pipeline.log 2>&1
```

### Apache proxy for pipeline endpoint

Add to your ISPConfig Apache Directives (must be before the `ProxyPass /` catch-all):

```apache
ProxyPass /pipeline http://127.0.0.1:9033/pipeline
ProxyPassReverse /pipeline http://127.0.0.1:9033/pipeline
```

### Individual scripts (manual)

```bash
uv run python scripts/crawl.py          # crawl only
uv run python scripts/parse.py          # parse only
uv run python scripts/index.py          # embed only
```

## Monitoring

```bash
pm2 logs                     # live logs from all services
pm2 logs ask-toronto-api     # API logs only
pm2 monit                    # real-time CPU/memory dashboard
```

## Resource usage estimates

| Component | RAM | CPU | Disk |
|-----------|-----|-----|------|
| PostgreSQL + pgvector | ~500MB | Idle unless querying | ~2GB |
| FastAPI (uvicorn) | ~200MB | Idle unless handling requests | — |
| Next.js (production) | ~150MB | Idle unless handling requests | ~100MB |
| PM2 | ~50MB | Minimal | — |
| OS + ISPConfig + Apache | ~1GB | Minimal | — |
| **Total** | **~1.9GB** | — | **~2.1GB** |

Leaves ~2GB free RAM for spikes and other services on the VPS.

## Troubleshooting

**API returns 502:** Check `pm2 logs ask-toronto-api` — likely a missing env var or database connection issue.

**Frontend shows "Unable to connect to backend":** The Next.js API route can't reach FastAPI. Verify `API_URL=http://127.0.0.1:3034` in the ecosystem config and that the API process is running.

**Database connection refused:** Ensure PostgreSQL is running (`sudo systemctl status postgresql`) and the connection string in `.env` is correct.

**Embeddings fail:** Check that `FIREWORKS_API_KEY` is set in `.env`. The embedding and LLM calls go to Fireworks.ai — no local GPU needed.

**Out of memory:** If RAM is tight, reduce PostgreSQL's `shared_buffers` in `/etc/postgresql/16/main/postgresql.conf` to `128MB` (default is usually 128MB anyway on small VPS).
