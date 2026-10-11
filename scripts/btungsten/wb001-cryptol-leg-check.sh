#!/bin/sh
# wb001-cryptol-leg-check.sh — WB001's CRYPTOL LEG of universal wire
# injectivity and of the zero tail (founder order 2026-10-10; routed by
# f15649ce3 to the RB05 lane, owned by its successor). Every obligation of
# wb001-cryptol/WB001WireInjective.cry, plus validImpliesBounded and
# zeroTailAtPosition from BTungstenWB001.cry, is run through Cryptol's own
# :prove, one process per obligation, each under the formal job's caps (a
# 6 GiB address-space cap and its own clock), at most CRYPTOL_LEG_PAR (3) at
# once. Then the negative controls: each MUST end in a Cryptol
# counterexample.
#
# Classes (wb001-formal-check.sh's law, unchanged):
#   Q.E.D.             PROVEN
#   timeout            NOT-PROVEN (timeout): recorded, never success
#   RTS out of memory  NOT-PROVEN (memory): recorded, never success
#   counterexample     REFUTED on an obligation: red
#   anything else      red
# The COMPOSED lines at the end print PROVEN only when every obligation they
# rest on printed PROVEN in this run, and otherwise NOT-PROVEN naming the
# open ones. They are compositions (README WB001 §cryptol-leg), never a
# single :prove verdict, and say so; the single-query rows for wireZeroTail
# and wireInjective stay in wb001-formal-check.sh with their own verdicts.
# The SAW leg (wb001-saw/injective.saw) is a separate result; nothing here
# reads it.
#
# usage: wb001-cryptol-leg-check.sh <path-to-cryptol>   (from the repo root)
set -eu

# ---- one job (the pool calls the script back with --one <spec>) -------------
# spec lines: cryptol, prover, budget, file, command, address-space cap (KiB).
# Writes <spec>.log, .rc, .secs and .peak (GNU time's maximum RSS, KiB).
if [ "${1:-}" = "--one" ]; then
  S=$2
  _c=$(sed -n 1p "$S"); _p=$(sed -n 2p "$S"); _b=$(sed -n 3p "$S")
  _f=$(sed -n 4p "$S"); _cmd=$(sed -n 5p "$S"); _cap=$(sed -n 6p "$S")
  _t0=$(date +%s)
  ( ulimit -v "$_cap"; exec /usr/bin/time -f '%M' -o "$S.peak" \
      timeout "$_b" "$_c" -c ":load $_f" -c ":set prover=$_p" -c "$_cmd" ) > "$S.log" 2>&1 && _rc=0 || _rc=$?
  echo "$_rc" > "$S.rc"
  echo $(( $(date +%s) - _t0 )) > "$S.secs"
  exit 0
fi

CRYPTOL="${1:?usage: wb001-cryptol-leg-check.sh <path-to-cryptol>}"
DIR=scripts/btungsten/wb001-cryptol
SPEC="$DIR/BTungstenWB001.cry"
LEG="$DIR/WB001WireInjective.cry"
MEM_CAP_KIB="${MEM_CAP_KIB:-6291456}"
PAR="${CRYPTOL_LEG_PAR:-3}"
OUT="${RUNNER_TEMP:-/tmp}/wb001-cryptol-leg"
rm -rf "$OUT" && mkdir -p "$OUT"

say() { printf '%s\n' "$*"; }

say "== cryptol-leg: toolchain =="
"$CRYPTOL" --version
for s in yices z3; do command -v "$s" >/dev/null 2>&1 && say "$s: $("$s" --version | head -n 1)"; done
[ -x /usr/bin/time ] || { say "cryptol-leg: /usr/bin/time is missing; the receipt needs peak RSS"; exit 1; }
say "caps: address space ${MEM_CAP_KIB} KiB per process, $PAR processes at once, a clock per obligation"

# job <kind> <name> <prover> <budget> <file> <command> <launch-rank> [<pattern>]
# kind: prove (an obligation) or control (must end in a counterexample whose
# text matches <pattern>). Lower ranks launch first (the long ones).
N=0
job() {
  N=$((N + 1))
  printf '%s\n' "$CRYPTOL" "$3" "$4" "$5" "$6" "$MEM_CAP_KIB" > "$OUT/$N.spec"
  printf '%s\n' "$1" "$2" "${8:-}" "$3" "$4" > "$OUT/$N.meta"
  printf '%s %s\n' "$7" "$N" >> "$OUT/launch"
}

# variant <id> <from> <to> — a copy of wb001-cryptol with ONE textual
# substitution in BTungstenWB001.cry (the text must occur on exactly one
# line); prints the copy's directory.
variant() {
  _d="$OUT/$1"
  rm -rf "$_d" && mkdir -p "$_d" && cp "$DIR"/*.cry "$_d/"
  _g="$_d/BTungstenWB001.cry"
  _hits=$(grep -cF -- "$2" "$_g" || true)
  [ "$_hits" = 1 ] || { say "CRYPTOL-LEG-CONTROL $1: FAIL (the substitution matches $_hits lines, not exactly 1)" >&2; exit 1; }
  FROM="$2" TO="$3" awk 'BEGIN { f = ENVIRON["FROM"]; t = ENVIRON["TO"] }
    { i = index($0, f); if (i) { $0 = substr($0, 1, i - 1) t substr($0, i + length(f)) } print }' \
    "$_g" > "$_g.new" && mv "$_g.new" "$_g"
  grep -qF -- "$3" "$_g" || { say "CRYPTOL-LEG-CONTROL $1: FAIL (the substitution did not apply)" >&2; exit 1; }
  say "$_d"
}

# ---- the obligations ---------------------------------------------------------
# The solver is the one measured to close each (yices for the leg's own
# lemmas; z3 for the two BTungstenWB001 lemmas, their recorded prover).
# Budgets are at least three times the slowest local time measured with
# three processes at once (dress rehearsal 2026-10-10, pool wall 787 s).
job prove validImpliesBounded z3 300 "$SPEC" ':prove validImpliesBounded' 5
job prove zeroTailAtPosition z3 300 "$SPEC" ':prove zeroTailAtPosition' 5
job prove validImpliesPadded w4-yices 300 "$LEG" ':prove validImpliesPadded' 3
job prove caseCover w4-yices 120 "$LEG" ':prove caseCover' 5
job prove splitDiff32 w4-yices 120 "$LEG" ':prove splitDiff32' 5
job prove splitDiff64 w4-yices 120 "$LEG" ':prove splitDiff64' 5
job prove padZero64 w4-yices 120 "$LEG" ':prove padZero64' 5
job prove padZero128 w4-yices 120 "$LEG" ':prove padZero128' 5
job prove padZero4096 w4-yices 600 "$LEG" ':prove padZero4096' 1
for f in Dom Non Act Dst Cap Pay Pld; do
  r=4; [ "$f" = Pld ] && r=1; [ "$f" = Pay ] && r=2
  job prove "byteDiff$f" w4-yices 900 "$LEG" ":prove byteDiff$f" "$r"
done
for f in Dom Dst Cap Pay Pld; do job prove "lenDiff$f" w4-yices 600 "$LEG" ":prove lenDiff$f" 4; done
for f in Epo Amt Exp; do job prove "u64Diff$f" w4-yices 600 "$LEG" ":prove u64Diff$f" 4; done
m=0
while [ "$m" -le 18 ]; do
  r=2; [ "$m" -eq 0 ] && r=0
  job prove "wireIsByteAt\`{$m}" w4-yices 900 "$LEG" ":prove wireIsByteAt\`{$m}" "$r"
  m=$((m + 1))
done

# ---- negative controls -------------------------------------------------------
# C1: wireIndexDef as stated has no bounds premise. Under Cryptol's semantics
# it is unsafe: an intent whose length word exceeds its field's capacity
# makes byteAt read past the field, so it can never be Q.E.D. here (the
# single-query attempt died of memory first and hid this). Position 3000
# suffices for a witness.
job control C1-wireIndexDef-unsafe w4-yices 300 "$SPEC" \
  ':prove \(a : Intent) -> wireIndexDef a 3000' 6 'invalid sequence index'
# C2: without "every earlier field equal" the two payload blocks may start at
# different offsets; the position lemma must then fail.
job control C2-earlier-fields-dropped w4-yices 600 "$LEG" \
  ':prove \a b j -> (bounded2 a b && (a.payload.len == b.payload.len) && (j < a.payload.len)) ==> ((a.payload.bytes @ j != b.payload.bytes @ j) ==> differs2 a b (bPld a + 5 + j) (bPld b + 5 + j))' 6 'Counterexample'
# C3: a difference past the payload's length never reaches the wire; this is
# why validIntent's canonical padding is load-bearing.
job control C3-past-the-length w4-yices 600 "$LEG" \
  ':prove \a b j -> (bounded2 a b && eqToPayload a b && (a.payload.len == b.payload.len) && (j < 4096)) ==> ((a.payload.bytes @ j != b.payload.bytes @ j) ==> differs2 a b (bPld a + 5 + j) (bPld b + 5 + j))' 6 'Counterexample'
# C4: the encoding without its length words (the boundary-shift class B1
# named): the length-word lemma must fail on that wire.
V4=$(variant C4-no-length-words 'else if k < off + 5 then (split f.len) @ (k - off - 1)' 'else if k < off + 5 then 0')
job control C4-no-length-words w4-yices 600 "$V4/WB001WireInjective.cry" ':prove lenDiffDst' 6 'Counterexample'
# C5: the wire defined one position off: the chunked wire check must fail.
V5=$(variant C5-wire-off-by-one 'wire i = [ byteAt i k | k <- take`{MaxEnv} [0 ...] ]' 'wire i = [ byteAt i (k + 1) | k <- take`{MaxEnv} [0 ...] ]')
job control C5-wire-off-by-one w4-yices 900 "$V5/WB001WireInjective.cry" ':prove wireIsByteAt`{0}' 6 'Counterexample'
# C6: the zero tail starts AT envLen, not one byte before it.
job control C6-zero-tail-off-by-one w4-yices 300 "$SPEC" \
  ':prove \a p -> ((lensBounded a) && (envLen a - 1 <= p)) ==> (byteAt a p == 0x00)' 6 'Counterexample'
# C7: caseCover without its last case (payload bytes): two intents that
# differ only there are a counterexample.
job control C7-case-missing w4-yices 300 "$LEG" \
  ':prove \a b -> (bounded2 a b && (a != b)) ==> ((a.domain.len != b.domain.len) || ((a.domain.len == b.domain.len) && (a.domain.bytes != b.domain.bytes)) || (eqToNonce a b && (a.nonce.bytes != b.nonce.bytes)) || (eqToEpoch a b && (a.epoch != b.epoch)) || (eqToAction a b && (a.action.bytes != b.action.bytes)) || (eqToDest a b && (a.destination.len != b.destination.len)) || (eqToDest a b && (a.destination.len == b.destination.len) && (a.destination.bytes != b.destination.bytes)) || (eqToCap a b && (a.capability.len != b.capability.len)) || (eqToCap a b && (a.capability.len == b.capability.len) && (a.capability.bytes != b.capability.bytes)) || (eqToAmount a b && (a.amount != b.amount)) || (eqToExpiry a b && (a.expiry != b.expiry)) || (eqToPayer a b && (a.payer.len != b.payer.len)) || (eqToPayer a b && (a.payer.len == b.payer.len) && (a.payer.bytes != b.payer.bytes)) || (eqToPayload a b && (a.payload.len != b.payload.len)))' 6 'Counterexample'

# ---- run the pool ------------------------------------------------------------
say "== cryptol-leg: $N processes, $PAR at once =="
_t0=$(date +%s)
sort -n -k1,1 -k2,2 "$OUT/launch" | while read -r _r _n; do printf '%s\n' "$OUT/$_n.spec"; done \
  | xargs -n 1 -P "$PAR" sh "$0" --one
say "pool wall time: $(( $(date +%s) - _t0 ))s"

# ---- classify, in declaration order -------------------------------------------
PROVEN_SET=" "
RED=0
CONTROLS=0
i=1
while [ "$i" -le "$N" ]; do
  _kind=$(sed -n 1p "$OUT/$i.meta"); _name=$(sed -n 2p "$OUT/$i.meta"); _pat=$(sed -n 3p "$OUT/$i.meta")
  _p=$(sed -n 4p "$OUT/$i.meta"); _b=$(sed -n 5p "$OUT/$i.meta")
  _rc=$(cat "$OUT/$i.spec.rc" 2>/dev/null || echo missing)
  _secs=$(cat "$OUT/$i.spec.secs" 2>/dev/null || echo '?')
  _peak=$(tail -n 1 "$OUT/$i.spec.peak" 2>/dev/null || true)
  case "$_peak" in ''|*[!0-9]*) _peak=unmeasured ;; esac
  _log="$OUT/$i.spec.log"
  _res="${_secs}s wall, peak RSS ${_peak} KiB"
  if [ "$_kind" = prove ]; then
    if [ "$_rc" = 0 ] && grep -aq 'Q\.E\.D\.' "$_log"; then
      grep -a 'Total Elapsed' "$_log" | tail -n 1
      say "CRYPTOL-LEG $_name: PROVEN (Q.E.D., $_p, $_res)"
      PROVEN_SET="$PROVEN_SET$_name "
    elif grep -aq 'ounterexample' "$_log"; then
      say "CRYPTOL-LEG $_name: REFUTED (counterexample, a REAL finding; $_res). Output:"
      cut -c1-400 "$_log"
      RED=1
    elif [ "$_rc" = 124 ]; then
      say "CRYPTOL-LEG $_name: NOT-PROVEN (timeout ${_b}s; recorded, never success; $_res)"
    elif [ "$_rc" = 251 ] || grep -aq 'out of memory' "$_log"; then
      say "CRYPTOL-LEG $_name: NOT-PROVEN (memory, RTS exhausted the ${MEM_CAP_KIB} KiB cap, rc=$_rc; recorded, never success; $_res)"
    elif [ "$_rc" = 137 ]; then
      say "CRYPTOL-LEG $_name: NOT-PROVEN (memory, killed at the ${MEM_CAP_KIB} KiB cap, rc=137; recorded, never success; $_res)"
    else
      say "CRYPTOL-LEG $_name: UNKNOWN (rc=$_rc, no Q.E.D. and no counterexample): a diagnostic failure, never a green. Output:"
      cut -c1-400 "$_log"
      RED=1
    fi
  else
    if grep -aq 'Q\.E\.D\.' "$_log"; then
      say "CRYPTOL-LEG-CONTROL $_name: FAIL (proven: the control has no teeth; $_res)"
      RED=1
    elif grep -aq 'ounterexample' "$_log" && grep -aqE -- "$_pat" "$_log"; then
      say "CRYPTOL-LEG-CONTROL $_name: PASS (counterexample, as required; $_p, $_res)"
      CONTROLS=$((CONTROLS + 1))
    else
      say "CRYPTOL-LEG-CONTROL $_name: FAIL (no counterexample matching '$_pat', rc=$_rc; a control that cannot produce its counterexample shows nothing; $_res). Output:"
      cut -c1-400 "$_log"
      RED=1
    fi
  fi
  i=$((i + 1))
done

# ---- the compositions -----------------------------------------------------------
# composed <theorem> <obligation>... — PROVEN only if every named obligation
# printed PROVEN in this run.
composed() {
  _t=$1; shift; _open=""
  for _o in "$@"; do
    case "$PROVEN_SET" in *" $_o "*) ;; *) _open="$_open $_o" ;; esac
  done
  if [ -z "$_open" ]; then
    say "CRYPTOL-LEG-COMPOSED $_t: PROVEN BY COMPOSITION ($# obligations, every one Q.E.D. in this run; glue: (D-eq) and first-order logic, README WB001 §cryptol-leg; not a single :prove verdict)"
  else
    say "CRYPTOL-LEG-COMPOSED $_t: NOT-PROVEN (open:$_open; a composition is only as proven as its least obligation)"
  fi
}
say "== cryptol-leg: compositions (README WB001 §cryptol-leg) =="
CHUNKS=""
m=0
while [ "$m" -le 18 ]; do CHUNKS="$CHUNKS wireIsByteAt\`{$m}"; m=$((m + 1)); done
# shellcheck disable=SC2086 # CHUNKS is a word list by construction
composed wireZeroTail validImpliesBounded zeroTailAtPosition $CHUNKS
# shellcheck disable=SC2086
composed wireInjective validImpliesBounded validImpliesPadded caseCover splitDiff32 splitDiff64 \
  padZero64 padZero128 padZero4096 \
  byteDiffDom byteDiffNon byteDiffAct byteDiffDst byteDiffCap byteDiffPay byteDiffPld \
  lenDiffDom lenDiffDst lenDiffCap lenDiffPay lenDiffPld u64DiffEpo u64DiffAmt u64DiffExp $CHUNKS
say "CRYPTOL-LEG CONTROLS: $CONTROLS of 7 ended in the required counterexample"
[ "$RED" -eq 0 ] && [ "$CONTROLS" -eq 7 ] || { say "cryptol-leg: RED (see the lines above)"; exit 1; }
