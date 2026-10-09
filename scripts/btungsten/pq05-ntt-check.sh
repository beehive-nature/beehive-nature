#!/bin/sh
# pq05-ntt-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ05: ML-KEM's NTT as ml-kem 0.3.2
# implements it. Classes, none standing in for another:
#
#   PIN          every package in pq05-ntt/Cargo.lock is in the workspace
#                Cargo.lock with the same version and checksum (so the
#                harness builds the workspace's ml-kem 0.3.2 and module-lattice
#                0.2.3, cargo checking each .crate against that checksum).
#   BUILD        pq05-ntt compiles to MIR JSON through cargo-saw-build;
#                pq05-ntt-names.py finds ml-kem's NTT and the Elem operators
#                by name and signature.
#   SPEC-CHECK   pq05-cryptol/KemNtt.cry on its closed terms: the computed
#                twiddle and γ tables against FIPS 203 Appendix A,
#                128 * 3303 = 1, NTT^-1 undoing NTT on a fixed polynomial, and
#                NTT^-1(NTT f ∘ NTT g) equal to the schoolbook negacyclic
#                product on a fixed pair.
#   EQUIVALENCE  pq05-saw/ntt.saw: ml-kem's Elem add, sub and mul equal
#                Field.cry; then its NTT equals FIPS 203 Algorithm 9 and its
#                inverse NTT equals Algorithm 10 for every polynomial with
#                coefficients in the field, those three proofs standing in for
#                the calls; its Barrett instance, then its base-case multiply
#                equals Algorithm 12 for every i < 128, then multiply_ntt
#                equals Algorithm 11, each proof standing in for the next.
#   TEETH        ntt-teeth.saw (one twiddle factor bent) and
#                ntt-teeth-gamma.saw (one γ bent) MUST fail with a
#                counterexample.
#
# usage: pq05-ntt-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq05-ntt-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq05-ntt-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq05-saw"
CRYDIR="$ROOT/scripts/btungsten/pq05-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq05-ntt"
OUT="$ROOT/target/saw-pq05-ntt"
MIR="$OUT/pq05_ntt.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ05 NTT: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1
rm -rf "$OUT" && mkdir -p "$OUT"

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ05 NTT: PIN the harness lock to the workspace lock =="
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
[ -z "$_extra" ] || { say "SAW-PIN PQ05: FAIL — harness packages not in the workspace lock as such:"; say "$_extra"; exit 1; }
grep -q '^ml-kem 0.3.2 ' "$OUT/harness.lock.txt" && grep -q '^module-lattice 0.2.3 ' "$OUT/harness.lock.txt" ||
  { say "SAW-PIN PQ05: FAIL — the harness does not lock ml-kem 0.3.2 and module-lattice 0.2.3"; exit 1; }
say "SAW-PIN PQ05: PASS ($(wc -l < "$OUT/harness.lock.txt") packages, each the workspace's version and checksum)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ05 NTT: BUILD the harness to MIR JSON (cargo-saw-build) =="
_lock0=$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ05: FAIL — harness"; exit 1; }
# cargo-saw-build takes no --locked: the lock must come out as it went in
[ "$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)" = "$_lock0" ] ||
  { say "SAW-BUILD PQ05: FAIL — the build changed pq05-ntt/Cargo.lock"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq05_ntt-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ05: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
python3 "$ROOT/scripts/btungsten/pq05-ntt-names.py" "$MIR" > "$OUT/names.saw" || { say "SAW-BUILD PQ05: FAIL — names"; exit 1; }
say "SAW-BUILD PQ05: PASS ($(wc -c < "$MIR") bytes of linked MIR; names:)"
sed 's/^/  /' "$OUT/names.saw"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ05: KemNtt.cry closed terms =="
for prop in zetasMatchAppendixA gammasMatchAppendixA inverseOf128 inverseUndoesForward nttMultipliesPolynomials; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load KemNtt.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ05 NTT: $_script =="
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
  say "== SAW PQ05 NTT: TEETH $_script — must FAIL with a counterexample =="
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

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required ntt.saw "ml-kem Elem add" "ml-kem Elem sub" "ml-kem Elem mul" "ml-kem ntt (FIPS 203 Algorithm 9)" \
  "ml-kem ntt_inverse (FIPS 203 Algorithm 10)" "ml-kem barrett_reduce (sums of two products)" \
  "ml-kem base_case_multiply (FIPS 203 Algorithm 12)" "ml-kem multiply_ntt (FIPS 203 Algorithm 11)"
run_teeth_verify ntt-teeth.saw
run_teeth_verify ntt-teeth-gamma.saw

say "== SAW PQ05 NTT: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (5) | EQUIVALENCE: PROVEN (8: Elem add, sub, mul; the NTT and its inverse composed from them; Barrett, base case, multiply_ntt) | TEETH: PASS (2)"
