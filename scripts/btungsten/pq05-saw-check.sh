#!/bin/sh
# pq05-saw-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ05: the X-Wing glue bsigner runs
# (crates/bpq-core/src/xwing.rs). Classes, none standing in for another:
#
#   BUILD           crates/bpq-core compiles to MIR JSON.
#   EQUIVALENCE     pq05-saw/xwing.saw: combiner_input and split_seed equal
#                   to pq05-cryptol/XWing.cry (written from draft -11) for
#                   every input.
#   PROVE-UNIVERSAL combinerBinds: the 134 hashed bytes determine
#                   (ss_M, ss_X, ct_X, pk_X).
#   TEETH           a combiner without pk_X MUST be refuted.
#
# The ML-KEM and X25519 primitives themselves are KAT (PQ01 ACVP, PQ11
# Wycheproof) and the whole construction is checked on the draft's vectors
# in CI job pq05-xwing.
#
# usage: pq05-saw-check.sh <saw> <saw-rustc>
set -eu

SAW="${1:?usage: pq05-saw-check.sh <saw> <saw-rustc>}"
SAW_RUSTC="${2:?usage: pq05-saw-check.sh <saw> <saw-rustc>}"
ROOT=$(pwd)
OUT="$ROOT/target/saw-pq05"
MIR="$OUT/bpq_core.linked-mir.json"

say() { printf '%s\n' "$*"; }

say "== SAW PQ05: BUILD bpq-core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$ROOT/crates/bpq-core" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name bpq_core --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ05: FAIL"; exit 1; }
[ -s "$MIR" ] || { say "SAW-BUILD PQ05: FAIL — no $MIR"; exit 1; }
say "SAW-BUILD PQ05: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

say "== SAW PQ05: xwing.saw =="
log=$(cd "$ROOT/scripts/btungsten/pq05-saw" && "$SAW" xwing.saw 2>&1) && rc=0 || rc=$?
say "$log" | grep -a -E 'PQ05-SAW|Subgoal failed|rror' || true
for ob in combiner_input split_seed combinerBinds; do
  say "$log" | grep -aqx "PQ05-SAW PROVEN $ob" || { say "SAW xwing.saw: '$ob' NOT PROVEN (rc=$rc). Full output:"; say "$log"; exit 1; }
done
if say "$log" | grep -aq 'UNEXPECTED-PROVEN' || ! say "$log" | grep -aqx 'PQ05-SAW-TEETH REFUTED combinerWithoutPk'; then
  say "SAW-TEETH xwing.saw: FAIL — the combiner without pk_X was not refuted. Full output:"; say "$log"; exit 1
fi
[ "$rc" -eq 0 ] || { say "SAW xwing.saw: saw exited rc=$rc — red until explained"; exit 1; }

say "== SAW PQ05: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (2, bpq-core xwing == XWing.cry) | PROVE-UNIVERSAL: PROVEN (combinerBinds) | TEETH: PASS (1)"
