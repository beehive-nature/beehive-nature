#!/bin/bash
# readonly.sh — Spring #1882 probe: "Multiple read-only trx running on
# eos-vm" (OPEN 2025-12-29). The referenced fix (Wire-Network/eos-vm#7,
# MERGED): many long read-only trxs share one executable memory space; two
# expiring timers race, one thread's kill re-marks the space executable, the
# other trx runs forever. Spring v1.2.2 predates that fix — try to reproduce
# with N concurrent long read-only transactions.
# WHERE it runs: WSL, AFTER deploy.sh.
set -uo pipefail
source "$(dirname "$0")/env.sh"
OUT=$REC/readonly-$(cat $EOSVM_HOME/current-node | tr ' -' '__').log
{
echo "══ #1882 read-only stress $(date -u +%FT%TZ)"
nodeos --help 2>/dev/null | grep -iE "read-only" | head -8 || echo "no read-only options in --help"

# read-only trxs go through /v1/chain/send_read_only_transaction
INFO=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}')
EXP=$(date -u -d "+60 seconds" +%Y-%m-%dT%H:%MS)
spin_trx() {
cat <<EOF
{"transaction":{"expiration":"$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%S)","ref_block_num":1,"ref_block_prefix":1,"max_net_usage_words":0,"max_cpu_usage_ms":0,"delay_sec":0,"context_free_actions":[],"actions":[{"account":"probe","name":"spin","authorization":[],"data":"$(printf '80c3b180' )"}],"transaction_extensions":[]}}
EOF
}
# spin(0x20202020 = 538976288 iterations ~ seconds-minutes of wasm loop)
DATA=$(python3 - <<'PY'
import struct, json
n = 538976288
data = struct.pack('<Q', n).hex()  # varint actually; spin takes uint32 — CDT ABI varint
# CDT varint encoding of uint32:
out = ''
v = n
while True:
    b = v & 0x7f
    v >>= 7
    if v: out += '%02x' % (b | 0x80)
    else: out += '%02x' % b; break
print(json.dumps({"transaction": {"expiration": __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'), "ref_block_num": 0, "ref_block_prefix": 0, "max_net_usage_words": 0, "max_cpu_usage_ms": 0, "delay_sec": 0, "context_free_actions": [], "actions": [{"account": "probe", "name": "spin", "authorization": [], "data": out}], "transaction_extensions": []}}))
PY
)
echo "read-only trx body: ${DATA:0:200}..."

fire() { curl -sS -m 60 -X POST $U/v1/chain/send_read_only_transaction -d "$DATA" 2>&1 | head -c 300; echo; }

echo "-- single read-only control"
fire

echo "-- 8 concurrent long read-only trxs"
for i in $(seq 1 8); do ( fire > /tmp/ro-$i.txt 2>&1; echo "ro-$i done $(date +%s%N)" >> /tmp/ro-done.txt ) & done
T0=$(date +%s)
# watch the read-only pool: if any trx never terminates, subsequent read-only
# calls stall well past their budget
sleep 90
ls /tmp/ro-done.txt 2>/dev/null && wc -l < /tmp/ro-done.txt || echo "0 of 8 completed in 90s"
rm -f /tmp/ro-done.txt
echo "-- after-burst health"
time fire
H=$(curl -sS -m 3 -X POST $U/v1/chain/get_info -d '{}' | grep -oE 'head_block_num":[0-9]+')
echo "head after burst: $H"
ps -o pid,etime,pcpu,comm -C nodeos | head -3
echo "══ #1882 probe complete"
} 2>&1 | tee "$OUT"
