#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_ROOT="${E2E_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
REPO_ROOT="${REPO_ROOT:-$(cd "$E2E_ROOT/.." && pwd)}"
WORK_ROOT="${WORK_ROOT:-/tmp/acurast-e2e-interactive}"

if [[ -f "$E2E_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$E2E_ROOT/.env"
  set +a
fi

if [[ -z "${ACURAST_E2E_MNEMONIC:-}" ]]; then
  echo "ACURAST_E2E_MNEMONIC is required. See e2e/README.md" >&2
  exit 1
fi

export E2E_ROOT REPO_ROOT WORK_ROOT
export ACURAST_MNEMONIC="$ACURAST_E2E_MNEMONIC"

mkdir -p "$WORK_ROOT"
cd "$REPO_ROOT"

echo "==> Running interactive-only e2e scenarios (local TTY)"
bash "$SCRIPT_DIR/scenarios/07-init-interactive.sh"
echo ""
echo "==> Interactive e2e scenario passed"
