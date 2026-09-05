#!/bin/bash
# m9run.sh — the M9 x402-anchoring acceptance (two-tier anchoring +
# admit-before-quote, X402-SORT-2026-09-01.md z2.1 rows). Law: anchor_cost=20,
# anchor_batch=3, anchor_asset=1. The ladder:
#   [0] admit(5,1)    REFUSED  — seller cannot afford its own anchor
#   [1] admit(25,1)   ADMITTED — the quote gate passes (25 ≥ 20)
#   [2] deposits (no checkpoint — the on-ramp is not a settlement)
#   [3] payment 1 fee 25  → ckpt seq 1, accrued 25, pend 1
#   [4] anchor()      FIRES on the PRIORITY path (revenue ≥ cost)
#   [5] payment 2 fee 3   → accrued 8, pend 1
#   [6] payment 3 fee 4   → accrued 12, pend 2
#   [7] anchor()      REFUSED (deferred — batch not full, revenue < cost)
#   [8] withdraw fee 497  → seq 4, pend 3, accrued UNCHANGED (value-out ≠ meter cut)
#   [9] anchor()      FIRES on the BATCH path (pend ≥ 3; deficit forgiven, labeled)
#   [10] m9audit.js recomputes the chain from the nullifiers table alone
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/wt-z2.1/contracts/privacy
A=${A:-paynote5555}
export NODE_PATH=/home/travi/plonkport/node_modules
CLEOS="/usr/bin/cleos -u $U"
BILL() { TID=$1; [ -n "$TID" ] && { sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; } }
REFUSAL() { echo "$1" | grep -m1 -oE 'assertion failure with message: .*' | head -1; }

$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

echo "[deploy] account + code + law (anchor_cost=20, anchor_batch=3, anchor_asset=1, max_anchors=64)"
$CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
$CLEOS set code $A $W/note.wasm 2>&1 | grep -c 'executed transaction'
$CLEOS set abi $A $W/note.abi 2>&1 | grep -c 'executed transaction'
sleep 1
echo "  init: $($CLEOS push action $A init '[1048576,1048576,20,3,1,64]' -p $A 2>&1 | grep -c 'executed transaction')"

echo "[0] ADMIT-BEFORE-QUOTE, insolvent: admit(5,1) —"
REFUSAL "$($CLEOS push action $A admit '[5,1]' -p $A 2>&1)"
echo "[1] ADMIT-BEFORE-QUOTE, solvent: admit(25,1) —"
BILL "$($CLEOS push action $A admit '[25,1]' -p $A 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"

cd $W
rm -f tree-state.json
echo "[2] deposits (the on-ramp — NO checkpoint, NO accrual):"
node $REPO/m7prep.js note 1000 1 >/dev/null
C1=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
C1H=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
cp m7-note.json m9-A.json
R=$($CLEOS push action $A deposit "[\"$C1H\",305419896,1000,1]" -p $A 2>&1); echo -n "  deposit-A "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
node $REPO/tree.js insert $C1 >/dev/null
node $REPO/m7prep.js note 500 1 >/dev/null
C2=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
C2H=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
cp m7-note.json m9-B.json
R=$($CLEOS push action $A deposit "[\"$C2H\",305419896,500,1]" -p $A 2>&1); echo -n "  deposit-B "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
node $REPO/tree.js insert $C2 >/dev/null
echo "  (post-deposits) $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued}`')"

PAY() {  # PAY <note-file> <amountOut> <fee> -> uses m7-note.json, writes calldata + m7-prev.json
  # out-notes are saved in m7-prev SCHEMA (secretOut/commitmentOut) — convert
  # to the spendable note SCHEMA (secret/commitment) BEFORE spending:
  node -e '
    const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    if(j.commitmentOut!==undefined){
      fs.writeFileSync(process.argv[1],JSON.stringify({secret:j.secretOut,amount:j.amountOut,asset:j.assetOut,commitment:j.commitmentOut}));
    }' "$1"
  cp "$1" m7-note.json
  node $REPO/m7prep.js payment "$2" "$3" 1 >/dev/null
  node payment_js/generate_witness.js payment_js/payment.wasm input7.json w9.wts >/dev/null 2>&1
  npx snarkjs plonk prove payment.zkey w9.wts proof9.json public9.json >/dev/null 2>&1
  node $REPO/flatten.js proof9.json public9.json > calldata9.json
  node -pe "const c=require('$W/calldata9.json'); JSON.stringify({N:c.pubs_hex.slice(64,128),O:c.pubs_hex.slice(128,192),P:c.proof_hex})"
}

echo "[3] PAYMENT 1 (spend A, fee 25 asset-1 — the admitted session):"
J=$(PAY m9-A.json 975 25); N1=$(node -pe "JSON.parse(process.argv[1]).N" "$J"); O1=$(node -pe "JSON.parse(process.argv[1]).O" "$J"); P1=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
R=$($CLEOS push action $A transfer "[\"$N1\",\"$O1\",42,25,1,\"$P1\"]" -p $A 2>&1); echo -n "  payment-1 "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "$R" | grep -q 'executed transaction' && { cp m7-prev.json m9-A2.json; node $REPO/tree.js insert "$(node -pe "require('$W/m7-prev.json').commitmentOut")" >/dev/null; }
echo "  $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued}`')"

echo "[4] ANCHOR — the PRIORITY path (accrued 25 ≥ cost 20, batch 1 < 3):"
BILL "$($CLEOS push action $A anchor '[]' -p $A 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued} (cost deducted)`')"

echo "[5] PAYMENT 2 (spend B, fee 3):"
J=$(PAY m9-B.json 497 3); N2=$(node -pe "JSON.parse(process.argv[1]).N" "$J"); O2=$(node -pe "JSON.parse(process.argv[1]).O" "$J"); P2=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
R=$($CLEOS push action $A transfer "[\"$N2\",\"$O2\",42,3,1,\"$P2\"]" -p $A 2>&1); echo -n "  payment-2 "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "$R" | grep -q 'executed transaction' && { cp m7-prev.json m9-B2.json; node $REPO/tree.js insert "$(node -pe "require('$W/m7-prev.json').commitmentOut")" >/dev/null; }

echo "[6] PAYMENT 3 (spend A', fee 4):"
J=$(PAY m9-A2.json 971 4); N3=$(node -pe "JSON.parse(process.argv[1]).N" "$J"); O3=$(node -pe "JSON.parse(process.argv[1]).O" "$J"); P3=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
R=$($CLEOS push action $A transfer "[\"$N3\",\"$O3\",42,4,1,\"$P3\"]" -p $A 2>&1); echo -n "  payment-3 "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
# the out-note joins the off-chain tree ONLY if the chain accepted it
echo "$R" | grep -q 'executed transaction' && node $REPO/tree.js insert "$(node -pe "require('$W/m7-prev.json').commitmentOut")" >/dev/null
echo "  $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued}`')"

echo "[7] ANCHOR — premature (pend 2 < 3, accrued 12 < 20) —"
REFUSAL "$($CLEOS push action $A anchor '[]' -p $A 2>&1)"

echo "[8] WITHDRAW (spend B', fee leg 497 = VALUE-OUT — checkpoints, never accrues):"
J=$(PAY m9-B2.json 0 497); N4=$(node -pe "JSON.parse(process.argv[1]).N" "$J"); O4=$(node -pe "JSON.parse(process.argv[1]).O" "$J"); P4=$(node -pe "JSON.parse(process.argv[1]).P" "$J")
R=$($CLEOS push action $A withdraw "[\"$N4\",\"eosio\",497,1,\"$O4\",\"$P4\"]" -p $A 2>&1); echo -n "  withdraw "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued} (unchanged — value-out)`')"

echo "[9] ANCHOR — the BATCH path (pend 3 ≥ 3; deficit 12 < 20 forgiven, labeled):"
BILL "$($CLEOS push action $A anchor '[]' -p $A 2>&1 | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
echo "  $($CLEOS get table $A $A checkpoint -l 1 | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; `checkpoint: seq=${r.seq} pend=${r.pend} accrued=${r.accrued}`')"

echo "[10] the stranger's audit (chain recomputed from the nullifiers table alone):"
$CLEOS get table $A $A checkpoint -l 1 > m9-ckpt.json
$CLEOS get table $A $A anchors > m9-anchors.json
$CLEOS get table $A $A nullifiers > m9-nulls.json
node $REPO/m9audit.js

echo "[tables] anchors commit (id, seq) — never a receipt list:"
$CLEOS get table $A $A anchors | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; r.map(x=>`  anchor ${x.id}: commits seq ${x.seq} at ${x.at}`).join("\n")'
$CLEOS get code $A 2>&1 | head -1
