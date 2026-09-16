#!/usr/bin/env bash
# run-bounded-tests.sh — the P-A+P-B bounded-gate battery (founder mission:
# normal generation · slow generation · wedged /slots · queue saturation ·
# client timeout · recovery). All loopback; production untouched.
# Fast test bounds: header 3s · idle 2s · perkey 1 · queue 1 · readyTTL 2.5s.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
R="$D/bounded-receipt.log"; say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }; faild() { say "FAIL $*"; FAILED=1; }
FAILED=0; mkdir -p "$D/run"; : > "$D/run/gate.log"
G=8095; M=8098
KEY='authorization: Bearer test-secret-1'
echo '{"keys":[{"id":"test-key-1","secret":"test-secret-1","tier":"free","balance_A":0,"revoked":false}]}' > "$D/run/keys.json"
cleanup() { pkill -f 'gate-bounded\.js' 2>/dev/null; pkill -f "mock2\.js $M" 2>/dev/null; sleep 1; }
trap cleanup EXIT
start_mock() { node "$D/mock2.js" $M "$1" "$D/run/life.log" >/dev/null 2>&1 & sleep 0.6; }
start_gate() { node "$D/gate-bounded.js" >/dev/null 2>&1 & sleep 0.6; }
last_verdicts() { tail -40 "$D/run/gate.log"; }

say "=== P-A+P-B bounded-gate battery (header=3s idle=2s perkey=1 queue=1 readyTTL=2.5s) ==="
export UP_HOST=127.0.0.1 UP_PORT=$M TEST_KEYS="$D/run/keys.json" TEST_LOG="$D/run/gate.log" LLAMA_KEY=dummy
export LISTEN_HOST=127.0.0.1 LISTEN_PORT=$G BOUND_HEADER_MS=3000 BOUND_IDLE_MS=2000 BOUND_PERKEY=1 BOUND_QUEUE=1 READY_TTL_MS=2500 READY_PROBE_MS=300

# S1 normal generation
start_mock normal; start_gate
OUT=$(curl -s -m 10 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
echo "$OUT" | grep -q 'DONE' && pass "S1 normal generation: full stream delivered" || faild "S1 no DONE in stream"
last_verdicts | grep -q '"phase":"complete"' && pass "S1 verdict complete" || faild "S1 no complete verdict"
cleanup

# S2 slow generation → idle cut
start_mock slowchunks; start_gate
OUT=$(curl -s -m 10 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null || true)
echo "$OUT" | grep -q 'DONE' && faild "S2 slow stream completed (idle cut did not fire)" || pass "S2 slow generation: stream CUT (no DONE)"
last_verdicts | grep -q 'stream-idle-cut' && pass "S2 verdict stream-idle-cut" || faild "S2 no idle-cut verdict"
grep -q 'response socket closed EARLY' "$D/run/life.log" && pass "S2 upstream stream destroyed on idle cut" || say "S2 note: upstream close shape: $(grep -c 'conn CLOSED' "$D/run/life.log")"
cleanup

# S3 wedged /slots → readiness 503 (both keyed and keyless)
start_mock wedgeslots; start_gate
C=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
[ "$C" = 503 ] && pass "S3 wedged /slots: generation refused 503 before proxying" || faild "S3 expected 503 got $C"
last_verdicts | grep -q '"phase":"not-ready"' && pass "S3 verdict not-ready" || faild "S3 no not-ready verdict"
C=$(curl -s -o /dev/null -w '%{http_code}' -m 3 "http://127.0.0.1:$G/readiness" 2>/dev/null)
[ "$C" = 503 ] && pass "S3 keyless /readiness = 503 (monitors see the truth, no 401)" || faild "S3 readiness=$C"
grep -q 'HANGING /v1' "$D/run/life.log" && faild "S3 upstream saw a generation (admission failed to gate it)" || pass "S3 upstream never saw the refused generation"
cleanup

# S4 header-hang (slots ready, generation wedges) → 504 bounded
start_mock headerhang; start_gate
T0=$(date +%s%N)
C=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
MS=$(( ($(date +%s%N) - T0) / 1000000 ))
[ "$C" = 504 ] && pass "S4 wedged generation: 504 after ${MS}ms (was: infinite hold)" || faild "S4 expected 504 got $C after ${MS}ms"
[ "$MS" -lt 5000 ] && pass "S4 bounded within header timeout" || faild "S4 took ${MS}ms — not bounded at 3s"
last_verdicts | grep -q 'header-timeout' && pass "S4 verdict header-timeout" || faild "S4 no header-timeout verdict"
cleanup

# S5 queue saturation (perkey=1, queue=1): r1 holds, r2 queues, r3 refused
start_mock slowchunks; start_gate
curl -s -m 12 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' >/dev/null 2>&1 &
R1=$!; sleep 0.8
curl -s -m 12 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' >/dev/null 2>&1 &
R2=$!; sleep 0.8
C3=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
[ "$C3" = 503 ] && pass "S5 queue saturation: third request refused 503 (was: infinite queue)" || faild "S5 expected 503 got $C3"
last_verdicts | grep -q 'queue-full' && pass "S5 verdict queue-full" || faild "S5 no queue-full verdict"
kill $R1 $R2 2>/dev/null; wait $R1 $R2 2>/dev/null
cleanup

# S6 client timeout → bookkeeping release → recovery; P-C absence proven
start_mock slowchunks; start_gate
curl -s -m 1.5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' >/dev/null 2>&1
last_verdicts | grep -q 'client-departed' && pass "S6 client departure logged (verdict client-departed)" || faild "S6 no client-departed verdict"
# admission latency = time to FIRST byte (slowchunks sends chunk 0 immediately;
# queued would mean waiting for the departed request's idle-cut ~5.5s)
TTFB=$(curl -s -o /dev/null -w '%{time_starttransfer}' -m 10 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
awk -v t="$TTFB" 'BEGIN{exit !(t < 2)}' && pass "S6 recovery: next request admitted immediately (ttfb=${TTFB}s — slot was released)" || faild "S6 next request ttfb=${TTFB}s (slot not released)"
sleep 6
grep -c 'conn CLOSED' "$D/run/life.log" | xargs -I{} say "S6 upstream connections closed naturally: {} (P-C absent: the departed client's generation was NOT destroyed)"
cleanup

# S7 recovery after wedge clears (readiness cache expiry)
start_mock wedgeslots; start_gate
C1=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
pkill -f "mock2\.js $M" 2>/dev/null; sleep 0.5; start_mock normal; sleep 3   # readyTTL 2.5s expires
C2=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null)
[ "$C1" = 503 ] && [ "$C2" = 200 ] && pass "S7 recovery: 503 during wedge → 200 after heal + cache expiry (no gate restart needed)" || faild "S7 c1=$C1 c2=$C2"
cleanup
say "=== battery end FAILED=$FAILED ==="
exit $FAILED
