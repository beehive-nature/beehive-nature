#!/bin/sh
# pq03-saw-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ03: the bzDiD derivation info
# string. Classes, none standing in for another:
#
#   BUILD           crates/bpq-core compiles to MIR JSON (mir-json schema 13,
#                   the schema SAW 1.6 reads).
#   EQUIVALENCE     pq03-saw/derive.saw: context_ok, args_ok, info_len,
#                   info_byte and info, each proven equal to its Cryptol
#                   definition (pq03-cryptol/BpqDerive.cry) for every input in
#                   its domain.
#   PROVE-UNIVERSAL pq03-saw/injective.saw: labelsPrefixFree, infoFits,
#                   infoPadded, rootIsolated and deriveInjective (two different
#                   admitted (label, context, counter) triples never share an
#                   info string) on the spec, which EQUIVALENCE ties to the Rust.
#   TEETH           derive-teeth.saw asks context_ok to admit DEL;
#                   injective-teeth.saw asks deriveInjective with a prefix
#                   label, with control bytes admitted, and with the counter cap
#                   raised. Every one MUST be refuted with a counterexample.
#
# usage: pq03-saw-check.sh <saw> <saw-rustc>
set -eu

SAW="${1:?usage: pq03-saw-check.sh <saw> <saw-rustc>}"
SAW_RUSTC="${2:?usage: pq03-saw-check.sh <saw> <saw-rustc>}"
ROOT=$(pwd)
CORE="$ROOT/crates/bpq-core"
SAWDIR="$ROOT/scripts/btungsten/pq03-saw"
OUT="$ROOT/target/saw-pq03"
MIR="$OUT/bpq_core.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ03: toolchain =="
"$SAW" --version | head -1

# ---- BUILD -------------------------------------------------------------------
say "== SAW PQ03: BUILD bpq-core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$CORE" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name bpq_core --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ03: FAIL — bpq-core did not compile to MIR"
  exit 1
}
[ -s "$MIR" ] || { say "SAW-BUILD PQ03: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
say "SAW-BUILD PQ03: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# every name must print "PQ03-SAW PROVEN <name>", and saw must exit 0
run_required() {
  _script=$1; shift
  say "== SAW PQ03: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
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

# a mir_verify tooth: saw must fail, with a counterexample, on the named obligation
run_teeth_verify() {
  _script=$1
  say "== SAW PQ03: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
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

# a prove tooth script: every named row must print REFUTED, none UNEXPECTED-PROVEN
run_teeth_prove() {
  _script=$1; shift
  say "== SAW PQ03: TEETH $_script — every row must be REFUTED =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ03-SAW-TEETH' || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN'; then
    say "SAW-TEETH $_script: FAIL — a weakened obligation was proven"
    exit 1
  fi
  for _row in "$@"; do
    if ! say "$_log" | grep -aqF "PQ03-SAW-TEETH REFUTED $_row"; then
      say "SAW-TEETH $_script: '$_row' not refuted (rc=$_rc). Full output:"
      say "$_log"
      exit 1
    fi
  done
  [ "$_rc" -eq 0 ] || { say "SAW-TEETH $_script: saw exited rc=$_rc — red until explained"; exit 1; }
  say "SAW-TEETH $_script: PASS ($# rows refuted with counterexamples)"
}

# ---- EQUIVALENCE ---------------------------------------------------------------
run_required derive.saw context_ok args_ok info_len info_byte info
run_teeth_verify derive-teeth.saw

# ---- PROVE-UNIVERSAL -------------------------------------------------------------
run_required injective.saw labelsPrefixFree infoFits infoPadded rootIsolated deriveInjective
run_teeth_prove injective-teeth.saw prefixLabel looseRule counterCap

say "== SAW PQ03: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (5, bpq-core == BpqDerive.cry) | PROVE-UNIVERSAL: PROVEN (5, incl. deriveInjective) | TEETH: PASS (4)"
