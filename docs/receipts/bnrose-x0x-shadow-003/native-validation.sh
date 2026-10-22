#!/usr/bin/env bash
set -euo pipefail
export HOME=/var/lib/bnrose-native-validation
export CARGO_HOME="$HOME/cargo"
export RUSTUP_HOME="$HOME/rustup"
export CARGO_TARGET_DIR="$HOME/target"
cd "$HOME"
if [ ! -d source ]; then git clone --no-checkout https://github.com/loviswaternakamoto/x0x source; fi
cd source
git fetch origin codex/bnrose-shadow
git checkout --detach 85633f6a6dfea44e62a0cad778aa429275fc4604
test "$(git rev-parse HEAD)" = 85633f6a6dfea44e62a0cad778aa429275fc4604
cat /etc/os-release
rustup toolchain install 1.95.0 --profile minimal
id; namei -l "$RUSTUP_HOME/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/rustc"; findmnt -T "$RUSTUP_HOME"; "$RUSTUP_HOME/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/rustc" -Vv
cargo +1.95.0 build --locked --release --features bnrose-shadow --example bnrose_shadow -j 2
cargo +1.95.0 test --locked --release --features bnrose-shadow --example bnrose_shadow -j 2
cargo +1.95.0 test --locked --release --features bnrose-shadow --lib bnrose_shadow::tests:: -j 2
sha256sum "$CARGO_TARGET_DIR/release/examples/bnrose_shadow"
