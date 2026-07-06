#!/usr/bin/env bash

assert_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "ASSERT FAIL: expected file: $path" >&2
    exit 1
  fi
}

assert_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "ASSERT FAIL: expected directory: $path" >&2
    exit 1
  fi
}

assert_exit() {
  local code="$1"
  local expected="$2"
  local label="${3:-command}"
  if [[ "$code" -ne "$expected" ]]; then
    echo "ASSERT FAIL: $label exited with $code (expected $expected)" >&2
    exit 1
  fi
}

assert_stdout_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "ASSERT FAIL: stdout missing expected text: $needle" >&2
    exit 1
  fi
}

assert_file_contains() {
  local path="$1"
  local needle="$2"
  if ! grep -qF "$needle" "$path"; then
    echo "ASSERT FAIL: $path does not contain: $needle" >&2
    exit 1
  fi
}

assert_json_key() {
  local path="$1"
  local key="$2"
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$path', 'utf8'));
    const keys = '$key'.split('.');
    let cur = data;
    for (const k of keys) {
      if (!cur || !(k in cur)) process.exit(1);
      cur = cur[k];
    }
  " 2>/dev/null || {
    echo "ASSERT FAIL: $path missing JSON key: $key" >&2
    exit 1
  }
}

assert_no_deploy_artifacts() {
  local deploy_dir="$1/.acurast/deploy"
  if [[ -d "$deploy_dir" ]] && [[ -n "$(ls -A "$deploy_dir" 2>/dev/null)" ]]; then
    echo "ASSERT FAIL: unexpected deploy artifacts in $deploy_dir" >&2
    exit 1
  fi
}
