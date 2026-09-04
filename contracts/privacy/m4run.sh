#!/bin/bash
# m4run.sh — the M4 acceptance pass (SPEC-PRIVACY-1, the port). One clean run,
# echo everything, modeled on m3final.sh. Steps:
#   wallet/account/deploy → init → deposit → PRIVATE TRANSFER (real PLONK
#   proof) → FORGED proof (must reject) → REPLAY (must reject as DOUBLE-SPEND)
#   → WITHDRAW (real proof #2, tag=2) → tables + law row.
U=http://127.0.0.1:8888
W=~/plonkport
REPO=/mnt/c/Users/travi/beehive-nature/contracts/privacy
A=${A:-plonknote11}
CLEOS="/usr/bin/cleos -u $U"

echo "[0] wallet + account"
$CLEOS wallet list 2>/dev/null | grep -q bnrzk || $CLEOS wallet create --name bnrzk --file $W/bnrzk.pw >/dev/null
$CLEOS wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 >/dev/null 2>&1 || true
BENCH_PRIV=$(awk '{print $1}' /tmp/nd/bench.key)
$CLEOS wallet import --name bnrzk --private-key "$BENCH_PRIV" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)
$CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
echo "[1] deploy"
echo "  code: $($CLEOS set code $A $W/note.wasm 2>&1 | grep -c 'executed transaction')  abi: $($CLEOS set abi $A $W/note.abi 2>&1 | grep -c 'executed transaction')"
sleep 1
echo "[2] init: $($CLEOS push action $A init '[1000,1000]' -p $A 2>&1 | grep -c 'executed transaction')"

# deposit artifacts (M3 flow unchanged: keccak deposit commitment)
node -e "
const crypto=require('crypto');
const K=b=>crypto.createHash('sha3-256').update(b).digest('hex');
const sk=crypto.randomBytes(32), amt=1000;
const c=K(Buffer.concat([sk,Buffer.from(amt.toString(16).padStart(16,'0'),'hex')]));
require('fs').writeFileSync('$W/m4dep.json', JSON.stringify({c}));
console.log('  deposit commitment:', c.slice(0,16)+'…');
"
DEPC=$(node -pe "JSON.parse(require('fs').readFileSync('$W/m4dep.json')).c")
echo "[3] deposit:"
$CLEOS push action $A deposit "[\"$DEPC\",305419896,1000]" -p $A 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+|assertion failure with message: [^"]*'

CD1=$(node -pe "require('$W/calldata.json')")
CD2=$(node -pe "require('$W/calldata2.json')")
CDF=$(node -pe "require('$W/calldata_forged.json')")
NUL1=$(node -pe "require('$W/calldata.json').pubs_hex.slice(64)")
CMT=$(node -pe "require('$W/calldata.json').pubs_hex.slice(0,64)")
NUL2=$(node -pe "require('$W/calldata2.json').pubs_hex.slice(64)")
P1=$(node -pe "require('$W/calldata.json').proof_hex")
P2=$(node -pe "require('$W/calldata2.json').proof_hex")
PF=$(node -pe "require('$W/calldata_forged.json').proof_hex")
TO_C=$(node -pe "require('crypto').randomBytes(32).toString('hex')")

echo "[4] PRIVATE TRANSFER (real circuit-backed PLONK proof):"
R=$($CLEOS push action $A transfer "[\"$NUL1\",\"$TO_C\",42,990,10,\"$CMT\",\"$P1\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|Error[^"]*'; fi

echo "[5] FORGED (eval_zw tampered +1):"
$CLEOS push action $A transfer "[\"$NUL1\",\"$TO_C\",42,990,10,\"$CMT\",\"$PF\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[6] REPLAY (same proof, same nullifier):"
$CLEOS push action $A transfer "[\"$NUL1\",\"$TO_C\",42,990,10,\"$CMT\",\"$P1\"]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|executed transaction: [a-f0-9]+'

echo "[7] WITHDRAW (real proof #2, tag=2 nullifier):"
R=$($CLEOS push action $A withdraw "[\"$NUL2\",\"kingbeelovis\",980,10,\"$CMT\",\"$P2\"]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|Error[^"]*'; fi

echo "[8] law + sets:"
$CLEOS get table $A $A law 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  law: alg_commit="+r[0].alg_commit+" alg_proof="+r[0].alg_proof+" (2 = ALG_PROOF_PLONK_V1)"'
$CLEOS get table $A $A nullifiers 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  nullifiers: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")'
$CLEOS get table $A $A commitments 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  commitments: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")'
echo "[9] code hash:"
$CLEOS get code $A 2>&1 | head -1
