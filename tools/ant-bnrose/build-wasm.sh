#!/usr/bin/env bash
set -euo pipefail
# The experiment copies the three existing crates into a minimal workspace.
# Their source bytes and dependency versions are unchanged.
root=/var/lib/bnrose-ant-validation
export CARGO_HOME="$root/cargo" RUSTUP_HOME="$root/rustup"
export CARGO_TARGET_DIR="$root/target"
mkdir -p "$root/core-workspace/crates"
cd "$root/source"
cp -a crates/bnrose-exec-core crates/bnrose-exec-wasm crates/btungsten-wb001-core "$root/core-workspace/crates/"
cp Cargo.lock "$root/core-workspace/Cargo.lock"
cat > "$root/core-workspace/Cargo.toml" <<'EOF'
[workspace]
resolver = "2"
members = ["crates/bnrose-exec-core", "crates/bnrose-exec-wasm", "crates/btungsten-wb001-core"]
[workspace.package]
edition = "2021"
EOF
toolchain=${BNROSE_RUST_TOOLCHAIN:-$(sed -n 's/^channel = "\([^"]*\)".*/\1/p' rust-toolchain.toml)}
[[ "$toolchain" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
rustup toolchain install "$toolchain" --profile minimal --target wasm32-unknown-unknown
cd "$root/core-workspace"
# Lock pruning is limited to the copied minimal workspace. Preserve its lock.
rustc "+$toolchain" --version
cargo "+$toolchain" build --release --target wasm32-unknown-unknown -p bnrose-exec-wasm
cp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/bnrose_exec_wasm.wasm" "$root/source/tools/ant-bnrose/kernel.wasm"
sha256sum "$root/source/tools/ant-bnrose/kernel.wasm"
