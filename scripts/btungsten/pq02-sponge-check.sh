#!/bin/sh
# pq02-sponge-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ02: the SHA-3 sponge as sha3
# 0.10.9 runs it (bsigner's SHA3-256 and SHAKE256). Classes, none standing
# in for another:
#
#   PIN          every package in pq02-sponge/Cargo.lock is in the workspace
#                Cargo.lock with the same version and checksum (so the
#                harness builds the workspace's sha3 0.10.9 and keccak 0.1.6,
#                cargo checking each .crate against that checksum).
#   BUILD        pq02-sponge compiles to MIR JSON through cargo-saw-build.
#   SPEC-CHECK   pq02-cryptol/KeccakF1600.cry's sponge on closed terms: FIPS
#                202's SHA3-256 of "" and "abc" and of 200 bytes of 0xA3, both
#                padding edges (135 and 136 bytes) and SHAKE256 of 0 .. 31 to
#                96 bytes (those last three computed by Python's hashlib).
#   EQUIVALENCE  pq02-saw/sponge.saw: SHA3-256 of one block, of two blocks and
#                of two parts in two updates, and SHAKE256 of a 32-byte seed
#                to 96 bytes, each equal to FIPS 202 for every input, with
#                keccak::p1600(s, 24) ASSUMED equal to keccakF and held opaque
#                (pq02-saw-check.sh ties it: shipped.saw and agree.saw).
#   TEETH        sponge-teeth-domain.saw (Keccak's domain byte 0x01 for
#                SHA-3's 0x06) and sponge-teeth-order.saw (the two updates'
#                parts swapped) MUST fail with a counterexample.
#
# usage: pq02-sponge-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq02-sponge-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq02-sponge-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq02-saw"
CRYDIR="$ROOT/scripts/btungsten/pq02-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq02-sponge"
OUT="$ROOT/target/saw-pq02-sponge"
MIR="$OUT/pq02_sponge.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ02 sponge: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1
rm -rf "$OUT" && mkdir -p "$OUT"

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ02 sponge: PIN the harness lock to the workspace lock =="
lockset() {
  awk '
    /^\[\[package\]\]/ { n = ""; v = "" }
    /^name = /     { n = $3 }
    /^version = /  { v = $3 }
    /^checksum = / { print n, v, $3 }
  ' "$1" | tr -d '"' | sort
}
lockset "$HARNESS/Cargo.lock" > "$OUT/harness.lock.txt"
lockset "$ROOT/Cargo.lock" > "$OUT/workspace.lock.txt"
_extra=$(comm -23 "$OUT/harness.lock.txt" "$OUT/workspace.lock.txt")
[ -z "$_extra" ] || { say "SAW-PIN PQ02 sponge: FAIL — harness packages not in the workspace lock as such:"; say "$_extra"; exit 1; }
grep -q '^sha3 0.10.9 ' "$OUT/harness.lock.txt" && grep -q '^keccak 0.1.6 ' "$OUT/harness.lock.txt" ||
  { say "SAW-PIN PQ02 sponge: FAIL — the harness does not lock sha3 0.10.9 and keccak 0.1.6"; exit 1; }
say "SAW-PIN PQ02 sponge: PASS ($(wc -l < "$OUT/harness.lock.txt") packages, each the workspace's version and checksum)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ02 sponge: BUILD the harness to MIR JSON (cargo-saw-build) =="
_lock0=$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ02 sponge: FAIL — harness"; exit 1; }
# cargo-saw-build takes no --locked: the lock must come out as it went in
[ "$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)" = "$_lock0" ] ||
  { say "SAW-BUILD PQ02 sponge: FAIL — the build changed pq02-sponge/Cargo.lock"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq02_sponge-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ02 sponge: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
say "SAW-BUILD PQ02 sponge: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ02 sponge: KeccakF1600.cry closed terms =="
for prop in sha3EmptyDigest sha3AbcDigest sha3MultiBlockDigest sha3PadSharedByte sha3PadFullBlock shake256Seed96; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load KeccakF1600.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ02 sponge: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ02-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqxF "PQ02-SAW PROVEN $_ob"; then
      say "SAW $_script: '$_ob' NOT PROVEN (rc=$_rc). Full output:"
      say "$_log"
      exit 1
    fi
  done
  [ "$_rc" -eq 0 ] || { say "SAW $_script: saw exited rc=$_rc after every PROVEN line — red until explained"; exit 1; }
  say "SAW $_script: $# obligations PROVEN in $((_t1 - _t0))s"
}

run_teeth_verify() {
  _script=$1
  say "== SAW PQ02 sponge: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ02-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ02-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required sponge.saw "sha3 0.10.9 SHA3-256, 32 bytes (one block)" "sha3 0.10.9 SHA3-256, 200 bytes (two blocks)" \
  "sha3 0.10.9 SHA3-256, 8 then 192 bytes in two updates" "sha3 0.10.9 SHAKE256, 32 bytes in, 96 out"
say "$_log" | grep -aqxF "PQ02-SAW ASSUMED keccak::p1600(s, 24) = keccakF (tied by shipped.saw and agree.saw)" ||
  { say "SAW sponge.saw: the p1600 assumption is not reported as such"; exit 1; }
run_teeth_verify sponge-teeth-domain.saw
run_teeth_verify sponge-teeth-order.saw

say "== SAW PQ02 sponge: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (6) | EQUIVALENCE: PROVEN (4: SHA3-256 one block, two blocks, two updates; SHAKE256 32 to 96) with keccak::p1600(s, 24) ASSUMED = keccakF (tied by the loop lane) | TEETH: PASS (2)"
