#!/bin/bash
# m7run.sh — the M7 per-asset acceptance: TWO ASSETS in ONE shielded set, a
# valid same-asset payment for each, a cross-asset attempt refused at
# witness generation, a meter's-leg fee in the OTHER asset accepted, plus
# forged/replay refusals. Root contract-computed (M6 carries over).
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/wt-z4/contracts/privacy
A=${A:-paynote2222}
export NODE_PATH=/home/travi/plonkport/node_modules
CLEOS="/usr/bin/cleos -u $U"
BILL() { TID=$1; [ -n "$TID" ] && { sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; } }

$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

echo "[0] account + deploy + init"
$CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
$CLEOS set code $A $W/note.wasm 2>&1 | grep -c 'executed transaction'
$CLEOS set abi $A $W/note.abi 2>&1 | grep -c 'executed transaction'
sleep 1
echo "  init: $($CLEOS push action $A init '[1048576,1048576]' -p $A 2>&1 | grep -c 'executed transaction')"

cd $W
rm -f tree-state.json

echo "[1] TWO ASSETS, ONE SET — deposits (assets recorded openly at the on-ramp):"
node $REPO/m7prep.js note 1000 1 >/dev/null          # asset 1 (the A-ish note)
C1=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
C1H=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
R=$($CLEOS push action $A deposit "[\"$C1H\",305419896,1000,1]" -p $A 2>&1); BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
node $REPO/tree.js insert $C1 >/dev/null
cp m7-note.json m7-note-asset1.json
cp m7-note.json m7-note-asset2.json.bak 2>/dev/null || true
node $REPO/m7prep.js note 500 2 >/dev/null           # asset 2 (the b note)
cp m7-note.json m7-note-asset2.json
C2=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
C2H=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
R=$($CLEOS push action $A deposit "[\"$C2H\",305419896,500,2]" -p $A 2>&1); BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
node $REPO/tree.js insert $C2 >/dev/null
echo "  two assets deposited; contract tree next_index: $($CLEOS get table $A $A tree 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).rows[0].next_index')"

echo "[2] PAYMENT 1 — asset-1 note, same-asset fee (10 in asset 1):"
cp m7-note-asset1.json m7-note.json
node $REPO/m7prep.js payment 990 10 1 >/dev/null
node payment_js/generate_witness.js payment_js/payment.wasm input7.json w7a.wts >/dev/null 2>&1
npx snarkjs plonk prove payment.zkey w7a.wts proof7a.json public7a.json >/dev/null 2>&1
node $REPO/flatten.js proof7a.json public7a.json > calldata7a.json
N1=$(node -pe "require('$W/calldata7a.json').pubs_hex.slice(64,128)")
O1=$(node -pe "require('$W/calldata7a.json').pubs_hex.slice(128,192)")
P1=$(node -pe "require('$W/calldata7a.json').proof_hex")
R=$($CLEOS push action $A transfer "[\"$N1\",\"$O1\",42,10,1,\"$P1\"]" -p $A 2>&1)
echo -n "  payment-1 "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"
CO1=$(node -pe "require('$W/calldata7a.json').pubs_dec[2]")
node $REPO/tree.js insert $CO1 >/dev/null           # the out-note (chain inserted it too)

cp m7-note-asset2.json m7-note.json
echo "[3] PAYMENT 2 — asset-2 (b) note, METER'S LEG: fee 3 in asset 1 (a DIFFERENT asset — note value intact):"
node $REPO/m7prep.js payment 500 3 1 >/dev/null      # amountIn=500 = amountOut=500 + 0 (fee not from note)
node payment_js/generate_witness.js payment_js/payment.wasm input7.json w7b.wts >/dev/null 2>&1
npx snarkjs plonk prove payment.zkey w7b.wts proof7b.json public7b.json >/dev/null 2>&1
echo -n "  off-chain verify: "; npx snarkjs plonk verify vk7.json public7b.json proof7b.json 2>&1 | tail -1
node $REPO/flatten.js proof7b.json public7b.json > calldata7b.json
N2=$(node -pe "require('$W/calldata7b.json').pubs_hex.slice(64,128)")
O2=$(node -pe "require('$W/calldata7b.json').pubs_hex.slice(128,192)")
P2=$(node -pe "require('$W/calldata7b.json').proof_hex")
R=$($CLEOS push action $A transfer "[\"$N2\",\"$O2\",42,3,1,\"$P2\"]" -p $A 2>&1)
echo -n "  payment-2 "; BILL "$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')"

echo "[4] CROSS-ASSET attempt (asset-1 in → asset-2 out) — must be refused AT WITNESS:"
cp m7-note-asset1.json m7-note.json
node $REPO/m7prep.js crossasset 990 10 2>/dev/null || true
node payment_js/generate_witness.js payment_js/payment.wasm input7-cross.json w7x.wts 2>&1 | grep -m1 -oE "Assert Failed|Error.*" | head -1

echo "[5] FORGED (payment-1 proof, eval tampered):"
T=$(node -e "const c=require('$W/calldata7a.json');const t=Buffer.from(c.proof_hex,'hex');t[767]+=1;console.log(t.toString('hex'))")
$CLEOS push action $A transfer "[\"$N1\",\"$O1\",42,10,1,\"$T\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [a-zA-Z0-9 :+-]*|executed transaction: [a-f0-9]+'

echo "[6] REPLAY (payment-1 again):"
$CLEOS push action $A transfer "[\"$N1\",\"$O1\",42,10,1,\"$P1\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [a-zA-Z0-9 :+-]*|uniqueness constraint|executed transaction: [a-f0-9]+'

echo "[7] tables:"
$CLEOS get table $A $A commitments 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  commitments: "+r.length+" rows — amounts "+r.map(x=>x.amount).join(",")+" assets "+r.map(x=>x.asset).join(",")'
$CLEOS get table $A $A nullifiers 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  nullifiers: "+r.length+" rows (algs "+r.map(x=>x.alg).join(",")+")"'
$CLEOS get table $A $A tree 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; "  tree: next_index="+r.next_index+" (every leaf contract-appended)"'
$CLEOS get code $A 2>&1 | head -1
