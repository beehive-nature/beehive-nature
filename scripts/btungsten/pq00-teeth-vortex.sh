#!/bin/sh
# pq00-teeth-vortex.sh — SPEC-BTUNGSTEN-PQ-1 PQ00: the two teeth templates
# (crates/btungsten-teeth/src/lib.rs) must CONVICT the two real defects in
# distributed-lab/vortex-rs at 3c0affd9320a before they guard anything of
# ours:
#
#   T-VACUOUS   vortex verify() accepts a proof with zero opened columns,
#               including one for a FALSE evaluation claim
#   T-TRUNCATE  vortex RSis::hash() without AVX-512 ignores every element
#               past the first 256 (a collision at length 257, position 256)
#
# Vortex stays out of the stack: it is cloned into a build copy under
# target/, one test-module line is appended to that copy's src/lib.rs, and
# the beehive-nature workspace must not resolve any package named vortex
# (audit law gate 1, printed at the end).
#
# usage: sh scripts/btungsten/pq00-teeth-vortex.sh   (from the repo root)
#   PQ00_WORK=<dir>   build copy location (default target/pq00-vortex)
set -eu

ROOT=$(pwd)
PIN=3c0affd9320a85f34a5999aba77a378c43538fe1
WORK="${PQ00_WORK:-$ROOT/target/pq00-vortex}"
say() { printf '%s\n' "$*"; }
fail() { say "PQ00: FAIL — $*"; exit 1; }

[ -f "$ROOT/crates/btungsten-teeth/src/lib.rs" ] || fail "run from the repo root"

say "== PQ00: toolchain =="
cargo --version
rustc --version
if rustc --print cfg ${RUSTFLAGS:-} | grep -q 'target_feature="avx512f"'; then
  fail "this target enables avx512f; the T-TRUNCATE defect lives on the non-AVX-512 path"
fi
say "PQ00: target has no avx512f (vortex takes its portable hash path)"

say "== PQ00: build copy of vortex-rs at $PIN =="
rm -rf "$WORK" && mkdir -p "$WORK"
git clone --quiet https://github.com/distributed-lab/vortex-rs.git "$WORK/vortex"
cd "$WORK/vortex"
git -c advice.detachedHead=false checkout --quiet "$PIN"
[ "$(git rev-parse HEAD)" = "$PIN" ] || fail "checkout is $(git rev-parse HEAD), not the pin"
if grep -q '^\[dev-dependencies\]' Cargo.toml; then
  fail "the pinned Cargo.toml grew a [dev-dependencies] table; adjust the overlay"
fi
cp "$ROOT/scripts/btungsten/teeth-vortex/pq00_teeth.rs" src/
printf '\n#[cfg(test)]\n#[path = "pq00_teeth.rs"]\nmod pq00_teeth;\n' >> src/lib.rs
printf '\n[dev-dependencies]\nbtungsten-teeth = { path = "%s" }\n' "$ROOT/crates/btungsten-teeth" >> Cargo.toml
# its own workspace: the default build copy sits under this repo's target/,
# and without this table cargo files it under the beehive-nature workspace
printf '\n[workspace]\n' >> Cargo.toml
say "PQ00: overlay = one appended test module, the dev-dependency on the templates, an empty [workspace]; vortex source otherwise as pinned"
git diff --stat

say "== PQ00: run the templates against vortex =="
LOG="$WORK/pq00.log"
cargo test --release --lib pq00_teeth -- --nocapture --test-threads=1 > "$LOG" 2>&1 && RC=0 || RC=$?
grep -a -E 'PQ00 |^test |test result' "$LOG" || true
[ "$RC" -eq 0 ] || { say "PQ00: cargo test exited $RC; full log:"; cat "$LOG"; fail "the vortex teeth run did not complete"; }
V=$(grep -a -o 'PQ00 T-VACUOUS convicts vortex verify: true' "$LOG" | wc -l)
T=$(grep -a -o 'PQ00 T-TRUNCATE convicts vortex RSis::hash: true' "$LOG" | wc -l)
[ "$V" -eq 2 ] || fail "T-VACUOUS convicted vortex verify $V of 2 times"
[ "$T" -eq 1 ] || fail "T-TRUNCATE convicted vortex RSis::hash $T of 1 times"

say "== PQ00: audit gate 1 — vortex absent from the beehive-nature build =="
cd "$ROOT"
if TREE=$(cargo tree --locked -e normal --workspace -i vortex 2>&1); then
  say "$TREE"
  fail "the workspace resolves a package named vortex"
fi
# only the resolver's own "no such package" counts; any other error is not evidence
say "$TREE" | grep 'did not match any packages' || { say "$TREE"; fail "cargo tree failed for another reason; absence not shown"; }
say "PQ00 vortex in the default build: absent"

say "== PQ00: verdict =="
say "T-VACUOUS: CONVICTS vortex verify (2 of 2 degenerate shapes) | T-TRUNCATE: CONVICTS vortex RSis::hash (len 257, pos 256) | vortex absent from the workspace | scope: the templates are proven able to see these two flaw classes; our own code is held to them lane by lane"
