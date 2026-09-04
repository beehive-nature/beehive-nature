#!/bin/bash
# m6run.sh — the M6 soundness acceptance: the contract-computed merkle root
# (no setter exists) + 64-bit range checks. Steps: init → deposit (root by
# the CONTRACT, cross-checked against tree.js) → PAYMENT against that root
# (out-note becomes a spendable leaf) → forged/replay/fee-tamper refusals →
# OVERFLOW witness refusal (off-chain, the range-check receipt) →
# PHANTOM-LEAF rejection (a root the contract never computed) → withdraw.
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/beehive-nature/contracts/privacy
A=${A:-notepay3333}
export NODE_PATH=/home/travi/plonkport/node_modules
CLEOS="/usr/bin/cleos -u $U"

$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

echo "[0] account + deploy"
$CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
echo "  code: $($CLEOS set code $A $W/note.wasm 2>&1 | grep -c 'executed transaction')  abi: $($CLEOS set abi $A $W/note.abi 2>&1 | grep -c 'executed transaction')"
sleep 1
echo "[1] init: $($CLEOS push action $A init '[1048576,1048576]' -p $A 2>&1 | grep -c 'executed transaction')"
echo "  initial root (empty tree): $($CLEOS get table $A $A law 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).rows[0].root')"

cd $W
rm -f tree-state.json
node $REPO/m5prep.js note 1000 >/dev/null
C1DEC=$(node -pe "JSON.parse(require('fs').readFileSync('m5-note.json')).commitment")
C1HEX=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m5-note.json')).commitment).toString(16).padStart(64,'0')")

echo "[2] deposit — the CONTRACT computes the root:"
R=$($CLEOS push action $A deposit "[\"$C1HEX\",305419896,1000]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
[ -n "$TID" ] && { sleep 1; echo -n "  deposit "; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; }
node $REPO/tree.js insert $C1DEC >/dev/null
# the chain DISPLAYS checksum256 T-transformed (reverse+swap-16B-halves) — compare through T
JSROOT=$(node -pe "const v=BigInt(require('child_process').execSync('node $REPO/tree.js root',{env:process.env}).toString().trim());const b=[];for(let i=31;i>=0;--i)b.push(Number(v>>BigInt(8*i)&255n));const hex=b.map(x=>x.toString(16).padStart(2,'0')).join('');const bb=Buffer.from(hex,'hex');const r=Buffer.from(bb.reverse());console.log(Buffer.concat([r.slice(16,32),r.slice(0,16)]).toString('hex'))")
echo "  contract root: $CHAINROOT"
echo "  tree.js root:  $JSROOT"
[ "$CHAINROOT" = "$JSROOT" ] && echo "  CROSS-CHECK: IDENTICAL — the contract's Poseidon agrees with circomlib's" || echo "  CROSS-CHECK FAILED"

echo "[3] THE PAYMENT (membership + conservation + range-checked, against the contract-computed root):"
node $REPO/m5prep.js payment 990 10 >/dev/null
node payment_js/generate_witness.js payment_js/payment.wasm input5.json witness5.wts >/dev/null 2>&1
npx snarkjs plonk prove payment.zkey witness5.wts proof5.json public5.json >/dev/null 2>&1
npx snarkjs plonk verify vk6.json public5.json proof5.json 2>&1 | tail -1
node $REPO/flatten.js proof5.json public5.json > calldata5.json
NUL1=$(node -pe "require('$W/calldata5.json').pubs_hex.slice(64,128)")
C2=$(node -pe "require('$W/calldata5.json').pubs_hex.slice(128,192)")
P5=$(node -pe "require('$W/calldata5.json').proof_hex")
R=$($CLEOS push action $A transfer "[\"$NUL1\",\"$C2\",42,10,\"$P5\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; echo -n "  PAYMENT "; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*'; fi
# the out-note became a leaf — cross-check root 2
C2DEC=$(node -pe "require('$W/calldata5.json').pubs_dec[2]")
node $REPO/tree.js insert $C2DEC >/dev/null
CHAINROOT2=$($CLEOS get table $A $A law 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).rows[0].root')
JSROOT2=$(node -pe "const v=BigInt(require('child_process').execSync('node $REPO/tree.js root',{env:process.env}).toString().trim());const b=[];for(let i=31;i>=0;--i)b.push(Number(v>>BigInt(8*i)&255n));const hex=b.map(x=>x.toString(16).padStart(2,'0')).join('');const bb=Buffer.from(hex,'hex');const r=Buffer.from(bb.reverse());console.log(Buffer.concat([r.slice(16,32),r.slice(0,16)]).toString('hex'))")
[ "$CHAINROOT2" = "$JSROOT2" ] && echo "  CROSS-CHECK 2 (post-payment tree): IDENTICAL" || echo "  CROSS-CHECK 2 FAILED: $CHAINROOT2 vs $JSROOT2"

echo "[4] FORGED (eval_zw +1):"
PF=$(node -e "const c=require('$W/calldata5.json');const t=Buffer.from(c.proof_hex,'hex');t[767]+=1;console.log(t.toString('hex'))")
$CLEOS push action $A transfer "[\"$NUL1\",\"$C2\",42,10,\"$PF\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[5] REPLAY:"
$CLEOS push action $A transfer "[\"$NUL1\",\"$C2\",42,10,\"$P5\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|uniqueness constraint|executed transaction: [a-f0-9]+'

echo "[6] FEE-TAMPER (claim 11, prove 10):"
$CLEOS push action $A transfer "[\"$NUL1\",\"$C2\",42,11,\"$P5\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[7] OVERFLOW (amountIn = 2^64 — conservation holds as integers, the 64-bit range check refuses):"
node -e "
const fs = require('fs');
const input = JSON.parse(fs.readFileSync('$W/input5.json'));
input.amountIn = '18446744073709551616';           // 2^64
input.amountOut = '18446744073709551606';           // 2^64 - 10
fs.writeFileSync('$W/input5-overflow.json', JSON.stringify(input));"
node payment_js/generate_witness.js payment_js/payment.wasm input5-overflow.json witness5o.wts 2>&1 | grep -m1 -oE 'Error.*|Assert.*' | head -1

echo "[8] PHANTOM-LEAF (a real commitment never deposited, proven against a root the contract never had):"
cp tree-state.json tree-state.bak
node -e "
(async () => {
  const fs = require('fs');
  const { buildPoseidonOpt } = require('circomlibjs');
  const { buildTree } = require('$REPO/tree.js');
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const tree = await buildTree();
  const secret = BigInt('777'), amount = BigInt('1000');
  const cmt = P([secret, amount]);                // a REAL note commitment — never deposited on-chain
  const leaves = tree.load(); leaves.push(cmt); tree.save(leaves);
  const idx = leaves.length - 1;
  const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
  const leafIdx = pathIndices.reduce((a,b,i)=>a+BigInt(b)*(1n<<BigInt(i)),0n);
  const input = { secret: '777', amountIn: '1000', pathElements, pathIndices,
                  secretOut: '888', amountOut: '990',
                  root, nullifier: P([secret, leafIdx]), commitmentOut: P([888n, 990n]), fee: '10' };
  fs.writeFileSync('input5-phantom.json', JSON.stringify(input));
})();" || exit 1
node payment_js/generate_witness.js payment_js/payment.wasm input5-phantom.json witness5p.wts >/dev/null 2>&1
npx snarkjs plonk prove payment.zkey witness5p.wts proof5p.json public5p.json >/dev/null 2>&1
node $REPO/flatten.js proof5p.json public5p.json > calldata5p.json
echo "  off-chain verify (honest proof for ITS root): $(npx snarkjs plonk verify vk6.json public5p.json proof5p.json 2>&1 | tail -1)"
NULP=$(node -pe "require('$W/calldata5p.json').pubs_hex.slice(64,128)")
COUTP=$(node -pe "require('$W/calldata5p.json').pubs_hex.slice(128,192)")
PP=$(node -pe "require('$W/calldata5p.json').proof_hex")
echo -n "  on-chain (a root the contract never computed — nowhere to land): "
$CLEOS push action $A transfer "[$(node -pe "JSON.stringify('$NULP')"),$(node -pe "JSON.stringify('$COUTP')"),42,10,$(node -pe "JSON.stringify('$PP')")]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [a-zA-Z0-9 :+-]*|executed transaction: [a-f0-9]+'
mv tree-state.bak tree-state.json

echo "[9] WITHDRAW the out-note (leaf 1, contract's tree):"
node -e "
(async () => {
  const fs = require('fs');
  const { buildPoseidonOpt } = require('circomlibjs');
  const { buildTree } = require('$REPO/tree.js');
  const poseidon = await buildPoseidonOpt();
  const P = vs => poseidon.F.toString(poseidon(vs));
  const tree = await buildTree();
  const prev = JSON.parse(fs.readFileSync('m5-prev.json'));
  const secret2 = BigInt(prev.secretOut), amt2 = BigInt(prev.amountOut);
  const c2 = P([secret2, amt2]);
  const leaves = tree.load();
  const idx = leaves.indexOf(c2);
  if (idx < 0) throw new Error('out-note not in tree');
  const { root, pathElements, pathIndices } = tree.proveAt(leaves, idx);
  const leafIdx = pathIndices.reduce((a,b,i)=>a+BigInt(b)*(1n<<BigInt(i)),0n);
  const input = { secret: secret2.toString(), amountIn: prev.amountOut, pathElements, pathIndices,
                  secretOut: '0', amountOut: '0', root, nullifier: P([secret2, leafIdx]),
                  commitmentOut: P([0n,0n]), fee: prev.amountOut };
  fs.writeFileSync('$W/input5w.json', JSON.stringify(input));
})();" && node payment_js/generate_witness.js payment_js/payment.wasm input5w.json witness5w.wts >/dev/null 2>&1 && npx snarkjs plonk prove payment.zkey witness5w.wts proof5w.json public5w.json >/dev/null 2>&1 && node $REPO/flatten.js proof5w.json public5w.json > calldata5w.json
NUL2=$(node -pe "require('$W/calldata5w.json').pubs_hex.slice(64,128)")
CBURN=$(node -pe "require('$W/calldata5w.json').pubs_hex.slice(128,192)")
P5W=$(node -pe "require('$W/calldata5w.json').proof_hex")
R=$($CLEOS push action $A withdraw "[\"$NUL2\",\"kingbeelovis\",990,\"$CBURN\",\"$P5W\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; echo -n "  WITHDRAW "; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*'; fi

echo "[10] tables + code:"
$CLEOS get table $A $A tree 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; "  tree: next_index="+r.next_index+" (leaves the contract appended itself)"'
$CLEOS get table $A $A law 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows[0]; "  law: alg_commit="+r.alg_commit+" alg_proof="+r.alg_proof+" root="+r.root.slice(0,16)+"…"'
$CLEOS get code $A 2>&1 | head -1
