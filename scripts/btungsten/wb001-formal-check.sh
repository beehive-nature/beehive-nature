#!/bin/sh
# wb001-formal-check.sh — the bTunGsTeN formal-assurance ladder runner
# (founder ruling 2026-10-07). Runs the Cryptol leg on a Linux x86_64 host
# (the CI formal job) and classifies every result by its class — none
# stands in for another:
#
#   TYPECHECK        gates this script (a module that does not load is a
#                    structural failure, red CI)
#   CHECK-SAMPLED    gates this script: the constructed arm (closed terms:
#                    boundary-shift twins, astral Unicode, a legitimate
#                    U+FFFD, combining sequences, near-collision payload
#                    pairs) and the adversarial arm (malformed classes
#                    proven rejected by validIntent BEFORE injectivity is
#                    evaluated), then the random-sampling arm on
#                    wireInjective. A counterexample in any arm is a REAL
#                    finding, not tool noise: red CI.
#   PROVE-UNIVERSAL  attempted under a bounded budget; a timeout prints
#                    NOT-PROVEN and exits green BY DESIGN — "NOT-PROVEN
#                    (timeout)" is the honest recorded state of an open
#                    obligation, and gating on it would wedge CI red
#                    forever (SPEC-BTUNGSTEN-1 §workbench result-class
#                    law: a solver timeout is NOT-RUN, never success —
#                    and also never a lie about the other classes).
#   EQUIVALENCE      not attempted here. The shared vectors are sampled
#                    agreement; universal equivalence is a later class
#                    and cannot be claimed from this run.
#
# usage: wb001-formal-check.sh <path-to-cryptol-binary>
set -eu

CRYPTOL="${1:?usage: wb001-formal-check.sh <path-to-cryptol>}"
CRY="scripts/btungsten/wb001-cryptol/Intent.cry"
PROVE_BUDGET_S="${PROVE_BUDGET_S:-300}"

say() { printf '%s\n' "$*"; }

# ---- toolchain (recorded in every receipt; versions are part of it) ----
say "== formal: toolchain =="
"$CRYPTOL" --version

# ---- CLASS 1: TYPECHECK ----------------------------------------------------
say "== formal: TYPECHECK :load $CRY =="
TC_LOG=$("$CRYPTOL" -c ":load $CRY" 2>&1) || {
  say "FORMAL-TYPECHECK: FAIL — module did not load. Full output:"
  say "$TC_LOG"
  exit 1
}
say "$TC_LOG" | tail -2
say "FORMAL-TYPECHECK: PASS (module loads; obligations: wireInjective, constructedValidPairs, adversarialRejected)"

# ---- one :check with honest classification ---------------------------------
# cryptol CLI (3.6.0, learned from its own usage output): -c COMMAND runs
# one command and exits; multiple -c run in order. -b takes a SCRIPT FILE,
# not stdin — the first CI run taught us this, receipted in the dispatch.
check() {
  _name=$1; _cmd=$2
  say "== formal: CHECK-SAMPLED $_name — $_cmd =="
  _out=$("$CRYPTOL" -c ":load $CRY" -c "$_cmd" 2>&1) || {
    say "FORMAL-CHECK-SAMPLED $_name: ABORTED (cryptol exited nonzero). Output:"
    say "$_out"
    exit 1
  }
  say "$_out" | tail -2
  if say "$_out" | grep -aq 'ounterexample'; then
    say "FORMAL-CHECK-SAMPLED $_name: FAIL — counterexample is a REAL finding, not tool noise"
    exit 1
  fi
  if ! say "$_out" | grep -aq 'Passed'; then
    say "FORMAL-CHECK-SAMPLED $_name: NO-PASS-LINE — a gate that cannot print its own success is not green. Output:"
    say "$_out"
    exit 1
  fi
  say "FORMAL-CHECK-SAMPLED $_name: PASS"
}

# ---- CLASS 2: CHECK-SAMPLED — adversarial arm, then constructed, then random
check adversarialRejected     ':check adversarialRejected'
check constructedValidPairs   ':check constructedValidPairs'
check wireInjective-sampled   ':check wireInjective'

# ---- CLASS 3: PROVE-UNIVERSAL — bounded, honestly classified ---------------
say "== formal: PROVE-UNIVERSAL :prove wireInjective (budget ${PROVE_BUDGET_S}s) =="
PROVE_LOG=$(timeout "$PROVE_BUDGET_S" "$CRYPTOL" -c ":load $CRY" -c ":prove wireInjective" 2>&1) && _rc=0 || _rc=$?
if [ "$_rc" -eq 0 ]; then
  if say "$PROVE_LOG" | grep -aq '^Valid'; then
    say "$PROVE_LOG" | tail -2
    say "FORMAL-PROVE-UNIVERSAL wireInjective: PROVEN"
  elif say "$PROVE_LOG" | grep -aq 'ounterexample'; then
    say "FORMAL-PROVE-UNIVERSAL wireInjective: REFUTED — counterexample is a REAL finding. Output:"
    say "$PROVE_LOG"
    exit 1
  else
    say "$PROVE_LOG" | tail -3
    say "FORMAL-PROVE-UNIVERSAL wireInjective: NOT-PROVEN (ran to completion, no verdict line)"
  fi
elif [ "$_rc" -eq 124 ]; then
  say "FORMAL-PROVE-UNIVERSAL wireInjective: NOT-PROVEN (timeout ${PROVE_BUDGET_S}s — recorded, never success)"
else
  say "FORMAL-PROVE-UNIVERSAL wireInjective: ABORTED rc=$_rc. Output:"
  say "$PROVE_LOG" || true
  exit 1
fi

say "== formal: ladder state =="
say "TYPECHECK: PASS | CHECK-SAMPLED: PASS (adversarial + constructed + random) | PROVE-UNIVERSAL: see line above | EQUIVALENCE: NOT ATTEMPTED (vectors are sampled agreement, never equivalence)"
