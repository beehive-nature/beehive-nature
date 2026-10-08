#!/bin/sh
# wb001-saw-check.sh — the SAW classes for Workbench 001. Classes, none
# standing in for another:
#
#   BUILD          the Rust model's core (crates/btungsten-wb001-core) compiles
#                  to MIR JSON (mir-json schema 13, the schema SAW 1.6 reads).
#   EQUIVALENCE    wb001-saw/rust.saw: the model's utf8_step, both UTF-8
#                  validators, all four padding checks, valid_intent, offsets,
#                  byte_at and encode, each proven equal to its Cryptol
#                  definition for every input in its domain. Every obligation
#                  must print its PROVEN line.
#   PROVE-UNIVERSAL wb001-saw/injective.saw: wireInjective for ALL valid
#                  intent pairs, through the first-difference ladder. Every
#                  rung must print its PROVEN line.
#   TEETH          rust-teeth.saw and injective-teeth.saw ask a deliberately
#                  wrong obligation each; both MUST fail with a solver
#                  counterexample. Passing, or failing any other way, is red.
#   SPEC-CHECK     wb001-cryptol/Ed25519.cry: the RFC 8032 Ed25519 spec on its
#                  closed terms (RFC §7.1 vectors, SHA-512("abc"), the
#                  OpenSSL-oracle envelope rows, the verifier's refusals).
#
# There is no NOT-PROVEN-green here: every obligation closes in minutes on a
# CI runner; one that does not is a finding.
#
# usage: wb001-saw-check.sh <saw> <saw-rustc> <cryptol>
set -eu

SAW="${1:?usage: wb001-saw-check.sh <saw> <saw-rustc> <cryptol>}"
SAW_RUSTC="${2:?usage: wb001-saw-check.sh <saw> <saw-rustc> <cryptol>}"
CRYPTOL="${3:?usage: wb001-saw-check.sh <saw> <saw-rustc> <cryptol>}"
ROOT=$(pwd)
CORE="$ROOT/crates/btungsten-wb001-core"
SAWDIR="$ROOT/scripts/btungsten/wb001-saw"
CRYDIR="$ROOT/scripts/btungsten/wb001-cryptol"
OUT="$ROOT/target/saw-wb001"
MIR="$OUT/btungsten_wb001_core.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW WB001: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1

# ---- BUILD -------------------------------------------------------------------
say "== SAW WB001: BUILD the model core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$CORE" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name btungsten_wb001_core --out-dir "$OUT" ) || {
  say "SAW-BUILD WB001: FAIL — the model core did not compile to MIR"
  exit 1
}
[ -s "$MIR" ] || { say "SAW-BUILD WB001: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
say "SAW-BUILD WB001: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# a required-lines runner: every name must print "WB001-SAW PROVEN <name>"
run_required() {
  _script=$1; shift
  say "== SAW WB001: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'WB001-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqF "WB001-SAW PROVEN $_ob"; then
      say "SAW $_script: '$_ob' NOT PROVEN (rc=$_rc). Full output:"
      say "$_log"
      exit 1
    fi
  done
  [ "$_rc" -eq 0 ] || { say "SAW $_script: saw exited rc=$_rc after every PROVEN line — red until explained"; exit 1; }
  say "SAW $_script: $# obligations PROVEN in $((_t1 - _t0))s"
}

# a teeth runner: must fail with a counterexample on the named obligation
run_teeth() {
  _script=$1
  say "== SAW WB001: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'WB001-SAW-TEETH|Subgoal failed|ounterexample|^Invalid: \[' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted; the PROVEN lines would be vacuous"
    exit 1
  fi
  # SAW prints a solver counterexample as "Invalid: [ <bindings> ]" (prove_print)
  # or under "Counterexample" (mir_verify); either is the required evidence
  if ! say "$_log" | grep -aq 'WB001-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- EQUIVALENCE ---------------------------------------------------------------
run_required rust.saw utf8_step well_formed_utf8_64 well_formed_utf8_128 \
  pad_ok_32 pad_ok_64 pad_ok_128 pad_ok_4096 valid_intent offsets byte_at encode
run_teeth rust-teeth.saw

# ---- PROVE-UNIVERSAL -------------------------------------------------------------
run_required injective.saw validImpliesBounded validImpliesPadded \
  "fd01 (domain)" "fd02 (nonce)" "fd03 (epoch)" "fd04 (action)" "fd05 (destination)" \
  "fd06 (capability)" "fd07 (amount)" "fd08 (expiry)" "fd09 (payer)" \
  "fd10len (payload length word)" "fdIdx (first-difference index)" \
  "fdInLen (difference inside the length)" "fd10at (payload byte at any differing index)" "fd10 (payload)" \
  casesCover recordExt firstDifference wireIndexDef wireInjective
run_teeth injective-teeth.saw

# ---- SPEC-CHECK: Ed25519 ----------------------------------------------------------
say "== SPEC-CHECK WB001: Ed25519.cry (RFC 8032) closed terms =="
for prop in sha512Abc rfcTest1 rfcTest2 rfcTest3 rfcTestAbc oracleEnvBase oracleEnvNested verifyRefusesFlips; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load Ed25519.cry" -c ":check $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if say "$_out" | grep -aq 'ounterexample' || ! say "$_out" | grep -aq 'Passed'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

say "== SAW WB001: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (11 obligations, Rust model == Cryptol spec) | PROVE-UNIVERSAL: wireInjective PROVEN (21 rungs) | TEETH: PASS (2) | SPEC-CHECK: Ed25519 RFC 8032 PASS (8)"
