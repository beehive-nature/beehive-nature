#!/bin/bash
# zkrself-recheck.sh v2 — ENFORCING settled-state re-verification of a
# negative test (review 2026-10-07: v1 printed whatever cleos said and
# exited 0 for a wrong refusal, a transport failure, and even unexpected
# success — a green exit proved nothing).
#
# Operational rule (the state-visibility incident, evidence-bounded):
# immediate verification after an anchor write was once observed to
# return "anchor not found" while later attempts returned the intended
# pairing rejection — a state-visibility or transaction-ordering race
# is CONSISTENT with those observations; the precise cause is
# UNVERIFIED. Therefore: RECONCILE the prerequisite anchor first
# (bounded, recorded retries); classify a refusal only on its specified
# reason; if the prerequisite cannot be established, report
# INCONCLUSIVE and exit nonzero — never passed.
#
# Usage: zkrself-recheck.sh <seq> <rootHex> <kind> <count> [proofFile]
#   (defaults: seq 5, the canonical root from expected.json, 0, 20,
#    calldata_dead.json — the two raced legs of 2026-10-06)
U=${U:-https://jungle4.greymass.com}
RURL=${RURL:-https://jungle4.api.eosnation.io}   # reads on a second endpoint (stale write-endpoint reads never gate a leg)
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
A=${A:-zkrtst111111}
W=~/plonkport
CLEOS="/usr/bin/cleos -u $U"
RCLEOS="/usr/bin/cleos -u $RURL"
SEQ=${1:-5}
ROOT=${2:-$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")}
KIND=${3:-0}
COUNT=${4:-20}
PROOF=${5:-$W/calldata_dead.json}
PASS=0; FAILS=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; FAILS=$((FAILS+1)); }

$CLEOS wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key "$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key)" >/dev/null 2>&1 || true
P=$(node -pe "require('$PROOF').proof_hex")
PAIR="count proof REJECTED — plonk pairing false"

echo "== reconcile prerequisite anchor seq $SEQ (root ${ROOT:0:12}… kind $KIND count $COUNT) =="
# THE 2026-10-07 REPAIR (shared with zkrself-run.sh): the inline
# `JSON.parse(process.stdin.read())` raced its own stdin — read()
# returns null when nothing is buffered and failed parses against
# VALID responses. The parser is now the shared reconcile_row.mjs
# (readFileSync(0) blocks to EOF — the race is structurally gone) with
# NAMED failure classes; fixture-proven in zkrself-parse-test.sh.
VIS=1
for I in 1 2 3 4 5 6 7 8; do
  ERR1=$($RCLEOS get table $A $A anchors --lower $SEQ --upper $SEQ 2>/dev/null | node "$REPO/reconcile_row.mjs" "$SEQ" "$ROOT" "$KIND" "$COUNT" 2>&1 >/dev/null)
  RC1=$?
  if [ $RC1 -eq 0 ]; then echo "  visible and exact (attempt $I)"; VIS=0; break; fi
  case $RC1 in
    2) echo "  MALFORMED response (attempt $I of 8): $ERR1" ;;
    3) echo "  TRANSPORT-empty (attempt $I of 8): $ERR1" ;;
    4) echo "  row not yet visible (attempt $I of 8): $ERR1" ;;
    5) echo "  FIELD mismatch — not the anchored claim (attempt $I of 8): $ERR1" ;;
    *) echo "  UNCLASSIFIED parse failure rc=$RC1 (attempt $I of 8): $ERR1" ;;
  esac
  sleep 6
done
if [ $VIS -ne 0 ]; then
  echo "INCONCLUSIVE: prerequisite anchor seq $SEQ not established after 8 recorded attempts — this negative test is NOT passed"
  exit 1
fi
ok "prerequisite visible"

OUT=$($CLEOS push action $A verify "[\"$SEQ\",\"$P\"]" -p $A 2>&1); RC=$?
if echo "$OUT" | grep -q "executed transaction:"; then
  bad "verify @seq $SEQ UNEXPECTEDLY EXECUTED (expected the pairing refusal)"; echo "$OUT" | head -3
elif echo "$OUT" | grep -qF "$PAIR"; then
  ok "verify @seq $SEQ refused on the specified reason: $PAIR"
else
  bad "verify @seq $SEQ refused for the WRONG reason (expected the pairing refusal)"; echo "$OUT" | head -3
fi

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
