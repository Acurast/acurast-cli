#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

if [[ ! -t 1 ]] && [[ -z "${E2E_FORCE_INTERACTIVE_INIT:-}" ]]; then
  echo "SKIP: no TTY for interactive acurast init (run via npm run test:e2e:interactive locally)"
  exit 0
fi

if ! command -v script >/dev/null 2>&1; then
  echo "SKIP: script(1) required for pseudo-TTY interactive init"
  exit 0
fi

SCENARIO_DIR="$WORK_ROOT/init-interactive"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cp -a "$E2E_ROOT/fixtures/blank-template/." "$SCENARIO_DIR/"
cd "$SCENARIO_DIR"

# project name, onetime, duration, bundle path (pseudo-TTY for Inquirer)
export ACURAST_MNEMONIC="$ACURAST_E2E_MNEMONIC"
INIT_CMD="printf '%s\n' 'e2e-interactive' 'onetime' '5s' 'dist/bundle.js' | acurast init"
OUT="$(script -qefc "$INIT_CMD" /dev/null 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast init (interactive)"
assert_stdout_contains "$OUT" "Successfully created"

assert_file "acurast.json"
assert_json_key "acurast.json" "projects.e2e-interactive"
assert_file ".env"
assert_file_contains ".gitignore" ".acurast"

echo "OK: init interactive"
