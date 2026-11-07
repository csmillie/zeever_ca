const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 9033;
// The ports zeever-web and zeever-api listen on, used by the
// post-reload smoke tests. These match the port registry and the PM2 config;
// see docs/DEPLOYMENT.md.
const WEB_PORT = 3033;
const API_PORT = 3034;
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET || '';
const REPO_DIR = process.env.DEPLOY_REPO_DIR || process.cwd();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const UV = process.env.UV_PATH || '/usr/local/bin/uv';
const PNPM = process.env.PNPM_PATH || '/usr/local/bin/pnpm';
// The web runtime is built by GitHub Actions and downloaded here. It is no
// longer built on this box.
//
// A clean `next build` peaks near 2GB resident across its process tree. This
// box has 4GB, shared with PostgreSQL, the API, this webhook, and the
// neighbouring sites. The build was never the thing that failed: it
// succeeded every time, while the memory pressure it created restarted the
// neighbours. Capping the heap (this file used to set 512MB) only traded that
// for builds dying in the TypeScript check.
//
// Set DEPLOY_ALLOW_LOCAL_BUILD=1 to build here anyway, for the case where CI is
// unreachable and the site must ship. It is an escape hatch, not a mode.
const ALLOW_LOCAL_BUILD = process.env.DEPLOY_ALLOW_LOCAL_BUILD === '1';
// Node's old-space limit for that escape-hatch build only, in MB. 768 is enough
// for the TypeScript check to finish and small enough that the box survives it.
const BUILD_HEAP_MB = process.env.DEPLOY_BUILD_HEAP_MB || '768';
// The PM2 config that defines zeever-web and zeever-api. Not in the repository:
// it carries server-specific paths and environment (see docs/DEPLOYMENT.md).
const PM2_CONFIG = process.env.PM2_CONFIG || path.join(REPO_DIR, 'ecosystem.config.js');
// The webhook runs as the PM2 user, so it invokes pm2 directly.
const PM2 = 'pm2';

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

// Hash of this file as it was when the process started.
//
// deploy() builds its shell script from THIS module, in memory. `git pull`
// rewrites the file on disk and changes nothing about the running process, so a
// fix to the deploy does not apply to the deploy that pulls it. On 2026-09-10
// that took the site down for the length of an outage: three merged fixes
// (set -e chains, the build heap ceiling, and the .next-prev guard) were all
// inert, because the webhook process had been running since before any of them
// landed. The commit that would have prevented the failure arrived in the same
// push that caused it.
//
// So the deploy compares this against the file it just pulled, and restarts the
// webhook once the deploy has finished if they differ.
const SELF_HASH = crypto
  .createHash('sha256')
  .update(fs.readFileSync(__filename))
  .digest('hex');

// Where the detached deploy records what happened, so a failure is visible
// instead of silent. GitHub gets its 200 the moment the payload is accepted, long
// before the build runs, so the webhook response has never meant anything.
const STATUS_FILE = path.join(REPO_DIR, '.deploy-status.json');
const DEPLOY_LOG = path.join(REPO_DIR, '.deploy.log');
// A push that arrived while a deploy was running. That deploy pulled before the
// push landed, so without this the new commit sat on main undeployed until
// some later push: on 2026-11-02 the merge of #321, a critical next fix, came
// nine seconds after #320's and was skipped, and nothing said so. A file, not
// a flag, because a deploy that changes this script restarts the webhook as
// its last step, which would drop anything held in memory.
const PENDING_FILE = path.join(REPO_DIR, '.deploy-pending');
const PENDING_POLL_MS = 15_000;

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return { state: 'unknown' };
  }
}

/**
 * Run the deploy in a detached child process.
 *
 * This webhook is itself managed by the shared PM2 config, so anything that
 * reloads that config restarts this process, and every execSync running inside
 * it dies too. On 2026-08-30 that is exactly what happened: git pull succeeded,
 * uv sync started, the process restarted, and pnpm build never ran. The post
 * that triggered the deploy sat on disk, unbuilt, while GitHub showed a 200 and
 * the site served a stale bundle.
 *
 * Detaching means the deploy outlives its parent. The shell writes the status
 * file itself, so the record survives even if this listener is gone by the time
 * the build finishes.
 */
function deploy() {
  const current = readStatus();
  if (current.state === 'running') {
    const age = Date.now() - new Date(current.started).getTime();
    // A build that has run for over twenty minutes is stuck, not busy.
    if (age < 20 * 60 * 1000) {
      console.log(`Deploy already running since ${current.started}; queued one more for when it finishes.`);
      fs.writeFileSync(PENDING_FILE, `${new Date().toISOString()}\n`);
      deployWhenIdle();
      return;
    }
    console.warn(`Previous deploy has been running since ${current.started}; starting anyway.`);
  }

  const started = new Date().toISOString();
  console.log(`[${started}] Starting detached deploy. Progress: ${DEPLOY_LOG}`);

  // Reload below is by process NAME, never by config file. `pm2 startOrReload
  // <config>` applies the whole ecosystem, which includes this webhook, so the
  // deploy would restart the process running it. `pm2 reload <name>` cannot
  // touch anything else. The `pm2 start --only` fallback covers the one thing
  // startOrReload gave us that reload does not: starting an app that is not
  // currently running.
  const script = [
    'set -o pipefail',
    `STATUS=${JSON.stringify(STATUS_FILE)}`,
    `STARTED=${JSON.stringify(started)}`,
    `REPO=${JSON.stringify(REPO_DIR)}`,
    `NODE=${JSON.stringify(process.execPath)}`,
    `UV=${JSON.stringify(UV)}`,
    `PNPM=${JSON.stringify(PNPM)}`,
    `PM2=${JSON.stringify(PM2)}`,
    `PM2_CONFIG=${JSON.stringify(PM2_CONFIG)}`,
    `ALERT_EMAIL=${JSON.stringify(process.env.DEPLOY_ALERT_EMAIL || '')}`,
    `ALERT_FROM=${JSON.stringify(process.env.DEPLOY_ALERT_FROM || '')}`,
    `SENDMAIL=${JSON.stringify(process.env.DEPLOY_SENDMAIL || '')}`,
    `WEB_PORT=${JSON.stringify(String(WEB_PORT))}`,
    `API_PORT=${JSON.stringify(String(API_PORT))}`,
    `ALLOW_LOCAL_BUILD=${ALLOW_LOCAL_BUILD ? '1' : '0'}`,
    `BUILD_HEAP_MB=${JSON.stringify(String(BUILD_HEAP_MB))}`,
    'cd "$REPO"',
    // One deploy at a time, enforced by the kernel instead of by a file. The
    // twenty minute status guard in deploy() still exists, but it reads a
    // record a crashed deploy can leave saying "running" forever. A flock
    // cannot outlive the process holding it.
    'exec 9>"$REPO/.deploy.lock"',
    'if ! flock -n 9; then',
    '  echo "Another deploy holds $REPO/.deploy.lock. Exiting."',
    '  exit 0',
    'fi',
    // Cleared here, holding the lock and before the pull, because this pull
    // covers every push queued so far, and a push that lands later writes the
    // marker again. Not in deploy(): a shell that loses the lock race above
    // exits without pulling, and a marker cleared before that would be lost.
    `rm -f ${JSON.stringify(PENDING_FILE)}`,
    // The commit is recorded alongside the state, which it was not before.
    //
    // /deploy/status could say a deploy failed at "build" but not which commit
    // it was building, so answering "is production on the change I merged?"
    // meant reading the log. It also gives the failure email a source for the
    // SHA that does not depend on how far the shell got before it died: SHA is
    // only assigned after git pull, BEFORE_SHA only after the first rev-parse,
    // and both are empty if it failed earlier still.
    'finish() {',
    '  printf \'{"state":"%s","started":"%s","finished":"%s","step":"%s","sha":"%s"}\\n\' \\',
    '    "$1" "$STARTED" "$(date -Is)" "$2" "${SHA:-${BEFORE_SHA:-}}" > "$STATUS"',
    '}',
    // The live runtime is a symlink to a per-commit directory, so publishing a
    // new one is a single rename and rolling back is the same rename with the
    // old target. The previous scheme moved .next aside and moved it back,
    // which left a window where the directory did not exist at all.
    'RUNTIME="$REPO/.runtime"',
    'PREV_TARGET=""',
    // Only meaningful once the symlink has been flipped. Before that there is
    // nothing to undo: the running site is still serving the old runtime,
    // because nothing has pointed it anywhere else.
    'restore() {',
    '  if [ -n "$PREV_TARGET" ] && [ -d "$PREV_TARGET" ]; then',
    '    ln -sfn "$PREV_TARGET" "$REPO/.runtime.swap"',
    '    mv -T "$REPO/.runtime.swap" "$RUNTIME"',
    '    "$PM2" reload zeever-web || true',
    '    echo "Rolled the runtime back to $PREV_TARGET."',
    '  fi',
    '}',
    // Disarms the trap and set -e before doing anything. fail() runs FROM the
    // ERR trap, so a failure inside restore or finish would re-fire it and call
    // fail again, recursing instead of reporting. The deploy would hang with the
    // status stuck on "running", which blocks every later webhook for twenty
    // minutes: precisely the silent failure this file exists to prevent.
    //
    // set +e so the rest of the handler runs to completion. A restore that
    // partially fails must still record the failure, because a status file
    // nobody wrote is worse than one that says less than it should.
    'fail() {',
    '  trap - ERR',
    '  set +e',
    '  restore',
    '  finish failed "$STEP"',
    // After the status file, never before: the durable record is what the next
    // deploy and /deploy/status read, and it must not wait on a mail server.
    // The notifier exits 0 whatever happens for the same reason — a mail
    // problem must not become a second failure stacked on the one being
    // reported. Its own output lands in this log, so a silent alerting path is
    // visible as such.
    '  DEPLOY_ALERT_EMAIL="$ALERT_EMAIL" DEPLOY_ALERT_FROM="$ALERT_FROM" \\',
    '  DEPLOY_SENDMAIL="${SENDMAIL:-/usr/sbin/sendmail}" DEPLOY_REPO_DIR="$REPO" \\',
    // SHA falls back to BEFORE_SHA because the two are assigned at different
    // points: SHA only exists after `git pull` succeeds. A failure in the pull
    // itself — the step most likely to fail first — would otherwise send an
    // email saying "commit unknown" about the one thing the operator needs to
    // identify it by. BEFORE_SHA is the commit still checked out, which is both
    // true and useful.
    '    "$NODE" "$REPO/scripts/notify-deploy-failure.js" "$STEP" "${SHA:-${BEFORE_SHA:-}}" || true',
    '  exit 1',
    '}',
    'trap fail ERR',
    'set -e',
    `SELF=${JSON.stringify(path.join(REPO_DIR, 'scripts', 'deploy-webhook.js'))}`,
    `SELF_HASH_AT_START=${JSON.stringify(SELF_HASH)}`,
    'STEP=git; finish running "$STEP"',
    // Captured before the pull, so the deploy can tell what actually arrived.
    // Empty if this fails, which every later test treats as "assume it changed".
    'BEFORE_SHA=$(git rev-parse HEAD 2>/dev/null || true)',
    // Name what will block the pull, before git does it in a way nobody reads.
    //
    // On 2026-09-22 three files were copied into the repo directory by hand to
    // run a script against the live database. The next merge brought the same
    // paths from origin, and `git pull` refused to overwrite untracked files.
    // Every deploy for two days then died here, at the first step, with the
    // explanation buried in a log — and the failure email said only "step: git".
    //
    // The repository directory is not scratch space. This does not stop anyone
    // using it as such; it makes the consequence legible at the moment it bites,
    // which is the difference between a two-minute fix and two days.
    'git fetch --quiet origin || true',
    // -e OR -L, not -f. `[ -f ]` follows symlinks, so a broken symlink sitting
    // where an incoming file belongs reads as absent while git still refuses to
    // overwrite it. Verified against a scratch repository: of a regular file, a
    // file in a new directory, a broken symlink and an empty directory, git
    // blocks on the first three and ignores the fourth, and `[ -f ]` sees only
    // two of the three it blocks on.
    //
    // A plain directory is excluded for the same reason, from the other side:
    // git creates a file inside an empty directory happily, so flagging one
    // would fail a deploy git would have allowed. A symlink is never excluded,
    // even when it points at a directory, because git does refuse those.
    'BLOCKERS=$(git diff --name-only HEAD origin/main 2>/dev/null | while read -r f; do',
    '  if { [ -L "$f" ] || { [ -e "$f" ] && ! [ -d "$f" ]; }; } \\',
    '     && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1; then',
    '    echo "$f"',
    '  fi',
    'done)',
    'if [ -n "$BLOCKERS" ]; then',
    '  echo "Untracked files sit where incoming commits need to write:"',
    '  printf "  %s\\n" $BLOCKERS',
    '  echo',
    '  echo "The repo directory is not scratch space. Move or delete these, then"',
    '  echo "redeploy. If a file is identical to the incoming one it is safe to"',
    '  echo "delete; check with: git show origin/main:<path> | diff - <path>"',
    '  fail',
    'fi',
    // The same, for tracked files edited on the box. From 2026-10-08 every
    // deploy died at `git pull` for a week: a build had rewritten
    // apps/web/next-env.d.ts and pnpm had added a key to pnpm-workspace.yaml,
    // and git refused to overwrite either. Only files the pull would touch are
    // named, because those are the only ones git refuses on; a stray local edit
    // elsewhere does not stop a deploy git would have allowed.
    'EDITED=$(git diff --name-only HEAD 2>/dev/null | while read -r f; do',
    '  if git diff --name-only HEAD origin/main 2>/dev/null | grep -qxF "$f"; then',
    '    echo "$f"',
    '  fi',
    'done)',
    'if [ -n "$EDITED" ]; then',
    '  echo "Tracked files were edited on this box, and incoming commits change them:"',
    '  printf "  %s\\n" $EDITED',
    '  echo',
    '  echo "If the edit was made by a tool (a build, pnpm install), commit it"',
    '  echo "upstream or ignore the file. Then discard it here and redeploy:"',
    '  echo "  git diff <path>; git checkout -- <path>"',
    '  fail',
    'fi',
    'git pull',
    'SHA=$(git rev-parse HEAD)',
    'echo "Deploying $SHA"',
    // Did that pull change the file this script was generated from? If so, the
    // steps below are the old ones, and the operator needs to know that before
    // reading anything they report. The webhook is restarted at the end so the
    // next deploy runs the new logic; restarting it now would not re-run this
    // deploy with it, and would only make the current run harder to follow.
    'SELF_STALE=0',
    'if [ "$(sha256sum "$SELF" | cut -d" " -f1)" != "$SELF_HASH_AT_START" ]; then',
    '  SELF_STALE=1',
    '  echo "=============================================================="',
    '  echo "WARNING: scripts/deploy-webhook.js changed in that pull."',
    '  echo "This deploy is running the version loaded when the webhook last"',
    '  echo "started, not the one just pulled. The webhook will be restarted"',
    '  echo "when this deploy finishes, so the next one uses the new logic."',
    '  echo "=============================================================="',
    'fi',
    // Python dependencies still install here. Only the Next.js build moved.
    'STEP=uv; finish running "$STEP"',
    // uv deletes and rebuilds .venv when the interpreter it was built for has
    // changed. If this user cannot delete every file in it, uv stops partway
    // and leaves a half-deleted environment behind. The running API survives on
    // modules it already imported, and the next restart cannot start at all.
    // That happened on 2026-10-08: an apt upgrade moved Python 3.12.13 to
    // 3.12.15, and 1,169 root-owned files left by `uv run` from a root shell
    // stopped the rebuild. The API went down at the next PM2 restart, six days
    // later. Refuse before uv touches anything, while .venv is still whole.
    'if [ -d .venv ]; then',
    '  FOREIGN=$(find .venv ! -user "$(id -u)" 2>/dev/null | wc -l)',
    '  if [ "$FOREIGN" -gt 0 ]; then',
    '    echo "$FOREIGN files in .venv are not owned by $(id -un), for example:"',
    '    find .venv ! -user "$(id -u)" -printf "  %u  %TY-%Tm-%Td %TH:%TM  %p\\n" 2>/dev/null | head -5',
    '    echo',
    // Owner only. `chown user:` would also reset the group, which other
    // users of a shared hosting tree may depend on.
    '    echo "uv sync may need to delete .venv, and could not finish. As root:"',
    '    echo "  chown -R $(id -un) $REPO/.venv"',
    '    echo "Then redeploy. Run uv here as $(id -un), never as root:"',
    '    echo "  sudo -u $(id -un) -H uv run ..."',
    // These files come back on their own when the culprit is scheduled: on
    // 2026-10-20 pymupdf bytecode reappeared two days after a rebuild,
    // written by a recrawl in another user's crontab, not root's. The owner printed
    // above names the crontab to look in.
    '    echo "If this recurs, a scheduled job is running uv as that owner:"',
    '    echo "  grep -n \\"uv \\" /var/spool/cron/crontabs/*"',
    '    fail',
    '  fi',
    'fi',
    '"$UV" sync',
    // The API has to be restarted to pick up the code and dependencies that
    // `git pull` and `uv sync` just put on disk. Dropping this in the rewrite
    // would have meant deploys silently stopped shipping Python changes: the
    // files land, uvicorn keeps serving what it loaded at boot, and every
    // indicator says the deploy succeeded.
    //
    // This is not the restart that PR #270 removed. That one fired after every
    // *pipeline* run, where the API's code had not changed and a bounce only
    // dropped in-flight requests. A deploy is the opposite case.
    //
    // Placed before the runtime swap so that a failure here fails the deploy
    // while PREV_TARGET is still empty, and restore() correctly does nothing.
    // Rolling the web runtime back would not fix an API that failed to start.
    // ...but only when this pull actually brought Python with it.
    //
    // uvicorn runs single-process in fork mode, so a restart drops every request
    // in flight. That is the reasoning PR #270 recorded when it stopped bouncing
    // the API after each pipeline run, and it applies just as well to a deploy
    // that only touched the website: there is nothing new for the API to load,
    // and a resident mid-question pays for the bounce anyway.
    //
    // The test fails OPEN. If the range cannot be determined — a shallow clone,
    // a first run, a git error — the API is restarted. Serving stale Python
    // silently is the failure this whole step exists to prevent; an unnecessary
    // restart merely costs what every deploy used to cost.
    'API_NEEDS_RESTART=1',
    'if [ -n "$BEFORE_SHA" ]; then',
    // Between the two SHAs, not HEAD~1..HEAD: a deploy can pull many commits at
    // once, and one push often contains several.
    '  CHANGED=$(git diff --name-only "$BEFORE_SHA" "$SHA" 2>/dev/null || echo "__UNKNOWN__")',
    '  if [ "$CHANGED" = "__UNKNOWN__" ]; then',
    '    echo "Could not diff $BEFORE_SHA..$SHA; restarting the API to be safe."',
    '  elif printf \'%s\\n\' "$CHANGED" | grep -qE \'(\\.py$|(^|/)pyproject\\.toml$|(^|/)uv\\.lock$)\'; then',
    '    echo "This pull touched Python, pyproject.toml or uv.lock."',
    '  else',
    '    API_NEEDS_RESTART=0',
    '  fi',
    'fi',
    'if [ "$API_NEEDS_RESTART" = "0" ]; then',
    '  echo "No Python changes in $BEFORE_SHA..$SHA; leaving zeever-api running."',
    'else',
    'STEP=api; finish running "$STEP"',
    'API_BEFORE=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-api)',
    '"$PM2" reload zeever-api || "$PM2" start "$PM2_CONFIG" --only zeever-api',
    'sleep 3',
    'API_AFTER=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-api)',
    'if [ "$API_AFTER" -le "$API_BEFORE" ]; then',
    '  echo "zeever-api did not restart: start time is unchanged at $API_AFTER."',
    '  echo "  It is still serving the code from before this pull."; fail',
    'fi',
    'API_CODE=""',
    'for attempt in 1 2 3 4 5 6 7 8 9 10; do',
    '  API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$API_PORT/health" || true)',
    '  if [ "$API_CODE" = "200" ]; then break; fi',
    '  sleep 2',
    'done',
    'if [ "$API_CODE" != "200" ]; then',
    '  echo "The API did not answer 200 on 127.0.0.1:$API_PORT/health (last: ${API_CODE:-no response})."; fail',
    'fi',
    // A moved start time plus one 200 is not yet proof. A process that boots,
    // answers, dies and is revived by PM2 produces both, and the uptime would
    // have moved again while the health loop was running. So read it once more:
    // the process that answered has to be the same one whose restart was
    // observed. If it moved, this is a crash loop wearing a healthy face.
    'API_SETTLED=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-api)',
    'if [ "$API_SETTLED" != "$API_AFTER" ]; then',
    '  echo "zeever-api restarted again during the health check"',
    '  echo "  ($API_AFTER then $API_SETTLED). It is crash looping, not running."; fail',
    'fi',
    'echo "API restarted and healthy on 127.0.0.1:$API_PORT."',
    'fi',
    // Captured HERE, before anything is deleted, and reused by the chunks and
    // swap steps below.
    //
    // Reading it later was a bug: `rm -rf "$NEW"` would delete the live runtime
    // whenever the same commit was deployed twice — a webhook redelivery, or an
    // operator re-running the deploy to pick up a corrected .env, which the env
    // step is built to support. The running Next process would 404 every static
    // chunk for the length of the fetch, no chunks could be carried forward from
    // a directory that no longer existed, and PREV_TARGET would name a deleted
    // path, so restore() could not roll anything back either.
    'CURRENT_TARGET=""',
    'if [ -L "$RUNTIME" ] || [ -d "$RUNTIME" ]; then',
    '  CURRENT_TARGET=$(readlink -f "$RUNTIME" 2>/dev/null || true)',
    'fi',
    'NEW="$REPO/.runtime-$SHA"',
    'REDEPLOY_LIVE=0',
    // Redeploying the live commit gets a fresh directory rather than a refusal.
    // Re-running a deploy is a legitimate thing to do — it is how a corrected
    // .env value is picked up — and it must not require the site to go down
    // first. The old tree stays put, becomes PREV_TARGET at the swap, and is
    // pruned one deploy later like any other previous generation.
    // Basenames, not full paths. CURRENT_TARGET comes from `readlink -f`, which
    // canonicalizes every component, so a single symlink anywhere in $REPO makes
    // the two strings differ while naming the same directory — and the guard
    // would silently stop guarding. Both runtimes always live directly in $REPO,
    // so their basenames are the honest comparison.
    'if [ -n "$CURRENT_TARGET" ] && [ "$(basename "$CURRENT_TARGET")" = ".runtime-$SHA" ]; then',
    '  NEW="$REPO/.runtime-$SHA-$(date +%s)"',
    '  REDEPLOY_LIVE=1',
    '  echo "$SHA is already live; unpacking a fresh copy at $(basename "$NEW")."',
    'fi',
    'SCRATCH="$REPO/.deploy-scratch"',
    'rm -rf "$NEW" "$SCRATCH"',
    'mkdir -p "$NEW" "$SCRATCH"',
    'if [ "$ALLOW_LOCAL_BUILD" = "1" ]; then',
    '  STEP=build; finish running "$STEP"',
    '  echo "DEPLOY_ALLOW_LOCAL_BUILD=1: building on this box instead of fetching."',
    '  cd "$REPO/apps/web"',
    '  export NODE_OPTIONS="--max-old-space-size=$BUILD_HEAP_MB"',
    '  "$PNPM" build',
    // Same assembly the CI job does, because standalone output deliberately
    // omits public/ and .next/static and this box has no CDN to serve them.
    '  APPDIR=.next/standalone/apps/web',
    '  mkdir -p "$APPDIR/.next/static"',
    '  cp -r .next/static/. "$APPDIR/.next/static/"',
    '  cp -r public "$APPDIR/public"',
    '  cp -a .next/standalone/. "$NEW/"',
    '  cd "$REPO"',
    'else',
    '  STEP=fetch; finish running "$STEP"',
    // `|| FETCH_RC=$?` keeps a non-zero exit from firing the ERR trap, so the
    // one recoverable case can be told apart from the rest.
    '  FETCH_RC=0',
    '  ZIP=$("$NODE" scripts/fetch-web-runtime.js "$SHA" "$SCRATCH") || FETCH_RC=$?',
    'fi',
    // Exit 2 is "the run passed but its artifact is gone", which is what a
    // redelivered webhook for a commit deployed more than 7 days ago hits. The
    // live tree is that same commit's artifact, already checksummed when it
    // was deployed, so a copy of it is as good as a fresh download and keeps a
    // redeploy (the way a corrected .env is picked up) from failing on age.
    // cp -a, not cp -r, for the same symlink reason as the tar below. The env
    // step rewrites .env, so nothing the copy brings along survives it.
    //
    // The copy gets the same verify step as a fetched tree (server.js,
    // BUILD_ID, static chunks), and that runs before the swap, so a damaged
    // live tree fails the deploy while the site keeps serving the original.
    // CURRENT_TARGET was read before the fetch. The deploy lock rules out a
    // concurrent prune, but a tree removed by hand in that window should fail
    // with a reason, not a bare cp error.
    'if [ "$ALLOW_LOCAL_BUILD" != "1" ] && [ "$FETCH_RC" = "2" ] && [ "$REDEPLOY_LIVE" = "1" ]; then',
    '  STEP=unpack; finish running "$STEP"',
    '  if [ ! -d "$CURRENT_TARGET" ]; then',
    '    echo "The artifact for $SHA is gone and the live runtime $CURRENT_TARGET no longer exists."; fail',
    '  fi',
    '  echo "The artifact for $SHA is gone, but $SHA is already live."',
    '  echo "  Copying the live runtime $(basename "$CURRENT_TARGET") instead."',
    '  cp -a "$CURRENT_TARGET/." "$NEW/"',
    'elif [ "$ALLOW_LOCAL_BUILD" != "1" ]; then',
    '  if [ "$FETCH_RC" != "0" ]; then fail; fi',
    '  STEP=unpack; finish running "$STEP"',
    '  cd "$SCRATCH"',
    // Actions wraps every artifact in a zip, so this is a zip of a tarball.
    // The tarball is what carries the symlinks.
    '  unzip -q -o "$ZIP"',
    '  TARBALL="standalone-$SHA.tar.gz"',
    '  if [ ! -f "$TARBALL" ] || [ ! -f "$TARBALL.sha256" ]; then',
    '    echo "The artifact did not contain $TARBALL and its checksum."; fail',
    '  fi',
    '  EXPECTED=$(cat "$TARBALL.sha256")',
    '  ACTUAL=$(sha256sum "$TARBALL" | cut -d" " -f1)',
    '  if [ "$EXPECTED" != "$ACTUAL" ]; then',
    '    echo "Checksum mismatch on $TARBALL."',
    '    echo "  expected $EXPECTED"',
    '    echo "  actual   $ACTUAL"',
    '    fail',
    '  fi',
    '  echo "Checksum verified: $ACTUAL"',
    // tar, not cp -r. The runtime contains 29 symlinks, among them
    // @swc/helpers and next itself, and a dereferencing copy turns them into
    // real directories that no longer resolve, producing
    // "Cannot find module '@swc/helpers/...'" the moment the server boots.
    '  tar -xzf "$TARBALL" -C "$NEW"',
    '  cd "$REPO"',
    'fi',
    'APP="$NEW/apps/web"',
    // Step: the environment. The runtime is unpacked fresh every deploy, so
    // whatever the last one wrote is gone and has to be put back.
    'STEP=env; finish running "$STEP"',
    'if [ ! -f "$REPO/.env" ]; then',
    '  echo "No $REPO/.env. The runtime has no environment to run with."; fail',
    'fi',
    'rm -f "$APP/.env"',
    '(umask 077; : > "$APP/.env")',
    'chmod 600 "$APP/.env"',
    'PM2_JSON=$("$PM2" jlist 2>/dev/null || echo "[]")',
    // Only the keys the web app actually reads. The root .env also holds the
    // database URL and every model provider key, and the web app has no use for
    // any of them: it talks to the FastAPI service over HTTP and never touches
    // Postgres. Copying the whole file would put those secrets in a second
    // place for no benefit.
    'for KEY in API_URL A2A_API_KEY MCP_API_KEY; do',
    '  LINE=$(grep -E "^${KEY}=" "$REPO/.env" | tail -1 || true)',
    // The VALUE, not the line. `A2A_API_KEY=` matches ^KEY= and is a perfectly
    // non-empty line, and it is exactly what .env.example ships, so testing the
    // line would wave through the one case this guard exists to catch: dotenv
    // sets the variable to '', checkApiKey() sees a falsy key, and returns true
    // for every caller. An empty value does not lock the endpoint, it opens it.
    '  VALUE=${LINE#*=}',
    // Trailing whitespace and one layer of matched quotes, because `KEY=""` is
    // also empty. Inline comments are deliberately NOT stripped: a secret may
    // legitimately contain a #, and silently truncating one at deploy time
    // would be a worse failure than the one being prevented.
    '  VALUE=$(printf \'%s\' "$VALUE" | sed \'s/[[:space:]]*$//\')',
    // Crude on purpose, and safe because VALUE is NEVER WRITTEN ANYWHERE. It
    // exists solely to answer "is this key empty?". What lands in the runtime
    // .env is "$LINE", the original line, byte for byte, which is why the
    // quoting and any # it contains reach dotenv exactly as the operator wrote
    // them. Stripping a stray quote that had no partner therefore costs
    // nothing, and the alternative is an unreadable pile of escaping for no
    // gain.
    '  VALUE=${VALUE#\\"}; VALUE=${VALUE%\\"}',
    "  VALUE=${VALUE#\\'}; VALUE=${VALUE%\\'}",
    '  if [ -n "$VALUE" ]; then',
    '    printf \'%s\\n\' "$LINE" >> "$APP/.env"',
    '    continue',
    '  fi',
    '  if [ -n "$LINE" ]; then',
    '    echo "  $KEY is present in .env but empty; treating it as unset."',
    '  fi',
    '  if printf \'%s\' "$PM2_JSON" | "$NODE" "$REPO/scripts/pm2-app.js" env-has zeever-web "$KEY"; then',
    '    echo "  $KEY: supplied by the PM2 config rather than .env"',
    '    continue',
    '  fi',
    '  echo "$KEY is set neither in $REPO/.env nor in the PM2 environment."',
    '  if [ "$KEY" = "API_URL" ]; then',
    '    echo "  Without it the web app falls back to http://localhost:3034, which"',
    '    echo "  happens to be right today and would silently stop being right."',
    '  else',
    '    echo "  checkApiKey() and checkMcpApiKey() return true when their key is"',
    '    echo "  unset, so a runtime without it serves that endpoint to anyone."',
    '  fi',
    '  fail',
    'done',
    // Step: carry one generation of hashed chunks forward.
    //
    // A browser holding the old HTML asks for the old chunk filenames. Those
    // names are content-hashed, so the new build does not contain them, and the
    // request 404s. The 404 is served with nosniff, the loader rejects it as a
    // script, and the page goes blank with a ChunkLoadError. Copying the old
    // generation in alongside the new one keeps those requests answerable for
    // as long as the previous runtime is retained.
    'STEP=chunks; finish running "$STEP"',
    // CURRENT_TARGET was captured before the unpack, above, and deliberately is
    // not re-read here: by this point the deploy has already created $NEW, and
    // re-resolving would only reintroduce the ordering the capture exists to fix.
    'if [ -n "$CURRENT_TARGET" ] && [ -d "$CURRENT_TARGET/apps/web/.next/static" ]; then',
    '  cp -rn "$CURRENT_TARGET/apps/web/.next/static/." "$APP/.next/static/" || true',
    '  echo "Carried the previous generation of static chunks forward."',
    'else',
    '  echo "No previous runtime to carry chunks from (first deploy of this kind)."',
    'fi',
    // Step: prove the runtime is a runtime before pointing the site at it.
    // Everything here is a thing that has actually gone wrong somewhere: an
    // empty build directory, a build that never ran, assets that did not copy.
    'STEP=verify; finish running "$STEP"',
    'if [ ! -f "$APP/server.js" ]; then',
    '  echo "No $APP/server.js. This is not a standalone runtime."; fail',
    'fi',
    'if [ ! -s "$APP/.next/BUILD_ID" ]; then',
    '  echo "No usable $APP/.next/BUILD_ID."; fail',
    'fi',
    'PUBLIC_COUNT=$(find "$APP/public" -type f 2>/dev/null | wc -l)',
    'if [ "$PUBLIC_COUNT" -eq 0 ]; then',
    '  echo "public/ is missing or empty: robots.txt, the favicon and every"',
    '  echo "  Open Graph image would 404."; fail',
    'fi',
    'CHUNK_COUNT=$(find "$APP/.next/static" -name "*.js" -type f 2>/dev/null | wc -l)',
    'if [ "$CHUNK_COUNT" -eq 0 ]; then',
    '  echo "No JavaScript under .next/static. Every page would load without its"',
    '  echo "  client bundle."; fail',
    'fi',
    'echo "Verified: BUILD_ID $(cat "$APP/.next/BUILD_ID"), $PUBLIC_COUNT public files, $CHUNK_COUNT static chunks."',
    // Step: publish. A single rename, so no request can observe a half-swapped
    // tree.
    'STEP=swap; finish running "$STEP"',
    'PREV_TARGET="$CURRENT_TARGET"',
    'ln -sfn "$NEW" "$REPO/.runtime.swap"',
    'mv -T "$REPO/.runtime.swap" "$RUNTIME"',
    'echo "Runtime now points at $NEW."',
    // Step: reload, then prove it happened. `pm2 reload` exits 0 for a process
    // it did not manage to replace, and this file already carries two scars
    // from trusting an exit code over an observation.
    'STEP=reload; finish running "$STEP"',
    'UPTIME_BEFORE=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-web)',
    '"$PM2" reload zeever-web || "$PM2" start "$PM2_CONFIG" --only zeever-web',
    '"$PM2" save',
    'sleep 3',
    'UPTIME_AFTER=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-web)',
    'if [ "$UPTIME_AFTER" -le "$UPTIME_BEFORE" ]; then',
    '  echo "zeever-web did not restart: start time is unchanged at $UPTIME_AFTER."',
    '  echo "  The site is still serving the previous runtime."; fail',
    'fi',
    'echo "Process restarted: start time moved from $UPTIME_BEFORE to $UPTIME_AFTER."',
    // And prove it serves. A process that restarted into a crash loop still
    // reports a newer start time every time PM2 revives it.
    'STEP=smoke; finish running "$STEP"',
    'CODE=""',
    'for attempt in 1 2 3 4 5 6 7 8 9 10; do',
    '  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$WEB_PORT/" || true)',
    '  if [ "$CODE" = "200" ]; then break; fi',
    '  sleep 2',
    'done',
    'if [ "$CODE" != "200" ]; then',
    '  echo "The site did not answer 200 on 127.0.0.1:$WEB_PORT (last: ${CODE:-no response})."; fail',
    'fi',
    // Same crash-loop check the API gets. A Next process that boots, serves one
    // request, dies on the next and is revived by PM2 answers 200 exactly once.
    'WEB_SETTLED=$("$PM2" jlist | "$NODE" "$REPO/scripts/pm2-app.js" uptime zeever-web)',
    'if [ "$WEB_SETTLED" != "$UPTIME_AFTER" ]; then',
    '  echo "zeever-web restarted again during the smoke test"',
    '  echo "  ($UPTIME_AFTER then $WEB_SETTLED). It is crash looping, not running."; fail',
    'fi',
    'echo "Serving: 200 from 127.0.0.1:$WEB_PORT."',
    // Step: keep exactly two generations. The current one, and the one whose
    // chunks were carried forward and which a rollback would need.
    'STEP=prune; finish running "$STEP"',
    'rm -rf "$SCRATCH"',
    'KEEP_NEW=$(basename "$NEW")',
    'KEEP_PREV=""',
    'if [ -n "$PREV_TARGET" ]; then KEEP_PREV=$(basename "$PREV_TARGET"); fi',
    'for dir in "$REPO"/.runtime-*; do',
    '  [ -d "$dir" ] || continue',
    '  name=$(basename "$dir")',
    '  if [ "$name" = "$KEEP_NEW" ] || [ "$name" = "$KEEP_PREV" ]; then continue; fi',
    '  rm -rf "$dir"',
    '  echo "Pruned $name."',
    'done',
    'finish ok done',
    'echo "Deploy complete."',
    // Last, and only after the status file says the deploy succeeded.
    //
    // Safe because this shell is detached and unref'd: restarting the webhook
    // that spawned it cannot kill it, which is exactly why the deploy was made
    // detached in the first place. GitHub was answered 200 the moment the
    // payload arrived, long before any of this, so there is no request in
    // flight to interrupt either.
    'if [ "$SELF_STALE" = "1" ]; then',
    '  echo "Restarting zeever-deploy so the next deploy uses the pulled code."',
    '  "$PM2" restart zeever-deploy || echo "  Restart failed; do it by hand."',
    'fi',
  ].join('\n');

  let out;
  try {
    out = fs.openSync(DEPLOY_LOG, 'a');
  } catch (err) {
    console.error(`Cannot open ${DEPLOY_LOG}: ${err.message}`);
    return;
  }

  const child = spawn('bash', ['-c', script], {
    cwd: REPO_DIR,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  fs.closeSync(out);
}

// Runs the queued deploy once the current one is no longer "running". The
// deploy is detached, so its end is only visible in the status file. One
// poller at a time: further pushes during the same deploy just rewrite the
// marker.
//
// It stops only when the marker is gone, which the deploy shell does once it
// holds the lock. Starting a deploy is not enough: the previous shell can
// still hold the lock after writing "ok" (it restarts this webhook last), and
// the new one then exits without pulling. The next tick simply tries again. A
// deploy stuck at "running" is left to deploy()'s twenty-minute rule on the
// next push rather than retried here every fifteen seconds.
let pendingPoll = null;
function deployWhenIdle() {
  if (pendingPoll) return;
  pendingPoll = setInterval(() => {
    if (!fs.existsSync(PENDING_FILE)) {
      clearInterval(pendingPoll);
      pendingPoll = null;
      return;
    }
    if (readStatus().state === 'running') return;
    console.log('Running the deploy queued while the last one was in progress.');
    deploy();
  }, PENDING_POLL_MS);
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
      // The API is deliberately not restarted here.
      //
      // It runs as a single uvicorn process in fork mode, so a restart drops
      // every request in flight. A resident partway through a question during a
      // re-crawl got a failed request, and nothing recorded it: the restart
      // counter does not distinguish a deliberate bounce from a crash, and the
      // dropped request never reached a log.
      //
      // The restart also achieved nothing. The API holds no corpus state
      // between requests: its lifespan only flushes Langfuse on shutdown, and
      // the query cache lives in Postgres rather than in memory. That cache is
      // keyed on chunk IDs, so a re-crawl invalidates the affected entries by
      // itself, which _compute_chunk_hash documents as its reason for including
      // them.
      //
      // If in-process caching of corpus data is ever added, this needs a way to
      // clear it that does not drop connections, rather than this restart back.
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

// The ref a push delivery names, or null when there is none to read.
//
// GitHub sends either JSON or, when the hook's content type is "form",
// `payload=<url-encoded JSON>`. The hook was set to form, so JSON.parse threw
// on every delivery, and the catch treated that as "not a push event" and
// deployed anyway. Every push to every branch, Dependabot's included,
// redeployed main. Anything unreadable, or without a ref (a ping), is now
// ignored rather than deployed: failing open here is what made the main-only
// filter a no-op.
function pushedRef(body, contentType = '') {
  try {
    const json = contentType.includes('application/x-www-form-urlencoded')
      ? new URLSearchParams(body).get('payload')
      : body;
    const ref = JSON.parse(json || '').ref;
    return typeof ref === 'string' ? ref : null;
  } catch {
    return null;
  }
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

      const ref = pushedRef(body, req.headers['content-type']);
      if (ref !== 'refs/heads/main') {
        console.log(`Ignoring ${ref ? `push to ${ref}` : 'a delivery with no ref'}.`);
        res.writeHead(200);
        res.end('Ignored');
        return;
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
  } else if (req.method === 'GET' && req.url === '/deploy/status') {
    // The deploy is detached, so this listener cannot report on it from memory.
    // The status file is written by the deploy's own shell and outlives both.
    const status = readStatus();
    if (status.state === 'running') {
      status.running_for_seconds =
        Math.round((Date.now() - new Date(status.started).getTime()) / 1000);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
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
  // A deploy that changed this file restarts the webhook as its last step, so
  // a push queued during that deploy is only on disk by the time we get here.
  if (fs.existsSync(PENDING_FILE)) {
    console.log(`Found ${PENDING_FILE}; a push is waiting to be deployed.`);
    deployWhenIdle();
  }
  console.log(`  POST /deploy    — deploy code (GitHub webhook)`);
  console.log(`  POST /pipeline  — run pipeline (actions: pipeline, gaps, recrawl, download-pdfs)`);
  console.log(`  GET  /deploy/status   — result of the last deploy (it runs detached)\n  GET  /pipeline/status — check if pipeline is running`);
  console.log(`  GET  /health    — health check`);
  console.log(`Repo: ${REPO_DIR}`);
});
