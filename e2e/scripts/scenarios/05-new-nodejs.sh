#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

setup_template_repo "$WORK_ROOT/template-repo" \
  "$E2E_ROOT/fixtures/blank-template" "nodejs"

SCENARIO_DIR="$WORK_ROOT/new-nodejs"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cd "$SCENARIO_DIR"

# Interactive template picker: the repo has a single template, so Enter selects it.
OUT="$(run_new_interactive e2e-new-app 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast new (interactive)"
assert_stdout_contains "$OUT" "created successfully"

assert_dir "e2e-new-app"
assert_file "e2e-new-app/package.json"
assert_file "e2e-new-app/src/index.ts"
assert_file "e2e-new-app/webpack.config.js"
assert_file_contains "e2e-new-app/package.json" '"name": "e2e-new-app"'

echo "OK: new (interactive)"
