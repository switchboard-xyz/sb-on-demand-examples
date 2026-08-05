#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

find_cargo_build_sbf() {
  if command -v cargo-build-sbf >/dev/null 2>&1; then
    command -v cargo-build-sbf
    return 0
  fi

  local search_dir="$PROJECT_ROOT"
  while [ "$search_dir" != "/" ]; do
    if [ -x "$search_dir/.codex-tools/bin/cargo-build-sbf" ]; then
      printf '%s\n' "$search_dir/.codex-tools/bin/cargo-build-sbf"
      return 0
    fi

    search_dir="$(dirname "$search_dir")"
  done

  return 1
}

CARGO_BUILD_SBF_BIN="$(find_cargo_build_sbf || true)"

if [ -z "$CARGO_BUILD_SBF_BIN" ]; then
  echo "cargo-build-sbf not found."
  echo "Install it on PATH or place it in a parent .codex-tools/bin directory."
  exit 1
fi

exec "$CARGO_BUILD_SBF_BIN" \
  --manifest-path "$PROJECT_ROOT/programs/basic-oracle-example/Cargo.toml" \
  --sbf-out-dir "$PROJECT_ROOT/target/deploy" \
  -j "${CARGO_BUILD_JOBS:-1}"
