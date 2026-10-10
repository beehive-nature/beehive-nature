#!/bin/sh
# pq05-field-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ05/PQ06: the ML-KEM and ML-DSA
# base fields as module-lattice 0.2.3 implements them. Classes, none
# standing in for another:
#
#   PIN          module-lattice 0.2.3, ml-kem 0.3.2 and ml-dsa 0.1.1 are
#                fetched and checked against Cargo.lock; module-lattice is
#                extracted for the harness to link; ml-kem's and ml-dsa's own
#                define_field! invocations must be exactly the harness's.
#   BUILD        pq05-field (a cargo package linking that module-lattice)
#                compiles to MIR JSON through cargo-saw-build.
#   EQUIVALENCE  pq05-saw/field.saw: conditional subtraction, Barrett
#                reduction and the Elem add, sub, neg and mul equal
#                pq05-cryptol/Field.cry for every input in the field.
#   TEETH        field-teeth-small.saw and field-teeth-range.saw drop a
#                precondition and MUST fail with a counterexample.
#   SPEC-CHECK   Field.cry's ML-DSA Barrett theorems (z3, over the
#                integers): its multiplier and shift are the macro's constant
#                expressions, and for every product of two elements the
#                algorithm's remainder before its one subtraction is in
#                [0, 2q). (The shipped 128-bit code is not yet tied to it.)
#
# usage: pq05-field-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq05-field-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq05-field-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
CRYDIR="$ROOT/scripts/btungsten/pq05-cryptol"
SAWDIR="$ROOT/scripts/btungsten/pq05-saw"
HARNESS="$ROOT/scripts/btungsten/pq05-field"
OUT="$ROOT/target/saw-pq05-field"
MIR="$OUT/pq05_field.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ05 field: toolchain =="
"$SAW" --version | head -1

# ---- PIN -----------------------------------------------------------------------
rm -rf "$OUT" && mkdir -p "$OUT"
pin() {
  _c=$1; _v=$2
  _want=$(awk -v c="$_c" -v v="$_v" '
    /^\[\[package\]\]/ { n = ""; ver = "" }
    /^name = /     { n = $3 }
    /^version = /  { ver = $3 }
    /^checksum = / { if (n == "\"" c "\"" && ver == "\"" v "\"") { gsub(/"/, "", $3); print $3 } }
  ' "$ROOT/Cargo.lock")
  [ -n "$_want" ] || { say "SAW-PIN PQ05: FAIL — Cargo.lock has no $_c $_v checksum"; exit 1; }
  curl --fail --silent --show-error --location --retry 3 \
    -o "$OUT/$_c-$_v.crate" "https://static.crates.io/crates/$_c/$_c-$_v.crate"
  _got=$(sha256sum "$OUT/$_c-$_v.crate" | cut -d' ' -f1)
  [ "$_got" = "$_want" ] || { say "SAW-PIN PQ05: FAIL — $_c-$_v.crate sha256 does not match Cargo.lock"; exit 1; }
  tar -xzf "$OUT/$_c-$_v.crate" -C "$OUT"
  say "SAW-PIN PQ05: PASS ($_c $_v, sha256 matches Cargo.lock)"
}
say "== SAW PQ05 field: PIN =="
pin module-lattice 0.2.3
pin ml-kem 0.3.2
pin ml-dsa 0.1.1
grep -qxF 'module_lattice::define_field!(BaseField, u16, u32, u64, 3329);' "$OUT/ml-kem-0.3.2/src/algebra.rs" ||
  { say "SAW-PIN PQ05: FAIL — ml-kem 0.3.2 no longer defines its field as the harness does"; exit 1; }
grep -qxF 'module_lattice::define_field!(BaseField, u32, u64, u128, 8_380_417);' "$OUT/ml-dsa-0.1.1/src/algebra.rs" ||
  { say "SAW-PIN PQ05: FAIL — ml-dsa 0.1.1 no longer defines its field as the harness does"; exit 1; }
grep -qxF 'module_lattice::define_field!(KemField, u16, u32, u64, 3329);' "$HARNESS/src/lib.rs" &&
  grep -qxF 'module_lattice::define_field!(DsaField, u32, u64, u128, 8_380_417);' "$HARNESS/src/lib.rs" ||
  { say "SAW-PIN PQ05: FAIL — the harness's invocations drifted from the crates'"; exit 1; }
say "SAW-PIN PQ05: PASS (ml-kem's and ml-dsa's define_field! invocations are the harness's)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ05 field: BUILD the harness to MIR JSON (cargo-saw-build) =="
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ05: FAIL — harness"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq05_field-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ05: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
# the same harness with overflow checks off (Cargo's release default; the
# workspace sets no profile override), for field-release.saw
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo-release" \
    CARGO_PROFILE_TEST_OVERFLOW_CHECKS=false CARGO_PROFILE_DEV_OVERFLOW_CHECKS=false \
    cargo saw-build ) || { say "SAW-BUILD PQ05: FAIL — harness (release semantics)"; exit 1; }
_found=$(find "$OUT/cargo-release" -name 'pq05_field-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ05: FAIL — no release-semantics MIR"; exit 1; }
cp "$_found" "$OUT/pq05_field_release.linked-mir.json"
say "SAW-BUILD PQ05: PASS ($(wc -c < "$MIR") bytes of linked MIR, and the release-semantics build)"

run_required() {
  _script=$1; shift
  say "== SAW PQ05 field: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ05-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqxF "PQ05-SAW PROVEN $_ob"; then
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
  say "== SAW PQ05 field: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ05-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ05-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ05: Field.cry, ML-DSA Barrett over the integers =="
for prop in dsaBarrettConstants dsaBarrettRange; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load Field.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required field.saw kem_small kem_barrett "kem_barrett (sums of two products)" kem_add kem_sub kem_neg kem_mul \
  dsa_small dsa_add dsa_sub dsa_neg
run_required field-release.saw "dsa_barrett (release build) = the Barrett algorithm" \
  "dsa_mul (release build) = the Barrett algorithm of the product"
run_teeth_verify field-teeth-small.saw
run_teeth_verify field-teeth-range.saw

say "== SAW PQ05 field: ladder state =="
say "PIN: PASS (3 crates + both define_field! invocations) | BUILD: PASS (and release semantics) | SPEC-CHECK: PASS (2) | EQUIVALENCE: PROVEN (13: 11, and ML-DSA Barrett and multiply as release builds run them) | TEETH: PASS (2)"
