#!/usr/bin/env bash
set -euo pipefail
export CARGO_HOME=/var/lib/invitation-validation/cargo
export RUSTUP_HOME=/var/lib/invitation-validation/toolchain
export CARGO_TARGET_DIR=/var/lib/invitation-validation/target
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_BUILD_JOBS=2
export CMAKE_POLICY_VERSION_MINIMUM=3.5
cd /var/lib/invitation-validation
if [ ! -d source ]; then git clone --no-checkout https://github.com/loviswaternakamoto/x0x source; fi
cd source
git checkout --detach cfb097504cfe2d2eaf3cdc6176b02585142450aa
test "$(git rev-parse HEAD)" = cfb097504cfe2d2eaf3cdc6176b02585142450aa
cat /etc/os-release
rustup toolchain install 1.95.0 --profile minimal
rustc +1.95.0 -Vv
cargo +1.95.0 build --locked --all-features --bin x0xd
cargo +1.95.0 test --locked --all-features --test named_group_join_metadata_event --no-run --message-format=json > /var/lib/invitation-validation/baseline-build.json
sha256sum "$CARGO_TARGET_DIR/debug/x0xd"
