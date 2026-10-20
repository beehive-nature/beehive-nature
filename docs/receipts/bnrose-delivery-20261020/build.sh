#!/usr/bin/env bash
set -euo pipefail
root=/var/lib/bnrose-native-validation
export CARGO_HOME="$root/cargo" RUSTUP_HOME="$root/rustup" CARGO_TARGET_DIR="$root/target"
export CMAKE_POLICY_VERSION_MINIMUM=3.5
mkdir -p "$root/direct-source"
tar -xf /run/bnrose-delivery-source.tar -C "$root/direct-source"
cd "$root/direct-source"
cargo +1.95.0 build --locked --offline --release --features bnrose-shadow --example bnrose_delivery -j 2