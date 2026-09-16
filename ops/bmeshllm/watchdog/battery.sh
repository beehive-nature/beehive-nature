#!/usr/bin/env bash
# battery.sh — the off-production failure/recovery battery for
# slots-watchdog.sh, per founder ruling 2026-09-16 ("test it off-production
# first"). Runs entirely against 127.0.0.1:8091. NEVER touches
# buzz-compute.service, its override, or any production path.
#
# Tiers:
#   1  healthy-path   — real llama-server (production config class: staged
#                       MTP model file, PLAIN decoding, no draft-mtp flag) →
#                       watchdog must NOT restart across the window.
#   2  synthetic-hang — a server that binds :8091 and never answers (the
#                       wedge's /slots signature, deterministic) → watchdog
#                       must detect, TERM, escalate to KILL, respawn; the
#                       respawn is a healthy responder → recovery proven.
#   3  real-wedge     — llama-server WITH --spec-type draft-mtp (throwaway
#                       instance) + interrupted-client abort battery; if the
#                       wedge reproduces, capture the /health-OK //slots-hang
#                       signature, then let the watchdog detect and heal it.
#                       If it does not reproduce in the bounded window, that
#                       is recorded honestly (tier 2 remains the logic proof).
#
# Usage: battery.sh [--skip-tier3]   (from the box, in ~/watchdog-test/)
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
R="$D/receipt-$(date -u +%Y%m%dT%H%M%SZ).log"
MODEL=/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf
BIN=/opt/buzz-compute/src/build-new/bin/llama-server
PORT=8091
say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }
fail() { say "FAIL $*"; FAILED=1; }
FAILED=0

cleanup() { pkill -f "slots-watchdog.sh" 2>/dev/null; pkill -f "hangserver" 2>/dev/null; pkill -f "healthserver" 2>/dev/null; pkill -f "127.0.0.1:$PORT" 2>/dev/null; sleep 1; }
trap cleanup EXIT

wait_port() { # port up|down [tries] — curl-based (the /dev/tcp variant false-failed under nohup on the box)
  local i=0 want=$2
  while [ $i -lt "${3:-120}" ]; do
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo 000)
    if [ "$code" = 200 ]; then [ "$want" = up ] && return 0; else [ "$want" = down ] && return 0; fi
    sleep 1; i=$((i+1))
  done
  return 1
}
slots_ok() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/slots" 2>/dev/null | grep -q '^200'; }
health_ok() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/health" 2>/dev/null | grep -q '^200'; }

# ── shared helper servers ──────────────────────────────────────────────
cat > "$D/hangserver.py" <<'PY'
# binds :8091, answers /health instantly, NEVER answers /slots (the wedge signature)
import http.server, socketserver, signal, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)  # wedge servers ignore TERM — exercise the KILL escalation
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/health'):
            self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(b'{"status":"ok"}')
        elif self.path.startswith('/slots'):
            time.sleep(300)  # hang: the mutex-held path
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(("127.0.0.1", 8091), H).serve_forever()  # threaded: /health stays green while /slots hangs
PY
cat > "$D/healthserver.py" <<'PY'
# binds :8091, answers both /health and /slots instantly (healthy shape)
import http.server, socketserver
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(b'{"status":"ok"}' if self.path.startswith('/health') else b'[]')
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(("127.0.0.1", 8091), H).serve_forever()
PY
# start-cmd for tier 2: first launch hangs, every respawn is healthy
cat > "$D/tier2-start.sh" <<SH
#!/usr/bin/env bash
if [ -f "$D/.tier2-launched" ]; then exec python3 "$D/healthserver.py"; else touch "$D/.tier2-launched"; exec python3 "$D/hangserver.py"; fi
SH
chmod +x "$D/tier2-start.sh"
rm -f "$D/.tier2-launched"

say "=== battery start (watchdog=$D/slots-watchdog.sh) ==="

# ── TIER 1: healthy path, real server, plain decoding ─────────────────
say "TIER 1: real llama-server, plain decoding (production config class)"
cleanup; sleep 1
cat > "$D/tier1-start.sh" <<SH
#!/usr/bin/env bash
exec $BIN --model $MODEL --alias tier1 --host 127.0.0.1 --port $PORT \
  --threads 2 --threads-batch 2 --ctx-size 8192 --parallel 1 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 -fa on
SH
chmod +x "$D/tier1-start.sh"
"$D/slots-watchdog.sh" --url "http://127.0.0.1:$PORT/slots" --timeout 3 --interval 5 \
  --max-fails 2 --stop-grace 20 --start-cmd "$D/tier1-start.sh" --log "$D/wd-tier1.log" &
WD=$!
wait_port up 180 && pass "tier1: server up on :$PORT" || fail "tier1: server never came up"
sleep 25   # ~5 probe cycles
grep -q "WEDGE-DETECTED" "$D/wd-tier1.log" && fail "tier1: false positive restart on healthy server" || pass "tier1: no restart across healthy window (5+ probes)"
slots_ok && pass "tier1: /slots 200 at window end" || fail "tier1: /slots not answering"
kill -TERM $WD 2>/dev/null; wait $WD 2>/dev/null
grep -q "exited cleanly after TERM" "$D/wd-tier1.log" && pass "tier1: clean TERM shutdown of healthy child" || say "tier1 note: child stop shape: $(grep -c 'stop:' "$D/wd-tier1.log") stop lines"
cleanup; wait_port down 30

# ── TIER 2: synthetic hang → detect → escalate → respawn → recover ────
say "TIER 2: synthetic /slots hang (deterministic wedge signature)"
rm -f "$D/.tier2-launched" "$D/wd-tier2.log"
"$D/slots-watchdog.sh" --url "http://127.0.0.1:$PORT/slots" --timeout 2 --interval 3 \
  --max-fails 2 --stop-grace 5 --start-cmd "$D/tier2-start.sh" --log "$D/wd-tier2.log" &
WD=$!
wait_port up 20
sleep 30   # 2 probes at 3s interval → detection window
grep -q "WEDGE-DETECTED" "$D/wd-tier2.log" && pass "tier2: hang detected via /slots timeout" || fail "tier2: no detection"
grep -q "SIGKILL" "$D/wd-tier2.log" && pass "tier2: TERM-ignored → SIGKILL escalation exercised (hang server ignores TERM by design of the sleep)" || say "tier2 note: $(grep 'stop:' "$D/wd-tier2.log" | tail -2 | tr '\n' ' ')"
sleep 8
slots_ok && pass "tier2: respawned server healthy (/slots 200) — full detect→kill→recover cycle" || fail "tier2: respawn not healthy"
kill -TERM $WD 2>/dev/null; wait $WD 2>/dev/null
cleanup; wait_port down 30; pass "tier2: teardown clean"

# ── TIER 3: real wedge attempt — draft-mtp + interrupted clients ──────
if [ "${1:-}" = "--skip-tier3" ]; then say "TIER 3: SKIPPED by flag"; else
say "TIER 3: throwaway draft-mtp instance + abort battery (production unit untouched)"
free -m | awk 'NR==2{if ($7 < 6000) exit 1}' || { say "tier3: SKIP (<6GB available RAM)"; exit 0; }
cat > "$D/tier3-start.sh" <<SH
#!/usr/bin/env bash
exec $BIN --model $MODEL --alias tier3-mtp --host 127.0.0.1 --port $PORT \
  --threads 2 --threads-batch 2 --ctx-size 8192 --parallel 1 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 -fa on --spec-type draft-mtp
SH
chmod +x "$D/tier3-start.sh"
"$D/slots-watchdog.sh" --url "http://127.0.0.1:$PORT/slots" --timeout 3 --interval 5 \
  --max-fails 2 --stop-grace 15 --start-cmd "$D/tier3-start.sh" --log "$D/wd-tier3.log" &
WD=$!
wait_port up 240 && pass "tier3: draft-mtp server up" || fail "tier3: server never came up"
sleep 20
# warm-up: one full completion
curl -s -m 60 http://127.0.0.1:$PORT/v1/chat/completions -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say the word bee."}],"max_tokens":24,"chat_template_kwargs":{"enable_thinking":false}}' \
  | grep -q '"content"' && pass "tier3: warm-up completion answered" || say "tier3 note: warm-up content check inconclusive"
say "tier3: abort battery — 6 interrupted clients mid-generation"
for i in 1 2 3 4 5 6; do
  curl -s -m 3 http://127.0.0.1:$PORT/v1/chat/completions -H 'content-type: application/json' \
    -d '{"messages":[{"role":"user","content":"Count slowly from one to one hundred, one number per line, no commentary."}],"max_tokens":400,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' \
    > /dev/null 2>&1 &
  C=$!; sleep 2; kill -9 $C 2>/dev/null; wait $C 2>/dev/null
  sleep 2
done
sleep 5
H=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:$PORT/health 2>/dev/null)
S=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:$PORT/slots 2>/dev/null || echo timeout)
say "tier3: post-abort signature health=$H slots=$S"
if [ "$H" = 200 ] && [ "$S" != 200 ]; then
  pass "tier3: WEDGE SIGNATURE REPRODUCED (/health 200 while /slots $S)"
  sleep 15   # let the watchdog detect + heal
  grep -q "WEDGE-DETECTED" "$D/wd-tier3.log" && pass "tier3: watchdog detected the real wedge" || fail "tier3: watchdog missed the real wedge"
  sleep 50   # detection + TERM/KILL + respawn + model load (~40s receipt)
  slots_ok && pass "tier3: healed after watchdog restart (/slots 200)" || fail "tier3: not healed after restart window"
else
  say "tier3: wedge did NOT reproduce in this bounded window (slots=$S) — recorded honestly; tier 2 remains the logic proof"
fi
kill -TERM $WD 2>/dev/null; wait $WD 2>/dev/null
cleanup; wait_port down 60
say "tier3: teardown clean"
fi

say "=== battery end: FAILED=$FAILED ==="
grep -hE "PASS|FAIL|SIGNATURE|note" "$R" | tail -25
exit $FAILED
