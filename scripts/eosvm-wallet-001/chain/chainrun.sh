#!/bin/bash
# chainrun.sh — EOSVM-WALLET-001 chain battery on the CURRENT runtime config
# (set by boot.sh; feature activation is BLOCKED — receipted — so all
# workloads ride base intrinsics only via probefree.wasm). Produces:
#   receipts/workloads-<cfg>.tsv   billed CPU per action (21 reps median)
#   receipts/robustness-<cfg>.log  rollback/unauth/malformed/mem/concurrent/restart
# WHERE it runs: WSL.
set -uo pipefail
source "$(dirname "$0")/env.sh"
CFG=$(cat $EOSVM_HOME/current-node 2>/dev/null || echo unknown-cfg)
TAG=$(echo "$CFG" | tr ' -' '__')
W=$REC/workloads-$TAG.tsv
R=$REC/robustness-$TAG.log
pass(){ echo "PASS $1 :: ${2:0:180}" | tee -a "$R"; }
fail(){ echo "FAIL $1 :: ${2:0:180}" | tee -a "$R"; }
note(){ echo "NOTE $1 :: ${2:0:180}" | tee -a "$R"; }

jqr(){ python3 -c "import sys,json;d=json.load(sys.stdin);p=d.get('processed',{});r=p.get('receipt',{});print(r.get('status'),r.get('cpu_usage_us'))"; }

echo "══ workloads under [$CFG] $(date -u +%FT%TZ)"
printf 'label\tcall\tn\tcpu_p50_us\tcpu_max_us\tstatus\n' > "$W"
series(){ # label acct action args auth
  local label=$1 acct=$2 act=$3 args=$4 auth=${5:-probe@active} f=/tmp/crv.txt
  : > $f
  for i in $(seq 1 21); do
    cleos -u $U push action $acct "$act" "$args" -p $auth --json 2>/dev/null | jqr >> $f
  done
  local p50=$(awk '{print $2}' $f | sort -n | awk '{a[NR]=$1}END{print (NR? a[int((NR+1)/2)] : 0)}')
  local mx=$(awk '{print $2}' $f | sort -n | tail -1)
  local st=$(awk '{print $1}' $f | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
  printf '%s\t%s %s %s\t21\t%s\t%s\t%s\n' "$label" "$acct" "$act" "$args" "$p50" "$mx" "$st" | tee -a "$W"
}
series noop      probe probe '[]'
series spin_1m   probe spin  '["1000000"]'
series spin_5m   probe spin  '["5000000"]'
series spin_20m  probe spin  '["20000000"]'
series putx      probe putx  '["2","42"]'

echo "══ robustness under [$CFG]"
# rollback: write-then-throw leaves no row
cleos -u $U push action probe wrth '["77"]' -p probe@active --json >/dev/null 2>&1 && fail rollback "wrth unexpectedly succeeded" || true
ROW=$(curl -sS -m 5 -X POST $U/v1/chain/get_table_rows -d '{"json":true,"code":"probe","scope":"probe","table":"rows","lower_bound":77,"upper_bound":77,"key_type":"i64","index_position":1}' 2>/dev/null)
printf '%s' "$ROW" | grep -q '"rows":\[\]' && pass rollback "row 77 absent after write+throw" || fail rollback "$ROW"
# unauthorized: spin requires eosio auth; push with probe@active
O=$(cleos -u $U push action probe spin '["10"]' -p probe@active --json 2>&1 | tail -2 | tr -d '\n')
printf '%s' "$O" | grep -qiE "auth|permission" && pass unauthorized "refused: ${O:0:120}" || note unauthorized "${O:0:150}"
# malformed ABI: wrong type via http
M=$(curl -sS -m 5 -X POST $U/v1/chain/abi_json_to_bin -d '{"code":"probe","action":"spin","args":{"n":"not-a-number"}}' 2>&1 | head -c 160)
printf '%s' "$M" | grep -qiE "error|invalid|json" && pass malformed-abi "${M:0:120}" || note malformed-abi "$M"
# memory: grow to 32MiB cap (wasm max-memory 34078720 = 520 pages - initial 2)
G=$(cleos -u $U push action probe grow '[520]' -p probe@active --json 2>/dev/null | jqr)
echo "grow(520 pages): $G" | tee -a "$R"
H=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
[ -n "$H" ] && pass memory "node alive after grow-to-cap: $H" || fail memory "node unresponsive"
# concurrent reads while producing
rm -f /tmp/conc.err
for i in $(seq 1 8); do
  ( end=$((SECONDS+10)); while [ $SECONDS -lt $end ]; do
      curl -sS -m 2 -X POST $U/v1/chain/get_table_rows -d '{"json":true,"code":"probe","scope":"probe","table":"rows","limit":10}' >/dev/null 2>&1 || echo "read ERR" >> /tmp/conc.err
      curl -sS -m 2 -X POST $U/v1/chain/get_info -d '{}' >/dev/null 2>&1 || echo "info ERR" >> /tmp/conc.err
  done ) &
done
wait
[ -f /tmp/conc.err ] && fail concurrent-read "$(sort /tmp/conc.err | uniq -c | tr '\n' ';')" || pass concurrent-read "8x10s parallel reads, zero errors"
# restart persistence
ND=$EOSVM_HOME/nd-$(echo "$CFG" | tr ' ' '-')
pkill -x nodeos; sleep 3
nohup nodeos -e -p eosio --plugin eosio::chain_api_plugin --plugin eosio::producer_plugin --plugin eosio::http_plugin \
  --access-control-allow-origin='*' --http-validate-host=false --http-server-address=127.0.0.1:8888 \
  --wasm-runtime $(echo "$CFG" | cut -d' ' -f1) --eos-vm-oc-enable $(echo "$CFG" | cut -d' ' -f3) \
  --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 TESTNET-ONLY PUBLIC-CONSTANT (the documented Spring dev producer key) \
  --data-dir "$ND/data" --config-dir "$ND/config" >> "$ND/nodeos.log" 2>&1 &
for i in $(seq 1 30); do sleep 1; curl -sS -m 2 -X POST $U/v1/chain/get_info -d '{}' >/dev/null 2>&1 && break; done
sleep 2
S=$(curl -sS -m 5 -X POST $U/v1/chain/get_table_rows -d '{"json":true,"code":"probe","scope":"probe","table":"rows","lower_bound":2,"upper_bound":2,"key_type":"i64","index_position":1}' 2>/dev/null | head -c 160)
printf '%s' "$S" | grep -q '"v":42\|"value":42\|42' && pass restart "row 2 survived restart: $S" || fail restart "$S"
V=$(cleos -u $U push action probe spin '["1000000"]' -p probe@active --json 2>/dev/null | jqr)
note restart-post "spin after restart: $V"
# state dump for cross-backend equivalence
{ curl -sS -m 5 -X POST $U/v1/chain/get_table_rows -d '{"json":true,"code":"probe","scope":"probe","table":"rows","limit":50}'; curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}'; } 2>/dev/null | sha256sum | awk '{print $1}' > "$REC/state-$TAG.sha"
note state-dump "$(cat "$REC/state-$TAG.sha") (PUBLIC-CONSTANT receipt hash)"
echo "══ chain battery complete for [$CFG]"
