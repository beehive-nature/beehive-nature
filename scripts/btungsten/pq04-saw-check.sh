#!/bin/sh
# pq04-saw-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ04: the SPEC-BPQ-1 byte layouts
# bsigner runs through crates/bpq-core/src/layout.rs. Classes, none standing
# in for another:
#
#   BUILD           crates/bpq-core compiles to MIR JSON (mir-json schema 13,
#                   the schema SAW 1.6 reads).
#   EQUIVALENCE     pq04-saw/layout.saw: domain_byte, domain_len, nonce, seg_ok,
#                   segment_count, body_len (Some and None), segment_plain_len,
#                   utc_timestamp and claim_kind, each proven equal to its
#                   Cryptol definition (pq04-cryptol/BpqLayout.cry) for every
#                   input in its domain.
#   PROVE-UNIVERSAL pq04-saw/properties.saw: domainsDisjoint, nonceInjective,
#                   bodyExact, segmentsTile (over the integers) and
#                   segmentsBridge (the bitvector definitions compute those
#                   integers), atNoNewline, kindNoSeparator and the bounded
#                   bindInjective on the spec, which EQUIVALENCE ties to the Rust.
#   TEETH           layout-teeth.saw asks utc_timestamp to take a lowercase z;
#                   properties-teeth.saw loosens one rule per row (a prefix
#                   domain, a wrapping BODY check, an empty last segment, the at
#                   validator dropped, '=' in a kind, and the at, kind and
#                   value rules each loosened inside bindInjective). Every one
#                   MUST be refuted with a counterexample. The binding
#                   preimage is a model of bsigner verify_bind, not proven
#                   equal to Rust code.
#
# usage: pq04-saw-check.sh <saw> <saw-rustc>
set -eu

SAW="${1:?usage: pq04-saw-check.sh <saw> <saw-rustc>}"
SAW_RUSTC="${2:?usage: pq04-saw-check.sh <saw> <saw-rustc>}"
ROOT=$(pwd)
CORE="$ROOT/crates/bpq-core"
SAWDIR="$ROOT/scripts/btungsten/pq04-saw"
OUT="$ROOT/target/saw-pq04"
MIR="$OUT/bpq_core.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ04: toolchain =="
"$SAW" --version | head -1

# ---- BUILD -------------------------------------------------------------------
say "== SAW PQ04: BUILD bpq-core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$CORE" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name bpq_core --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ04: FAIL — bpq-core did not compile to MIR"
  exit 1
}
[ -s "$MIR" ] || { say "SAW-BUILD PQ04: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
say "SAW-BUILD PQ04: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# every name must print "PQ04-SAW PROVEN <name>", and saw must exit 0
run_required() {
  _script=$1; shift
  say "== SAW PQ04: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ04-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqF "PQ04-SAW PROVEN $_ob"; then
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
  say "== SAW PQ04: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ04-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ04-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# a prove tooth script: every named row must print REFUTED, none UNEXPECTED-PROVEN
run_teeth_prove() {
  _script=$1; shift
  say "== SAW PQ04: TEETH $_script — every row must be REFUTED =="
  _log=$(cd "$SAWDIR" && "$SAW" "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ04-SAW-TEETH' || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN'; then
    say "SAW-TEETH $_script: FAIL — a weakened obligation was proven"
    exit 1
  fi
  for _row in "$@"; do
    if ! say "$_log" | grep -aqF "PQ04-SAW-TEETH REFUTED $_row"; then
      say "SAW-TEETH $_script: '$_row' not refuted (rc=$_rc). Full output:"
      say "$_log"
      exit 1
    fi
  done
  [ "$_rc" -eq 0 ] || { say "SAW-TEETH $_script: saw exited rc=$_rc — red until explained"; exit 1; }
  say "SAW-TEETH $_script: PASS ($# rows refuted with counterexamples)"
}

# ---- EQUIVALENCE ---------------------------------------------------------------
run_required layout.saw domain_byte domain_len nonce seg_ok segment_count body_len_some \
  body_len_none segment_plain_len utc_timestamp claim_kind
run_teeth_verify layout-teeth.saw

# ---- PROVE-UNIVERSAL -------------------------------------------------------------
run_required properties.saw domainsDisjoint nonceInjective bodyExact segmentsTile segmentsBridge \
  atNoNewline kindNoSeparator bindInjective
run_teeth_prove properties-teeth.saw prefixDomain wrappingBody lastEmptyWhole atAnyText \
  kindWithEquals bindAtAnyText bindKindEquals bindValueLines

say "== SAW PQ04: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (10, bpq-core layout == BpqLayout.cry) | PROVE-UNIVERSAL: PROVEN (8, incl. segmentsTile, bounded bindInjective) | TEETH: PASS (9)"
