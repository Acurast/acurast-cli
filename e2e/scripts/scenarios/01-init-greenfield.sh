#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

SCENARIO_DIR="$WORK_ROOT/init-greenfield"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cp -a "$E2E_ROOT/fixtures/blank-template/." "$SCENARIO_DIR/"
cd "$SCENARIO_DIR"

# Interactive prompts do not work without a TTY in Docker; use --defaults (same as CI).
OUT="$(run_acurast init --defaults --network canary 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast init --defaults"
assert_stdout_contains "$OUT" "Successfully created"

assert_file "acurast.json"
assert_json_key "acurast.json" "projects.e2e-blank-template"
assert_file ".env"
assert_file_contains ".env" "ACURAST_MNEMONIC="
assert_file_contains ".gitignore" ".acurast"
assert_file_contains ".gitignore" ".env"

echo "OK: init greenfield"
