#!/bin/sh
# pq06-ntt-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ06: ML-DSA's NTT as ml-dsa 0.1.1
# implements it. Classes, none standing in for another:
#
#   PIN          every package in pq06-ntt/Cargo.lock is in the workspace
#                Cargo.lock with the same version and checksum (so the
#                harness builds the workspace's ml-dsa 0.1.1 and module-lattice
#                0.2.3, cargo checking each .crate against that checksum).
#   BUILD        pq06-ntt compiles to MIR JSON through cargo-saw-build;
#                pq06-ntt-names.py finds ml-dsa's NTT, its eight inverse
#                layers, the closing Elem-times-Polynomial product and the
#                Elem operators by name and signature.
#   SPEC-CHECK   pq06-cryptol/DsaNtt.cry on its closed terms: the computed
#                twiddle table against FIPS 204 Appendix B, 256 * 8347681 = 1,
#                NTT^-1 undoing NTT on a fixed polynomial, and
#                NTT^-1(NTT f ∘ NTT g) equal to the schoolbook negacyclic
#                product on a fixed pair.
#   EQUIVALENCE  pq06-saw/ntt.saw: ml-dsa's Elem add, sub and neg equal
#                Field.cry (mul assumed equal, tied by the field lane's three
#                links, and reported as ASSUMED); then its NTT equals FIPS 204
#                Algorithm 41 for every polynomial with coefficients in the
#                field; then each inverse layer, the product by 256^-1, and
#                its inverse NTT equal to Algorithm 42, each proof standing in
#                for the next; and multiply_ntt equal to Algorithm 45.
#   TEETH        ntt-teeth.saw (one twiddle factor bent) and
#                ntt-teeth-sign.saw (the inverse twiddle's sign dropped)
#                MUST fail with a counterexample.
#
# usage: pq06-ntt-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq06-ntt-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq06-ntt-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq06-saw"
CRYDIR="$ROOT/scripts/btungsten/pq06-cryptol"
FIELDDIR="$ROOT/scripts/btungsten/pq05-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq06-ntt"
OUT="$ROOT/target/saw-pq06-ntt"
MIR="$OUT/pq06_ntt.linked-mir.json"
# DsaNtt.cry imports Field, which lives beside the ML-KEM spec: both Cryptol
# and SAW resolve it through CRYPTOLPATH
CRYPTOLPATH="$FIELDDIR"
export CRYPTOLPATH

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ06 NTT: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1
rm -rf "$OUT" && mkdir -p "$OUT"

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ06 NTT: PIN the harness lock to the workspace lock =="
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
[ -z "$_extra" ] || { say "SAW-PIN PQ06: FAIL — harness packages not in the workspace lock as such:"; say "$_extra"; exit 1; }
grep -q '^ml-dsa 0.1.1 ' "$OUT/harness.lock.txt" && grep -q '^module-lattice 0.2.3 ' "$OUT/harness.lock.txt" ||
  { say "SAW-PIN PQ06: FAIL — the harness does not lock ml-dsa 0.1.1 and module-lattice 0.2.3"; exit 1; }
say "SAW-PIN PQ06: PASS ($(wc -l < "$OUT/harness.lock.txt") packages, each the workspace's version and checksum)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ06 NTT: BUILD the harness to MIR JSON (cargo-saw-build) =="
_lock0=$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ06: FAIL — harness"; exit 1; }
# cargo-saw-build takes no --locked: the lock must come out as it went in
[ "$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)" = "$_lock0" ] ||
  { say "SAW-BUILD PQ06: FAIL — the build changed pq06-ntt/Cargo.lock"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq06_ntt-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ06: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
python3 "$ROOT/scripts/btungsten/pq06-ntt-names.py" "$MIR" > "$OUT/names.saw" || { say "SAW-BUILD PQ06: FAIL — names"; exit 1; }
say "SAW-BUILD PQ06: PASS ($(wc -c < "$MIR") bytes of linked MIR; names:)"
sed 's/^/  /' "$OUT/names.saw"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ06: DsaNtt.cry closed terms =="
for prop in zetasMatchAppendixB inverseOf256 inverseUndoesForward nttMultipliesPolynomials; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load DsaNtt.cry" -c ":prove $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ06 NTT: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ06-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqxF "PQ06-SAW PROVEN $_ob"; then
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
  say "== SAW PQ06 NTT: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M13g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ06-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ06-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required ntt.saw "ml-dsa Elem add" "ml-dsa Elem sub" "ml-dsa Elem neg" "ml-dsa ntt (FIPS 204 Algorithm 41)" \
  "ml-dsa inverse layer len 1" "ml-dsa inverse layer len 2" "ml-dsa inverse layer len 4" "ml-dsa inverse layer len 8" \
  "ml-dsa inverse layer len 16" "ml-dsa inverse layer len 32" "ml-dsa inverse layer len 64" "ml-dsa inverse layer len 128" \
  "ml-dsa Elem * Polynomial" "ml-dsa ntt_inverse (FIPS 204 Algorithm 42)" "ml-dsa multiply_ntt (FIPS 204 Algorithm 45)"
say "$_log" | grep -aqxF "PQ06-SAW ASSUMED ml-dsa Elem mul (tied by the field lane's three links)" ||
  { say "SAW ntt.saw: the mul assumption is not reported as such"; exit 1; }
run_teeth_verify ntt-teeth.saw
run_teeth_verify ntt-teeth-sign.saw

say "== SAW PQ06 NTT: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (4) | EQUIVALENCE: PROVEN (15: Elem add, sub, neg; the NTT; eight inverse layers, the product by 256^-1 and the inverse NTT composed from them; multiply_ntt) with Elem mul ASSUMED (the field lane's three links) | TEETH: PASS (2)"
