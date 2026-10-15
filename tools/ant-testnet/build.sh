#!/bin/sh
# build.sh — the pinned lab, from source, on any Linux host (WSL included). Idempotent.
#
#   ant-devnet  WithAutonomi/ant-node tag v0.22.0 = commit 008d2ad
#               cargo build --release --bin ant-devnet --features test-utils
#               (the crate's default features add logging and webrtc-direct)
#   anvil       Foundry v1.8.5 (commit 51a52c5), installed as ~/.local/foundry-v1.8.5/anvil and
#               linked as ~/.local/bin/anvil — this script links, it does not download Foundry
#
# Refuses to build an ant-node checkout that is not the pinned commit, and refuses to link an
# anvil that is not v1.8.5. Another host that runs this and then start.sh runs the same lab.
set -eu
ROOT="${ANT_TESTNET_ROOT:-$HOME/ant-testnet}"
TAG=v0.22.0; SHA=008d2ad
command -v cargo >/dev/null || { echo "cargo not on PATH (. ~/.cargo/env)" >&2; exit 1; }
command -v git >/dev/null || { echo "git is missing" >&2; exit 1; }
mkdir -p "$ROOT"
[ -d "$ROOT/ant-node/.git" ] || git clone --branch "$TAG" --depth 1 https://github.com/WithAutonomi/ant-node.git "$ROOT/ant-node"
got="$(git -C "$ROOT/ant-node" rev-parse --short=7 HEAD)"
[ "$got" = "$SHA" ] || { echo "ant-node checkout is $got, not $SHA ($TAG); refusing to build an unpinned devnet" >&2; exit 1; }
( cd "$ROOT/ant-node" && CARGO_TARGET_DIR="$ROOT/target" cargo build --release --bin ant-devnet --features test-utils )
"$ROOT/target/release/ant-devnet" --version
F="$HOME/.local/foundry-v1.8.5/anvil"
[ -x "$F" ] || { echo "Foundry v1.8.5 is not at $F. Put that exact release there (the foundry-rs/foundry v1.8.5 release archive), then rerun." >&2; exit 1; }
"$F" --version 2>/dev/null | grep -q '1\.8\.5' || { echo "$F is not v1.8.5: $("$F" --version | head -1)" >&2; exit 1; }
mkdir -p "$HOME/.local/bin"; ln -sf "$F" "$HOME/.local/bin/anvil"
"$HOME/.local/bin/anvil" --version | head -1
echo "lab built: ant-devnet $TAG ($SHA) at $ROOT/target/release/ant-devnet; anvil v1.8.5 linked. Next: sh $(dirname "$0")/start.sh"
