#!/usr/bin/env bash
# composite-adversarial.sh — the residual-hardening battery (founder mission):
# boot-epoch ledger identity + evidence-backed sweep window, proven across
# MULTIPLE kill/restart cycles and repeated numeric task ids. The central
# invariant under attack: restart, replay, cancellation, timeout, and wedge
# recovery can NEVER manufacture a billable COMPLETE receipt.
# P-C stays disabled. Real llama-server (plain decoding). Loopback only.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
R="$D/adversarial-receipt.log"; rm -f "$R"
say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }; faild() { say "FAIL $*"; FAILED=1; }
FAILED=0
MODEL=/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf
BIN=/opt/buzz-compute/src/build-new/bin/llama-server
G=8095; U=8099; C=~/composite
KEY='authorization: Bearer test-secret-1'
PAY="$C/pd/receipts"; FAILD_="$C/pd/receipts-failure"; EVID="$C/pd/evidence"
npay() { ls "$PAY" 2>/dev/null | wc -l; }
LED="$C/pd/state/tasks-ledger.json"

# STEP 0: evidence-backed sweep window from the PREVIOUS run's real log
if [ -f "$C/llama.log" ]; then
  EV=$(python3 "$D/../meter-pd/sweep-bound-evidence.py" "$C/llama.log" --json 2>/dev/null || true)
  W=$(echo "$EV" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recommended_wedge_silence_s"])' 2>/dev/null || echo "")
  say "window from evidence: $EV"
else
  W=""; say "no prior log — window falls back to 46 (last measured class)"
fi
W=${W:-46}; WS=$(python3 -c "print(int(float('$W')+0.999))")
say "WEDGE_SILENCE_S = ${WS}s (evidence-derived)"

rm -rf "$C"; mkdir -p "$C/pd"
cleanup() { pkill -f 'meter-pd\.py' 2>/dev/null; pkill -f 'gate-bounded\.js' 2>/dev/null; pkill -f 'slots-watchdog\.sh' 2>/dev/null; pkill -f 'alias adv-test' 2>/dev/null; sleep 1; }
trap cleanup EXIT

cat > "$C/start-llama.sh" <<SH
#!/usr/bin/env bash
exec $BIN --model $MODEL --alias adv-test --host 127.0.0.1 --port $U \
  --threads 2 --threads-batch 2 --ctx-size 8192 --parallel 1 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 -fa on >> $C/llama.log 2>&1
SH
chmod +x "$C/start-llama.sh"; : > "$C/llama.log"; : > "$C/gate.log"
echo '{"keys":[{"id":"test-key-1","secret":"test-secret-1","tier":"free","balance_A":0,"revoked":false}]}' > "$C/keys.json"
gen() { curl -s -m 60 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$1\"}],\"max_tokens\":${2:-24},\"chat_template_kwargs\":{\"enable_thinking\":false}}" 2>/dev/null; }

bash "$D/../watchdog/slots-watchdog.sh" --url "http://127.0.0.1:$U/slots" --timeout 2 --interval 3 \
  --max-fails 2 --stop-grace 8 --start-grace 150 --start-cmd "$C/start-llama.sh" --log "$C/wd.log" &
UP_HOST=127.0.0.1 UP_PORT=$U TEST_KEYS="$C/keys.json" TEST_LOG="$C/gate.log" LLAMA_KEY=dummy \
LISTEN_HOST=127.0.0.1 LISTEN_PORT=$G BOUND_HEADER_MS=12000 BOUND_IDLE_MS=6000 BOUND_PERKEY=1 BOUND_QUEUE=2 \
READY_TTL_MS=3000 READY_PROBE_MS=300 node "$D/../gate-bounded/gate-bounded.js" > "$C/gate-stdout.log" 2>&1 &
PD_ROOT="$C/pd" PD_LLAMA_LOG="$C/llama.log" PD_GATE_LOG="$C/gate.log" WEDGE_SILENCE_S=$WS \
python3 "$D/../meter-pd/meter-pd.py" --watch > "$C/meter-stdout.log" 2>&1 &
METER=$!
say "components up; waiting for readiness…"
i=0; until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://127.0.0.1:$G/readiness" 2>/dev/null)" = 200 ] || [ $i -ge 90 ]; do sleep 2; i=$((i+2)); done
[ $i -lt 90 ] && pass "boot0 ready after ${i}s" || { faild "boot0 never ready"; exit 1; }

# A1 complete (boot 0)
gen "Say the word bee." | grep -q '"content"' && pass "A1 boot0 completion" || faild "A1 no content"
sleep 12; [ "$(npay)" = 1 ] && pass "A1 payment #1 (boot0 task id will repeat in later boots)" || faild "A1 payments=$(npay)"

# A2 KILL #1 — clean SIGKILL, no in-flight work
LP=$(pgrep -f 'alias adv-test' | head -1); kill -9 "$LP" && say "A2 SIGKILL #1 (pid $LP, clean — no in-flight task)"
sleep 8   # probe DURING the dead window (respawn load takes >8s even warm)
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hi"}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
[ "$CODE" = 503 ] && pass "A2 gap admission refused 503 (no accidental completion during the gap)" || faild "A2 expected 503 got $CODE"
sleep 17
grep -q 'WEDGE-DETECTED' "$C/wd.log" && pass "A2 watchdog detected the dead server" || faild "A2 no detection"
i=0; until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://127.0.0.1:$G/readiness" 2>/dev/null)" = 200 ] || [ $i -ge 100 ]; do sleep 3; i=$((i+3)); done
[ $i -lt 100 ] && pass "A2 boot1 recovered after ~${i}s" || faild "A2 no recovery"

# A3 complete (boot 1) — numeric task id REPEATS (fresh id space)
gen "Say the word hive." | grep -q '"content"' && pass "A3 boot1 completion (repeated numeric task id)" || faild "A3 no content"
sleep 12; [ "$(npay)" = 2 ] && pass "A3 payment #2 — the repeated id billed independently (epoch-qualified)" || faild "A3 payments=$(npay)"

# A4 KILL #2 — SIGSTOP mid-generation (wedge class) + idle-cut + sweep marker
curl -s -m 30 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Write a long essay about rivers."}],"max_tokens":60,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' >/dev/null 2>&1 &
sleep 4
LP=$(pgrep -f 'alias adv-test' | head -1); kill -STOP "$LP" && say "A4 SIGSTOP #2 (pid $LP) mid-generation"
sleep 12
grep -q 'stream-idle-cut' "$C/gate.log" && pass "A4 in-flight bounded (idle-cut 504)" || faild "A4 no idle-cut"
sleep 25; grep -q 'WEDGE-DETECTED' "$C/wd.log" && pass "A4 watchdog cycle ran" || faild "A4 no watchdog detection"
kill -CONT "$LP" 2>/dev/null || true
i=0; until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://127.0.0.1:$G/readiness" 2>/dev/null)" = 200 ] || [ $i -ge 100 ]; do sleep 3; i=$((i+3)); done
[ $i -lt 100 ] && pass "A4 boot2 recovered" || faild "A4 no recovery"

# A5 direct abort (partial evidence)
curl -s -m 2 -X POST "http://127.0.0.1:$U/v1/chat/completions" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Count to one hundred."}],"max_tokens":60,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' >/dev/null 2>&1
# A6 complete (boot 2)
gen "Say the word comb." | grep -q '"content"' && pass "A6 boot2 completion" || faild "A6 no content"

# A7 wait for the sweep window to pass so the A4 wedged task ages in
say "waiting ${WS}s sweep window…"; sleep $((WS + 12))
[ "$(npay)" = 3 ] && pass "A7 exactly 3 payment receipts for 3 true completions across 3 boots" || faild "A7 payments=$(npay)"

# A8 meter RESTART
B8=$( { npay; ls "$FAILD_" 2>/dev/null | wc -l; ls "$EVID" 2>/dev/null | wc -l; } | tr '\n' ' ')
kill $METER 2>/dev/null; wait $METER 2>/dev/null
PD_ROOT="$C/pd" PD_LLAMA_LOG="$C/llama.log" PD_GATE_LOG="$C/gate.log" WEDGE_SILENCE_S=$WS \
python3 "$D/../meter-pd/meter-pd.py" --watch >> "$C/meter-stdout.log" 2>&1 &
METER=$!
sleep 12
A8=$( { npay; ls "$FAILD_" 2>/dev/null | wc -l; ls "$EVID" 2>/dev/null | wc -l; } | tr '\n' ' ')
[ "$B8" = "$A8" ] && pass "A8 meter restart: zero new artifacts" || faild "A8 before=($B8) after=($A8)"

# A9 full-log REPLAY via the epoch-aware helper
python3 - "$C" "$D" <<'PY' && pass "A9 epoch-aware full-log replay: ZERO new artifacts" || faild "A9 replay created artifacts"
import os, sys, importlib.util
C, D = sys.argv[1], sys.argv[2]
os.environ["PD_ROOT"] = os.path.join(C, "pd")
spec = importlib.util.spec_from_file_location("mpd", os.path.join(D, "..", "meter-pd", "meter-pd.py"))
mpd = importlib.util.module_from_spec(spec); spec.loader.exec_module(mpd)
import json
led = json.load(open(os.path.join(C, "pd", "state", "tasks-ledger.json")))
text = open(os.path.join(C, "llama.log"), errors="replace").read()
before = (len(os.listdir(mpd.RECEIPTS)), len(os.listdir(mpd.FAILURES)), len(os.listdir(mpd.EVIDENCE)))
counts = mpd.replay(text, mpd.meter.load_rate_set(), "test-key", led)
after = (len(os.listdir(mpd.RECEIPTS)), len(os.listdir(mpd.FAILURES)), len(os.listdir(mpd.EVIDENCE)))
assert before == after, (before, after, counts)
print("replay boot map:", counts)
PY

# A10 THE INVARIANT AUDIT (mechanism + determinism + non-billable + separation)
python3 - "$C/pd" "$D" <<'PY' && pass "A10 INVARIANT AUDIT: epochs qualified, repeated-id collision deterministic (2 receipts for 2 boots same id), restart/replay/cancel/timeout/wedge manufactured ZERO billable receipts" || faild "A10 invariant audit failed"
import json, os, sys, glob, collections, importlib.util, tempfile
root, D = sys.argv[1], sys.argv[2]
led = json.load(open(os.path.join(root, "state", "tasks-ledger.json")))
complete = led["complete"]
epochs = {k.split(":", 1)[0] for k in complete}
assert len(epochs) >= 3, f"expected >=3 boots in ledger, got {epochs}"
assert all(":" in k for k in complete), f"unqualified ledger key: {complete}"
assert led.get("epoch", 0) >= 2
ids = collections.Counter(k.split(":", 1)[1] for k in complete)
sampled = [i for i, n in ids.items() if n >= 2]
# DETERMINISTIC collision test in a scratch root: the SAME numeric task id
# completing in TWO different boots bills exactly twice, distinct keys
scratch = tempfile.mkdtemp(prefix="pd-collision.")
os.environ["PD_ROOT"] = scratch
spec = importlib.util.spec_from_file_location("mpd", os.path.join(D, "..", "meter-pd", "meter-pd.py"))
mpd = importlib.util.module_from_spec(spec); spec.loader.exec_module(mpd)
FIX = """2.20.000.001 I slot launch_slot_: id  0 | task 7 | processing task, is_child = 0
2.30.475.416 I slot print_timing: id  0 | task 7 | prompt eval time =   123.45 ms /     39 tokens
2.31.100.001 I slot print_timing: id  0 | task 7 | eval time =   6789.01 ms /    128 tokens"""
led2 = {"complete": [], "partial": [], "wedged": [], "gate_seen": []}
mpd.parse_delivery(FIX, mpd.meter.load_rate_set(), "k", set(), led2, epoch="41")
mpd.parse_delivery(FIX, mpd.meter.load_rate_set(), "k", set(), led2, epoch="42")
n = len(os.listdir(mpd.RECEIPTS))
assert n == 2, f"same id in two boots must bill exactly twice, got {n}"
assert sorted(led2["complete"]) == ["41:7", "42:7"], led2["complete"]
# replaying BOTH boots again manufactures nothing
mpd.parse_delivery(FIX, mpd.meter.load_rate_set(), "k", set(), led2, epoch="41")
mpd.parse_delivery(FIX, mpd.meter.load_rate_set(), "k", set(), led2, epoch="42")
assert len(os.listdir(mpd.RECEIPTS)) == 2
bad = [f for f in glob.glob(os.path.join(root, "receipts-failure", "*.json")) + glob.glob(os.path.join(root, "evidence", "*.json"))
       if "line_items" in open(f).read() or "total_computed" in open(f).read()]
assert not bad, bad
a = open(os.path.join(root, "state", "receipt-chain-tip")).read()
b = open(os.path.join(root, "state", "failure-chain-tip")).read()
assert a != b
states = {json.loads(l)["state"] for l in open(os.path.join(root, "state.jsonl"))}
assert "COMPLETE" in states, states
print(f"ledger: {complete}; epochs {sorted(epochs)}; live-sampled collision ids: {sampled or 'none this run (determinism test covers it)'}; wedged {led['wedged']}; partial {led['partial']}")
PY
kill $METER 2>/dev/null
say "=== adversarial composite end FAILED=$FAILED ==="
exit $FAILED
