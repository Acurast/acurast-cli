#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"
# shellcheck source=../lib/run-cli.sh
source "$SCRIPT_DIR/../lib/run-cli.sh"

REPO_ROOT="${REPO_ROOT:?}"

cd "$REPO_ROOT"

# estimate-fee loads acurast.json from cwd; use repo root project
if [[ ! -f acurast.json ]]; then
  echo "ASSERT FAIL: repo root acurast.json missing" >&2
  exit 1
fi

OUT="$(run_acurast estimate-fee test-instant-match -o json 2>&1)"
CODE=$?
assert_exit "$CODE" 0 "acurast estimate-fee"

echo "OK: estimate-fee"
