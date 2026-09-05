#!/bin/bash
# m10run.sh — the M10 BONDED DISPUTE acceptance (the third z2.1 raid row:
# "a dispute costs a bond — spam-resistant by fee, not by moderator").
# Law: anchor_cost=20, anchor_batch=3, anchor_asset=1, max_anchors=64,
# dispute_bond=15, dispute_window=40 blocks.
#
#   INSTANCE A (the DEFAULT build — what ships):
#   [A0] ladder start: deposits + payment 1 + priority anchor 1 (accrued 5)
#   [A1] challenge(anchor 1) IMMEDIATELY (inside the window) → INVALID
#        (recomputed == committed) → bond FORFEITED to the anchorer
#        (accrued 5 + 15 = 20)
#   [A0-cont] ladder to seq 4 (two payments, withdraw, batch anchor 2)
#   [A2] the stranger's audit STILL PASS (disputes touch no chain data)
#   [A3] double-dispute refusal (one dispute per anchor, forever)
#   [A4] no-bond refusal (escrow empty)
#   [A5] window-closed refusal (sleep past 40 blocks × 500 ms)
#
#   INSTANCE B (the M10_PROBE build — attack fixture, treedbg law):
#   [B1] ladder to seq 2, accrued 8; badanchor commits a LYING head
#   [B2] challenge(bad anchor) → VALID (recomputed ≠ committed) →
#        accrued SLASHED to the challenger (8 → payouts; bond returns)
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/wt-z2.1/contracts/privacy
A=${A:-disputenote2}
B=${B:-liarprobe222}
CH=${CH:-challnote111}
export NODE_PATH=/home/travi/plonkport/node_modules
CLEOS="/usr/bin/cleos -u $U"
BILL() { TID=$1; [ -n "$TID" ] && { sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 60; } }
REFUSAL() { echo "$1" | grep -m1 -oE 'assertion failure with message: .*' | head -1; }
CKPT() { $CLEOS get table $1 $1 checkpoint -l 1 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `seq=${r.seq} pend=${r.pend} accrued=${r.accrued}`'; }

$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

DEPLOY() {  # DEPLOY <account> <wasm-dir>
  $CLEOS create account eosio $1 "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
  sleep 1
  $CLEOS set code $1 $2/note.wasm 2>&1 | grep -c 'executed transaction'
  $CLEOS set abi $1 $2/note.abi 2>&1 | grep -c 'executed transaction'
  sleep 1
  echo "  init: $($CLEOS push action $1 init '[1048576,1048576,20,3,1,64,15,40,500]' -p $1 2>&1 | grep -c 'executed transaction')"
}
PAY() {  # PAY <acct> <note-file> <amountOut> <fee> — m7-prev→note schema conversion included
  node -e '
    const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    if(j.commitmentOut!==undefined){
      fs.writeFileSync(process.argv[1],JSON.stringify({secret:j.secretOut,amount:j.amountOut,asset:j.assetOut,commitment:j.commitmentOut}));
    }' "$2"
  cp "$2" m7-note.json
  node $REPO/m7prep.js payment "$3" "$4" 1 >/dev/null
  node payment_js/generate_witness.js payment_js/payment.wasm input7.json w10.wts >/dev/null 2>&1
  npx snarkjs plonk prove payment.zkey w10.wts proof10.json public10.json >/dev/null 2>&1
  node $REPO/flatten.js proof10.json public10.json > calldata10.json
  node -pe "const c=require('$W/calldata10.json'); JSON.stringify({N:c.pubs_hex.slice(64,128),O:c.pubs_hex.slice(128,192),P:c.proof_hex})"
}
DEP() {  # DEP <acct> <amount> — mints a note, deposits, inserts tree
  node $REPO/m7prep.js note $2 1 >/dev/null
  local C=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
  local CH_=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
  cp m7-note.json "$3"
  $CLEOS push action $1 deposit "[\"$CH_\",305419896,$2,1]" -p $1 >/dev/null 2>&1
  node $REPO/tree.js insert $C >/dev/null
}
SPEND() {  # SPEND <acct> <note-file> <amountOut> <fee> — transfer, tree-insert on success
  local J=$(PAY "$1" "$2" "$3" "$4")
  local N=$(node -pe "JSON.parse(process.argv[1]).N" "$J") O=$(node -pe "JSON.parse(process.argv[1]).O" "$J") P=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
  local R=$($CLEOS push action $1 transfer "[\"$N\",\"$O\",42,$4,1,\"$P\"]" -p $1 2>&1)
  echo "$R" | grep -q 'executed transaction' && node $REPO/tree.js insert "$(node -pe "require('$W/m7-prev.json').commitmentOut")" >/dev/null
}

echo "== INSTANCE A (default build): $A =="
DEPLOY $A $W
cd $W; rm -f tree-state.json
$CLEOS create account eosio $CH "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
echo "[A0] the M9 ladder (challenge interleaved while the window is fresh):"
DEP $A 1000 m10-A.json; DEP $A 500 m10-B.json
SPEND $A m10-A.json 975 25; cp m7-prev.json m10-A2.json
BILL "$($CLEOS push action $A anchor '[]' -p $A 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  after anchor 1: $(CKPT $A)"

echo "[A1] INVALID challenge, inside the window (anchor 1 is TRUE — recomputed == committed):"
BILL "$($CLEOS push action $A postbond "[\"$CH\",15]" -p $CH 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
BILL "$($CLEOS push action $A challenge "[1,\"$CH\"]" -p $CH 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  post-challenge: $(CKPT $A)  (bond 15 forfeited → accrued)"
$CLEOS get table $A $A escrow 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  escrow: "+r.map(x=>x.owner+"="+x.amount).join(",")'
$CLEOS get table $A $A disputes 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  disputes: "+r.map(x=>`anchor ${x.anchor_id} by ${x.challenger} valid=${x.valid}`).join(",")'

echo "[A0-cont] ladder to seq 4:"
SPEND $A m10-B.json 497 3; cp m7-prev.json m10-B2.json
SPEND $A m10-A2.json 971 4
J=$(PAY $A m10-B2.json 0 497); N4=$(node -pe "JSON.parse(process.argv[1]).N" "$J"); O4=$(node -pe "JSON.parse(process.argv[1]).O" "$J"); P4=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
R=$($CLEOS push action $A withdraw "[\"$N4\",\"eosio\",497,1,\"$O4\",\"$P4\"]" -p $A 2>&1); echo -n "  withdraw "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
BILL "$($CLEOS push action $A anchor '[]' -p $A 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  ladder end: $(CKPT $A)"

echo "[A2] the stranger's audit STILL PASS:"
$CLEOS get table $A $A checkpoint -l 1 > m9-ckpt.json
$CLEOS get table $A $A anchors > m9-anchors.json
$CLEOS get table $A $A nullifiers > m9-nulls.json
node $REPO/m9audit.js

echo "[A3] double-dispute refusal:"
REFUSAL "$($CLEOS push action $A challenge "[1,\"$CH\"]" -p $CH 2>&1)"
echo "[A4] no-bond refusal (anchor 2, escrow now 0):"
REFUSAL "$($CLEOS push action $A challenge "[2,\"$CH\"]" -p $CH 2>&1)"
echo "[A5] window-closed refusal (anchor 2; sleeping past 40 blocks × 500 ms):"
BILL "$($CLEOS push action $A postbond "[\"$CH\",15]" -p $CH 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
sleep 22
REFUSAL "$($CLEOS push action $A challenge "[2,\"$CH\"]" -p $CH 2>&1)"

echo ""
echo "== INSTANCE B (M10_PROBE build — the lying-anchorer fixture): $B =="
DEPLOY $B $W/probe
cd $W; rm -f tree-state.json
echo "[B1] ladder to seq 2 (accrued 8) + badanchor (a LYING head at seq 2):"
DEP $B 1000 m10b-A.json; DEP $B 500 m10b-B.json
SPEND $B m10b-A.json 975 25; cp m7-prev.json m10b-A2.json
BILL "$($CLEOS push action $B anchor '[]' -p $B 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
SPEND $B m10b-B.json 497 3
echo "  pre-challenge: $(CKPT $B)"
BADH=$(node -pe "'ab'.repeat(32)")
BILL "$($CLEOS push action $B badanchor "[2,\"$BADH\"]" -p $B 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  bad anchor 2 committed (claimed head $BADH)"
echo "[B2] VALID challenge → SLASH:"
BILL "$($CLEOS push action $B postbond "[\"$CH\",15]" -p $CH 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
BILL "$($CLEOS push action $B challenge "[2,\"$CH\"]" -p $CH 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  post-challenge: $(CKPT $B)  (accrued SLASHED to 0)"
$CLEOS get table $B $B disputes 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  disputes: "+r.map(x=>`anchor ${x.anchor_id} by ${x.challenger} valid=${x.valid} slashed=${x.slashed}`).join(",")'
$CLEOS get table $B $B payouts 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  payouts: "+r.map(x=>x.owner+"="+x.amount).join(",")'
$CLEOS get code $A 2>&1 | head -1
$CLEOS get code $B 2>&1 | head -1
