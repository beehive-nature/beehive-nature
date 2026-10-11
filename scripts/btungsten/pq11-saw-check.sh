#!/bin/sh
# pq11-saw-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ11 (BIP-39 piece): the packing of
# the 24 recovery words, crates/bpq-core/src/bip39.rs, which bsigner's word
# reader (crates/bsigner/src/bip39.rs) runs. Classes, none standing in for
# another:
#
#   BUILD           crates/bpq-core compiles to MIR JSON.
#   EQUIVALENCE     pq11-saw/bip39.saw: indices, indices_ok, unpack and
#                   decode_ok equal to pq11-cryptol/Bip39.cry for every input.
#   PROVE-UNIVERSAL the same script: mnemonicRoundTrip (entropy and checksum
#                   to 24 valid indices and back), mnemonicRoundTripBack (24
#                   valid indices from exactly one pair), badChecksumRefused
#                   (any other checksum byte refused) with the hash left free,
#                   so for every hash.
#   TEETH           pq11-saw/bip39-teeth.saw: badChecksumRefused with a decoder
#                   that skips the checksum, and the Rust packing asked to read
#                   each group low bit first. Both MUST be refuted.
#
# usage: pq11-saw-check.sh <saw> <saw-rustc>
set -eu

SAW="${1:?usage: pq11-saw-check.sh <saw> <saw-rustc>}"
SAW_RUSTC="${2:?usage: pq11-saw-check.sh <saw> <saw-rustc>}"
ROOT=$(pwd)
CORE="$ROOT/crates/bpq-core"
SAWDIR="$ROOT/scripts/btungsten/pq11-saw"
OUT="$ROOT/target/saw-pq11"
MIR="$OUT/bpq_core.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ11: toolchain =="
"$SAW" --version | head -1

say "== SAW PQ11: BUILD bpq-core to MIR JSON =="
rm -rf "$OUT" && mkdir -p "$OUT"
( cd "$CORE" && "$SAW_RUSTC" src/lib.rs --edition 2021 --crate-type lib --crate-name bpq_core --out-dir "$OUT" ) || {
  say "SAW-BUILD PQ11: FAIL — bpq-core did not compile to MIR"
  exit 1
}
[ -s "$MIR" ] || { say "SAW-BUILD PQ11: FAIL — no $MIR"; ls -la "$OUT"; exit 1; }
say "SAW-BUILD PQ11: PASS ($(wc -c < "$MIR") bytes of linked MIR)"

say "== SAW PQ11: bip39.saw =="
t0=$(clock)
log=$(cd "$SAWDIR" && "$SAW" bip39.saw 2>&1) && rc=0 || rc=$?
t1=$(clock)
say "$log" | grep -a -E 'PQ11-SAW|Subgoal failed|rror' || true
for ob in indices indices_ok unpack decode_ok mnemonicRoundTrip mnemonicRoundTripBack badChecksumRefused; do
  if ! say "$log" | grep -aqx "PQ11-SAW PROVEN $ob"; then
    say "SAW bip39.saw: '$ob' NOT PROVEN (rc=$rc). Full output:"; say "$log"; exit 1
  fi
done
[ "$rc" -eq 0 ] || { say "SAW bip39.saw: saw exited rc=$rc after every PROVEN line — red until explained"; exit 1; }
say "SAW bip39.saw: 7 obligations PROVEN in $((t1 - t0))s"

say "== SAW PQ11: TEETH bip39-teeth.saw — both rows must be refuted =="
log=$(cd "$SAWDIR" && "$SAW" bip39-teeth.saw 2>&1) && rc=0 || rc=$?
say "$log" | grep -a -E 'PQ11-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
if say "$log" | grep -aq 'UNEXPECTED-PROVEN'; then
  say "SAW-TEETH bip39-teeth.saw: FAIL — a weakened obligation was proven"; exit 1
fi
say "$log" | grep -aqx 'PQ11-SAW-TEETH REFUTED checksumIgnored' || {
  say "SAW-TEETH bip39-teeth.saw: FAIL — checksumIgnored not refuted. Full output:"; say "$log"; exit 1; }
# the mir_verify row fails the script, with a counterexample on that obligation
if [ "$rc" -eq 0 ] || ! say "$log" | grep -aq 'PQ11-SAW-TEETH obligation lowBitsFirst' \
   || ! say "$log" | grep -aqi 'counterexample'; then
  say "SAW-TEETH bip39-teeth.saw: FAIL — lowBitsFirst was not refuted with a counterexample. Full output:"
  say "$log"; exit 1
fi
say "SAW-TEETH bip39-teeth.saw: PASS (2 rows refuted with counterexamples)"

say "== SAW PQ11: ladder state =="
say "BUILD: PASS | EQUIVALENCE: PROVEN (4, bpq-core bip39 == Bip39.cry) | PROVE-UNIVERSAL: PROVEN (3, for any checksum hash) | TEETH: PASS (2)"
