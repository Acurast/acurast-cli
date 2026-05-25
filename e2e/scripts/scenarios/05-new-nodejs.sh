#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

WORK_ROOT="${WORK_ROOT:?}"

SCENARIO_DIR="$WORK_ROOT/new-nodejs"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cd "$SCENARIO_DIR"

OUT="$(run_acurast new e2e-new-app --template nodejs 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast new --template nodejs"
assert_stdout_contains "$OUT" "created successfully"

assert_dir "e2e-new-app"
assert_file "e2e-new-app/package.json"
assert_file "e2e-new-app/src/index.ts"
assert_file "e2e-new-app/webpack.config.js"
assert_file_contains "e2e-new-app/package.json" '"name": "e2e-new-app"'

echo "OK: new nodejs template"
