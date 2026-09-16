#!/usr/bin/env bash
# composite-run.sh — the END-TO-END bounded-compute lifecycle battery:
# real llama-server (plain decoding, NO MTP) :8099 under the real watchdog,
# fronted by the bounded gate :8095, observed by meter-pd --watch with a
# persisted ledger. Proves: admission → bounded execution → wedge
# detection/recovery → four-state delivery observation → payment/failure
# chain separation → ONLY COMPLETE creates billable output, across
# restart/recovery AND duplicate/replayed log input.
# Wedge injection = SIGSTOP (process alive, answers nothing) — the /health-OK
# distinction of the true #27388 wedge was established separately; the
# watchdog's probe law (/slots) detects both.
# P-C remains disabled. Everything loopback; production untouched.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
C=~/composite; rm -rf "$C"; mkdir -p "$C/pd"
R="$D/composite-receipt.log"; rm -f "$R"; say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }; faild() { say "FAIL $*"; FAILED=1; }
FAILED=0
MODEL=/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf
BIN=/opt/buzz-compute/src/build-new/bin/llama-server
G=8095; U=8099
KEY='authorization: Bearer test-secret-1'
PAY="$C/pd/receipts"; FAIL="$C/pd/receipts-failure"; EVID="$C/pd/evidence"; STREAM="$C/pd/state.jsonl"
npay() { ls "$PAY" 2>/dev/null | wc -l; }; nfail() { ls "$FAIL" 2>/dev/null | wc -l; }; nevid() { ls "$EVID" 2>/dev/null | wc -l; }
cleanup() { pkill -f 'meter-pd\.py' 2>/dev/null; pkill -f 'gate-bounded\.js' 2>/dev/null; pkill -f 'slots-watchdog\.sh' 2>/dev/null; pkill -f 'alias comp-test' 2>/dev/null; sleep 1; }
trap cleanup EXIT

say "=== composite battery: real llama + watchdog + bounded gate + meter-pd ==="
cat > "$C/start-llama.sh" <<SH
#!/usr/bin/env bash
exec $BIN --model $MODEL --alias comp-test --host 127.0.0.1 --port $U \
  --threads 2 --threads-batch 2 --ctx-size 8192 --parallel 1 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 -fa on >> $C/llama.log 2>&1
SH
chmod +x "$C/start-llama.sh"; : > "$C/llama.log"; : > "$C/gate.log"
echo '{"keys":[{"id":"test-key-1","secret":"test-secret-1","tier":"free","balance_A":0,"revoked":false}]}' > "$C/keys.json"

# the three staged components, wired exactly as designed
bash "$D/../watchdog/slots-watchdog.sh" --url "http://127.0.0.1:$U/slots" --timeout 2 --interval 3 \
  --max-fails 2 --stop-grace 8 --start-grace 150 --start-cmd "$C/start-llama.sh" --log "$C/wd.log" &
UP_HOST=127.0.0.1 UP_PORT=$U TEST_KEYS="$C/keys.json" TEST_LOG="$C/gate.log" LLAMA_KEY=dummy \
LISTEN_HOST=127.0.0.1 LISTEN_PORT=$G BOUND_HEADER_MS=12000 BOUND_IDLE_MS=6000 BOUND_PERKEY=1 BOUND_QUEUE=2 \
READY_TTL_MS=3000 READY_PROBE_MS=300 node "$D/../gate-bounded/gate-bounded.js" > "$C/gate-stdout.log" 2>&1 &
PD_ROOT="$C/pd" PD_LLAMA_LOG="$C/llama.log" PD_GATE_LOG="$C/gate.log" WEDGE_SILENCE_S=25 \
PD_SCRIPT_DIR="$D/../meter-pd" python3 "$D/../meter-pd/meter-pd.py" --watch > "$C/meter-stdout.log" 2>&1 &
METER=$!
say "components up (watchdog + gate + meter-pd); waiting for llama readiness…"

i=0; until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://127.0.0.1:$G/readiness" 2>/dev/null)" = 200 ] || [ $i -ge 90 ]; do sleep 2; i=$((i+2)); done
[ $i -lt 90 ] && pass "C0 admission path ready: gate /readiness 200 after ${i}s (llama loaded, /slots probed)" || { faild "C0 llama never became ready"; exit 1; }

# E1 normal completion through the full path
OUT=$(curl -s -m 60 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say the word bee."}],"max_tokens":24,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
echo "$OUT" | grep -q '"content"' && pass "E1 completion through gate+llama" || faild "E1 no content"
sleep 12
[ "$(npay)" = 1 ] && pass "E1 meter emitted EXACTLY 1 payment receipt (COMPLETE)" || faild "E1 payment receipts=$(npay)"

# E2 gate-fronted early departure (P-C disabled: server finishes anyway)
curl -s -m 2 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Write a long calm essay about rivers."}],"max_tokens":60,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' >/dev/null 2>&1
grep -q 'client-departed' "$C/gate.log" && pass "E2 client departure logged at the gate" || faild "E2 no client-departed verdict"
sleep 22
[ "$(npay)" = 2 ] && pass "E2 generation completed SERVER-SIDE for the departed client (P-C absent) -> 2nd COMPLETE receipt (honest: the compute happened)" || faild "E2 payment receipts=$(npay)"

# E2b DIRECT aborted generation (bypasses the gate, as box-side clients do)
curl -s -m 2 -X POST "http://127.0.0.1:$U/v1/chat/completions" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Count slowly to one hundred."}],"max_tokens":60,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' >/dev/null 2>&1
sleep 12
python3 - "$EVID" <<'PY' && pass "E2b direct abort -> PARTIAL/CANCELLED evidence, billing:null, n_tokens observed" || faild "E2b partial evidence wrong"
import json,sys,glob,os
parts=[json.load(open(f)) for f in glob.glob(os.path.join(sys.argv[1],"*.json"))]
p=[x for x in parts if x["state"]=="PARTIAL/CANCELLED"]
assert len(p)==1 and p[0]["billing"] is None and p[0]["observed"]["n_tokens_at_stop"] and "line_items" not in p[0], parts
PY

# E3 wedge: in-flight generation + SIGSTOP -> idle-cut 504 + watchdog recovery + WEDGED sweep
curl -s -m 30 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Write another essay, longer."}],"max_tokens":60,"stream":true,"chat_template_kwargs":{"enable_thinking":false}}' >/dev/null 2>&1 &
EF=$!
sleep 4
LP=$(pgrep -f 'alias comp-test' | head -1); kill -STOP "$LP" && say "E3 SIGSTOP injected (pid $LP) mid-generation"
sleep 12
grep -q 'stream-idle-cut' "$C/gate.log" && pass "E3 in-flight request bounded: idle-cut 504 (FAILED/TIMEOUT)" || faild "E3 no idle-cut"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hi"}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
[ "$CODE" = 503 ] && pass "E3 admission during wedge: 503 not-ready (bounded, not queued)" || faild "E3 expected 503 got $CODE"
sleep 25
grep -q 'WEDGE-DETECTED' "$C/wd.log" && pass "E3 watchdog detected the wedge via /slots" || faild "E3 no WEDGE-DETECTED"
grep -q 'SIGKILL' "$C/wd.log" && pass "E3 TERM-ignored (stopped) -> SIGKILL escalation -> respawn" || say "E3 note: $(grep 'stop:' "$C/wd.log" | tail -1)"
kill -CONT "$LP" 2>/dev/null || true
say "E3 waiting for respawn + readiness (model reload)…"
i=0; until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://127.0.0.1:$G/readiness" 2>/dev/null)" = 200 ] || [ $i -ge 100 ]; do sleep 3; i=$((i+3)); done
[ $i -lt 100 ] && pass "E3 RECOVERY: llama respawned, gate /readiness 200 after ~${i}s" || faild "E3 no recovery"
python3 - "$FAIL" <<'PY' && pass "E3 cross-source corroboration: gate 504 FAILED/TIMEOUT + meter UNKNOWN/WEDGED for the same event" || faild "E3 failure records wrong"
import json,sys,glob,os
f=[json.load(open(x)) for x in glob.glob(os.path.join(sys.argv[1],"*.json"))]
ft=[x for x in f if x["state"]=="FAILED/TIMEOUT"]; wg=[x for x in f if x["state"]=="UNKNOWN/WEDGED"]
assert any(x["detail"].get("phase")=="stream-idle-cut" for x in ft), f
assert any(x["source"]=="meter-wedge-detector" for x in wg), f
PY

# E4a post-recovery completion
OUT=$(curl -s -m 60 -X POST "http://127.0.0.1:$G/v1/chat/completions" -H "$KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say the word hive."}],"max_tokens":24,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
echo "$OUT" | grep -q '"content"' && pass "E4a post-recovery completion through the full path" || faild "E4a no content"
sleep 12
[ "$(npay)" = 3 ] && pass "E4a exactly 3 payment receipts (one per true COMPLETE, across the restart)" || faild "E4a payment receipts=$(npay)"

# E4b REPLAY the entire log through the parser with the persisted ledger
B4=$( { npay; nfail; nevid; } | tr '\n' ' ')
python3 - "$C" "$D" <<'PY' && pass "E4b REPLAY of the full log: ZERO new artifacts (write-once ledger holds)" || faild "E4b replay created artifacts"
import json,os,sys,glob
C,D=sys.argv[1],sys.argv[2]
os.environ["PD_ROOT"]=os.path.join(C,"pd")
import importlib.util
spec=importlib.util.spec_from_file_location("mpd", os.path.join(D,"..","meter-pd","meter-pd.py"))
mpd=importlib.util.module_from_spec(spec); spec.loader.exec_module(mpd)
led=json.load(open(os.path.join(C,"pd","state","tasks-ledger.json")))
seen=set(led["complete"])
text=open(os.path.join(C,"llama.log"),errors="replace").read()
before=(len(os.listdir(mpd.RECEIPTS)),len(os.listdir(mpd.FAILURES)),len(os.listdir(mpd.EVIDENCE)))
mpd.parse_delivery(text, mpd.meter.load_rate_set(), "test-key", seen, led)
after=(len(os.listdir(mpd.RECEIPTS)),len(os.listdir(mpd.FAILURES)),len(os.listdir(mpd.EVIDENCE)))
assert before==after, (before,after)
PY
# E4c meter RESTART with the same PD_ROOT: no duplicates
kill $METER 2>/dev/null; wait $METER 2>/dev/null
PD_ROOT="$C/pd" PD_LLAMA_LOG="$C/llama.log" PD_GATE_LOG="$C/gate.log" WEDGE_SILENCE_S=25 \
PD_SCRIPT_DIR="$D/../meter-pd" python3 "$D/../meter-pd/meter-pd.py" --watch >> "$C/meter-stdout.log" 2>&1 &
METER=$!
sleep 12
A4=$( { npay; nfail; nevid; } | tr '\n' ' ')
[ "$B4" = "$A4" ] && pass "E4c meter restart (persisted ledger+offsets): no duplicate artifacts" || faild "E4c before=($B4) after=($A4)"

# FINAL AUDIT: only COMPLETE is billable; chains separate; four states present
python3 - "$C/pd" <<'PY' && pass "FINAL AUDIT: zero billable shapes outside the payment chain; tips differ; all four states present" || faild "FINAL AUDIT failed"
import json,os,sys,glob
root=sys.argv[1]
bad=[f for f in glob.glob(os.path.join(root,"receipts-failure","*.json"))+glob.glob(os.path.join(root,"evidence","*.json"))
     if "line_items" in open(f).read() or "total_computed" in open(f).read()]
assert not bad, bad
a=open(os.path.join(root,"state","receipt-chain-tip")).read()
b=open(os.path.join(root,"state","failure-chain-tip")).read()
assert a!=b
states={json.loads(l)["state"] for l in open(os.path.join(root,"state.jsonl"))}
assert states=={"COMPLETE","PARTIAL/CANCELLED","FAILED/TIMEOUT","UNKNOWN/WEDGED"}, states
PY
say "=== composite battery end FAILED=$FAILED ==="
say "artifacts: payment=$(npay) failure=$(nfail) evidence=$(nevid) — P-C never fired upstream destroys only via bounds/watchdog"
exit $FAILED
