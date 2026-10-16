#!/bin/sh
# pq03-hkdf-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ03: HKDF-Expand(SHA-256) as
# hkdf 0.12.4, hmac 0.12.1 and sha2 0.10.9 run it in bsigner's expand_label.
# Classes, none standing in for another:
#
#   PIN          every package in pq03-hkdf/Cargo.lock is in the workspace
#                Cargo.lock with the same version and checksum (so the
#                harness builds the workspace's hkdf, hmac and sha2, cargo
#                checking each .crate against that checksum).
#   BUILD        pq03-hkdf compiles to MIR JSON through cargo-saw-build.
#   SPEC-CHECK   pq03-cryptol/Hkdf.cry on closed terms: SHA-256 of any length
#                against Sha256.cry's one-block digest and FIPS 180-4's
#                two-block example, RFC 5869 test case 1, and bsigner's three
#                info shapes (those computed by Python's hmac and hashlib).
#   EQUIVALENCE  pq03-saw/hkdf.saw, at info lengths 21, 55 and 101 with 32
#                bytes out, for every PRK and info: reference_N (RFC 5869
#                over sha2's compress256 in the harness) equals hkdfExpand32
#                with the compression standing in, held opaque; agree_N: the
#                shipped expand equals reference_N, nothing standing in but the
#                SHA-NI probe (the soft path). Both assumptions are printed as
#                ASSUMED and checked for here.
#   TEETH        hkdf-teeth-counter.saw (counter byte 0x02), hkdf-teeth-pads.saw
#                (ipad and opad swapped) and hkdf-teeth-agree.saw (the shipped
#                expand against the reference over a bent info, on zero inputs)
#                MUST fail with a counterexample.
#
# usage: pq03-hkdf-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq03-hkdf-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq03-hkdf-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq03-saw"
CRYDIR="$ROOT/scripts/btungsten/pq03-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq03-hkdf"
OUT="$ROOT/target/saw-pq03-hkdf"
MIR="$OUT/pq03_hkdf.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ03 HKDF: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1
rm -rf "$OUT" && mkdir -p "$OUT"

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ03 HKDF: PIN the harness lock to the workspace lock =="
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
[ -z "$_extra" ] || { say "SAW-PIN PQ03 HKDF: FAIL — harness packages not in the workspace lock as such:"; say "$_extra"; exit 1; }
grep -q '^hkdf 0.12.4 ' "$OUT/harness.lock.txt" && grep -q '^hmac 0.12.1 ' "$OUT/harness.lock.txt" && grep -q '^sha2 0.10.9 ' "$OUT/harness.lock.txt" ||
  { say "SAW-PIN PQ03 HKDF: FAIL — the harness does not lock hkdf 0.12.4, hmac 0.12.1 and sha2 0.10.9"; exit 1; }
say "SAW-PIN PQ03 HKDF: PASS ($(wc -l < "$OUT/harness.lock.txt") packages, each the workspace's version and checksum)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ03 HKDF: BUILD the harness to MIR JSON (cargo-saw-build) =="
_lock0=$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ03 HKDF: FAIL — harness"; exit 1; }
# cargo-saw-build takes no --locked: the lock must come out as it went in
[ "$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)" = "$_lock0" ] ||
  { say "SAW-BUILD PQ03 HKDF: FAIL — the build changed pq03-hkdf/Cargo.lock"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq03_hkdf-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ03 HKDF: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
say "SAW-BUILD PQ03 HKDF: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ03 HKDF: Hkdf.cry closed terms =="
for prop in sha256AgreesOneBlock sha256TwoBlockExample hkdfRfc5869Case1 hkdfShape21 hkdfShape55 hkdfShape101; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load Hkdf.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ03 HKDF: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ03-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqxF "PQ03-SAW PROVEN $_ob"; then
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
  say "== SAW PQ03 HKDF: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
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
run_required hkdf.saw reference_21 agree_21 reference_55 agree_55 reference_101 agree_101
for _a in "PQ03-SAW ASSUMED sha2 x86 compress, one block = FIPS 180-4 compress (the soft path is proven by pq03-sha256-check.sh)"           "PQ03-SAW ASSUMED the SHA-NI probe answers absent (the soft path)"; do
  say "$_log" | grep -aqxF "$_a" || { say "SAW hkdf.saw: an assumption is not reported as such: $_a"; exit 1; }
done
run_teeth_verify hkdf-teeth-counter.saw
run_teeth_verify hkdf-teeth-pads.saw
run_teeth_verify hkdf-teeth-agree.saw

say "== SAW PQ03 HKDF: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (6) | EQUIVALENCE: PROVEN (6: at info 21, 55, 101 bytes, the reference = RFC 5869 and the shipped expand = the reference) with the one-block compression and the soft path ASSUMED | TEETH: PASS (3)"
