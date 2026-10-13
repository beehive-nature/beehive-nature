#!/bin/bash
# ocreplay.sh — Spring #1880 probe: "eos-vm-oc-enable replay issue" (OPEN
# 2025-12-10): full replay crashes unless eos-vm-oc-enable=none. Bounded local
# approximation: build a small chain under oc=all, then --replay-blockchain
# under oc=all (case) and oc=none (control). NOT their full-sync replay —
# scope stated in the dispatch.
# WHERE it runs: WSL. Serialized.
set -uo pipefail
source "$(dirname "$0")/env.sh"
OUT=$REC/ocreplay.log
{
echo "══ #1880 oc replay probe $(date -u +%FT%TZ)"

run_case() { # run_case <oc> -> replay outcome
  local OC=$1
  echo "── case oc=$OC"
  bash "$LANE/chain/boot.sh" eos-vm-jit "$OC" >/dev/null 2>&1 || { echo "boot FAIL"; return; }
  bash "$LANE/chain/deploy.sh" >/dev/null 2>&1 || echo "deploy issues (see deploy log)"
  for i in $(seq 1 150); do cleos -u $U push action probe spin '[200000]' -p probe@active >/dev/null 2>&1; done
  for i in $(seq 1 50);  do cleos -u $U push action probe put "[\"$i\",\"$i\"]" -p probe@active >/dev/null 2>&1; done
  H1=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
  echo "chain built: $H1"
  pkill -x nodeos; sleep 3
  ND=$EOSVM_HOME/nd-eos-vm-jit-oc$OC
  timeout 300 nodeos -e -p eosio \
    --plugin eosio::chain_api_plugin --plugin eosio::producer_plugin --plugin eosio::http_plugin \
    --http-server-address=127.0.0.1:8889 --wasm-runtime eos-vm-jit --eos-vm-oc-enable "$OC" \
    --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 TESTNET-ONLY PUBLIC-CONSTANT (the documented Spring dev producer key) \
    --data-dir "$ND/data" --config-dir "$ND/config" --replay-blockchain > "$ND/replay.log" 2>&1
  RC=$?
  echo "replay exit=$RC"
  tail -4 "$ND/replay.log"
  grep -ciE "segfault|crash|abort|fatal" "$ND/replay.log" || true
  echo "── case oc=$OC verdict: exit $RC $( [ $RC -eq 0 ] && echo REPLAY-OK || echo REPLAY-PROBLEM )"
}

run_case none
run_case all
echo "══ #1880 probe complete"
} 2>&1 | tee "$OUT"
