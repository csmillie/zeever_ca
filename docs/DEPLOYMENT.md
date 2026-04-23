# Zeever.ca — Deployment Guide

Production deployment using Apache as reverse proxy and PM2 for process management.

## Architecture

```
Internet → Apache (port 80/443, SSL)
              │
              ├── /  →  proxy to PM2/Next.js (port 3033)
              │
              └── /api/ →  proxy to PM2/FastAPI (port 3034)
                              │
                              └── PostgreSQL + pgvector (port 5432, local only)
                                     │
                                     └── LLM API (external, for inference + embeddings)
```

## Port assignments

| Port | Service | Notes |
|------|---------|-------|
| 3033 | Next.js frontend | Proxied via Apache |
| 3034 | FastAPI backend | Proxied via Apache |
| 5432 | PostgreSQL | Local only, no external access |

## Prerequisites

### 1. PostgreSQL 16 + pgvector

```bash
# Install PostgreSQL 16 (Debian/Ubuntu)
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

### 2. Apply database schema

```bash
cd /path/to/zeever_ca
sudo -u postgres psql -d canadianai -f db/migrations/001_initial_schema.sql
sudo -u postgres psql -d canadianai -f db/migrations/002_nomic_embeddings.sql
```

### 3. Python 3.12 + uv

```bash
sudo apt-get install -y python3.12 python3.12-venv python3.12-dev
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### 4. Node.js 18+ + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
```

## Deploy the application

### 1. Clone and configure

```bash
git clone https://github.com/csmillie/zeever_ca.git
cd zeever_ca
cp .env.example .env
# Edit .env — set DATABASE_URL password and LLM provider keys
```

### 2. Install dependencies

```bash
uv sync
cd apps/web && pnpm install && pnpm build && cd ../..
```

### 3. Run the data pipeline

```bash
# Full pipeline: crawl + parse + embed
uv run python scripts/manage.py pipeline

# Or individual steps
uv run python scripts/crawl.py
uv run python scripts/parse.py
uv run python scripts/index.py
```

### 4. Build knowledge graph (optional)

```bash
uv run python scripts/build_graph.py --content-types guide inspection

# Verify
psql $DATABASE_URL -c "SELECT count(*) FROM canadian_ai.graph_nodes;"
psql $DATABASE_URL -c "SELECT count(*) FROM canadian_ai.graph_edges;"
```

## PM2 Process Management

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'zeever-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3033',
      env: {
        NODE_ENV: 'production',
        PORT: '3033',
        API_URL: 'http://127.0.0.1:3034',
      },
    },
    {
      name: 'zeever-api',
      interpreter: '.venv/bin/python',
      script: '-m',
      args: 'uvicorn query_engine.api:app --host 127.0.0.1 --port 3034',
      env: {
        PATH: '.venv/bin:' + process.env.PATH,
      },
    },
  ],
};
```

### Start services

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow instructions to enable on boot
```

### Verify

```bash
pm2 status
curl http://127.0.0.1:3034/health    # {"status":"ok"}
curl http://127.0.0.1:3033           # HTML
```

## Apache Configuration

### Proxy directives

Add to your Apache vhost config:

```apache
ProxyPreserveHost On

# API routes go to FastAPI
ProxyPass /api/ http://127.0.0.1:3034/api/
ProxyPassReverse /api/ http://127.0.0.1:3034/api/

# Everything else goes to Next.js
ProxyPass / http://127.0.0.1:3033/
ProxyPassReverse / http://127.0.0.1:3033/
```

### Enable modules

```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

### SSL

Use Let's Encrypt via certbot or your hosting panel:

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

## Updating

```bash
git pull
uv sync
cd apps/web && pnpm install && pnpm build && cd ../..
pm2 restart all
```

## Auto-deploy webhook (optional)

A webhook listener on port 9033 auto-deploys on push to main.

1. Generate a secret: `openssl rand -hex 32`
2. Add to `.env`: `DEPLOY_WEBHOOK_SECRET=your_secret`
3. Add webhook PM2 process and Apache proxy rule for `/deploy`
4. Configure GitHub webhook: Settings > Webhooks, payload URL `https://yourdomain.com/deploy`

## Data pipeline scheduling

```bash
# Weekly re-crawl (Sunday 3am)
crontab -e
0 3 * * 0 cd /path/to/zeever_ca && uv run python scripts/pipeline.py >> /var/log/zeever-pipeline.log 2>&1
```

## Monitoring

```bash
pm2 logs                  # live logs
pm2 logs zeever-api       # API only
pm2 monit                 # CPU/memory dashboard
```

## Resource estimates

| Component | RAM | Disk |
|-----------|-----|------|
| PostgreSQL + pgvector | ~500MB | ~2GB |
| FastAPI (uvicorn) | ~200MB | — |
| Next.js (production) | ~150MB | ~100MB |
| PM2 | ~50MB | — |
| OS + Apache | ~1GB | — |
| **Total** | **~1.9GB** | **~2.1GB** |

## Troubleshooting

**API returns 502:** Check `pm2 logs zeever-api` — likely missing env var or database connection issue.

**Frontend can't reach backend:** Verify `API_URL=http://127.0.0.1:3034` in ecosystem config and API process is running.

**Database connection refused:** Check PostgreSQL is running (`sudo systemctl status postgresql`) and `.env` connection string is correct.

**Embeddings fail:** Verify LLM provider API key is set in `.env`.
