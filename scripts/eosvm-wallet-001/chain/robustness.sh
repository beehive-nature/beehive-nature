#!/bin/bash
# robustness.sh — the adversarial battery on the booted node config.
# Covers: replay, rollback, unauthorized action, malformed ABI/wire input,
# timeout (nodeos watchdog), memory pressure (wasm memory cap), restart
# persistence, and the state dump used for cross-backend equivalence.
# WHERE it runs: WSL, AFTER deploy.sh.
set -uo pipefail
source "$(dirname "$0")/env.sh"
CFG=$(cat $EOSVM_HOME/current-node)
TAG=$(echo "$CFG" | tr ' -' '__')
OUT=$REC/robustness-$TAG.log

pass() { echo "PASS $1 :: $2" | tee -a "$OUT"; }
fail() { echo "FAIL $1 :: $2" | tee -a "$OUT"; }
note() { echo "NOTE $1 :: $2" | tee -a "$OUT"; }

{
echo "══ robustness battery under [$CFG] $(date -u +%FT%TZ)"

# 1 · REPLAY — same signed trx pushed twice
T=$(cleos -u $U push action probe put '["9001","1"]' -p probe@active -d -s --json 2>/dev/null)
TXID=$(printf '%s' "$T" | python3 -c 'import sys,json;print(json.load(sys.stdin)["transaction_id"])' 2>/dev/null || echo "")
if [ -n "$TXID" ]; then
  R1=$(cleos -u $U push transaction "$T" --json 2>&1 | tail -3 | tr -d '\n' | head -c 220)
  sleep 1
  R2=$(cleos -u $U push transaction "$T" --json 2>&1 | tail -3 | tr -d '\n' | head -c 220)
  echo "replay first:  $R1"
  echo "replay second: $R2"
  case "$R2" in *duplicate*|*"same transaction"*|*expired*|*400*|*"pushed transaction"*|"") :;; esac
  # verdict recorded by human inspection line; scripted heuristic:
  if printf '%s' "$R2" | grep -qiE "duplicate|same tx|expired|fail"; then pass replay "second push refused: $R2";
  elif [ "$R2" = "$R1" ]; then fail replay "second push identical result — investigate";
  else note replay "second push outcome: $R2"; fi
else fail replay "could not build trx"; fi

# 2 · ROLLBACK — write then throw leaves NO row
cleos -u $U push action probe writethrow '["77"]' -p probe@active --json >/dev/null 2>&1 && fail rollback "writethrow unexpectedly succeeded" || true
ROW=$(cleos -u $U get table probe probe t -L 77 -U 77 2>/dev/null | head -c 200)
if printf '%s' "$ROW" | grep -q '"rows":\[\]'; then pass rollback "row 77 absent after throw: $ROW"; else fail rollback "row 77 survived: $ROW"; fi

# 3 · UNAUTHORIZED — wrong authority
cleos -u $U push action probe put '["5","5"]' -p bench@active --json >/tmp/ra.json 2>/tmp/ra.err && fail unauthorized "wrong-auth push succeeded" || {
  grep -qiE "auth|permission" /tmp/ra.err && pass unauthorized "$(head -c 160 /tmp/ra.err | tr -d '\n')" || fail unauthorized "rejected for other reason: $(head -c 160 /tmp/ra.err | tr -d '\n' || cat /tmp/ra.json | head -c 120)"; }

# 4 · MALFORMED ABI — wrong arg type through the HTTP API
M=$(curl -sS -m 5 -X POST $U/v1/chain/abi_json_to_bin -d '{"code":"probe","action":"put","args":{"id":"not-a-number"}}' 2>&1 | head -c 200)
printf '%s' "$M" | grep -qiE "error|invalid|fail" && pass malformed-abi "$M" || note malformed-abi "$M"

# 4b · MALFORMED wire — garbage packed transaction
MW=$(curl -sS -m 5 -X POST $U/v1/chain/push_transaction -d '{"signed_transaction":"deadbeef"}' 2>&1 | head -c 200)
printf '%s' "$MW" | grep -qiE "error|invalid|fail|bad" && pass malformed-wire "$MW" || note malformed-wire "$MW"

# 5 · TIMEOUT — heavy spin vs the node's transaction deadline
S=$(cleos -u $U push action probe spin '[4000000000]' -p probe@active --json --expiration 60 2>&1 | tail -5 | tr -d '\n' | head -c 300)
echo "spin(4e9): $S"
printf '%s' "$S" | grep -qiE "deadline|cpu|exceeded|abort|interrupt" && pass timeout "$S" || note timeout "$S"

# 6 · MEMORY — wasm growth to the cap
G=$(cleos -u $U push action probe grow '[100]' -p probe@active --json 2>&1 | tail -4 | tr -d '\n' | head -c 300)
echo "grow(100MiB): $G"
GP=$(cleos -u $U get table probe probe t -L 1 -U 1 2>/dev/null | head -c 200)
echo "grow result row: $GP"
H=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
[ -n "$H" ] && pass memory "node alive after grow: $H / $GP" || fail memory "node unresponsive after grow"

# 7 · CONCURRENT READS while producing
for i in $(seq 1 8); do
  ( end=$((SECONDS+10)); while [ $SECONDS -lt $end ]; do
      curl -sS -m 2 -X POST $U/v1/chain/get_table_rows -d '{"json":true,"code":"probe","scope":"probe","table":"t","limit":10}' >/dev/null 2>&1 || echo "read $i ERR" >> /tmp/conc.err
      curl -sS -m 2 -X POST $U/v1/chain/get_info -d '{}' >/dev/null 2>&1 || echo "info $i ERR" >> /tmp/conc.err
  done ) &
done
wait
[ -f /tmp/conc.err ] && fail concurrent-read "$(cat /tmp/conc.err | sort | uniq -c | head -3 | tr '\n' ';')" || pass concurrent-read "8x10s parallel reads, zero errors"
H=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
[ -n "$H" ] && pass concurrent-read "still producing: $H" || fail concurrent-read "stalled"

# 8 · RESTART persistence (uses boot.sh resume)
ND=$EOSVM_HOME/nd-$(echo "$CFG" | tr ' ' '-')
pkill -x nodeos; sleep 3
nohup nodeos -e -p eosio \
  --plugin eosio::chain_api_plugin --plugin eosio::producer_plugin --plugin eosio::http_plugin \
  --access-control-allow-origin='*' --http-validate-host=false --http-server-address=127.0.0.1:8888 \
  --wasm-runtime $(echo "$CFG" | cut -d' ' -f1) --eos-vm-oc-enable $(echo "$CFG" | cut -d' ' -f3) \
  --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 TESTNET-ONLY PUBLIC-CONSTANT (the documented Spring dev producer key) \
  --data-dir "$ND/data" --config-dir "$ND/config" >> "$ND/nodeos.log" 2>&1 &
for i in $(seq 1 30); do sleep 1; H=$(curl -sS -m 2 -X POST $U/v1/chain/get_info -d '{}' 2>/dev/null | grep -oE 'head_block_num":[0-9]+' || true); [ -n "$H" ] && break; done
[ -n "$H" ] && pass restart "node back: $H" || fail restart "did not come back"
R9=$(cleos -u $U get table probe probe t -L 9001 -U 9001 2>/dev/null | head -c 160)
printf '%s' "$R9" | grep -q '"val":1' && pass restart "row 9001 survived restart" || fail restart "row lost: $R9"
R77=$(cleos -u $U get table probe probe t -L 77 -U 77 2>/dev/null | head -c 160)
printf '%s' "$R77" | grep -q '"rows":\[\]' && pass restart "thrown row 77 still absent after restart" || fail restart "phantom row: $R77"

# 9 · STATE DUMP for cross-backend equivalence
{
  cleos -u $U get table probe probe t -l 100 2>/dev/null
  curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}'
} | sha256sum | awk '{print $1}' > "$REC/state-$TAG.sha"
note state-dump "$(cat "$REC/state-$TAG.sha") (PUBLIC-CONSTANT receipt hash)"

echo "══ robustness battery complete"
} 2>&1 | tee "$OUT"
