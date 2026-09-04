#!/bin/bash
# tree6-check.sh — THE SIX-LEAF CANONICAL-FOLD BATTERY (founder order,
# standing forever). Inserts six known leaves through the CONTRACT's own
# incremental tree and asserts every root equals tree.js's canonical fold.
# Caught the M7 TREE LAW live (root(4+) divergence — the right branch's
# filled[i] update); any future tree change must pass 6/6 before ship.
# Usage: bash tree6-check.sh <fresh-account-name>   (chars a-z 1-5 only!)
set -e
U=http://127.0.0.1:8888
W=~/plonkport
T="$(cd "$(dirname "$0")" && pwd)"
A=${1:?usage: tree6-check.sh <fresh-account>}
export NODE_PATH=/home/travi/plonkport/node_modules
C="/usr/bin/cleos -u $U"
$C wallet unlock --name bnrzk --password "$(cat $W/bnrzk.pw)" >/dev/null 2>&1 || true
BENCH_PUB=$(awk '{print $2}' /tmp/nd/bench.key)
$C create account eosio $A "$BENCH_PUB" >/dev/null 2>&1 || true
sleep 1
$C set code $A $W/treedbg.wasm >/dev/null 2>&1
$C set abi $A $W/treedbg.abi >/dev/null 2>&1
sleep 1
PASS=0
for I in 1 2 3 4 5 6; do
  LHEX=$(node -pe "BigInt($I).toString(16).padStart(64,'0')")
  $C push action $A ins "[\"$LHEX\"]" -p $A >/dev/null 2>&1
  sleep 1
  CH=$($C get table $A $A st 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).rows[0].root);});")
  WANT=$(node -e "
(async () => {
  const { buildTree } = require('$T/tree.js');
  const tree = await buildTree();
  const v = BigInt(tree.rootOf(['1','2','3','4','5','6'].slice(0, $I)));
  const b = []; for (let i = 31; i >= 0; --i) b.push(Number(v >> BigInt(8*i) & 255n));
  console.log(b.map(x => x.toString(16).padStart(2, '0')).join(''));
})();")
  if [ "$CH" = "$WANT" ]; then PASS=$((PASS+1)); else echo "insert-$I DIVERGE (chain=$CH canon=$WANT)"; fi
done
echo "six-leaf canonical-fold battery: $PASS/6"
[ "$PASS" = "6" ] || exit 1
