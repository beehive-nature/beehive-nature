#!/bin/bash
# zkrchain.sh — the on-chain accept-path receipt (EOSVM-WALLET-001): the
# VERBATIM zkrcount contract (contracts/zkreceipts/zkrcount.cpp, built by
# CDT 4.1.1) verifying the FRESH count proof through nodeos's OWN native
# crypto intrinsics — the authoritative curve/pairing implementation, not
# any harness host function.
#   1. init + anchor(seq,root,kind,count) from calldata_dead
#   2. verify(seq, proof)               -> EXECUTED (proof accepted on-chain)
#   3. anchor + FORGED proof            -> "count proof REJECTED"
#   4. mutated-count anchor + real proof -> REJECTED
# WHERE it runs: WSL, after deploy.sh on the booted node.
set -uo pipefail
source "$(dirname "$0")/env.sh"
OUT=$REC/zkrchain-$(cat $EOSVM_HOME/current-node | tr ' -' '__').log
{
echo "══ zkrcount on-chain accept-path $(date -u +%FT%TZ)"

python3 - << 'PY'
import json
d = json.load(open('/home/travi/plonkport/calldata_dead.json'))
f = json.load(open('/home/travi/plonkport/calldata_forged.json'))
pubs = bytes.fromhex(d['pubs_hex'])
root   = [x for x in pubs[:32]]
kind   = int.from_bytes(pubs[32:64], 'big') % (2**64)
count  = int.from_bytes(pubs[64:96], 'big') % (2**64)
proof  = [x for x in bytes.fromhex(d['proof_hex'])]
forged = [x for x in bytes.fromhex(f['proof_hex'])]
print(f"root={pubs[:32].hex()} kind={kind} count={count}")
json.dump([1, root, kind, count],          open('/tmp/zkr_anchor1.json','w'))
json.dump([1, proof],                      open('/tmp/zkr_verify1.json','w'))
json.dump([2, root, kind, count],          open('/tmp/zkr_anchor2.json','w'))
json.dump([2, forged],                     open('/tmp/zkr_verify2.json','w'))
json.dump([3, root, kind, count + 1],      open('/tmp/zkr_anchor3.json','w'))
json.dump([3, proof],                      open('/tmp/zkr_verify3.json','w'))
PY

cleos -u $U create account eosio zkrcount EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV >/dev/null 2>&1 || true
cleos -u $U set code zkrcount -p zkrcount@active /home/travi/plonkport/zkrcount.wasm 2>&1 | tail -1
cleos -u $U set abi zkrcount /home/travi/plonkport/zkrcount.abi -p zkrcount@active 2>&1 | tail -1

cleos -u $U push action zkrcount init '[1000]' -p zkrcount@active 2>&1 | tail -1
cleos -u $U push action zkrcount anchor "$(cat /tmp/zkr_anchor1.json)" -p zkrcount@active 2>&1 | tail -1

echo "── 2. the REAL proof (expect EXECUTED)"
V1=$(cleos -u $U push action zkrcount verify "$(cat /tmp/zkr_verify1.json)" -p zkrcount@active --json 2>&1)
printf '%s' "$V1" | python3 -c 'import sys,json
s=sys.stdin.read()
try:
  d=json.loads(s); p=d.get("processed",{}); r=p.get("receipt",{})
  print("REAL-PROOF executed:", r.get("status"), "cpu_usage_us:", r.get("cpu_usage_us"))
except Exception:
  print("REAL-PROOF RAW:", s[:400])'

echo "── 3. FORGED proof (expect REJECTED)"
cleos -u $U push action zkrcount anchor "$(cat /tmp/zkr_anchor2.json)" -p zkrcount@active >/dev/null 2>&1
cleos -u $U push action zkrcount verify "$(cat /tmp/zkr_verify2.json)" -p zkrcount@active 2>&1 | tail -2

echo "── 4. mutated-count anchor + REAL proof (expect REJECTED)"
cleos -u $U push action zkrcount anchor "$(cat /tmp/zkr_anchor3.json)" -p zkrcount@active >/dev/null 2>&1
cleos -u $U push action zkrcount verify "$(cat /tmp/zkr_verify3.json)" -p zkrcount@active 2>&1 | tail -2

echo "── state"
cleos -u $U get table zkrcount zkrcount anchors -l 5 2>/dev/null | head -c 700; echo
echo "══ complete"
} 2>&1 | tee "$OUT"
