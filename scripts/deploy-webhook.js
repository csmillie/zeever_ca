const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const path = require('path');

const PORT = 9033;
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET || '';
const REPO_DIR = process.env.DEPLOY_REPO_DIR || process.cwd();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const UV = process.env.UV_PATH || '/usr/local/bin/uv';
const PNPM = process.env.PNPM_PATH || '/usr/local/bin/pnpm';

if (!SECRET) {
  console.error('FATAL: DEPLOY_WEBHOOK_SECRET is not set. Refusing to start without authentication.');
  process.exit(1);
}

function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  const sigBuffer = Buffer.from(signature || '');
  const digestBuffer = Buffer.from(digest);
  if (sigBuffer.length !== digestBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, sigBuffer);
}

let pipelineRunning = false;

function deploy() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting deploy...`);

  try {
    const commands = [
      'git pull',
      `${UV} sync`,
      `cd apps/web && ${PNPM} install && ${PNPM} build`,
    ];

    for (const cmd of commands) {
      console.log(`  Running: ${cmd}`);
      execSync(cmd, { cwd: REPO_DIR, stdio: 'inherit', timeout: 300000 });
    }

    // Reload all processes from ecosystem config to pick up any new env vars
    console.log('  Reloading PM2 processes from ecosystem config...');
    execSync('pm2 delete zeever-web zeever-api 2>/dev/null', { stdio: 'inherit' });
    try {
      execSync(`pm2 start ${REPO_DIR}/ecosystem.config.js --only zeever-web,zeever-api`, { stdio: 'inherit' });
      execSync('pm2 save', { stdio: 'inherit' });
    } catch (startErr) {
      console.error(`  CRITICAL: PM2 start failed after delete. Processes may be down. Error: ${startErr.message}`);
      // Attempt recovery with simple restart
      try {
        execSync(`pm2 start ${REPO_DIR}/ecosystem.config.js`, { stdio: 'inherit' });
        execSync('pm2 save', { stdio: 'inherit' });
        console.log('  Recovery: restarted all processes from ecosystem config.');
      } catch (recoveryErr) {
        console.error(`  CRITICAL: Recovery also failed. Manual intervention required. Error: ${recoveryErr.message}`);
      }
    }

    console.log(`[${timestamp}] Deploy complete.`);
  } catch (err) {
    console.error(`[${timestamp}] Deploy failed:`, err.message);
  }
}

function runPipeline(options = {}) {
  if (pipelineRunning) {
    console.log('Pipeline already running, skipping.');
    return;
  }

  const { skipCrawl = false, action = 'pipeline', categories = [] } = options;
  pipelineRunning = true;
  const timestamp = new Date().toISOString();

  let args;
  let label;
  switch (action) {
    case 'gaps':
      args = ['run', 'python', 'scripts/crawl_gaps.py'];
      label = 'gap fill';
      break;
    case 'recrawl':
      args = ['run', 'python', 'scripts/recrawl.py'];
      label = 'recrawl';
      break;
    case 'download-pdfs':
      args = ['run', 'python', 'scripts/download_pdfs.py', '--categories', ...categories];
      label = `PDF download (${categories.join(', ')})`;
      break;
    default:
      args = ['run', 'python', 'scripts/pipeline.py'];
      if (skipCrawl) args.push('--skip-crawl');
      label = `pipeline${skipCrawl ? ' (skip crawl)' : ''}`;
      break;
  }

  console.log(`[${timestamp}] Starting ${label}...`);

  // Redirect child stdio to a log file so it doesn't block the webhook
  // server's event loop during long crawls. child.unref() lets the
  // webhook server exit cleanly without waiting for the pipeline.
  let logFile;
  try {
    logFile = fs.openSync('/tmp/zeever-pipeline.log', 'a');
  } catch (err) {
    pipelineRunning = false;
    console.error(`Failed to open pipeline log file: ${err.message}`);
    return;
  }

  const child = spawn(UV, args, {
    cwd: REPO_DIR,
    stdio: ['ignore', logFile, logFile],
    detached: false,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  child.unref();

  child.on('close', (code) => {
    pipelineRunning = false;
    try { fs.closeSync(logFile); } catch {}
    const endTime = new Date().toISOString();
    if (code === 0) {
      console.log(`[${endTime}] Pipeline complete.`);
      try {
        execSync('pm2 restart zeever-api', { stdio: 'inherit' });
      } catch {
        console.log('  PM2 restart after pipeline failed.');
      }
    } else {
      console.error(`[${endTime}] Pipeline failed with code ${code}.`);
    }
  });

  child.on('error', (err) => {
    pipelineRunning = false;
    try { fs.closeSync(logFile); } catch {}
    console.error(`Pipeline spawn error: ${err.message}`);
  });
}

function parseBody(req, res, callback) {
  let body = '';
  let bodySize = 0;

  req.on('data', chunk => {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
      res.writeHead(413);
      res.end('Payload too large');
      req.destroy();
      return;
    }
    body += chunk;
  });

  req.on('end', () => {
    if (bodySize > MAX_BODY_SIZE) return;
    callback(body);
  });
}

const server = http.createServer((req, res) => {
  // Deploy endpoint (GitHub webhook)
  if (req.method === 'POST' && req.url === '/deploy') {
    parseBody(req, res, (body) => {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(body, signature)) {
        console.log('Invalid signature, rejecting.');
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        const payload = JSON.parse(body);
        if (payload.ref && payload.ref !== 'refs/heads/main') {
          console.log(`Ignoring push to ${payload.ref}`);
          res.writeHead(200);
          res.end('Ignored');
          return;
        }
      } catch {
        // Not JSON or not a push event
      }

      res.writeHead(200);
      res.end('Deploying');
      setTimeout(deploy, 100);
    });

  // Pipeline endpoint (trigger crawl + parse + embed)
  } else if (req.method === 'POST' && req.url === '/pipeline') {
    parseBody(req, res, (body) => {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(body, signature)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (pipelineRunning) {
        res.writeHead(409);
        res.end('Pipeline already running');
        return;
      }

      let options = {};
      try {
        const payload = JSON.parse(body);
        options = {
          skipCrawl: payload.skip_crawl === true,
          action: payload.action || 'pipeline',
          categories: Array.isArray(payload.categories) ? payload.categories : [],
        };
      } catch {}

      res.writeHead(200);
      res.end('Pipeline started');
      setTimeout(() => runPipeline(options), 100);
    });

  // Pipeline status — read from status file for detailed progress
  } else if (req.method === 'GET' && req.url === '/pipeline/status') {
    const statusFile = process.env.PIPELINE_STATUS_FILE || '/tmp/zeever-pipeline-status.json';
    fs.readFile(statusFile, 'utf8', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (err || !data) {
        res.end(JSON.stringify({ running: pipelineRunning }));
      } else {
        try {
          const parsed = JSON.parse(data);
          // Reconcile: if process exited but status file still says running (e.g. SIGKILL/OOM)
          if (!pipelineRunning && parsed.running) {
            parsed.running = false;
            parsed.step = parsed.step === 'starting' ? 'failed' : parsed.step;
          }
          res.end(JSON.stringify(parsed));
        } catch {
          res.end(JSON.stringify({ running: pipelineRunning }));
        }
      }
    });

  // Health check
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('ok');

  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Webhook server listening on http://127.0.0.1:${PORT}`);
  console.log(`  POST /deploy    — deploy code (GitHub webhook)`);
  console.log(`  POST /pipeline  — run pipeline (actions: pipeline, gaps, recrawl, download-pdfs)`);
  console.log(`  GET  /pipeline/status — check if pipeline is running`);
  console.log(`  GET  /health    — health check`);
  console.log(`Repo: ${REPO_DIR}`);
});
