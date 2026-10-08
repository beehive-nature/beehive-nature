#!/bin/sh
# wb002-saw-check.sh — the EQUIVALENCE class for Workbench 002: the model core
# (crates/btungsten-wb002-core/src/lib.rs) against the Cryptol spec
# (wb002-cryptol/BTungstenWB002.cry), proven by SAW over MIR. Classes, none
# standing in for another:
#
#   BUILD        the core compiles to MIR JSON (mir-json, schema 13 — the
#                schema SAW 1.6 reads). A failed build is red.
#   EQUIVALENCE  wb002-saw/sovereign.saw: three mir_verify obligations
#                (step on the well-formed domain, step's refusal of the
#                rest, sovereign on the whole Cryptol domain). Every one
#                must print its PROVEN line; anything else is red. There is
#                no NOT-PROVEN-green here: these goals are small, and an
#                equivalence that does not close is a finding.
#   TEETH        wb002-saw/sovereign-teeth.saw asks the same obligation of
#                the specimen machine (step + the F-1 issuer head). It MUST
#                fail with a solver counterexample; passing, or failing for
#                any other reason (a typo, a load error), is red.
#
# usage: wb002-saw-check.sh <path-to-saw> <saw-rustc command>
#   the second argument is one executable: saw-rustc itself, or a wrapper
#   that runs it (CI runs it from the pinned mir-json image).
set -eu

SAW="${1:?usage: wb002-saw-check.sh <saw> <saw-rustc>}"
SAW_RUSTC="${2:?usage: wb002-saw-check.sh <saw> <saw-rustc>}"
ROOT=$(pwd)
CORE="$ROOT/crates/btungsten-wb002-core"
SAWDIR="$ROOT/scripts/btungsten/wb002-saw"
OUT="$ROOT/target/saw-wb002"
MIR="$OUT/btungsten_wb002_core.linked-mir.json"

say() { printf '%s\n' "$*"; }

say "== SAW WB002: toolchain =="
"$SAW" --version | head -1

# ---- BUILD -------------------------------------------------------------------
say "== SAW WB002: BUILD the model core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$CORE" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name btungsten_wb002_core --out-dir "$OUT" ) || {
  say "SAW-BUILD WB002: FAIL — the model core did not compile to MIR"
  exit 1
}
if [ ! -s "$MIR" ]; then
  say "SAW-BUILD WB002: FAIL — no $MIR after the build. $OUT holds:"
  ls -la "$OUT"
  exit 1
fi
say "SAW-BUILD WB002: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

# ---- EQUIVALENCE ---------------------------------------------------------------
say "== SAW WB002: EQUIVALENCE sovereign.saw =="
EQ_LOG=$(cd "$SAWDIR" && "$SAW" sovereign.saw 2>&1) && EQ_RC=0 || EQ_RC=$?
say "$EQ_LOG" | grep -a -E 'WB002-SAW|Proof succeeded|Subgoal failed|rror' || true
for ob in step_matches_spec step_refuses_rest sovereign_matches; do
  if ! say "$EQ_LOG" | grep -aq "^WB002-SAW PROVEN $ob\$"; then
    say "SAW-EQUIVALENCE $ob: NOT PROVEN (rc=$EQ_RC) — a real finding or a broken script; full output:"
    say "$EQ_LOG"
    exit 1
  fi
  say "SAW-EQUIVALENCE $ob: PROVEN (mir_verify, z3)"
done
[ "$EQ_RC" -eq 0 ] || { say "SAW-EQUIVALENCE: saw exited rc=$EQ_RC after printing every PROVEN line — red until explained"; exit 1; }

# ---- TEETH ---------------------------------------------------------------------
say "== SAW WB002: TEETH sovereign-teeth.saw — must FAIL with a counterexample =="
TE_LOG=$(cd "$SAWDIR" && "$SAW" sovereign-teeth.saw 2>&1) && TE_RC=0 || TE_RC=$?
say "$TE_LOG" | grep -a -E 'WB002-SAW-TEETH|Subgoal failed|ounterexample' | head -20 || true
if say "$TE_LOG" | grep -aq 'UNEXPECTED-PROVEN' || [ "$TE_RC" -eq 0 ]; then
  say "SAW-TEETH WB002: FAIL — the equivalence obligation accepted the specimen machine; the PROVEN lines above would be vacuous"
  exit 1
fi
if ! say "$TE_LOG" | grep -aq 'WB002-SAW-TEETH obligation' || ! say "$TE_LOG" | grep -aqi 'counterexample'; then
  say "SAW-TEETH WB002: FAIL — saw failed, but not with a solver counterexample on the obligation (load or script error?). Full output:"
  say "$TE_LOG"
  exit 1
fi
say "SAW-TEETH WB002: PASS (the solver separates the model core from the F-1 specimen machine)"

say "== SAW WB002: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (step on well-formed, step refuses the rest, sovereign on all of [3]) | TEETH: PASS | scope: model core == Cryptol spec (the model links this core); NOT the 2021 wasm"
