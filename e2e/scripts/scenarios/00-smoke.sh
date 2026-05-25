#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/assert.sh
source "$SCRIPT_DIR/../lib/assert.sh"

REPO_ROOT="${REPO_ROOT:?}"
EXPECTED_VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"

OUT="$(acurast --version 2>&1)"
assert_exit $? 0 "acurast --version"
assert_stdout_contains "$OUT" "$EXPECTED_VERSION"

OUT="$(acurast --help 2>&1)"
assert_exit $? 0 "acurast --help"
assert_stdout_contains "$OUT" "deploy"

echo "OK: smoke"
