#!/usr/bin/env bash
# run-tests.sh — off-production gate-semantics battery.
# Builds a THROWAWAY copy of the gate (bind 127.0.0.1:8095, upstream = local
# mocks, own test keys.json) and proves four things about the front path:
#   T1 auth          — keyless → 401 before upstream is ever touched
#   T2 cancellation  — client abort mid-generation does NOT close the gate's
#                      upstream socket (cancellation is swallowed)
#   T3 containment   — wedged upstream: the gate neither times out nor
#                      refuses; the request hangs for the full client budget
#                      and the upstream socket stays open after the client left
#   T4 readiness     — with a key, /health proxies green from a server whose
#                      /slots hangs (false-ready through the front path)
# The production gate (172.18.0.1:8091) and llama-server are never touched.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
R="$D/gate-semantics-receipt.log"
PORT=8095; UPA=8096; UPB=8097
say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }; faild() { say "FAIL $*"; FAILED=1; }
FAILED=0; mkdir -p "$D/run"
cleanup() { pkill -f 'gate-test\.js' 2>/dev/null; pkill -f "mock-upstream.*$UPA" 2>/dev/null; pkill -f "mock-upstream.*$UPB" 2>/dev/null; sleep 1; }
trap cleanup EXIT

say "=== gate-semantics battery (throwaway gate :$PORT) ==="
# throwaway gate: patched copy — never the production file
sed -e "s|const UPSTREAM_HOST = '172.18.0.1';|const UPSTREAM_HOST = '127.0.0.1';|" \
    -e "s|const UPSTREAM_PORT = 8090;|const UPSTREAM_PORT = process.env.UP_PORT;|" \
    -e "s|const KEYS = '/opt/buzz-meter/keys.json';|const KEYS = process.env.TEST_KEYS;|" \
    -e "s|const ACCESS_LOG = '/opt/buzz-meter/logs/gate-access.log';|const ACCESS_LOG = process.env.TEST_LOG;|" \
    -e "s|server.listen(8091, '172.18.0.1'|server.listen($PORT, '127.0.0.1'|" \
    /opt/buzz-meter/gate.js > "$D/run/gate-test.js"
echo '{"keys":[{"id":"test-key-1","secret":"test-secret-1","tier":"free","balance_A":0,"revoked":false}]}' > "$D/run/keys.json"
: > "$D/run/gate.log"

# T1+T4 ride mock A (wedge); T2 rides mock B (slowgen)
node "$D/mock-upstream.js" $UPA A "$D/run/lifeA.log" & node "$D/mock-upstream.js" $UPB B "$D/run/lifeB.log" &
sleep 1
UP_PORT=$UPB TEST_KEYS="$D/run/keys.json" TEST_LOG="$D/run/gate.log" LLAMA_KEY=dummy node "$D/run/gate-test.js" > "$D/run/gate-stdout.log" 2>&1 &
GATE=$!
sleep 1

# T1: keyless → 401, upstream untouched
C=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$PORT/health" 2>/dev/null)
[ "$C" = 401 ] && pass "T1 keyless request 401 at the gate (auth before upstream)" || faild "T1 expected 401 got $C"
grep -q '/health' "$D/run/lifeB.log" && faild "T1 upstream saw the keyless request" || pass "T1 upstream never saw it"

# T2: client aborts mid-generation (mock B streams ~3s) — does the gate close upstream?
: > "$D/run/lifeB.log"
curl -s -m 1 -X POST "http://127.0.0.1:$PORT/v1/chat/completions" -H 'authorization: Bearer test-secret-1' -H 'content-type: application/json' -d '{"x":1}' >/dev/null 2>&1
sleep 4
if grep -q 'conn CLOSED' "$D/run/lifeB.log"; then
  pass "T2 gate DID close the upstream socket after client abort (cancellation propagates)"
else
  say "T2 FINDING: gate did NOT close upstream after client abort (cancellation swallowed — generation runs to completion for a departed client)"
fi

# T3+T4: switch the throwaway gate to the wedge mock
kill $GATE 2>/dev/null; wait $GATE 2>/dev/null; sleep 1
UP_PORT=$UPA TEST_KEYS="$D/run/keys.json" TEST_LOG="$D/run/gate.log" LLAMA_KEY=dummy node "$D/run/gate-test.js" >> "$D/run/gate-stdout.log" 2>&1 &
GATE=$!
sleep 1

# T3: wedged upstream — client budget 8s; what does the gate do?
: > "$D/run/lifeA.log"
T0=$(date +%s)
C=$(curl -s -o /dev/null -w '%{http_code}' -m 8 -X POST "http://127.0.0.1:$PORT/v1/chat/completions" -H 'authorization: Bearer test-secret-1' -H 'content-type: application/json' -d '{"x":1}' 2>/dev/null || echo client-timeout)
T1=$(( $(date +%s) - T0 ))
sleep 3
if [ "$C" = "client-timeout" ] && [ "$T1" -ge 8 ]; then
  pass "T3 wedged upstream: gate held the request the full ${T1}s client budget — NO timeout, NO refusal (containment absent)"
else
  say "T3 FINDING: gate verdict=$C after ${T1}s (some bound exists?)"
fi
if grep -q 'conn CLOSED' "$D/run/lifeA.log"; then
  pass "T3 gate released the upstream socket after the client left"
else
  say "T3 FINDING: upstream socket still open ~${T1}s+ after client departed (wedged slot held indefinitely through the gate)"
fi

# T4: with a key, /health through the gate from a server whose /slots hangs
C=$(curl -s -o /dev/null -w '%{http_code}' -m 3 -H 'authorization: Bearer test-secret-1' "http://127.0.0.1:$PORT/health" 2>/dev/null)
S=$(curl -s -o /dev/null -w '%{http_code}' -m 3 -H 'authorization: Bearer test-secret-1' "http://127.0.0.1:$PORT/slots" 2>/dev/null || echo hang)
[ "$C" = 200 ] && [ "$S" != 200 ] && pass "T4 false-ready through the front path: keyed /health=200 while /slots=$S hangs" || say "T4 FINDING: health=$C slots=$S"

kill $GATE 2>/dev/null; wait $GATE 2>/dev/null
say "=== battery end FAILED=$FAILED ==="
exit $FAILED
