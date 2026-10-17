#!/bin/sh
# Build surfaces/bnr-explorer.wasm from crates/bnr-explorer-wasm, reproducibly.
#   sh scripts/bnr-explorer/build-wasm.sh          rebuild and write the module
#   sh scripts/bnr-explorer/build-wasm.sh --check  fail unless the committed
#                                                  module IS this tree's build
# Reproducible because the only machine-specific strings a build can embed
# (this checkout's path, the cargo home, the target directory) are remapped to
# fixed names (the last, most specific mapping wins), and the toolchain is
# pinned by rust-toolchain.toml. A separate target directory keeps the
# remapped flags from invalidating the workspace's own cache.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
OUT=surfaces/bnr-explorer.wasm
TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}/bnr-explorer-repro"
HOME_DIR="${CARGO_HOME:-$HOME/.cargo}"
RUSTFLAGS="--remap-path-prefix=$ROOT=/bnr --remap-path-prefix=$HOME_DIR=/cargo --remap-path-prefix=$TARGET_DIR=/target" \
  cargo build -p bnr-explorer-wasm --target wasm32-unknown-unknown --release --locked \
  --target-dir "$TARGET_DIR" &&
BUILT="$TARGET_DIR/wasm32-unknown-unknown/release/bnr_explorer_wasm.wasm" &&
built=$(sha256sum < "$BUILT" | cut -d' ' -f1) &&
if [ "${1:-}" = "--check" ]; then
  have=$(sha256sum < "$OUT" | cut -d' ' -f1) &&
  if [ "$have" != "$built" ]; then
    echo "$OUT is not the build of this tree: committed $have, built $built" >&2
    exit 1
  fi &&
  echo "$OUT reproduces: sha256 $built"
else
  cp "$BUILT" "$OUT" &&
  echo "wrote $OUT: sha256 $built, $(wc -c < "$OUT") bytes"
fi
