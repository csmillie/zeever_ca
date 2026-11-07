#!/usr/bin/env node
/**
 * Guard rails for editing the shared PM2 config.
 *
 * A shared PM2 ecosystem config can define every app on a server (zeever.ca's
 * defines 19 of them across seven unrelated sites). Editing it by hand to repoint one app is a
 * small change to a file with a large blast radius, and the worst outcome is
 * not a wrong value: it is a syntax error, which makes the whole config
 * unloadable and takes every app's management down with it, including the
 * deploy webhook's.
 *
 * That failure is entirely preventable, because the file is JavaScript. It can
 * be require()d and inspected before PM2 is ever pointed at it.
 *
 *   node scripts/pm2-config-guard.js snapshot
 *       Record what the config currently defines, and copy it to a timestamped
 *       backup. Run this BEFORE editing.
 *
 *   node scripts/pm2-config-guard.js verify --expect-changed zeever-web
 *       Re-read the config and report exactly what changed against the
 *       snapshot. Fails if the file no longer parses, if any app was added or
 *       removed, if an app other than the expected one changed, or if the
 *       expected one did not. Run AFTER editing and BEFORE any pm2 command.
 *
 *   node scripts/pm2-config-guard.js restore
 *       Put the most recent backup back.
 *
 * The state file lives beside the config rather than in a temp directory, and
 * is refused unless its ownership and permissions make it untamperable. See
 * assertTrustworthy() for why that matters more here than it usually would.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const command = args[0];

function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const CONFIG = path.resolve(opt('config', process.env.PM2_CONFIG || 'ecosystem.config.js'));
// Beside the config, NOT in /var/tmp.
//
// /var/tmp is world-writable (drwxrwxrwt) and this box has seven site users.
// Any of them could pre-create a predictably-named state file and keep
// ownership of it, because writeFileSync truncates in place rather than taking
// ownership. That file is trusted twice over: verify reads its baseline, and
// restore reads BOTH the source and destination paths out of it and copies one
// over the other with the operator's privileges. An attacker who can make
// verify fail gets the operator to run restore — the documented remedy — and
// restore would then copy an attacker-chosen file over an attacker-chosen
// path. Local privilege escalation, driven by the tool's own failure workflow.
const STATE = path.resolve(opt('state', path.join(path.dirname(CONFIG), '.pm2-config-guard.json')));

function die(message) {
  console.error(`\npm2-config-guard: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`  ok    ${message}`);
}

function bad(message) {
  console.log(`  FAIL  ${message}`);
}

/**
 * Whose ownership counts as trustworthy here.
 *
 * Root, the caller, and whoever owns the PM2 config. That last one is not a
 * loosening: the owner of the config can already make PM2 execute anything, so
 * they are trusted by construction. Without it the tool refuses to run in the
 * normal layout — a shared config belongs to the PM2 user while the operator
 * is root — and a security check that fires on the correct configuration gets
 * disabled rather than heeded.
 */
function trustedUids() {
  const set = new Set([0]);
  if (typeof process.getuid === 'function') set.add(process.getuid());
  try {
    set.add(fs.lstatSync(CONFIG).uid);
  } catch {
    /* CONFIG may not exist yet; the caller reports that better than we can. */
  }
  return set;
}

/**
 * Refuse to act on a path anyone untrusted could have written.
 *
 * Checks the file and its directory: not a symlink (so the path cannot be
 * redirected out from under us), owned by a trusted uid, and not writable by
 * group or other. Applied to the state file, to the backup restore reads from,
 * and to the config restore writes over.
 */
function assertTrustworthy(target, what) {
  const trusted = trustedUids();
  for (const [p, kind] of [[path.dirname(target), 'directory'], [target, 'file']]) {
    let st;
    try {
      st = fs.lstatSync(p);
    } catch (err) {
      die(`${what}: cannot stat ${p} (${err.code}).`);
    }
    if (st.isSymbolicLink()) {
      die(`${what}: ${p} is a symlink. Refusing to follow it.`);
    }
    if (!trusted.has(st.uid)) {
      die(
        `${what}: ${p} is owned by uid ${st.uid}, which is not root, you, or ` +
          `the owner of ${CONFIG}.\n` +
          `  Someone else can rewrite it, and this tool acts on what it says.`
      );
    }
    // 0o022 = group-writable or world-writable.
    if ((st.mode & 0o022) !== 0) {
      die(
        `${what}: ${p} is writable by group or other (mode ${(st.mode & 0o777).toString(8)}).\n` +
          `  Refusing to trust it.`
      );
    }
  }
}

/**
 * Load the config the same way PM2 does, and fail the way a person can act on.
 *
 * require() is the whole point of this tool. A syntax error surfaces here, with
 * the file untouched and nothing restarted, instead of surfacing as `pm2` being
 * unable to read the config for any of the nineteen apps.
 */
function load() {
  delete require.cache[CONFIG];
  try {
    const mod = require(CONFIG);
    const apps = mod && mod.apps;
    if (!Array.isArray(apps)) die(`${CONFIG} loaded but exports no apps array.`);
    return apps;
  } catch (err) {
    die(
      `${CONFIG} does not load:\n\n    ${err.message}\n\n` +
        `  PM2 cannot read it either, so every app in it is unmanageable ` +
        `until this is fixed.\n  Restore the backup with:\n\n` +
        `    node ${path.basename(__filename)} restore\n`
    );
  }
}

/** Key-sorted stringify, so field order in the file cannot read as a change. */
function stable(v) {
  if (typeof v === 'function') return '"[function]"';
  if (v === undefined) return '"[undefined]"';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
    .join(',')}}`;
}

/**
 * Every field of the app definition, not a chosen few.
 *
 * An earlier version fingerprinted script/args/cwd/interpreter/env only, which
 * meant an accidental edit to a neighbour's instances, exec_mode, node_args,
 * max_memory_restart, watch or env_production passed verification silently —
 * a false negative in the one check this tool exists to perform.
 *
 * Anything env-shaped is reduced to a count and a hash: this file sits beside
 * the config on a shared box and must not become a second copy of nineteen
 * apps' secrets.
 */
function fingerprint(app) {
  const out = {};
  for (const key of Object.keys(app)) {
    if (key === 'name') continue;
    const value = app[key];
    if (/^env/i.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value).sort();
      const hash = crypto
        .createHash('sha256')
        .update(stable(keys.map((k) => [k, String(value[k])])))
        .digest('hex')
        .slice(0, 12);
      out[key] = `${key}[${keys.length}]=${hash}`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function fingerprintAll(apps) {
  const out = {};
  for (const app of apps) {
    if (!app || !app.name) continue;
    out[app.name] = fingerprint(app);
  }
  return out;
}

/** Field-by-field, so a failure says which field rather than "something". */
function diffFields(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const lines = [];
  for (const k of keys) {
    const b = stable(before[k]);
    const a = stable(after[k]);
    if (b === a) continue;
    lines.push(`            ${k}: ${k in before ? b : '(absent)'} -> ${k in after ? a : '(absent)'}`);
  }
  return lines;
}

if (command === 'snapshot') {
  const apps = load();
  const fps = fingerprintAll(apps);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const configMtime = fs.statSync(CONFIG).mtime;
  const backup = `${CONFIG}.bak-${stamp}`;
  fs.copyFileSync(CONFIG, backup);
  fs.chmodSync(backup, 0o600);
  // 0o600 and written through a fresh descriptor, so the state file is not
  // readable or writable by the other site users on this box.
  const fd = fs.openSync(STATE, 'w', 0o600);
  try {
    fs.writeFileSync(
    fd,
    JSON.stringify(
      { config: CONFIG, backup, taken: stamp, configMtime: configMtime.toISOString(), apps: fps },
      null,
      2,
    ),
  );
    fs.fchmodSync(fd, 0o600);
  } finally {
    fs.closeSync(fd);
  }
  console.log(`\nSnapshot of ${CONFIG}`);
  console.log(`  ${Object.keys(fps).length} apps defined`);
  for (const name of Object.keys(fps).sort()) console.log(`    ${name}`);
  console.log(`\n  backup: ${backup}`);
  console.log(`  state:  ${STATE}`);
  // A snapshot taken after the edit records the edited file as the baseline, so
  // verify then compares the change against itself and reports "expected to
  // change but did not" — which reads as "your edit is missing" when in fact
  // nothing is wrong. Said here, while it is still cheap to redo, rather than
  // leaving it to be decoded from a failure later.
  const ageMinutes = (Date.now() - configMtime.getTime()) / 60000;
  if (ageMinutes < 30) {
    console.log('');
    console.log(`  NOTE: ${path.basename(CONFIG)} was modified ${Math.round(ageMinutes)} minute(s) ago.`);
    console.log('  If that was your edit, this snapshot has captured it as the baseline,');
    console.log('  and verify will report that the app "did not change" — because against');
    console.log('  this baseline it has not. Snapshot first, then edit.');
  }

  console.log(`\nEdit the config, then run:`);
  console.log(`  node ${path.basename(__filename)} verify --expect-changed <app-name>\n`);
  process.exit(0);
}

function readState() {
  if (!fs.existsSync(STATE)) die(`No snapshot at ${STATE}. Run snapshot first.`);
  assertTrustworthy(STATE, 'state file');
  return JSON.parse(fs.readFileSync(STATE, 'utf8'));
}

/**
 * App names from --expect-changed, insisting the flag carries a value.
 *
 * `verify --expect-changed` with the name left off used to produce an empty
 * set, which then satisfied the "nothing changed" branch and exited 0 saying
 * "Safe to apply" — a typo turning the check into a rubber stamp, in the tool
 * whose entire job is to not be one.
 */
function expectChanged() {
  const names = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--expect-changed') continue;
    const value = args[i + 1];
    if (!value || value.startsWith('--')) {
      die('--expect-changed needs an app name, e.g. --expect-changed zeever-web');
    }
    names.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
    i += 1;
  }
  return new Set(names);
}

if (command === 'verify') {
  const state = readState();
  const expected = expectChanged();

  // load() exits with instructions if the file no longer parses. Reaching the
  // next line is itself the most important check this tool performs.
  const apps = load();
  ok(`${CONFIG} still parses`);

  const before = state.apps;
  const after = fingerprintAll(apps);
  let failed = false;

  const removed = Object.keys(before).filter((n) => !(n in after));
  const added = Object.keys(after).filter((n) => !(n in before));
  if (removed.length) {
    bad(`apps REMOVED: ${removed.join(', ')}`);
    failed = true;
  } else {
    ok(`no apps removed (${Object.keys(before).length} still defined)`);
  }
  if (added.length) {
    bad(`apps ADDED: ${added.join(', ')}`);
    failed = true;
  }

  const changed = Object.keys(after).filter(
    (n) => n in before && stable(before[n]) !== stable(after[n])
  );

  for (const name of changed) {
    const expectedChange = expected.has(name);
    if (!expectedChange) failed = true;
    console.log(`  ${expectedChange ? 'ok   ' : 'FAIL '} ${name} changed`);
    for (const line of diffFields(before[name], after[name])) console.log(line);
  }

  // A name that was never in the config at all. Almost always a typo, and it
  // has to be caught here explicitly: narrowing `untouched` to apps that still
  // exist (so a REMOVED app is not reported twice) also stopped a misspelled
  // name from being reported at all. `--expect-changed ask-toronto-weeb` with
  // nothing edited then passed, printing "Safe to apply" and suggesting
  // `pm2 delete ask-toronto-weeb` — telling the operator their edit landed when
  // it did not, in the one tool whose job is to never say that.
  //
  // Absent from both sides, so an app that was newly ADDED is left to the added
  // branch rather than being reported twice over.
  const unknown = [...expected].filter((n) => !(n in before) && !(n in after));
  if (unknown.length) {
    bad(`expected app is not in the snapshot: ${unknown.join(', ')}`);
    failed = true;
  }

  // Only apps that are still present. An expected app that was REMOVED is
  // already reported as such, and saying "expected to change but did not"
  // about a thing that no longer exists reads as a second, different problem.
  const untouched = [...expected].filter((n) => n in after && !changed.includes(n));
  if (untouched.length) {
    bad(`expected to change but did not: ${untouched.join(', ')}`);
    // Two different situations produce this, and they want opposite responses:
    // an unsaved edit needs redoing, while a snapshot taken after the edit is
    // harmless and means the config is already correct. The message used to
    // imply only the first, which is the more alarming reading and was the
    // wrong one on 2026-09-16.
    console.log('');
    console.log('        Two things produce this, and they need opposite responses:');
    console.log('');
    console.log('          1. The edit was not saved. The config still needs changing.');
    console.log(`          2. Snapshot ran AFTER the edit, so the baseline already`);
    console.log('             contains it. Nothing is wrong and you can proceed.');
    console.log('');
    console.log('        Tell them apart — this prints the difference between the config');
    console.log('        and the copy taken at snapshot time:');
    console.log('');
    console.log(`          diff ${state.backup} \\`);
    console.log(`               ${CONFIG}`);
    console.log('');
    console.log('        No output means they are identical, which is expected in BOTH');
    console.log('        cases. So read the config itself: if it already contains the');
    console.log('        change you intended, this is case 2.');
    if (state.configMtime) {
      console.log('');
      console.log(`        Snapshot taken:   ${state.taken}`);
      console.log(`        Config modified:  ${state.configMtime}  (as of the snapshot)`);
    }
    console.log('');
    failed = true;
  }

  if (!changed.length && !expected.size) ok('nothing changed');

  if (failed) {
    console.error(`\nDo not run pm2 against this config yet. To undo:`);
    console.error(`  node ${path.basename(__filename)} restore\n`);
    process.exit(1);
  }
  console.log(`\nSafe to apply. Only the expected app changed:`);
  console.log(`  pm2 delete ${[...expected].join(' ')}`);
  console.log(`  pm2 start ${CONFIG} --only ${[...expected].join(',')}`);
  console.log(`  pm2 save\n`);
  process.exit(0);
}

if (command === 'restore') {
  const state = readState();
  // Both paths come out of a file on disk and are about to be handed to a
  // privileged copy, so neither is taken on trust. The destination must be the
  // config this invocation is already operating on, and the source must sit
  // beside it and be as untamperable as the state file itself.
  if (path.resolve(state.config) !== CONFIG) {
    die(
      `The snapshot names a different config:\n` +
        `    snapshot: ${state.config}\n    current:  ${CONFIG}\n` +
        `  Refusing to copy over a path this invocation was not pointed at.`
    );
  }
  if (path.dirname(path.resolve(state.backup)) !== path.dirname(CONFIG)) {
    die(
      `Backup ${state.backup} is not beside ${CONFIG}. Refusing to restore from it.`
    );
  }
  if (!fs.existsSync(state.backup)) die(`Backup ${state.backup} is gone.`);
  assertTrustworthy(path.resolve(state.backup), 'backup');
  // The destination too, checked here rather than earlier, because copyFileSync
  // follows a symlink at the destination and would write through it. Anyone who
  // could plant that symlink already owns the directory holding the config PM2
  // executes, so this is not the weak point — but it costs one call, and the
  // source and the state file are both checked, so leaving the destination
  // unchecked would be an odd place to stop.
  assertTrustworthy(CONFIG, 'config');

  fs.copyFileSync(state.backup, state.config);
  console.log(`Restored ${state.config} from ${state.backup}`);
  // Prove the restore produced something loadable rather than asserting it.
  load();
  console.log('It parses. PM2 can read it again.');
  process.exit(0);
}

die(
  'usage:\n' +
    '    pm2-config-guard.js snapshot [--config PATH] [--state PATH]\n' +
    '    pm2-config-guard.js verify --expect-changed <app>[,<app>]\n' +
    '    pm2-config-guard.js restore'
);
