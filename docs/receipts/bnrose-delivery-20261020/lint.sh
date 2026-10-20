#!/usr/bin/env bash
set -euo pipefail
root=/var/lib/bnrose-native-validation
export CARGO_HOME="$root/cargo" RUSTUP_HOME="$root/rustup" CARGO_TARGET_DIR="$root/target"
export CMAKE_POLICY_VERSION_MINIMUM=3.5
cd "$root/direct-source"
rustup component add --toolchain 1.95.0 rustfmt clippy
cargo +1.95.0 fmt --all -- --check
cargo +1.95.0 clippy --locked --offline --release --features bnrose-shadow --example bnrose_delivery -j 2 -- -D warnings