#!/usr/bin/env bash
# Build only. Never connects to hardware, flashes, uploads, or spends.
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo 'usage: build-pinned.sh CHECKOUT FULL_COMMIT' >&2
  exit 2
fi
cd -P -- "$1"
revision=$(git rev-parse HEAD)
if [ "$revision" != "$2" ]; then
  echo 'Refusing unexpected source revision' >&2; exit 1
fi
source_status=$(git status --porcelain --untracked-files=all --ignore-submodules=none)
if [ -n "$source_status" ]; then
  echo 'Refusing dirty source' >&2; exit 1
fi
pins=$(git submodule status --recursive)
if printf '%s\n' "$pins" | grep -q '^[+U-]'; then
  echo 'Refusing missing or mismatched submodule' >&2; exit 1
fi
if [ -e core/build-xtask ]; then
  echo 'Refusing an existing build directory; use a fresh checkout' >&2; exit 1
fi
# C assertions in secmon otherwise embed the absolute checkout path, changing
# its binary hash. Keep the mapping the same per build.
export CFLAGS="-ffile-prefix-map=$PWD=/build/bsafe"
nix-shell --run 'uv sync --frozen && uv run --frozen xtask build firmware --model T3W1 --pyopt true'
