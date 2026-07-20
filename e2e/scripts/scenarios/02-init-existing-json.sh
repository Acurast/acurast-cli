#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

E2E_ROOT="${E2E_ROOT:?}"
WORK_ROOT="${WORK_ROOT:?}"

SCENARIO_DIR="$WORK_ROOT/init-existing-json"
rm -rf "$SCENARIO_DIR"
mkdir -p "$SCENARIO_DIR"
cp -a "$E2E_ROOT/fixtures/with-acurast-json/." "$SCENARIO_DIR/"
cd "$SCENARIO_DIR"

BEFORE="$(cat acurast.json)"

OUT="$(run_acurast init 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast init"
assert_stdout_contains "$OUT" "already exists"

assert_file ".env"
assert_file_contains ".env" "ACURAST_MNEMONIC="

AFTER="$(cat acurast.json)"
if [[ "$BEFORE" != "$AFTER" ]]; then
  echo "ASSERT FAIL: acurast.json was modified" >&2
  exit 1
fi

echo "OK: init existing json"
