#!/bin/sh
# wb002-formal-check.sh — the bTunGsTeN formal-assurance ladder runner for
# Workbench 002 (sovereign continuity across the SimpleAssets-2021 state
# machine; README §WB002 §next 2). Same result classes as
# wb001-formal-check.sh, none standing in for another:
#
#   TYPECHECK        gates this script (a module that does not load is a
#                    structural failure, red CI)
#   CHECK-SAMPLED    gates this script: random sampling of
#                    sovereignContinuity, plus the constructed F-1 row
#                    (f1Convicted). A counterexample is a REAL finding.
#   PROVE-UNIVERSAL  sovereignContinuity for ALL states and actions under a
#                    bounded budget; a timeout prints NOT-PROVEN and exits
#                    green BY DESIGN (result-class law), a counterexample is
#                    red.
#   TEETH            the solver must REFUTE the same continuity words on the
#                    specimen machine (step + the F-1 issuer head). Q.E.D.
#                    there means the property lost its teeth: red.
#   EQUIVALENCE      not attempted here: SAW proves the model core equal to
#                    this spec in wb002-saw-check.sh. The SAW plan
#                    (wb002-saw/sovereign.saw) is that class and cannot
#                    be claimed from this run.
#
# cryptol 3.6.0 exits nonzero when a :prove finds a counterexample, so the
# exit code alone cannot tell REFUTED from ABORTED — every leg classifies on
# the verdict line first.
#
# usage: wb002-formal-check.sh <path-to-cryptol-binary>
set -eu

CRYPTOL="${1:?usage: wb002-formal-check.sh <path-to-cryptol>}"
CRY="scripts/btungsten/wb002-cryptol/BTungstenWB002.cry"
export CRYPTOLPATH="scripts/btungsten/wb002-cryptol"
PROVE_BUDGET_S="${PROVE_BUDGET_S:-120}"

say() { printf '%s\n' "$*"; }

say "== formal WB002: toolchain =="
"$CRYPTOL" --version

# ---- CLASS 1: TYPECHECK ----------------------------------------------------
say "== formal WB002: TYPECHECK :load $CRY =="
TC_LOG=$("$CRYPTOL" -c ":load $CRY" 2>&1) || {
  say "FORMAL-TYPECHECK WB002: FAIL — module did not load. Full output:"
  say "$TC_LOG"
  exit 1
}
say "$TC_LOG" | tail -1
say "FORMAL-TYPECHECK WB002: PASS (module loads; obligations: sovereignContinuity, f1Convicted)"

# ---- CLASS 2: CHECK-SAMPLED ------------------------------------------------
check() {
  _name=$1; _cmd=$2
  say "== formal WB002: CHECK-SAMPLED $_name — $_cmd =="
  _out=$("$CRYPTOL" -c ":load $CRY" -c "$_cmd" 2>&1) && _rc=0 || _rc=$?
  say "$_out" | tail -2
  if say "$_out" | grep -aq 'ounterexample'; then
    say "FORMAL-CHECK-SAMPLED $_name: FAIL — counterexample is a REAL finding, not tool noise"
    exit 1
  fi
  if [ "$_rc" -ne 0 ]; then
    say "FORMAL-CHECK-SAMPLED $_name: ABORTED rc=$_rc. Output:"
    say "$_out"
    exit 1
  fi
  if ! say "$_out" | grep -aq 'Passed'; then
    say "FORMAL-CHECK-SAMPLED $_name: NO-PASS-LINE — a gate that cannot print its own success is not green. Output:"
    say "$_out"
    exit 1
  fi
  say "FORMAL-CHECK-SAMPLED $_name: PASS"
}
check sovereignContinuity-sampled ':check sovereignContinuity'
check f1Convicted                 ':check f1Convicted'

# ---- one :prove, run once, verdict line classified --------------------------
# sets PROVE_LOG and PROVE_VERDICT (QED | REFUTED | TIMEOUT | NOVERDICT | ABORTED)
run_prove() {
  PROVE_LOG=$(timeout "$PROVE_BUDGET_S" "$CRYPTOL" -c ":load $CRY" -c ":prove $1" 2>&1) && _rc=0 || _rc=$?
  if [ "$_rc" -eq 124 ]; then PROVE_VERDICT=TIMEOUT
  elif say "$PROVE_LOG" | grep -aq 'Q\.E\.D\.'; then PROVE_VERDICT=QED
  elif say "$PROVE_LOG" | grep -aq '^Counterexample'; then PROVE_VERDICT=REFUTED
  elif [ "$_rc" -eq 0 ]; then PROVE_VERDICT=NOVERDICT
  else PROVE_VERDICT=ABORTED
  fi
}

# ---- CLASS 3: PROVE-UNIVERSAL ----------------------------------------------
say "== formal WB002: PROVE-UNIVERSAL :prove sovereignContinuity (budget ${PROVE_BUDGET_S}s) =="
run_prove sovereignContinuity
say "$PROVE_LOG" | tail -6
case $PROVE_VERDICT in
  QED)       say "FORMAL-PROVE-UNIVERSAL sovereignContinuity: PROVEN (universal, :prove verdict Q.E.D.)" ;;
  REFUTED)   say "FORMAL-PROVE-UNIVERSAL sovereignContinuity: REFUTED — counterexample is a REAL finding"; exit 1 ;;
  TIMEOUT)   say "FORMAL-PROVE-UNIVERSAL sovereignContinuity: NOT-PROVEN (timeout ${PROVE_BUDGET_S}s — recorded, never success)" ;;
  NOVERDICT) say "FORMAL-PROVE-UNIVERSAL sovereignContinuity: NOT-PROVEN (ran to completion, no verdict line)" ;;
  *)         say "FORMAL-PROVE-UNIVERSAL sovereignContinuity: ABORTED. Output:"; say "$PROVE_LOG"; exit 1 ;;
esac

# ---- TEETH: the specimen machine must be REFUTED by the same words ----------
say "== formal WB002: TEETH :prove continuityOf stepSpecimen — must be REFUTED =="
run_prove 'continuityOf stepSpecimen'
say "$PROVE_LOG" | tail -6
case $PROVE_VERDICT in
  REFUTED) say "FORMAL-TEETH WB002: PASS (the solver convicts the F-1 issuer seam)" ;;
  QED)     say "FORMAL-TEETH WB002: FAIL — the continuity words cannot see the F-1 seam; a PROVEN verdict above would be vacuous"; exit 1 ;;
  *)       say "FORMAL-TEETH WB002: FAIL — no refutation ($PROVE_VERDICT); teeth unproven. Output:"; say "$PROVE_LOG"; exit 1 ;;
esac

say "== formal WB002: ladder state =="
say "TYPECHECK: PASS | CHECK-SAMPLED: PASS (random + constructed F-1 row) | PROVE-UNIVERSAL: see line above | TEETH: PASS | EQUIVALENCE: separate class, wb002-saw-check.sh (SAW, wb002-saw.yml)"
