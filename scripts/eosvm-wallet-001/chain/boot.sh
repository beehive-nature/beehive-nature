#!/bin/bash
# boot.sh — (re)boot the local Spring v1.2.2 dev node under one runtime
# configuration. WHERE it runs: WSL.
#   boot.sh <runtime> <oc> [genesis]   runtime: eos-vm|eos-vm-jit  oc: none|all|auto
# genesis: path to a genesis json (default: this lane's genesis-all.json,
# which pre-activates PREACTIVATE_FEATURE + CRYPTO_PRIMITIVES +
# BLS_PRIMITIVES2 + GET_BLOCK_NUM at genesis — the zkbench lane's boot2.sh
# recipe, extended; fresh Spring dev chains activate NOTHING by default and
# even the v1.2.2 stock bios is refused with "env.bls_pairing unresolveable"
# without it — receipted).
set -euo pipefail
RT="${1:-eos-vm-jit}"; OC="${2:-none}"; GEN="${3:-$(dirname "$0")/genesis-all.json}"
case "$RT" in eos-vm|eos-vm-jit) ;; *) echo "bad runtime $RT"; exit 1;; esac
case "$OC" in none|all|auto) ;; *) echo "bad oc $OC"; exit 1;; esac
source "$(dirname "$0")/env.sh"

ND=$EOSVM_HOME/nd-$RT-oc$OC
pkill -x nodeos 2>/dev/null || true; sleep 2
rm -rf "$ND"; mkdir -p "$ND/data" "$ND/config"

nohup nodeos -e -p eosio \
  --plugin eosio::chain_api_plugin --plugin eosio::producer_plugin \
  --plugin eosio::http_plugin \
  --access-control-allow-origin='*' --http-validate-host=false \
  --http-server-address=127.0.0.1:8888 \
  --wasm-runtime "$RT" --eos-vm-oc-enable "$OC" \
  --genesis-json "$GEN" --genesis-timestamp "$(date -u +%Y-%m-%dT%H:%M:%S.000)" \
  --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 TESTNET-ONLY PUBLIC-CONSTANT (the documented Spring dev producer key) \
  --data-dir "$ND/data" --config-dir "$ND/config" > "$ND/nodeos.log" 2>&1 &

for i in $(seq 1 30); do
  sleep 1
  H=$(curl -sS -m 2 -X POST $U/v1/chain/get_info -d '{}' 2>/dev/null | grep -oE 'head_block_num":[0-9]+' | cut -d: -f2 || true)
  [ -n "$H" ] && [ "$H" -gt 2 ] && { echo "BOOTED $RT oc=$OC head=$H"; echo "$RT oc=$OC" > "$EOSVM_HOME/current-node"; exit 0; }
done
echo "FAILED TO BOOT $RT oc=$OC"; tail -5 "$ND/nodeos.log"; exit 1
