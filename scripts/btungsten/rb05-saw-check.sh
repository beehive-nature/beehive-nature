#!/bin/sh
# rb05-saw-check.sh — RB05: the RB04 grammar (scripts/btungsten/rb04-daedalus/
# WB001.ddl, read definition by definition in rb05-grammar/WB001Grammar.cry)
# is the WB001 decoder (wb001-cryptol/WB001Decode.cry, whose Rust
# implementation wb001-saw/decode.saw proves) on EVERY input. Classes, none
# standing in for another:
#
#   PROVE-UNIVERSAL  rb05-grammar/grammar.saw: the UTF-8 simulation ladder at
#                    64 and 128 bytes, the stream bridge, and the four
#                    envelope theorems (exactEquiv: acceptance and values;
#                    envelopeOk / envelopeTrailing / envelopeRefuses: the
#                    prefix entry's consumed length), and three closed-term
#                    non-vacuity rows. Every obligation must
#                    print its PROVEN line.
#   TEETH            RB04's four TEETH substitutions, applied to the reading
#                    (one textual substitution each, which must occur exactly
#                    once): grammar.saw re-run on each variant MUST fail with a
#                    solver counterexample on the declared obligation, after
#                    proving every obligation before it.
#
# usage: rb05-saw-check.sh <saw>      (from the repository root)
set -eu

SAW="${1:?usage: rb05-saw-check.sh <saw>}"
ROOT=$(pwd)
BT="$ROOT/scripts/btungsten"
OUT="$ROOT/target/saw-rb05"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW RB05: toolchain =="
"$SAW" --version | head -1

OBLIGATIONS="u8Init 64|u8Step 64|u8Fin 64|u8Chain 64|u8ProjD 64|u8ProjG 64|utf8Equiv 64|u8Init 128|u8Step 128|u8Fin 128|u8Chain 128|u8ProjD 128|u8ProjG 128|utf8Equiv 128|bytesFromPadded 64|bytesFromPadded 128|utf8From 64|utf8From 128|exactEquiv|envelopeOk|envelopeTrailing|envelopeRefuses|acceptsBridgeTerms|refusesTrailingByte|refusesEncodedSurrogate"

# ---- PROVE-UNIVERSAL -----------------------------------------------------------
say "== SAW RB05: grammar.saw =="
_t0=$(clock)
_log=$(cd "$BT/rb05-grammar" && "$SAW" grammar.saw 2>&1) && _rc=0 || _rc=$?
_t1=$(clock)
say "$_log" | grep -a -E 'RB05-SAW|Subgoal failed|rror' || true
_n=0
_old_ifs=$IFS; IFS='|'
for _ob in $OBLIGATIONS; do
  _n=$((_n + 1))
  if ! say "$_log" | grep -aqxF "RB05-SAW PROVEN $_ob"; then
    say "SAW grammar.saw: '$_ob' NOT PROVEN (rc=$_rc). Full output:"
    say "$_log"
    exit 1
  fi
done
IFS=$_old_ifs
[ "$_rc" -eq 0 ] || { say "SAW grammar.saw: saw exited rc=$_rc after every PROVEN line — red until explained"; exit 1; }
say "SAW grammar.saw: $_n obligations PROVEN in $((_t1 - _t0))s"

# ---- TEETH ------------------------------------------------------------------------
# tooth <id> <from> <to> <obligation that must fail> <last obligation proven before it>
tooth() {
  _id=$1; _from=$2; _to=$3; _fails=$4; _before=$5
  say "== SAW RB05: TEETH $_id — grammar.saw on the variant MUST FAIL at '$_fails' =="
  _dir="$OUT/$_id/scripts/btungsten"
  rm -rf "$OUT/$_id" && mkdir -p "$_dir"
  cp -r "$BT/wb001-cryptol" "$BT/rb05-grammar" "$_dir/"
  _g="$_dir/rb05-grammar/WB001Grammar.cry"
  _hits=$(grep -cF -- "$_from" "$_g" || true)
  [ "$_hits" = 1 ] || { say "SAW-TEETH $_id: FAIL — the substitution matches $_hits lines, not exactly 1"; exit 1; }
  FROM="$_from" TO="$_to" awk 'BEGIN { f = ENVIRON["FROM"]; t = ENVIRON["TO"] }
    { i = index($0, f); if (i) { $0 = substr($0, 1, i - 1) t substr($0, i + length(f)) } print }' \
    "$_g" > "$_g.new" && mv "$_g.new" "$_g"
  grep -qF -- "$_to" "$_g" || { say "SAW-TEETH $_id: FAIL — the substitution did not apply"; exit 1; }
  _log=$(cd "$_dir/rb05-grammar" && "$SAW" grammar.saw 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'RB05-SAW PROVEN|Subgoal failed|ounterexample|^Invalid: \[' | tail -4 || true
  if [ "$_rc" -eq 0 ] || say "$_log" | grep -aqxF "RB05-SAW PROVEN $_fails"; then
    say "SAW-TEETH $_id: FAIL — '$_fails' was proven on the variant; the honest PROVEN line would be vacuous"
    exit 1
  fi
  if ! say "$_log" | grep -aqxF "RB05-SAW PROVEN $_before"; then
    say "SAW-TEETH $_id: FAIL — the run stopped before '$_before', not at '$_fails'. Full output:"
    say "$_log"
    exit 1
  fi
  if ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_id: FAIL — saw failed, but not with a counterexample. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_id: PASS (counterexample at '$_fails', as required)"
}

tooth t1-domain-bound 's n 8 0x01 1 64' 's n 8 0x01 1 65' exactEquiv 'utf8From 128'
tooth t2-word-endian 'be64From s p1)' 'join (reverse (split (be64From s p1) : [8][8])))' exactEquiv 'utf8From 128'
tooth t3-cesu8-surrogate '(b0 == 0xed) && inR 0x80 0x9f b1' '(b0 == 0xed) && inR 0x80 0xbf b1' 'u8Step 64' 'u8Init 64'
tooth t4-trailing-bytes 'gExact s n = (ok && ((zext p : [64]) == n), v)' 'gExact s n = (ok, v)' exactEquiv 'utf8From 128'

say "== SAW RB05: ladder state =="
say "PROVE-UNIVERSAL: grammar == decoder spec on every input ($_n obligations) | TEETH: PASS (4, RB04's substitutions)"
