#!/bin/bash
# m3final.sh — the M3 receipt, ONE clean pass, no pipefail, echo everything.
U=http://127.0.0.1:8888
ZK=/tmp/zk
J=/mnt/c/Users/travi/zkbench/m3-values.json
G() { node -pe "JSON.parse(require('fs').readFileSync('$J')).$1"; }
C1=$(G commitment); T1=$(G viewtag); N1=$(G nullifier)
C2=$(G commitment2); T2=$(G viewtag2); N2=$(G nullifier2)
cleos wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
A=noteacct4

echo "[1] create + deploy"
cleos -u $U create account eosio $A "$(awk '{print $2}' /tmp/nd/bench.key)" 2>&1 | grep -oE 'executed transaction|already exists' | head -1
sleep 1
echo "  code: $(cleos -u $U set code $A $ZK/note.wasm 2>&1 | grep -c 'executed transaction')"
echo "  abi:  $(cleos -u $U set abi $A $ZK/note.abi 2>&1 | grep -c 'executed transaction')"
sleep 1
echo "[2] init: $(cleos -u $U push action $A init '[1000,1000]' -p $A 2>&1 | grep -c 'executed transaction')"
echo "[3] deposit:"
cleos -u $U push action $A deposit "[\"$C1\",$T1,1000]" -p $A 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+ +[0-9]+ bytes +[0-9]+ us|assertion failure with message: [^"]*|uniqueness constraint'
echo "[4] PRIVATE TRANSFER:"
R=$(cleos -u $U push action $A transfer "[\"$N1\",\"$C2\",$T2,990,10]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|uniqueness constraint'; fi
echo "[5] FORGED (replay N1):"
cleos -u $U push action $A transfer "[\"$N1\",\"$C2\",$T2,990,10]" -p $A 2>&1 | grep -m1 -oE 'assertion failure with message: [^"]*|DOUBLE-SPEND|uniqueness constraint|executed transaction'
echo "[6] WITHDRAW (N2 → kingbeelovis):"
R=$(cleos -u $U push action $A withdraw "[\"$N2\",\"kingbeelovis\",980,10]" -p $A 2>&1)
TID=$(echo "$R" | grep -oE 'executed transaction: [a-f0-9]+' | head -1 | awk '{print $3}')
if [ -n "$TID" ]; then sleep 1; bash /mnt/c/Users/travi/zkbench/find2.sh "${TID:0:16}" 40; else echo "$R" | grep -m1 -oE 'assertion failure with message: [^"]*|uniqueness constraint'; fi
echo "[7] sets:"
cleos -u $U get table $A $A commitments 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  commitments: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")'
cleos -u $U get table $A $A nullifiers 2>/dev/null | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)).rows; "  nullifiers: "+r.length+" rows, algs "+r.map(x=>x.alg).join(",")'
