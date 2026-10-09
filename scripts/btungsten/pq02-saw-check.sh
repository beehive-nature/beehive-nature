#!/bin/sh
# pq02-saw-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ02: the shipped Keccak-f[1600],
# both versions Cargo.lock links: keccak 0.1.6 (under sha3 0.10: bsigner's
# SHA3-256 and SHAKE256, every bzpq1 id, succession commitment and
# sealed-object hash; fips205) and keccak 0.2.2 (under shake 0.1 for ml-dsa
# 0.1.1 and sha3 0.11 for ml-kem 0.3.2 and slh-dsa). Classes, none standing
# in for another:
#
#   PIN          each keccak .crate is fetched and checked against the checksum
#                Cargo.lock carries for it; the proof is about those bytes.
#   BUILD        keccak 0.1.6 with pq02-harness/harness.rs, and
#                pq02-harness/harness022.rs (which compiles 0.2.2's round
#                body files verbatim), compile to MIR JSON.
#   SPEC-CHECK   pq02-cryptol/KeccakF1600.cry (written from FIPS 202, ρ offsets
#                and round constants derived, not transcribed) on its closed
#                terms: the Keccak team's zero-state lanes, FIPS 202 SHA3-256
#                of "" and "abc", the ρ walk covering every lane once.
#   EQUIVALENCE  pq02-saw/shipped.saw: the crate's own round body (generic
#                keccak::keccak_p, run once per constant through the harness
#                lane type) equals FIPS 202 keccakRound k for every state, for
#                each k = 0..23; pq02-saw/shipped022.saw the same for 0.2.2's
#                soft::keccak_p. Not machine-checked: that the 24-round
#                permutation runs those bodies in order (each crate's loop,
#                read).
#   TEETH        shipped-teeth.saw (one ρ offset off by one) MUST fail with a
#                counterexample.
#
# usage: pq02-saw-check.sh <saw> <saw-rustc> <cryptol>
set -eu

SAW="${1:?usage: pq02-saw-check.sh <saw> <saw-rustc> <cryptol>}"
SAW_RUSTC="${2:?usage: pq02-saw-check.sh <saw> <saw-rustc> <cryptol>}"
CRYPTOL="${3:?usage: pq02-saw-check.sh <saw> <saw-rustc> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq02-saw"
CRYDIR="$ROOT/scripts/btungsten/pq02-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq02-harness/harness.rs"
OUT="$ROOT/target/saw-pq02"
MIR="$OUT/pq02_harness.linked-mir.json"
VERSION=0.1.6

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ02: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1

# ---- PIN -----------------------------------------------------------------------
rm -rf "$OUT" && mkdir -p "$OUT"
pin() {
  _v=$1
  say "== SAW PQ02: PIN keccak $_v to Cargo.lock =="
  _want=$(awk -v v="$_v" '
    /^\[\[package\]\]/ { n = ""; ver = "" }
    /^name = /     { n = $3 }
    /^version = /  { ver = $3 }
    /^checksum = / { if (n == "\"keccak\"" && ver == "\"" v "\"") { gsub(/"/, "", $3); print $3 } }
  ' "$ROOT/Cargo.lock")
  [ -n "$_want" ] || { say "SAW-PIN PQ02: FAIL — Cargo.lock has no keccak $_v checksum"; exit 1; }
  curl --fail --silent --show-error --location --retry 3 \
    -o "$OUT/keccak-$_v.crate" "https://static.crates.io/crates/keccak/keccak-$_v.crate"
  _got=$(sha256sum "$OUT/keccak-$_v.crate" | cut -d' ' -f1)
  [ "$_got" = "$_want" ] || { say "SAW-PIN PQ02: FAIL — keccak-$_v.crate sha256 does not match Cargo.lock"; exit 1; }
  tar -xzf "$OUT/keccak-$_v.crate" -C "$OUT"
  say "SAW-PIN PQ02: PASS (keccak $_v, sha256 matches Cargo.lock)"
}
pin "$VERSION"
pin 0.2.2

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ02: BUILD the crates and the harnesses to MIR JSON =="
( cd "$OUT" && "$SAW_RUSTC" "keccak-$VERSION/src/lib.rs" --edition 2018 --crate-type lib \
    --crate-name keccak --out-dir "$OUT" ) || { say "SAW-BUILD PQ02: FAIL — keccak"; exit 1; }
( cd "$OUT" && "$SAW_RUSTC" "$HARNESS" --edition 2021 --crate-type lib --crate-name pq02_harness \
    --extern keccak="$OUT/libkeccak.rlib" -L "dependency=$OUT" --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ02: FAIL — harness"; exit 1; }
[ -s "$MIR" ] || { say "SAW-BUILD PQ02: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
# keccak 0.2.2: its soft backend compiled verbatim inside harness022.rs
( cd "$OUT" && "$SAW_RUSTC" "$ROOT/scripts/btungsten/pq02-harness/harness022.rs" --edition 2024 \
    --crate-type lib --crate-name pq02_harness022 --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ02: FAIL — harness022"; exit 1; }
[ -s "$OUT/pq02_harness022.linked-mir.json" ] || { say "SAW-BUILD PQ02: FAIL — no harness022 MIR"; exit 1; }
say "SAW-BUILD PQ02: PASS ($(wc -c < "$MIR") + $(wc -c < "$OUT/pq02_harness022.linked-mir.json") bytes of linked MIR)"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ02: KeccakF1600.cry closed terms =="
for prop in zeroStateFirstLane zeroStateLastLane sha3EmptyDigest sha3AbcDigest rhoWalkCoversEveryLaneOnce; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load KeccakF1600.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ02: $_script =="
  _t0=$(clock)
  # each one-round goal over 1600 state bits; the heap cap keeps a CI runner
  # (16 GB) alive, measured peak 10.7 GB for all 24
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ02-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqx "PQ02-SAW PROVEN $_ob"; then
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
  say "== SAW PQ02: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
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

# ---- EQUIVALENCE -------------------------------------------------------------------
rounds=""
i=0
while [ $i -lt 24 ]; do rounds="$rounds shipped_round_$i"; i=$((i + 1)); done
# shellcheck disable=SC2086
run_required shipped.saw $rounds
run_teeth_verify shipped-teeth.saw
rounds022=""
i=0
while [ $i -lt 24 ]; do rounds022="$rounds022 keccak022.shipped_round_$i"; i=$((i + 1)); done
# shellcheck disable=SC2086
run_required shipped022.saw $rounds022

say "== SAW PQ02: ladder state =="
say "PIN: PASS (2 crates) | BUILD: PASS | SPEC-CHECK: PASS (5) | EQUIVALENCE: PROVEN (keccak 0.1.6 and 0.2.2 round bodies == FIPS 202 keccakRound, all 24 constants each; the 24-round loops read, not proven) | TEETH: PASS (1)"
