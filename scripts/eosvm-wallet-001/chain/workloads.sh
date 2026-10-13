#!/bin/bash
# workloads.sh — the identical authorized local-test workloads under one node
# runtime config; emits billed-CPU (receipt cpu_usage_us), wall time, and
# sends the state dump for cross-backend equivalence. WHERE it runs: WSL,
# AFTER deploy.sh on the booted node. Serialized by design (one node).
set -euo pipefail
source "$(dirname "$0")/env.sh"
CFG=$(cat $EOSVM_HOME/current-node)
TAG=$(echo "$CFG" | tr ' -' '__')
OUT=$REC/workloads-$TAG.tsv
{
printf 'label\tcall\tn\tcpu_p50_us\tcpu_max_us\tstatus\n' > "$OUT"

run_series() { # run_series <label> <account> <action> <json-args> [auth]
  local label=$1 acct=$2 act=$3 args=$4 auth=${5:-bench@active}
  local cpufile=/tmp/ws-cpu.txt wallfile=/tmp/ws-wall.txt status=OK
  : > $cpufile; : > $wallfile
  for i in $(seq 1 "${REPS:-21}"); do
    local t0=$(date +%s%N) j cpu
    j=$(cleos -u $U push action $acct "$act" "$args" -p $auth --json 2>/tmp/ws-err.txt) || { status="FAIL:$(head -c 120 /tmp/ws-err.txt | tr -d '\n')"; break; }
    local t1=$(date +%s%N)
    cpu=$(printf '%s' "$j" | python3 -c 'import sys,json;d=json.load(sys.stdin);p=d.get("processed",{}).get("receipt",{});print(p.get("cpu_usage_us",d.get("cpu_usage_us","")))' 2>/dev/null || true)
    echo "${cpu:-NA}" >> $cpufile; echo $(( (t1-t0)/1000000 )) >> $wallfile
  done
  local p50=$(sort -n $cpufile | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}')
  local mx=$(sort -n $cpufile | tail -1)
  local wp50=$(sort -n $wallfile | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}')
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$label" "$acct $act $args" "${REPS:-21}" "${p50:-NA}" "${mx:-NA}" "$status" | tee -a "$OUT"
  [ -n "$wp50" ] && printf '   wall_p50_ms=%s\n' "$wp50"
}

printf 'label\tcall\tn\tcpu_p50_us\tcpu_max_us\tstatus\n' > "$OUT"
# ── the workloads (identical sequence under every runtime config) ──
run_series noop        bench     noop    '[]'
run_series pair_x1     bench     pair    '[1]'
run_series pair_x10    bench     pair    '[10]'
run_series pair_x50    bench     pair    '[50]'
run_series padd_x100   bench     padd    '[100]'
run_series pmul_x50    bench     pmul    '[50]'
run_series vm_groth16  verifymin verify  '[]'
run_series vm_negative verifymin verifybad '[]'
run_series probe_spin  probe     spin    '[2000000]'
run_series db_putget   probe     put     '["1","7"]'
# note.wasm needs its own auth + args schema; guarded separately below
echo "== workload series complete: $OUT"
} 2>&1 | tee "$REC/workloads-$TAG.log"
