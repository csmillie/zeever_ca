#!/usr/bin/env node
/**
 * Email the operator when a deploy fails, with the tail of the log.
 *
 * A failed deploy is already recorded in .deploy-status.json and .deploy.log,
 * but both require someone to go and look. GitHub gets its 200 the moment the
 * payload is accepted, long before anything runs, so nothing else reports it
 * either. On 2026-09-10 a failed build left the site crash looping for hours
 * and the first anyone knew of it was the site being down.
 *
 * Usage (from the deploy's fail handler):
 *   node scripts/notify-deploy-failure.js <step> <sha>
 *
 * Environment:
 *   DEPLOY_ALERT_EMAIL   where to send. Unset means "do not send", quietly.
 *   DEPLOY_ALERT_FROM    envelope sender. Defaults to deploy@<hostname>.
 *   DEPLOY_SENDMAIL      path to sendmail. Defaults to /usr/sbin/sendmail.
 *   DEPLOY_REPO_DIR      repo root, for finding the status and log files.
 *
 * This never throws and always exits 0. It is called from a failure handler
 * that has already disarmed its own ERR trap; a mail problem must not become a
 * second failure on top of the one being reported, and must not stop the deploy
 * from recording what happened.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = process.env.DEPLOY_REPO_DIR || process.cwd();
const TO = process.env.DEPLOY_ALERT_EMAIL || '';
const FROM = process.env.DEPLOY_ALERT_FROM || `deploy@${os.hostname()}`;
const SENDMAIL = process.env.DEPLOY_SENDMAIL || '/usr/sbin/sendmail';

// Enough to see what failed without mailing a whole Next.js build.
const LOG_LINES = 150;
const MAX_BYTES = 64 * 1024;

/**
 * Remove anything that looks like a credential.
 *
 * Not defensive programming for its own sake. On 2026-09-14 pydantic printed a
 * GitHub PAT and two API keys into this very log while reporting a validation
 * error, and they sat in the PM2 logs until the keys were rotated.
 * Mailing log tails without this would forward the next such leak to an inbox
 * and through a mail server, turning a local exposure into a remote one.
 *
 * Deliberately over-broad. A redacted line that was harmless costs a little
 * context in an email; an un-redacted secret costs a rotation.
 */
function redact(text) {
  return (
    text
      // Provider-shaped tokens, by prefix.
      .replace(/\b(github_pat_|ghp_|gho_|ghs_|ghu_|ghr_)[A-Za-z0-9_]{10,}/g, '$1[REDACTED]')
      .replace(/\bsk-[A-Za-z0-9_-]{10,}/g, 'sk-[REDACTED]')
      .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, 'xox-[REDACTED]')
      // KEY=..., TOKEN=..., SECRET=..., PASSWORD=... in any casing.
      .replace(
        /\b([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD))\s*[=:]\s*("[^"]*"|'[^']*'|\S+)/gi,
        '$1=[REDACTED]',
      )
      // pydantic prints rejected values as input_value='...', which is exactly
      // how a PAT and two API keys reached this log on 2026-09-14. The field
      // name carries no hint that the value is a secret, so it is matched by
      // name rather than by what it contains.
      .replace(/\binput_value\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, 'input_value=[REDACTED]')
      // Authorization headers.
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{10,}/gi, '$1 [REDACTED]')
      // Credentials embedded in a URL.
      .replace(/\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1[REDACTED]@')
      // Long hex runs, which is what `openssl rand -hex 32` produces.
      //
      // Twenty, not thirty-two: the value pydantic echoed was truncated to
      // twenty-four characters, and a truncated secret is still a secret.
      //
      // Exactly forty is left alone, because that is a git SHA and this log is
      // full of them. The deploy writes `Deploying <40 hex>` and
      // `Runtime now points at .../.runtime-<40 hex>`, which are the two lines
      // that say *which deploy this was* — redacting them made the alert worse
      // at the one job it has. A secret that happens to be exactly forty hex
      // characters (`openssl rand -hex 20`) therefore passes this rule; the
      // named forms above still catch it, and the keys this project actually
      // issues are `-hex 32`, which is sixty-four.
      .replace(/\b[0-9a-f]{20,}\b/gi, (match) =>
        match.length === 40 ? match : '[REDACTED]',
      )
  );
}

function tail(file, lines) {
  let text;
  try {
    const stat = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    try {
      const start = Math.max(0, stat.size - MAX_BYTES);
      const buf = Buffer.alloc(Math.min(stat.size, MAX_BYTES));
      fs.readSync(fd, buf, 0, buf.length, start);
      text = buf.toString('utf8');
      if (start > 0) text = `[... earlier output omitted ...]\n${text}`;
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    return `(could not read ${file}: ${err.code || err.message})`;
  }
  const all = text.split('\n');
  return all.slice(Math.max(0, all.length - lines)).join('\n');
}

function readStatus(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function buildMessage({ step, sha, status, log, to, from, host }) {
  const shortSha = sha ? sha.slice(0, 8) : 'unknown';
  const subject = `[zeever] deploy FAILED at step "${step || 'unknown'}" (${shortSha})`;
  const body = [
    `A deploy on ${host} failed and the site was left on the previous runtime.`,
    '',
    `  host     ${host}`,
    `  commit   ${sha || 'unknown'}`,
    `  step     ${step || 'unknown'}`,
    `  started  ${status?.started || 'unknown'}`,
    `  finished ${status?.finished || 'unknown'}`,
    '',
    'The runtime symlink is only moved after the new tree is verified, so a',
    'failure before that point leaves the running site untouched, and one after',
    'it is rolled back. The site should still be serving; check it anyway.',
    '',
    `Last ${LOG_LINES} lines of the deploy log:`,
    '',
    '----------------------------------------------------------------------',
    log,
    '----------------------------------------------------------------------',
    '',
    'Credentials are stripped from the log above before sending. If something',
    'looks like it should be there and reads [REDACTED], check the log on the',
    'box rather than loosening the filter.',
    '',
  ].join('\n');

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'X-Zeever-Deploy-Step: ' + (step || 'unknown'),
    '',
    body,
  ].join('\n');
}

function main() {
  const [, , stepArg, shaArg] = process.argv;

  if (!TO) {
    console.log('  DEPLOY_ALERT_EMAIL is not set; no failure email sent.');
    return;
  }

  // Read after the deploy's `finish failed` has written it — the fail handler
  // calls this notifier on the line after, deliberately, so that the durable
  // record exists before anything waits on a mail server. Stated here as well
  // as there because this file is what depends on the ordering, and a reader of
  // this file alone cannot see the caller.
  const status = readStatus(path.join(REPO, '.deploy-status.json'));

  // Arguments first, status file second. They normally agree; the status file
  // is the fallback for the case the arguments cannot cover, which is a failure
  // early enough that the shell had no SHA to pass.
  const step = stepArg || status?.step || '';
  const sha = shaArg || status?.sha || '';

  const log = redact(tail(path.join(REPO, '.deploy.log'), LOG_LINES));
  const message = buildMessage({
    step,
    sha,
    status,
    log,
    to: TO,
    from: FROM,
    host: os.hostname(),
  });

  if (!fs.existsSync(SENDMAIL)) {
    // Said out loud rather than swallowed. An alerting path that quietly does
    // nothing is the same class of problem as a deploy that quietly fails.
    console.log(`  No sendmail at ${SENDMAIL}; failure email NOT sent.`);
    return;
  }

  const result = spawnSync(SENDMAIL, ['-t', '-oi'], { input: message, encoding: 'utf8' });
  if (result.error) {
    console.log(`  Failure email could not be sent: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    console.log(
      `  sendmail exited ${result.status}; failure email may not have been delivered.` +
        (result.stderr ? ` ${result.stderr.trim()}` : ''),
    );
    return;
  }
  console.log(`  Failure email handed to sendmail for ${TO}.`);
}

try {
  main();
} catch (err) {
  // Exit 0 regardless: this runs inside a failure handler, and the deploy's
  // own reporting matters more than the email about it.
  console.log(`  Failure email skipped: ${err.message}`);
}

module.exports = { redact, buildMessage };
