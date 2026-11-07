#!/usr/bin/env node
/**
 * Download the CI-built web runtime for one commit.
 *
 * The build moved off the VPS: a clean `next build` peaks near 2GB across its
 * process tree, and the 4GB box is shared with PostgreSQL, the API, this
 * webhook, and the neighbouring sites. The build always succeeded.
 * The neighbours were what paid for it.
 *
 * Usage:
 *   node scripts/fetch-web-runtime.js <sha> <output-dir>
 *
 * Writes <output-dir>/runtime.zip and prints nothing on stdout except that
 * path, so the caller can capture it. Progress goes to stderr.
 *
 * Environment:
 *   DEPLOY_GITHUB_TOKEN   fine-grained PAT, read-only on Actions. Required.
 *   DEPLOY_GITHUB_REPO    owner/name. Defaults to csmillie/zeever_ca. The
 *                         repo answers to its old name zeever-ca by redirect;
 *                         the canonical one is what the API returns.
 *   DEPLOY_FETCH_TIMEOUT  seconds to wait for a run to finish. Default 900.
 *
 * Exit codes are meaningful to the deploy:
 *   0  artifact downloaded
 *   1  a problem worth failing the deploy over (build failed, timed out,
 *      no run for this commit)
 *   2  the run succeeded but its artifact is gone: expired, or a run that
 *      never uploaded one. The deploy can recover from this when the commit
 *      is already live, by copying the running tree instead.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.github.com';
const WORKFLOW_PATH = '.github/workflows/web-build.yml';
const POLL_INTERVAL_MS = 15_000;

const [, , SHA, OUT_DIR] = process.argv;
const TOKEN = process.env.DEPLOY_GITHUB_TOKEN || '';
const REPO = process.env.DEPLOY_GITHUB_REPO || 'csmillie/zeever_ca';
const TIMEOUT_MS = (Number(process.env.DEPLOY_FETCH_TIMEOUT) || 900) * 1000;

function die(message, code = 1) {
  console.error(`fetch-web-runtime: ${message}`);
  process.exit(code);
}

function log(message) {
  console.error(`  ${message}`);
}

if (!SHA || !OUT_DIR) die('usage: fetch-web-runtime.js <sha> <output-dir>');
if (!TOKEN) die('DEPLOY_GITHUB_TOKEN is not set. Cannot reach the Actions API.');
if (typeof fetch !== 'function') {
  die(`Node ${process.version} has no global fetch. Node 18 or newer is required.`);
}

async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'zeever-deploy',
    },
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    die(
      `GitHub returned ${res.status} for ${pathname}. The token is missing, ` +
        `expired, or lacks read access to Actions on ${REPO}.\n${body.slice(0, 300)}`
    );
  }
  if (!res.ok) die(`GitHub returned ${res.status} for ${pathname}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The run for this exact commit, from this exact workflow.
 *
 * Filtered by `path` rather than by name: a workflow's name is a string in the
 * file and can be edited, while the path is what identifies it to the API. The
 * repo also runs an AI code-review workflow on the same commits, and deploying
 * on the strength of a review passing would be nonsense.
 */
async function findRun() {
  const data = await api(
    `/repos/${REPO}/actions/runs?head_sha=${encodeURIComponent(SHA)}&per_page=100`
  );
  const runs = (data.workflow_runs || []).filter((r) => r.path === WORKFLOW_PATH);
  if (!runs.length) return null;
  // Newest first, so a re-run supersedes the original.
  runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return runs[0];
}

async function waitForRun() {
  const deadline = Date.now() + TIMEOUT_MS;
  let run = null;
  while (Date.now() < deadline) {
    run = await findRun();
    if (run && run.status === 'completed') return run;
    if (!run) {
      log(`No ${WORKFLOW_PATH} run for ${SHA.slice(0, 8)} yet; waiting.`);
    } else {
      log(`Run ${run.id} is ${run.status}; waiting.`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (!run) {
    die(
      `No ${WORKFLOW_PATH} run exists for ${SHA} after ` +
        `${TIMEOUT_MS / 1000}s. Was the commit pushed to GitHub?`
    );
  }
  die(`Run ${run.id} was still ${run.status} after ${TIMEOUT_MS / 1000}s.`);
}

async function main() {
  log(`Looking for a ${WORKFLOW_PATH} run for ${SHA.slice(0, 8)} on ${REPO}.`);
  const run = await waitForRun();

  // Belt and braces. The query above is `?head_sha=<SHA>`, so GitHub has
  // already filtered to runs for this commit and this cannot fire today. It is
  // here so the guarantee is stated where it is relied on rather than living
  // implicitly in a query string three functions away, and so a future refactor
  // that drops or loosens that parameter fails loudly instead of quietly
  // deploying a runtime built from a different commit.
  if (String(run.head_sha).toLowerCase() !== String(SHA).toLowerCase()) {
    die(
      `Run ${run.id} was built from ${run.head_sha}, not ${SHA}.\n` +
        `  Refusing to deploy a runtime built from a different commit.`
    );
  }

  if (run.conclusion !== 'success') {
    die(
      `The CI build for ${SHA.slice(0, 8)} concluded "${run.conclusion}".\n` +
        `  ${run.html_url}\n` +
        `  Refusing to deploy a commit whose build did not pass.`
    );
  }
  log(`Run ${run.id} succeeded.`);

  const { artifacts = [] } = await api(`/repos/${REPO}/actions/runs/${run.id}/artifacts`);
  const wanted = `standalone-${SHA}`;
  const artifact = artifacts.find((a) => a.name === wanted);
  // GitHub lists an expired artifact with `expired: true` for a while and then
  // drops it from the listing altogether, so a missing artifact on a run older
  // than the retention window is almost always the same case. Reporting it as
  // "only pushes to main upload" sent the operator looking at the wrong thing.
  if (!artifact) {
    die(
      `Run ${run.id} succeeded but published no artifact named ${wanted}.\n` +
        `  Found: ${artifacts.map((a) => a.name).join(', ') || '(none)'}\n` +
        `  The run is from ${run.created_at}. If that is more than 7 days ago the\n` +
        `  artifact expired and GitHub has purged it. Otherwise the run was not a\n` +
        `  push to main, which is the only event that uploads one.\n` +
        `  Re-run the workflow for this commit (Actions -> Web build -> Run workflow),\n` +
        `  or set DEPLOY_ALLOW_LOCAL_BUILD=1 to build on the box this once.`,
      2
    );
  }
  if (artifact.expired) {
    die(
      `Artifact ${wanted} has expired (retention is 7 days).\n` +
        `  Re-run the workflow for this commit (Actions -> Web build -> Run workflow),\n` +
        `  or set DEPLOY_ALLOW_LOCAL_BUILD=1 to build on the box this once.`,
      2
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zipPath = path.join(OUT_DIR, 'runtime.zip');
  log(`Downloading ${wanted} (${(artifact.size_in_bytes / 1048576).toFixed(1)}MB).`);

  const res = await fetch(artifact.archive_download_url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'zeever-deploy',
    },
    redirect: 'follow',
  });
  if (!res.ok) die(`Artifact download returned ${res.status}.`);

  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const written = fs.statSync(zipPath).size;
  if (written === 0) die('Downloaded artifact is empty.');
  log(`Wrote ${zipPath} (${(written / 1048576).toFixed(1)}MB).`);

  process.stdout.write(`${zipPath}\n`);
}

main().catch((err) => die(err.stack || String(err)));
