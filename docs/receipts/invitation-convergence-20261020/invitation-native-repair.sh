#!/usr/bin/env bash
set -euo pipefail
export CARGO_HOME=/var/lib/invitation-validation/cargo
export RUSTUP_HOME=/var/lib/invitation-validation/toolchain
export CARGO_TARGET_DIR=/var/lib/invitation-validation/target
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_BUILD_JOBS=2
export CMAKE_POLICY_VERSION_MINIMUM=3.5
cd /var/lib/invitation-validation/source
git fetch origin codex/invitation-convergence
git checkout --detach 3956274a07958e8b01da34eacf9fb672148e7048
test "$(git rev-parse HEAD)" = 3956274a07958e8b01da34eacf9fb672148e7048
test -z "$(git status --porcelain)"
test -z "$(git diff cfb097504cfe2d2eaf3cdc6176b02585142450aa HEAD -- src Cargo.toml Cargo.lock)"
cargo +1.95.0 test --locked --offline --all-features --test named_group_join_metadata_event --no-run --message-format=json > /var/lib/invitation-validation/repaired-build.json
sha256sum "$CARGO_TARGET_DIR/debug/x0xd"
git rev-parse HEAD
