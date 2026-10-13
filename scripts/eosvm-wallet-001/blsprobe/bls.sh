#!/bin/bash
# bls.sh — the BLS12-381 runtime reconciliation (EOSVM-WALLET-001), freestanding
# probe edition (CDT's own linker spins on this box — receipted; the probe is
# built with clang-21 wasm32 + a hand ABI):
#  1. FRESH node, bios only. set code blsprobe2 BEFORE activation -> expected
#     "unresolved import" refusal (the ACTIVATION REQUIREMENT receipt)
#  2. activate BLS_PRIMITIVES2 (v1.2.2 registry digest c0cce5bc…)
#  3. set code again -> ok; push action probe -> EXECUTED iff bls_g1_add
#     returned 0 AND the 96-byte result equals ffjavascript's 2*G1 (baked in
#     at build time by gen_bls.c.js) — the full correctness cross-check
#  4. control: 47-byte malformed input would fail via raw(); (kept CDT-free:
#     the freestanding probe exposes action "probe" only; malformed-input
#     refusal is covered at the engine level + Spring's own check_valid)
# WHERE it runs: WSL. Reboots the node fresh — run AFTER other chain work.
set -uo pipefail
source "$(dirname "$0")/../chain/env.sh"
OUT=$REC/bls.log
B=$LANE/blsprobe
{
echo "══ BLS12-381 runtime reconciliation (freestanding probe) $(date -u +%FT%TZ)"
bash "$LANE/chain/boot.sh" eos-vm-jit none >/dev/null 2>&1
Z=$EOSVM_HOME/zkbench
cleos -u $U set contract eosio $Z eosio.bios.wasm eosio.bios.abi -p eosio@active >/dev/null 2>&1
cleos -u $U create account eosio blsprobe2 EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV >/dev/null 2>&1

cat > /tmp/bls_abi.json << 'EOF'
{"version":"eosio::abi/1.1","types":[],"structs":[{"name":"probe","base":"","fields":[]}],"actions":[{"name":"probe","type":"probe","ricardian_contract":""}],"tables":[],"variants":[],"abi_extensions":[]}
EOF

echo "── 1. set code BEFORE activation (expect unresolved-import refusal)"
cleos -u $U set code blsprobe2 -p blsprobe2@active $B/blsprobe_free.wasm 2>&1 | tail -4

echo "── 2. activate BLS_PRIMITIVES2"
cleos -u $U push action eosio activate '["c0cce5bcd8ea19a28d9e12eafda65ebe6d0e0177e280d4f20c7ad66dcd9e011b PUBLIC-CONSTANT"]' -p eosio@active 2>&1 | tail -2

echo "── 3. set code AFTER activation + probe (EXECUTED == bls_g1_add == ffjavascript 2G1)"
cleos -u $U set code blsprobe2 -p blsprobe2@active $B/blsprobe_free.wasm 2>&1 | tail -2
cleos -u $U set abi blsprobe2 -p blsprobe2@active /tmp/bls_abi.json 2>&1 | tail -1
P=$(cleos -u $U push action blsprobe2 probe '[]' -p blsprobe2@active --json 2>&1)
printf '%s' "$P" | python3 -c 'import sys,json
s=sys.stdin.read()
try:
  d=json.loads(s); p=d.get("processed",{}); r=p.get("receipt",{})
  print("probe executed:", r.get("status"), "cpu_usage_us:", r.get("cpu_usage_us"))
except Exception:
  print("probe RAW:", s[:400])'
H=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
echo "node alive: $H"
echo "══ complete"
} 2>&1 | tee "$OUT"
