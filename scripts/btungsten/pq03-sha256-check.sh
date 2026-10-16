#!/bin/sh
# pq03-sha256-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ03: SHA-256 in sha2 0.10.9,
# under bsigner's HKDF-SHA256 and HMAC, BIP-340 tagged hashes and BIP-341
# sighashes. Classes, none standing in for another:
#
#   PIN          the sha2 .crate is fetched and checked against the checksum
#                Cargo.lock carries for it; the proof is about those bytes.
#   BUILD        pq03-harness/sha256.rs (which compiles the crate's soft.rs
#                and consts.rs verbatim) compiles to MIR JSON.
#   SPEC-CHECK   pq03-cryptol/Sha256.cry (FIPS 180-4; K and H0 computed from
#                integer roots of the primes) on its closed terms: the primes,
#                the published first and last K and H0, and FIPS 180-4's
#                digests of "", "abc" and its two-block example.
#   EQUIVALENCE  pq03-saw/sha256.saw: the crate's tables equal the derived
#                constants; its two-round function and message schedule equal
#                FIPS 180-4 for every input; its 64-round block function
#                equals FIPS compress, composed from those two proofs; one
#                block through its compress (bytes to big-endian words)
#                equals FIPS compress. This is the soft path: on x86_64 with
#                the SHA extensions sha2 runs SHA-NI intrinsics instead,
#                which this does not cover.
#   TEETH        sha256-teeth.saw (Σ1 rotating by 7) and sha256-teeth-k.saw
#                (one round constant off by a bit) MUST fail with a
#                counterexample.
#
# usage: pq03-sha256-check.sh <saw> <saw-rustc> <cryptol>
set -eu

SAW="${1:?usage: pq03-sha256-check.sh <saw> <saw-rustc> <cryptol>}"
SAW_RUSTC="${2:?usage: pq03-sha256-check.sh <saw> <saw-rustc> <cryptol>}"
CRYPTOL="${3:?usage: pq03-sha256-check.sh <saw> <saw-rustc> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq03-saw"
CRYDIR="$ROOT/scripts/btungsten/pq03-cryptol"
OUT="$ROOT/target/saw-pq03-sha256"
MIR="$OUT/pq03_sha256.linked-mir.json"
VERSION=0.10.9

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ03 SHA-256: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ03 SHA-256: PIN sha2 $VERSION to Cargo.lock =="
rm -rf "$OUT" && mkdir -p "$OUT"
WANT=$(awk -v v="$VERSION" '
  /^\[\[package\]\]/ { n = ""; ver = "" }
  /^name = /     { n = $3 }
  /^version = /  { ver = $3 }
  /^checksum = / { if (n == "\"sha2\"" && ver == "\"" v "\"") { gsub(/"/, "", $3); print $3 } }
' "$ROOT/Cargo.lock")
[ -n "$WANT" ] || { say "SAW-PIN PQ03: FAIL — Cargo.lock has no sha2 $VERSION checksum"; exit 1; }
curl --fail --silent --show-error --location --retry 3 \
  -o "$OUT/sha2-$VERSION.crate" "https://static.crates.io/crates/sha2/sha2-$VERSION.crate"
GOT=$(sha256sum "$OUT/sha2-$VERSION.crate" | cut -d' ' -f1)
[ "$GOT" = "$WANT" ] || { say "SAW-PIN PQ03: FAIL — sha2-$VERSION.crate sha256 does not match Cargo.lock"; exit 1; }
tar -xzf "$OUT/sha2-$VERSION.crate" -C "$OUT"
say "SAW-PIN PQ03: PASS (sha2 $VERSION, sha256 matches Cargo.lock)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ03 SHA-256: BUILD the harness to MIR JSON =="
( cd "$OUT" && "$SAW_RUSTC" "$ROOT/scripts/btungsten/pq03-harness/sha256.rs" --edition 2018 \
    --crate-type lib --crate-name pq03_sha256 --out-dir "$OUT" ) || { say "SAW-BUILD PQ03: FAIL — harness"; exit 1; }
[ -s "$MIR" ] || { say "SAW-BUILD PQ03: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
say "SAW-BUILD PQ03: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ03: Sha256.cry closed terms =="
for prop in primesArePrimesInOrder constantsMatchThePublishedOnes sha256EmptyDigest sha256AbcDigest sha256TwoBlockDigest; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load Sha256.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ03 SHA-256: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ03-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqF "PQ03-SAW PROVEN $_ob"; then
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
  say "== SAW PQ03 SHA-256: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ03-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ03-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required sha256.saw "sha256 K32 = K" "sha256 H256_256 = H0" sha256_digest_round_x2 schedule \
  sha256_digest_block_u32 compress1
run_teeth_verify sha256-teeth.saw
run_teeth_verify sha256-teeth-k.saw

say "== SAW PQ03 SHA-256: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (5) | EQUIVALENCE: PROVEN (6: tables, two-round function, schedule, 64-round block composed, one-block compress; the soft path) | TEETH: PASS (2)"
