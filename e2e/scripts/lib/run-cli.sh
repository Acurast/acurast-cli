#!/usr/bin/env bash

E2E_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Map e2e mnemonic to CLI env and run acurast.
run_acurast() {
  if [[ -z "${ACURAST_E2E_MNEMONIC:-}" ]]; then
    echo "ACURAST_E2E_MNEMONIC is not set" >&2
    exit 1
  fi
  export ACURAST_MNEMONIC="$ACURAST_E2E_MNEMONIC"
  acurast "$@"
}

_require_expect() {
  if ! command -v expect >/dev/null 2>&1; then
    echo "expect(1) is required to drive interactive prompts" >&2
    exit 1
  fi
  if [[ -z "${ACURAST_E2E_MNEMONIC:-}" ]]; then
    echo "ACURAST_E2E_MNEMONIC is not set" >&2
    exit 1
  fi
  export ACURAST_MNEMONIC="$ACURAST_E2E_MNEMONIC"
}

# Drive the real interactive `acurast init` wizard.
# Inquirer reads keypresses in raw mode and pauses stdin between prompts, so
# answers must be sent reactively (one prompt at a time) rather than piped
# ahead of time; expect(1) handles the synchronisation.
# Usage: run_init_interactive <project-name> [duration]
run_init_interactive() {
  _require_expect
  expect "$E2E_LIB_DIR/init.exp" "$@"
}

# Drive the real interactive `acurast new` template picker.
# Usage: run_new_interactive <project-name>
run_new_interactive() {
  _require_expect
  expect "$E2E_LIB_DIR/new.exp" "$@"
}

# Build a throwaway local git template repo so `acurast new` runs fully offline
# and its interactive template picker is deterministic (a single choice, so
# Enter always selects it). Exports ACURAST_TEMPLATES_REPO pointing at it.
# Usage: setup_template_repo <dest> <fixture-src> <template-name>
setup_template_repo() {
  local dest="$1" src="$2" name="$3"
  rm -rf "$dest"
  mkdir -p "$dest/templates/$name"
  cp -a "$src/." "$dest/templates/$name/"
  git -C "$dest" init -q
  git -C "$dest" add -A
  git -C "$dest" -c user.email=e2e@acurast.local -c user.name=e2e \
    commit -qm "e2e template fixture"
  export ACURAST_TEMPLATES_REPO="$dest"
}
