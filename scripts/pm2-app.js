#!/usr/bin/env node
/**
 * Small queries against `pm2 jlist`, for the deploy script.
 *
 * Reads the JSON on stdin so it works the same whether pm2 runs as this user or
 * through sudo:
 *
 *   pm2 jlist | node scripts/pm2-app.js uptime zeever-web
 *   pm2 jlist | node scripts/pm2-app.js env-has zeever-web A2A_API_KEY
 *
 * uptime    prints the process start time in epoch milliseconds, or 0 if the app
 *           is not running. The deploy compares the value before and after a
 *           reload: a reload that silently did nothing leaves it unchanged, and
 *           "pm2 reload returned 0" has never been the same claim as "the
 *           process restarted".
 *
 * env-has   exits 0 if the app's environment carries a non-empty value for the
 *           named key. Used to tell a genuinely missing secret apart from one
 *           that is supplied by the PM2 config rather than by the .env file.
 */

const [, , command, appName, key] = process.argv;

function die(message) {
  console.error(`pm2-app: ${message}`);
  process.exit(2);
}

if (!command || !appName) die('usage: pm2-app.js <uptime|env-has> <app> [KEY]');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let apps;
  try {
    apps = JSON.parse(raw);
  } catch {
    die('stdin was not the JSON that `pm2 jlist` produces');
  }
  const app = (Array.isArray(apps) ? apps : []).find((a) => a.name === appName);

  if (command === 'uptime') {
    // Absent app prints 0 rather than failing: the first deploy after this
    // change runs before the app has ever been started under the new config,
    // and 0 makes "any later timestamp is newer" true without a special case.
    process.stdout.write(String((app && app.pm2_env && app.pm2_env.pm_uptime) || 0));
    return;
  }

  if (command === 'env-has') {
    if (!key) die('env-has needs a key name');
    const value = app && app.pm2_env ? app.pm2_env[key] : undefined;
    process.exit(value !== undefined && value !== '' ? 0 : 1);
  }

  die(`unknown command ${command}`);
});
