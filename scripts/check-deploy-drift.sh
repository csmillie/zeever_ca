#!/bin/bash
# Is the server running what main says it should be?
#
#   bash scripts/check-deploy-drift.sh            # report, exit 1 if drifted
#   bash scripts/check-deploy-drift.sh --quiet    # cron mode: silent unless drifted
#
# Meant for cron, hourly:
#   0 * * * * cd /path/to/zeever_ca && bash scripts/check-deploy-drift.sh --quiet
#
# ## Why this exists when deploy failures already send email
#
# On 2026-09-22 a merge to main could not be pulled, because untracked files sat
# where the incoming commits needed to write. Every deploy for the next two days
# failed at the first step and sent a failure email. The alerting worked exactly
# as designed, every single time.
#
# Two days passed anyway. The same email arrives on the first failure and on the
# twentieth, so a repeated identical alert reads as noise -- and nothing said how
# long the condition had lasted or how far behind the server had fallen.
#
# "Behind origin/main by 2 commits for 48 hours" is a different sentence from
# "deploy failed". It states a duration and a distance, it is true whether or not
# a deploy was attempted, and it keeps being true until somebody acts. It also
# catches the failures no deploy email can: a webhook delivery that timed out and
# was never retried, which is how the same two days began.
#
# It reports rather than repairs. A pull here would run as the wrong user, at an
# unpredictable moment, with no artifact fetch or runtime swap behind it -- which
# is precisely the half-deployed state this is supposed to detect.
set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

# Three ways to find the repo, most explicit first. The script's own location is
# the usual one, and it is wrong the moment somebody copies the file to /tmp to
# try it -- which is how this fallback got written.
if [ -n "${DEPLOY_REPO_DIR:-}" ]; then
  REPO=$DEPLOY_REPO_DIR
elif git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --git-dir >/dev/null 2>&1; then
  REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
elif git rev-parse --git-dir >/dev/null 2>&1; then
  REPO=$(pwd)
else
  echo "drift check: no repository found. Run from the repo, or set DEPLOY_REPO_DIR."
  exit 2
fi
cd "$REPO" || { echo "cannot enter $REPO"; exit 2; }

say() { [ "$QUIET" = "1" ] || echo "$@"; }

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "drift check: $REPO is not a git repository"
  exit 2
fi

# Read-only. Never mutates the working tree, so this is safe to run beside a
# deploy holding the lock.
git fetch --quiet origin 2>/dev/null || {
  echo "drift check: could not reach origin"
  exit 2
}

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null) || {
  echo "drift check: no origin/main"
  exit 2
}
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)

# What the runtime symlink actually serves, which can differ from HEAD: the
# recovery on 2026-09-24 pulled the repo and reloaded the API while the web
# runtime stayed on the previous commit. HEAD alone would have called that fine.
RUNTIME_SHA=""
if [ -L .runtime ]; then
  RUNTIME_SHA=$(readlink .runtime | sed 's|.*/\.runtime-||; s|-[0-9]*$||')
fi

STATUS_STATE=""
STATUS_SHA=""
if [ -f .deploy-status.json ]; then
  STATUS_STATE=$(python3 -c 'import json;print(json.load(open(".deploy-status.json")).get("state",""))' 2>/dev/null || true)
  STATUS_SHA=$(python3 -c 'import json;print(json.load(open(".deploy-status.json")).get("sha",""))' 2>/dev/null || true)
fi

DRIFTED=0
REASONS=()

if [ "$BEHIND" -gt 0 ]; then
  DRIFTED=1
  AGE=$(git log -1 --format=%cr "origin/main" 2>/dev/null || echo "unknown")
  REASONS+=("repo is $BEHIND commit(s) behind origin/main; newest there is $AGE")
fi

# The check that HEAD cannot make. A runtime on a different commit from the repo
# is a half-finished deploy, and it looks healthy from every other angle.
if [ -n "$RUNTIME_SHA" ] && [ "$RUNTIME_SHA" != "$LOCAL" ]; then
  DRIFTED=1
  REASONS+=("web runtime serves ${RUNTIME_SHA:0:8} but the repo is at ${LOCAL:0:8}")
fi

if [ "$STATUS_STATE" = "failed" ]; then
  DRIFTED=1
  REASONS+=("last deploy recorded state=failed at ${STATUS_SHA:0:8}")
fi

if [ "$DRIFTED" = "0" ]; then
  say "in sync: ${LOCAL:0:8}, runtime matches, last deploy ${STATUS_STATE:-unknown}"
  exit 0
fi

# Printed even in --quiet, because this is the case cron should mail.
echo "DEPLOY DRIFT on $(hostname)"
for r in "${REASONS[@]}"; do echo "  - $r"; done
echo
echo "  repo HEAD    ${LOCAL:0:8}"
echo "  origin/main  ${REMOTE:0:8}"
[ -n "$RUNTIME_SHA" ] && echo "  runtime      ${RUNTIME_SHA:0:8}"
echo
echo "This reports; it does not fix. Redeploy through the webhook so the artifact"
echo "fetch, verification and runtime swap all run, rather than pulling by hand:"
echo "  see docs/DEPLOYMENT.md, 'Triggering a deploy without GitHub'."
exit 1
