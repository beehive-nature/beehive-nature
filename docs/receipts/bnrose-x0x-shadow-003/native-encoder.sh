#!/usr/bin/env bash
set -euo pipefail
export HOME=/var/lib/bnrose-native-validation
export CARGO_HOME="$HOME/cargo"
export RUSTUP_HOME="$HOME/rustup"
export CARGO_TARGET_DIR="$HOME/target"
cd "$HOME/source"
test "$(git rev-parse HEAD)" = 85633f6a6dfea44e62a0cad778aa429275fc4604
cargo +1.95.0 test --locked --offline --release --features bnrose-shadow --lib bnrose_shadow::tests:: -j 1
sha256sum "$CARGO_TARGET_DIR/release/examples/bnrose_shadow"
