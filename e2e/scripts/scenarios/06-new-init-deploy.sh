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

SCENARIO_DIR="$WORK_ROOT/new-init-deploy"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cd "$SCENARIO_DIR"

# new (interactive template picker -> single choice)
OUT="$(run_new_interactive e2e-full-flow 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast new (interactive)"
assert_dir "e2e-full-flow"

cd e2e-full-flow

# init (interactive wizard): name, One Time, 5s, bundle path default
OUT="$(run_init_interactive e2e-full-flow 5s 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast init (interactive)"
assert_stdout_contains "$OUT" "Successfully created"
assert_file "acurast.json"
assert_file ".env"
assert_json_key "acurast.json" "projects.e2e-full-flow"

# The wizard only writes network "mainnet". Deploy dry-run needs a funded
# wallet, and the e2e mnemonic is funded on canary, so switch the network the
# same way a user would edit acurast.json before deploying.
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync('acurast.json', 'utf8'));
  c.projects['e2e-full-flow'].network = 'canary';
  fs.writeFileSync('acurast.json', JSON.stringify(c, null, 2));
"
assert_file_contains "acurast.json" '"network": "canary"'

npm run build --silent
assert_file "dist/bundle.js"

OUT="$(run_acurast deploy e2e-full-flow --dry-run --non-interactive --output json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast deploy --dry-run"
assert_stdout_contains "$OUT" "Dry run, not deploying"
assert_no_deploy_artifacts "$(pwd)"

echo "OK: new, init, build, deploy dry-run (interactive)"
