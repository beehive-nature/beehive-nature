#!/bin/bash
# m5run.sh — the M5 acceptance pass: ONE private PAYMENT (membership +
# conservation in one proof) on the rehearsal chain, then the refusals.
# Steps: deploy → init → deposit(Poseidon leaf) → setroot → PAYMENT →
# forged → replay → fee-tamper → withdraw(the second note, full value out
# the public leg) → tables. Model: m4run.sh.
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/beehive-nature/contracts/privacy
A=${A:-notepay1111}
export NODE_PATH=/home/travi/plonkport/node_modules
CLEOS="/usr/bin/cleos -u $U"

$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

echo "[0] account + deploy"
$CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
echo "  code: $($CLEOS set code $A $W/note.wasm 2>&1 | grep -c 'executed transaction')  abi: $($CLEOS set abi $A $W/note.abi 2>&1 | grep -c 'executed transaction')"
sleep 1
echo "[1] init(2^20, 2^20): $($CLEOS push action $A init '[1048576,1048576]' -p $A 2>&1 | grep -c 'executed transaction')"

CMT1=$(node -pe "JSON.parse(require('fs').readFileSync('$W/m5-note.json')).commitment")
ROOT1=$(node -pe "require('child_process').execSync('node $REPO/tree.js root',{cwd:'$W',env:process.env}).toString().trim()")
CMT1HEX=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('$W/m5-note.json')).commitment).toString(16).padStart(64,'0')")

echo "[2] deposit (Poseidon leaf, open on-ramp amount):"
$CLEOS push action $A deposit "[\"$CMT1HEX\",305419896,1000]" -p $A 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+|assertion failure with message: [^"]*'

echo "[3] setroot (owner rolls the tree forward — rehearsal-labeled):"
ROOT1HEX=$(node -pe "BigInt('$ROOT1').toString(16).padStart(64,'0')")
$CLEOS push action $A setroot "[\"$ROOT1HEX\"]" -p $A 2>&1 | grep -c 'executed transaction'

P5=$(node -pe "require('$W/calldata5.json').proof_hex")
PUBS5=$(node -pe "require('$W/calldata5.json').pubs_hex")
NUL1=$(node -pe "require('$W/calldata5.json').pubs_hex.slice(64,128)")
CMT2=$(node -pe "require('$W/calldata5.json').pubs_hex.slice(128,192)")
echo "  pubs check — nullifier:$NUL1 out:$CMT2 fee:$(node -pe "require('$W/calldata5.json').pubs_dec[3]")"

echo "[4] THE PRIVATE PAYMENT (membership + conservation, one proof):"
R=$($CLEOS push action $A transfer "[\"$NUL1\",\"$CMT2\",42,10,\"$P5\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|Error[^"]*'; fi

echo "[5] FORGED (eval_zw tampered +1):"
PF=$(node -e "const c=require('$W/calldata5.json');const t=Buffer.from(c.proof_hex,'hex');if(t[767]===0xff)throw new Error('edge');t[767]+=1;console.log(t.toString('hex'))")
$CLEOS push action $A transfer "[\"$NUL1\",\"$CMT2\",42,10,\"$PF\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[6] REPLAY (same proof, same nullifier):"
$CLEOS push action $A transfer "[\"$NUL1\",\"$CMT2\",42,10,\"$P5\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|uniqueness constraint|executed transaction: [a-f0-9]+'

echo "[7] FEE-TAMPER (claim fee 11, proof says 10 — publics bind):"
$CLEOS push action $A transfer "[\"$NUL1\",\"$CMT2\",42,11,\"$P5\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[8] WITHDRAW the second note (value out the public fee leg):"
cd $W
# insert the payment's out-note into the tree, roll the root, prove over it
C2DEC=$(node -pe "require('$W/calldata5.json').pubs_dec[2]")
node $REPO/tree.js insert $C2DEC >/dev/null
ROOT2=$(node $REPO/tree.js root)
ROOT2HEX=$(node -pe "BigInt('$ROOT2').toString(16).padStart(64,'0')")
echo "  setroot2: $($CLEOS push action $A setroot "[\"$ROOT2HEX\"]" -p $A 2>&1 | grep -c 'executed transaction')"
node -e "
(async () => {
  const fs = require('fs');
  const { buildPoseidonOpt } = require('circomlibjs');
  const { buildTree } = require('$REPO/tree.js');
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const tree = await buildTree();
  const c5 = require('$W/calldata5.json');
  const prev = JSON.parse(fs.readFileSync('$W/m5-prev.json'));
  const secret2 = BigInt(prev.secretOut), amt2 = BigInt(prev.amountOut);
  const c2 = P([secret2, amt2]);
  if (BigInt(c5.pubs_dec[2]) !== BigInt(c2)) throw new Error('out-note mismatch');
  const leaves = tree.load();
  const idx = leaves.indexOf(c2);
  if (idx < 0) throw new Error('insert the out-note first');
  const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
  const leafIdx = pathIndices.reduce((a,b,i)=>a+BigInt(b)*(1n<<BigInt(i)),0n);
  const nullifier = P([secret2, leafIdx]);
  const input = { secret: secret2.toString(), amountIn: prev.amountOut, pathElements, pathIndices,
                  secretOut: '0', amountOut: '0', root, nullifier, commitmentOut: P([0n,0n]), fee: prev.amountOut };
  fs.writeFileSync('$W/input5w.json', JSON.stringify(input));
  console.log('withdraw witness ready (out=0, fee=' + prev.amountOut + ')');
})();" || exit 1
node payment_js/generate_witness.js payment_js/payment.wasm input5w.json witness5w.wts >/dev/null 2>&1
npx snarkjs plonk prove payment.zkey witness5w.wts proof5w.json public5w.json >/dev/null 2>&1
node $REPO/flatten.js proof5w.json public5w.json > calldata5w.json
NUL2=$(node -pe "require('$W/calldata5w.json').pubs_hex.slice(64,128)")
CBURN=$(node -pe "require('$W/calldata5w.json').pubs_hex.slice(128,192)")
P5W=$(node -pe "require('$W/calldata5w.json').proof_hex")
R=$($CLEOS push action $A withdraw "[\"$NUL2\",\"kingbeelovis\",990,\"$CBURN\",\"$P5W\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|Error[^"]*'; fi

echo "[9] law + sets:"
$CLEOS get table $A $A law 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; "  law: alg_commit="+r.alg_commit+" (poseidon) alg_proof="+r.alg_proof+" root="+r.root.slice(0,16)+"…"'
$CLEOS get table $A $A nullifiers 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  nullifiers: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")'
$CLEOS get table $A $A commitments 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  commitments: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")+", amounts "+r.map(x=>x.amount).join(",")'
echo "[10] code hash:"
$CLEOS get code $A 2>&1 | head -1
