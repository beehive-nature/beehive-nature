#!/usr/bin/env bash
# Deterministic public-genealogy tar builder. Run under GNU tar (the verified
# Windows path uses WSL) so the archive format and metadata rules are explicit.
set -euo pipefail

build_eternalization_tar() {
  local source_dir="$1"
  local output_tar="$2"
  local temp_tar="${output_tar}.tmp-$$-${RANDOM}"
  if ! tar \
    --sort=name \
    --mtime='2026-10-02T00:00:00Z' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    --format=posix \
    --pax-option=delete=atime,delete=ctime \
    -C "$source_dir" \
    -cf "$temp_tar" \
    .; then
    rm -f "$temp_tar"
    return 1
  fi
  mv -f "$temp_tar" "$output_tar"
}

verify_reproducible_eternalization_tar() {
  local source_dir="$1"
  local output_tar="$2"
  local repeat_tar="${output_tar}.repeat-$$"

  build_eternalization_tar "$source_dir" "$output_tar"
  build_eternalization_tar "$source_dir" "$repeat_tar"
  cmp --silent "$output_tar" "$repeat_tar" || {
    rm -f "$repeat_tar"
    echo "FAILED: independent tar constructions differ" >&2
    return 1
  }

  local sha bytes
  sha="$(sha256sum "$output_tar" | awk '{print $1}')"
  bytes="$(stat -c '%s' "$output_tar")"
  rm -f "$repeat_tar"
  printf '{"tar":"%s","bytes":%s,"sha256":"%s","reproduced":true}\n' "$output_tar" "$bytes" "$sha"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ "$#" -ne 2 ]]; then
    echo "usage: build-eternalization-tar.sh <prepared-package-dir> <output.tar>" >&2
    exit 2
  fi
  verify_reproducible_eternalization_tar "$1" "$2"
fi
