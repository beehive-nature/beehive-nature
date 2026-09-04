#!/bin/bash
# .clean-measure.sh — quiet-box M7 re-measure (clean rewrite)
U=http://127.0.0.1:8888
W=~/plonkport
T=/mnt/c/Users/travi/wt-z4/contracts/privacy
A=measureacct4
export NODE_PATH=/home/travi/plonkport/node_modules
C="/usr/bin/cleos -u $U"
$C wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)

$C create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1 || true
sleep 1
$C set code $A $W/note.wasm >/dev/null 2>&1 || true
$C set abi $A $W/note.abi >/dev/null 2>&1 || true
sleep 1
$C push action $A init '[1048576,1048576]' -p $A >/dev/null 2>&1 || true
echo "== deployed + init on $A"

rm -f tree-state.json
echo '[]' > /tmp/mirror.json

chainroot() { $C get table $A $A law 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).rows[0].root'; }
mirrorroot() { node $T/tree.js root | node -e "
const v = BigInt(require('fs').readFileSync(0).toString().trim());
const b = []; for (let i = 31; i >= 0; --i) b.push(Number(v >> BigInt(8*i) & 255n));
console.log(b.map(x => x.toString(16).padStart(2, '0')).join(''));"; }
check() { C1=$(chainroot); C2=$(mirrorroot); if [ "$C1" = "$C2" ]; then echo "  root MATCH"; else echo "  root DIVERGE"; echo "   chain=$C1"; echo "   mirro=$C2"; exit 1; fi; }
bill() { sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "$1" 60; }

for N in 1 2 3; do
  node $T/m7prep.js note 1000 $N >/dev/null
  cp m7-note.json /tmp/note-$N.json
  NDEC=$(node -pe "JSON.parse(require('fs').readFileSync('m7-note.json')).commitment")
  NHEX=$(node -pe "BigInt(JSON.parse(require('fs').readFileSync('m7-note.json')).commitment).toString(16).padStart(64,'0')")
  node $T/tree.js insert $NDEC >/dev/null
  R=$($C push action $A deposit "[\"$NHEX\",305419896,1000,$N]" -p $A 2>&1)
  TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
  echo -n "deposit-$N "; if [ -n "$TID" ]; then bill "${TID:0:16}"; else echo "PUSH FAILED"; exit 1; fi
  check
  cp /tmp/note-$N.json m7-note.json
  node $T/m7prep.js payment 990 10 $N >/dev/null
  node payment_js/generate_witness.js payment_js/payment.wasm input7.json wpm.wts >/dev/null 2>&1
  npx snarkjs plonk prove payment.zkey wpm.wts proofpm.json publicpm.json >/dev/null 2>&1
  node $T/flatten.js proofpm.json publicpm.json > calldpm.json
  NUL=$(node -pe "require('$W/calldpm.json').pubs_hex.slice(64,128)")
  OUT=$(node -pe "require('$W/calldpm.json').pubs_hex.slice(128,192)")
  P=$(node -pe "require('$W/calldpm.json').proof_hex")
  R=$($C push action $A transfer "[\"$NUL\",\"$OUT\",42,10,$N,\"$P\"]" -p $A 2>&1)
  TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
  echo -n "payment-$N "; if [ -n "$TID" ]; then bill "${TID:0:16}"; else echo "PUSH FAILED: $(echo "$R" | grep -m1 -oE 'assertion failure with message: [a-zA-Z0-9 :+-]*')"; exit 1; fi
  node $T/tree.js insert $(node -pe "require('$W/calldpm.json').pubs_dec[2]") >/dev/null
  check
done
echo "== ALL GREEN"
