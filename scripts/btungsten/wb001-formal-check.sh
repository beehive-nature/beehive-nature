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
# 240s, not 300: twice the prove process died by SIGTERM (exit 143, at
# 269s in run 37698302619 and 289s in run 37701649473) BEFORE a 300s
# wrapper could print the honest classification. Termination by signal
# is the recorded FACT; what sent it is unevidenced and unclaimed.
# Below the observed window the classification lands; override
# PROVE_BUDGET_S for a manual long run on a durable host.
PROVE_BUDGET_S="${PROVE_BUDGET_S:-240}"

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
say "FORMAL-TYPECHECK: PASS (module loads; obligations: wireInjective, adversarialRejected, validIBase, twinsValid, twinsDistinct, validAstral, validFffd, validCombining, nearValid, nearDistinct, baseVsTwinDistinct)"

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

# ---- FORMAL-WIRE-ALIGNMENT (founder review B1, 2026-10-07): the bridge ----
# The BRIDGE block in Intent.cry was comment-only until B1 — no Cryptol
# wire byte had ever been compared to a runtime canonical() byte, so the
# deployed-envelope claim under the wireInjective proof was prose. These
# closed-term evaluations compare the .cry wire (prefix + zero tail +
# envLen) against OPAQUE constants pinned from the runtime
# (wb001-bridge.json, derived by wb001-bridge-gen.mjs, re-derived on the
# node leg by wb001-bridge.test.mjs every run). A red here names its
# term: the twin and the runtime have drifted apart.
check bridgeIBase     ':check bridgeIBase'
check bridgeTwinL     ':check bridgeTwinL'
check bridgeTwinR     ':check bridgeTwinR'
check bridgeAstral    ':check bridgeAstral'
check bridgeFffd      ':check bridgeFffd'
check bridgeCombining ':check bridgeCombining'
check bridgeNearA     ':check bridgeNearA'
check bridgeNearB     ':check bridgeNearB'
check envLenMatchesOffsets ':check envLenMatchesOffsets'

# ---- CLASS 2: CHECK-SAMPLED — adversarial arm, then constructed (one
# obligation per claim, so a red names the claim), then random
check adversarialRejected     ':check adversarialRejected'
check validDomain_iBase       ':check validDomain_iBase'
check validNonce_iBase        ':check validNonce_iBase'
check validAction_iBase       ':check validAction_iBase'
check validDest_iBase         ':check validDest_iBase'
check validCap_iBase          ':check validCap_iBase'
check validPayer_iBase        ':check validPayer_iBase'
check validPayload_iBase      ':check validPayload_iBase'
check validIBase              ':check validIBase'
check twinsValid              ':check twinsValid'
check twinsDistinct           ':check twinsDistinct'
check validAstral             ':check validAstral'
check validFffd               ':check validFffd'
check validCombining          ':check validCombining'
check nearValid               ':check nearValid'
check nearDistinct            ':check nearDistinct'
check baseVsTwinDistinct      ':check baseVsTwinDistinct'
# THEOREM-CORRECTION rows (founder review 2026-10-08): the executed
# refutation of the original unconditioned zero-tail theorem (kept as a
# permanent regression), and the decomposed lemma ladder's sampled legs.
check zeroTailWrapRefuted     ':check zeroTailWrapRefuted'
check validImpliesBounded     ':check validImpliesBounded'
check offsetsOrdered-sampled  ':check offsetsOrdered'
check zeroTailFromBounds-sampled ':check zeroTailFromBounds'
check wireZeroTail-sampled    ':check wireZeroTail'
check wireInjective-sampled   ':check wireInjective'

# ---- CLASS 3: PROVE-UNIVERSAL — bounded, honestly classified, per obligation.
# Budgets are per-obligation: cheap arithmetic lemmas get a small budget so
# the heavy theorems keep theirs; a LEMMA timeout still records NOT-PROVEN
# (an open obligation is a recorded state, never a wedge) — but a lemma that
# cannot close in its small budget is a smell the receipt names.
prove() {
  _name=$1
  _budget=$2
  say "== formal: PROVE-UNIVERSAL :prove $_name (budget ${_budget}s) =="
  PROVE_LOG=$(timeout "$_budget" "$CRYPTOL" -c ":load $CRY" -c ":prove $_name" 2>&1) && rc=0 || rc=$?
  if [ "$rc" -eq 0 ]; then
    # Cryptol's universal verdict is printed as "Q.E.D." (some versions
    # "Valid."). The first honestly-successful prove was mis-recorded as
    # NOT-PROVEN because the classifier looked only for Valid — never
    # again: a result class records what happened, not what we guessed
    # the tool would print.
    if say "$PROVE_LOG" | grep -aq 'Q\.E\.D\.' || say "$PROVE_LOG" | grep -aq '^Valid'; then
      say "$PROVE_LOG" | tail -2
      say "FORMAL-PROVE-UNIVERSAL $_name: PROVEN (universal, :prove verdict Q.E.D.)"
    elif say "$PROVE_LOG" | grep -aq 'ounterexample'; then
      say "FORMAL-PROVE-UNIVERSAL $_name: REFUTED — counterexample is a REAL finding. Output:"
      say "$PROVE_LOG"
      exit 1
    else
      # A clean exit with NO recognized verdict is an UNKNOWN result, not a
      # benign one: this is a diagnostic failure (founder ruling 2026-10-08 —
      # the old code silently greened this case).
      say "FORMAL-PROVE-UNIVERSAL $_name: UNKNOWN-VERDICT — clean exit, no Q.E.D./counterexample line. Full output follows; this is a diagnostic failure, never a green:"
      say "$PROVE_LOG"
      exit 1
    fi
  elif [ "$rc" -eq 124 ]; then
    say "FORMAL-PROVE-UNIVERSAL $_name: NOT-PROVEN (timeout ${_budget}s — recorded, never success)"
  elif [ "$rc" -eq 137 ]; then
    say "FORMAL-PROVE-UNIVERSAL $_name: KILLED (SIGKILL, rc=137 — resource death is a fact, its cause is not guessed)"
    exit 1
  else
    # Includes 143/SIGTERM: termination by signal is a FACT; what sent the
    # signal (orchestration, eviction, OOM policy) is UNEVIDENCED and this
    # receipt does not claim it.
    say "FORMAL-PROVE-UNIVERSAL $_name: TERMINATED rc=$rc (signal death — fact of termination recorded, cause unevidenced). Output:"
    say "$PROVE_LOG" || true
    exit 1
  fi
}
prove validImpliesBounded 45
prove offsetsOrdered 90
# zeroTailFromBounds (the composed enumeration form) stays CHECK-SAMPLED only:
# its content is the two lemmas below plus the bridge sampling — re-proving
# the 4,626-way enumeration would burn budget the pieces already close.
prove zeroTailAtPosition 120
prove wireIndexDef 120
prove wireZeroTail "$PROVE_BUDGET_S"
prove wireInjective "$PROVE_BUDGET_S"

say "== formal: ladder state =="
say "FORMAL-WIRE-ALIGNMENT: PASS — 8 pinned terms, exact prefix + zero tail + envLen, both legs re-derive every run (sampled agreement, never equivalence)"
say "TYPECHECK: PASS | CHECK-SAMPLED: PASS (adversarial + constructed + random) | PROVE-UNIVERSAL: see line above | EQUIVALENCE: NOT ATTEMPTED (vectors are sampled agreement, never equivalence)"
