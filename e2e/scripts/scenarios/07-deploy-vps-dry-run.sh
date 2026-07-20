#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

# `deploy vps` needs no project files — the app template ships with the CLI.
# Canary is required: the flow exits early on mainnet when the balance is 0.
SCENARIO_DIR="$WORK_ROOT/deploy-vps"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cd "$SCENARIO_DIR"

# Non-interactive: everything from flags.
OUT="$(run_acurast deploy vps --non-interactive --dry-run \
  --image ubuntu --min-memory 2GB --min-storage 10GB --min-compute-score 100 \
  --authorized-ssh-key "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF7e2edummykey e2e@acurast" \
  --duration 1h --output json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy vps --dry-run (non-interactive)"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$SCENARIO_DIR"

# VPS_* env vars: flags win, env fills the rest.
OUT="$(VPS_MIN_MEMORY=2GB VPS_DURATION=1h VPS_SSH_PASSWORD=e2e-password \
  run_acurast deploy vps --non-interactive --dry-run --output json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy vps --dry-run (VPS_* env)"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$SCENARIO_DIR"

# Interactive wizard driven through a pseudo-tty; answers "yes" to persisting
# the wizard answers as VPS_* variables in .env.
OUT="$(run_vps_interactive_dry_run 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy vps --dry-run (interactive wizard)"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$SCENARIO_DIR"
assert_file ".env"
grep -q "^VPS_DURATION=1h$" .env || {
  echo "ASSERT FAIL: .env missing persisted VPS_DURATION" >&2
  exit 1
}
grep -q "^VPS_IMAGE=ubuntu$" .env || {
  echo "ASSERT FAIL: .env missing persisted VPS_IMAGE" >&2
  exit 1
}

echo "OK: deploy vps dry-run (non-interactive, env vars, wizard)"
