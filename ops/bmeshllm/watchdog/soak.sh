#!/usr/bin/env bash
# soak.sh — the real-wedge reproduction soak for the /slots watchdog.
# Off-production ONLY: standalone llama-server on 127.0.0.1:8091 with
# --spec-type draft-mtp under slots-watchdog supervision. The workload is
# the #27604 trigger shape: ONE long generation always in flight, while a
# second worker repeatedly aborts streaming clients mid-generation.
# Wedge signature = /health 200 AND /slots not-200/timeout. On detection the
# watchdog heals it; we capture heal duration and recurrence count inside a
# bounded budget (default 1200s). Production is never touched.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
PORT=8091; BUDGET=${1:-1200}
R="$D/soak-receipt-$(date -u +%Y%m%dT%H%M%SZ).log"
MODEL=/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf
BIN=/opt/buzz-compute/src/build-new/bin/llama-server
say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }

cat > "$D/soak-start.sh" <<SH
#!/usr/bin/env bash
exec $BIN --model $MODEL --alias soak-mtp --host 127.0.0.1 --port $PORT \
  --threads 2 --threads-batch 2 --ctx-size 8192 --parallel 1 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 -fa on --spec-type draft-mtp
SH
chmod +x "$D/soak-start.sh"

cleanup() { pkill -P $$ 2>/dev/null; pkill -f 'slots-watchdog.sh' 2>/dev/null; pkill -f 'alias soak-mtp' 2>/dev/null; sleep 1; }
trap cleanup EXIT

up() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/health" 2>/dev/null | grep -q 200; }

say "soak start: budget=${BUDGET}s, draft-mtp under watchdog, #27604 trigger shape"
"$D/slots-watchdog.sh" --url "http://127.0.0.1:$PORT/slots" --timeout 3 --interval 5 \
  --max-fails 2 --stop-grace 15 --start-cmd "$D/soak-start.sh" --log "$D/wd-soak.log" &
WD=$!

i=0; until up || [ $i -ge 150 ]; do sleep 2; i=$((i+2)); done
up && say "server up after ${i}s" || { say "FAIL server never came up"; exit 1; }

STOP=0; WEDGES=0; HEALS=0; WEDGE_AT=""; HEALED_AT=""
gen_body='{"messages":[{"role":"user","content":"Write a long, calm essay about rivers. Do not stop early."}],"max_tokens":400,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}'
abort_body='{"messages":[{"role":"user","content":"Count slowly from one to one hundred, one number per line."}],"max_tokens":400,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}'

# worker A: one long generation always in flight (restarts when it ends)
( while [ $STOP = 0 ]; do
    curl -s -m 300 -X POST "http://127.0.0.1:$PORT/v1/chat/completions" -H 'content-type: application/json' -d "$gen_body" >/dev/null 2>&1
    sleep 1
  done ) &
A=$!
# worker B: abort a streaming client every ~10s (mid-generation, 2s in)
( while [ $STOP = 0 ]; do
    curl -s -m 8 -X POST "http://127.0.0.1:$PORT/v1/chat/completions" -H 'content-type: application/json' -d "$abort_body" >/dev/null 2>&1 &
    C=$!; sleep 2; kill -9 $C 2>/dev/null; wait $C 2>/dev/null
    sleep 8
  done ) &
B=$!

# monitor: the signature detector (health vs slots)
START=$(date +%s)
while [ $(( $(date +%s) - START )) -lt $BUDGET ]; do
  H=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo t)
  S=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/slots" 2>/dev/null || echo t)
  if [ "$H" = 200 ] && [ "$S" != 200 ]; then
    WEDGES=$((WEDGES+1)); WEDGE_AT=$(date -u +%H:%M:%SZ)
    say "WEDGE-SIGNATURE #$WEDGES at $WEDGE_AT: health=$H slots=$S — watchdog healing (probe-log will show detection)"
    T0=$(date +%s)
    while [ $(( $(date +%s) - T0 )) -lt 240 ]; do
      if curl -s -o /dev/null -m 3 "http://127.0.0.1:$PORT/slots" 2>/dev/null; then break; fi; sleep 5
    done
    if up; then HEALS=$((HEALS+1)); HEALED_AT=$(date -u +%H:%M:%SZ); say "HEALED #$HEALS at $HEALED_AT (took $(( $(date +%s) - T0 ))s from detection)"; else say "NOT-HEALED within 240s"; fi
  fi
  sleep 10
done
STOP=1; wait $A $B 2>/dev/null

say "soak end: wedge_signatures=$WEDGES heals=$HEALS budget=${BUDGET}s"
if [ $WEDGES -eq 0 ]; then say "RESULT: wedge NOT reproduced under concurrent long-gen + abort workload in ${BUDGET}s — honest record"; else say "RESULT: wedge REPRODUCED x$WEDGES and healed x$HEALS under the watchdog"; fi
grep -cE 'WEDGE-DETECTED' "$D/wd-soak.log" | xargs -I{} say "watchdog restarts in log: {}"
kill -TERM $WD 2>/dev/null; wait $WD 2>/dev/null
say "teardown done"
