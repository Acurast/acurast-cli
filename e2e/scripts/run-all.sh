#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_ROOT="${E2E_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
REPO_ROOT="${REPO_ROOT:-$(cd "$E2E_ROOT/.." && pwd)}"
if [[ -z "${WORK_ROOT:-}" ]]; then
  if [[ -d /workspace && -w /workspace ]]; then
    WORK_ROOT=/workspace
  else
    WORK_ROOT="$E2E_ROOT/.work"
  fi
fi

# Load local e2e/.env if present (not used in CI)
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

echo "==> E2E preflight: canary balance"
node "$E2E_ROOT/scripts/preflight-balance.mjs"

SCENARIOS=(
  "$SCRIPT_DIR/scenarios/00-smoke.sh"
  "$SCRIPT_DIR/scenarios/01-init-greenfield.sh"
  "$SCRIPT_DIR/scenarios/02-init-existing-json.sh"
  "$SCRIPT_DIR/scenarios/03-blank-project-build-deploy-dry-run.sh"
  "$SCRIPT_DIR/scenarios/04-estimate-fee.sh"
  "$SCRIPT_DIR/scenarios/05-new-nodejs.sh"
  "$SCRIPT_DIR/scenarios/06-new-init-deploy.sh"
)

for scenario in "${SCENARIOS[@]}"; do
  echo ""
  echo "==> Running $(basename "$scenario")"
  bash "$scenario"
done

echo ""
echo "==> All E2E scenarios passed"
