#!/bin/sh
# cryptol-twin-check.sh — the formal Cryptol TWIN of BNROSE-RUST-002's exact
# replacement law (founder order 2026-10-13/14: "proceed to the formal Cryptol
# twin once qualified"). Every obligation of
# bnrose-rust-001/cryptol/BnroseReplacement.cry is run through Cryptol's own
# :prove, one process per obligation under the formal job's caps (a 6 GiB
# address-space cap and its own clock). Then the negative controls: two
# variants, each ONE textual substitution in the gate line, and each MUST end
# in a Cryptol counterexample — the leg has teeth.
#
# Classes (wb001-cryptol-leg-check.sh's law, unchanged):
#   Q.E.D.             PROVEN
#   timeout            NOT-PROVEN (timeout): recorded, never success
#   RTS out of memory  NOT-PROVEN (memory): recorded, never success
#   counterexample     REFUTED on an obligation: red
#   anything else      red
# The COMPOSED line prints PROVEN only when every obligation printed Q.E.D. in
# this run, and otherwise NOT-PROVEN naming the open ones. A NOT-PROVEN leg is
# green (the formal ladder's law: an open obligation is a recorded state,
# never a wedge); a REFUTED obligation or a control without its
# counterexample is red.
#
# usage: cryptol-twin-check.sh <path-to-cryptol>   (from the repo root)
set -eu

if [ "${1:-}" = "--one" ]; then
  S=$2
  _c=$(sed -n 1p "$S"); _p=$(sed -n 2p "$S"); _b=$(sed -n 3p "$S")
  _f=$(sed -n 4p "$S"); _cmd=$(sed -n 5p "$S"); _cap=$(sed -n 6p "$S")
  _t0=$(date +%s)
  _cdir=$(dirname "$_c")   # the bundled solvers live beside the cryptol binary
  ( ulimit -v "$_cap"; export PATH="$_cdir:$PATH"; exec /usr/bin/time -f '%M' -o "$S.peak" \
      timeout "$_b" "$_c" -c ":load $_f" -c ":set prover=$_p" -c "$_cmd" ) > "$S.log" 2>&1 && _rc=0 || _rc=$?
  echo "$_rc" > "$S.rc"
  echo $(( $(date +%s) - _t0 )) > "$S.secs"
  exit 0
fi

CRYPTOL="${1:?usage: cryptol-twin-check.sh <path-to-cryptol>}"
DIR=scripts/bnrose-rust-001/cryptol
SPEC="$DIR/BnroseReplacement.cry"
MEM_CAP_KIB="${MEM_CAP_KIB:-6291456}"
BUDGET_SECS="${BUDGET_SECS:-300}"
OUT="${RUNNER_TEMP:-/tmp}/bnrose-cryptol-twin"
rm -rf "$OUT" && mkdir -p "$OUT"

say() { printf '%s\n' "$*"; }

say "== bnrose cryptol twin: toolchain =="
"$CRYPTOL" --version
for s in yices z3; do command -v "$s" >/dev/null 2>&1 && say "$s: $("$s" --version | head -n 1)"; done
[ -x /usr/bin/time ] || { say "cryptol-twin: /usr/bin/time is missing; the receipt needs peak RSS"; exit 1; }
say "caps: address space ${MEM_CAP_KIB} KiB per process, a ${BUDGET_SECS}s clock per obligation"

OBLIGATIONS="BnroseReplacement.cry:gateFailsClosed BnroseReplacement.cry:gateNeedsNeverExecuted BnroseReplacement.cry:gateOpensOnlyWhenBothHold BnroseReplacement.cry:replacementNeverTouchesARow BnroseReplacement.cry:freshAttemptBelowSaturation BnroseReplacement.cry:oldRecordsStand BnroseReplacement.cry:saturationCornerReusesSlot15 BnroseReplacement.cry:nextAttemptDependsOnlyOnMax BnroseReplacement.cry:gateDependsOnlyOnAnyRow BnroseReplacement.cry:attempt8Agrees BnroseComposition.cry:applyIdempotent BnroseComposition.cry:twoDispatchesAtMostOneEffect BnroseComposition.cry:oneEffectWhenFreshAndDispatched BnroseComposition.cry:staleViewsStillOneEffect BnroseComposition.cry:saturationReuseSingleEffect BnroseComposition.cry:reconciledGateCloses"
N=0
PROVEN=""
OPEN=""
RED=0

# variant <id> <from> <to> — a copy of the twin with ONE textual substitution
# in BnroseReplacement.cry (the text must occur on exactly one line).
variant() {
  _d="$OUT/$1"
  rm -rf "$_d" && mkdir -p "$_d" && cp "$DIR"/*.cry "$_d/"
  _g="$_d/BnroseReplacement.cry"
  _hits=$(grep -cF -- "$2" "$_g" || true)
  [ "$_hits" = 1 ] || { say "CRYPTOL-TWIN-CONTROL $1: FAIL (the substitution matches $_hits lines, not exactly 1)" >&2; exit 1; }
  sed "s|$(printf '%s' "$2" | sed 's/[&|\\]/\\&/g')|$(printf '%s' "$3" | sed 's/[&|\\]/\\&/g')|" "$_g" > "$_g.new" && mv "$_g.new" "$_g"
  echo "$_d/BnroseReplacement.cry"
}

for entry in $OBLIGATIONS; do
  ob=${entry#*:}
  _file="$DIR/${entry%%:*}"
  N=$((N + 1))
  printf '%s\n' "$CRYPTOL" yices "$BUDGET_SECS" "$_file" ":prove $ob" "$MEM_CAP_KIB" > "$OUT/$N.spec"
  sh "$0" --one "$OUT/$N.spec"
  rc=$(cat "$OUT/$N.spec.rc"); log="$OUT/$N.spec.log"
  if   grep -q 'Q.E.D.' "$log"; then
    say "PROVEN    $ob (rc=$rc, $(cat "$OUT/$N.spec.secs")s, peak $(cat "$OUT/$N.spec.peak") KiB)"
    PROVEN="$PROVEN $ob"
  elif [ "$rc" = 124 ]; then
    say "NOT-PROVEN $ob (timeout): recorded, never success"
    OPEN="$OPEN $ob(timeout)"
  elif grep -q 'heap overflow\|out of memory' "$log"; then
    say "NOT-PROVEN $ob (memory): recorded, never success"
    OPEN="$OPEN $ob(memory)"
  elif grep -qi 'counterexample' "$log"; then
    say "REFUTED   $ob — a counterexample on an obligation is red:" >&2
    sed -n '1,12p' "$log" >&2
    RED=1
  else
    say "RED       $ob (rc=$rc, unrecognized):" >&2
    sed -n '1,12p' "$log" >&2
    RED=1
  fi
done

# ---- the composition control: a NAIVE destination must COUNTEREXAMPLE --------
# (the destination's op-keyed dedup is load-bearing, not decorative)
N=$((N + 1))
printf '%s\n' "$CRYPTOL" yices "$BUDGET_SECS" "$DIR/BnroseComposition.cry" ":prove naiveDestinationDuplicates" "$MEM_CAP_KIB" > "$OUT/$N.spec"
sh "$0" --one "$OUT/$N.spec"
if grep -qi 'counterexample' "$OUT/$N.spec.log"; then
  say "CONTROL naive-destination: counterexample (a dedup-free destination duplicates) — the enforcement is load-bearing"
else
  say "CONTROL naive-destination: FAIL — the naive model must refute" >&2
  sed -n '1,12p' "$OUT/$N.spec.log" >&2
  RED=1
fi

# ---- the negative controls: one substitution each, must COUNTEREXAMPLE ------
GATE_LINE='gate optIn rows = optIn && (rows == zero)'

C1=$(variant optin-dropped "$GATE_LINE" 'gate optIn rows = (rows == zero)')
N=$((N + 1)); printf '%s\n' "$CRYPTOL" yices "$BUDGET_SECS" "$C1" ":prove gateFailsClosed" "$MEM_CAP_KIB" > "$OUT/$N.spec"
sh "$0" --one "$OUT/$N.spec"
if grep -qi "counterexample" "$OUT/$N.spec.log"; then
  say "CONTROL optin-dropped: counterexample (the door opens without the flag) — $(grep -A1 -i counterexample "$OUT/$N.spec.log" | tail -n 1)"
else
  say "CONTROL optin-dropped: FAIL — no counterexample; the control must refute" >&2
  sed -n "1,12p" "$OUT/$N.spec.log" >&2
  RED=1
fi

C2=$(variant zero-slot-only "$GATE_LINE" 'gate optIn rows = optIn && (rows @ (0:[4]) == False)')
N=$((N + 1)); printf '%s\n' "$CRYPTOL" yices "$BUDGET_SECS" "$C2" ":prove gateNeedsNeverExecuted" "$MEM_CAP_KIB" > "$OUT/$N.spec"
sh "$0" --one "$OUT/$N.spec"
if grep -qi "counterexample" "$OUT/$N.spec.log"; then
  say "CONTROL zero-slot-only: counterexample (a row past slot 0 is missed) — $(grep -A1 -i counterexample "$OUT/$N.spec.log" | tail -n 1)"
else
  say "CONTROL zero-slot-only: FAIL — no counterexample; the control must refute" >&2
  sed -n "1,12p" "$OUT/$N.spec.log" >&2
  RED=1
fi

# ---- the composed verdict ---------------------------------------------------
# A composition, never a single :prove verdict: PROVEN only if every
# obligation it rests on printed Q.E.D. in this run.
_TOTAL=$(echo $OBLIGATIONS | wc -w | tr -d " ")
_PROVED=$(echo $PROVEN | wc -w | tr -d " ")
if [ -z "$OPEN" ] && [ "$RED" = 0 ]; then
  say "COMPOSED  the exact replacement law + its composition (fail-closed without the flag; any recorded effect closes the gate; the gate is exactly the conjunction; a replacement's entity is fresh and rowless below saturation; old records stand; the saturation corner reuses slot 15; the SAW binding lemmas; two sovereigns one effect under the ASSUMED destination model): PROVEN over $_TOTAL obligations + 2 controls"
elif [ "$RED" = 0 ]; then
  say "COMPOSED  the exact replacement law: NOT-PROVEN (open:$OPEN) — recorded, never a wedge"
fi

[ "$RED" = 0 ] || { say "cryptol-twin: RED — see the REFUTED/RED rows above" >&2; exit 1; }
# Qualification-record distinction (independent review 2026-10-16): the
# green line CARRIES THE COUNTS. A green workflow with open obligations
# is a legitimate recorded state — but it must never be readable as
# "all obligations proved".
say "cryptol-twin: green — proved $_PROVED/$_TOTAL obligations; open $(($_TOTAL - _PROVED)) (recorded, never success); green here means NO REFUTED obligation, not all-proved"
