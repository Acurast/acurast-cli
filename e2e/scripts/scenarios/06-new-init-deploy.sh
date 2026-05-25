#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

WORK_ROOT="${WORK_ROOT:?}"

SCENARIO_DIR="$WORK_ROOT/new-init-deploy"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cd "$SCENARIO_DIR"

OUT="$(run_acurast new e2e-full-flow --template nodejs 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast new"
assert_dir "e2e-full-flow"

cd e2e-full-flow

OUT="$(run_acurast init --defaults --network canary --instant-match 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast init --defaults --instant-match"
assert_stdout_contains "$OUT" "Successfully created"
assert_file "acurast.json"
assert_file ".env"
assert_json_key "acurast.json" "projects.e2e-full-flow"

npm install --silent
npm run build --silent
assert_file "dist/bundle.js"

OUT="$(run_acurast deploy e2e-full-flow --dry-run --non-interactive --output json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy --dry-run"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$(pwd)"

echo "OK: new, init, deploy dry-run"
