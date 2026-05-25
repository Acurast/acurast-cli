#!/usr/bin/env bash

# Map e2e mnemonic to CLI env and run acurast.
run_acurast() {
  if [[ -z "${ACURAST_E2E_MNEMONIC:-}" ]]; then
    echo "ACURAST_E2E_MNEMONIC is not set" >&2
    exit 1
  fi
  export ACURAST_MNEMONIC="$ACURAST_E2E_MNEMONIC"
  acurast "$@"
}
