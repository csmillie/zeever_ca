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

### 4. Node.js 22 + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
```

pnpm is only needed on the server if you build the web app there. See
"Where the web build happens" below.

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
```

The web app is built separately; see "Where the web build happens".

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

## Where the web build happens

`apps/web/next.config.js` sets `output: 'standalone'`, so a build produces a
self-contained server (`server.js` plus only the `node_modules` it needs)
rather than an app that runs through `next start`. A clean build peaks near
2 GB across its process tree, which is more than a small VPS can spare next to
PostgreSQL and the API, so there are two ways to get one onto the server.

**Build in CI (what zeever.ca does).** `.github/workflows/web-build.yml` runs on
every push to `main`: it runs the web tests, builds, copies `public/` and
`.next/static` into the standalone tree, refuses to ship if an `.env` was traced
into the bundle, and uploads `standalone-<sha>.tar.gz` with its `.sha256` as a
workflow artifact. The server downloads that artifact rather than building
(`scripts/fetch-web-runtime.js`), which needs two settings in `.env`:

```bash
# Fine-grained personal access token, scoped to your repository only, with a
# single permission: Actions: Read-only. Enough to find the run for a commit
# and download its artifact; it cannot push, merge or start a workflow.
DEPLOY_GITHUB_TOKEN=
DEPLOY_GITHUB_REPO=your-github-user/your-fork
```

**Build on the server.** If the machine has the memory, build in place:

```bash
pnpm install
pnpm build
```

Either way the runtime is unpacked into `.runtime-<sha>`, and `.runtime` is a
symlink to the current one. The PM2 entry points at the symlink, so publishing a
new build is a symlink flip and a reload, and the entry itself never changes.

### Rolling back

The deploy keeps two generations on disk:

```bash
ls -d .runtime-*                            # current target plus one previous
ln -sfn "$PWD/.runtime-<older-sha>" .runtime.swap
mv -T .runtime.swap .runtime
pm2 reload zeever-web
```

The previous generation is kept for a second reason. A browser still holding the
old HTML asks for the old content-hashed chunk files, which the new build does
not contain, and the page goes blank with a `ChunkLoadError`. The deploy copies
the previous generation's `.next/static` into the new runtime so those requests
still succeed.

## PM2 Process Management

### ecosystem.config.js

`ecosystem.config.js` is not part of the repository, since it carries
server-specific paths and environment. A minimal one:

```javascript
module.exports = {
  apps: [
    {
      name: 'zeever-web',
      cwd: '/path/to/zeever_ca',
      script: '/path/to/zeever_ca/.runtime/apps/web/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3033',
        // Required. The generated server.js binds to process.env.HOSTNAME, and
        // a login shell exports HOSTNAME as the machine's name.
        HOSTNAME: '127.0.0.1',
        API_URL: 'http://127.0.0.1:3034',
      },
    },
    {
      name: 'zeever-api',
      cwd: '/path/to/zeever_ca',
      script: '.venv/bin/python',
      args: '-m uvicorn query_engine.api:app --host 127.0.0.1 --port 3034',
    },
    {
      name: 'zeever-deploy',
      cwd: '/path/to/zeever_ca',
      script: 'scripts/deploy-webhook.js',
      env: {
        DEPLOY_REPO_DIR: '/path/to/zeever_ca',
        // Where the deploy finds this file, to start an app PM2 has lost.
        // Defaults to ecosystem.config.js in DEPLOY_REPO_DIR.
        PM2_CONFIG: '/path/to/ecosystem.config.js',
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

### Maintenance page

`maintenance/index.html` is a self-contained page (no fonts, stylesheet, script
or images) for Apache to serve while the Next.js app is down or restarting. It
refreshes every 20 seconds, so a visitor who lands on it mid-deploy gets the
site back without doing anything. The exclusion must come **before** the
catch-all proxy rule:

```apache
ProxyPass /maintenance !
Alias /maintenance /path/to/zeever_ca/maintenance
<Directory /path/to/zeever_ca/maintenance>
    Require all granted
    Options -Indexes
</Directory>

ErrorDocument 502 /maintenance/index.html
ErrorDocument 503 /maintenance/index.html
ErrorDocument 504 /maintenance/index.html
```

If you also set `ProxyErrorOverride On`, limit it to page routes. Applied to
`/api/` it replaces the API's JSON error, which names the cause, with the
maintenance HTML.

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

By hand:

```bash
git pull
uv sync
pm2 restart zeever-api
# then publish a new web runtime, from CI or a local build (see above)
pm2 reload zeever-web
```

## Auto-deploy webhook (optional)

`scripts/deploy-webhook.js` listens on port 9033 and deploys on a push to
`main`. It pulls, runs `uv sync`, restarts `zeever-api` only when the pull
touched Python code or the lockfile (and checks `/health` answers), waits for
the CI build of that exact commit, refuses to deploy a commit whose build
failed, then downloads, verifies and unpacks the artifact, flips `.runtime` and
reloads `zeever-web`, checking the process really restarted. Anything that fails
before the flip leaves the running site untouched; anything after it flips back.
The deploy runs detached and writes `.deploy.log` and `.deploy-status.json` in
the repository root.

1. Generate a secret: `openssl rand -hex 32`
2. Add to `.env`: `DEPLOY_WEBHOOK_SECRET=your_secret`, plus the
   `DEPLOY_GITHUB_*` settings above
3. Add the `zeever-deploy` PM2 process and an Apache proxy rule for `/deploy`
4. Configure the GitHub webhook: Settings > Webhooks, payload URL
   `https://yourdomain.com/deploy`

Optional: `DEPLOY_ALERT_EMAIL` mails the tail of the deploy log through the
local MTA when a deploy fails, with credentials stripped first.

A change to `deploy-webhook.js` takes effect only after `zeever-deploy`
restarts, because the running process holds the old code. The webhook restarts
itself after a successful deploy that changed it, so the first deploy after
such a change still runs the old logic; reload it by hand to skip that:

```bash
pm2 reload zeever-deploy
```

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
