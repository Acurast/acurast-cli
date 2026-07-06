#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

# The with-acurast-json fixture ships a canary config (project "e2e-existing").
# Canary is required: mainnet dry-run exits early when the wallet balance is 0,
# never reaching the deploy path.
SCENARIO_DIR="$WORK_ROOT/deploy-flow"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cp -a "$E2E_ROOT/fixtures/with-acurast-json/." "$SCENARIO_DIR/"
cd "$SCENARIO_DIR"

cat > .env <<EOF
ACURAST_MNEMONIC=${ACURAST_E2E_MNEMONIC}
EOF

assert_json_key "acurast.json" "projects.e2e-existing"

npm install --silent
npm run build --silent
assert_file "dist/bundle.js"

OUT="$(run_acurast deploy e2e-existing --dry-run --non-interactive --output json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy --dry-run"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$SCENARIO_DIR"

echo "OK: build and deploy dry-run"
