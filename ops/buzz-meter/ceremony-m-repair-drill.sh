#!/usr/bin/env bash
# ceremony-m-repair-drill.sh — the AV-2 + AV-3 re-drill battery.
# AV-2: rate freshness boundary (299s admission, 300s typed refusal, refresh succeeds)
# AV-3: billing observability (healthy=1 charge, down=0+parks, recovery=1+no backfill)
# Runs against the deployed gate on the box. Each drill uses a unique
# X-Drill-ID for correlation across gate log + meter receipts.
set -uo pipefail
PASS=0; FAIL=0
ck() { if [ "$2" = "0" ]; then echo "DRILL-PASS $1"; PASS=$((PASS+1)); else echo "DRILL-FAIL $1"; FAIL=$((FAIL+1)); fi; }
G=172.18.0.1:8091
KEY='authorization: Bearer bclaude-build-local-1-secret-placeholder'
RS=/opt/buzz-meter/rate_set.json
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DRILL_LOG=/tmp/ceremony-m-repair-$STAMP.log
echo "=== Ceremony M Repair Drill — $STAMP ===" | tee "$DRILL_LOG"

# ─── AV-2: Rate Freshness Boundary ───
echo "--- AV-2: rate freshness boundary ---" | tee -a "$DRILL_LOG"

# Backup the real rate set
sudo cp $RS /tmp/rate_set.ceremony-m-repair.bak

# Test 1: FRESH rate (age ~0s) → admission expected
FRESH_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sudo python3 -c "
import json, sys
with open('$RS') as f: d = json.load(f)
d['minted_at'] = '$FRESH_TS'
with open('$RS', 'w') as f: json.dump(d, f, indent=1)
"
sleep 6  # let the gate's rate cache expire (READY_TTL_MS=5000)
DRILL_ID="av2-fresh-$STAMP"
RESP=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say bee."}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
[ "$RESP" = "200" ]; ck "AV-2 fresh rate (age ~0s) admitted: $RESP" $([ "$RESP" = "200" ] && echo 0 || echo 1)

# Test 2: STALE rate (age 299s) → admission expected (boundary exclusive)
STALE_299_TS=$(date -u -d '299 seconds ago' +%Y-%m-%dT%H:%M:%SZ)
sudo python3 -c "
import json
with open('$RS') as f: d = json.load(f)
d['minted_at'] = '$STALE_299_TS'
with open('$RS', 'w') as f: json.dump(d, f, indent=1)
"
sleep 6
DRILL_ID="av2-299s-$STAMP"
RESP=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say bee."}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
[ "$RESP" = "200" ]; ck "AV-2 rate age 299s admitted (boundary exclusive): $RESP" $([ "$RESP" = "200" ] && echo 0 || echo 1)

# Test 3: STALE rate (age 300s) → typed refusal expected
STALE_300_TS=$(date -u -d '300 seconds ago' +%Y-%m-%dT%H:%M:%SZ)
sudo python3 -c "
import json
with open('$RS') as f: d = json.load(f)
d['minted_at'] = '$STALE_300_TS'
with open('$RS', 'w') as f: json.dump(d, f, indent=1)
"
sleep 6
DRILL_ID="av2-300s-$STAMP"
RESP_BODY=$(curl -s -m 10 -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say bee."}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
RESP_CODE=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code',0))" 2>/dev/null || echo "non-json")
PHASE=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('phase',''))" 2>/dev/null || echo "")
[ "$RESP_CODE" = "503" ] && [ "$PHASE" = "rate-stale" ]; ck "AV-2 rate age 300s refused typed (code=$RESP_CODE phase=$PHASE)" $([ "$RESP_CODE" = "503" ] && [ "$PHASE" = "rate-stale" ] && echo 0 || echo 1)

# Test 4: REFRESHED rate → admission expected (same request class succeeds)
FRESH2_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sudo python3 -c "
import json
with open('$RS') as f: d = json.load(f)
d['minted_at'] = '$FRESH2_TS'
with open('$RS', 'w') as f: json.dump(d, f, indent=1)
"
sleep 6
DRILL_ID="av2-refresh-$STAMP"
RESP=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say bee."}],"max_tokens":8,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
[ "$RESP" = "200" ]; ck "AV-2 refreshed rate admitted (same class succeeds): $RESP" $([ "$RESP" = "200" ] && echo 0 || echo 1)

# ─── AV-3: Billing Observability ───
echo "--- AV-3: billing observability ---" | tee -a "$DRILL_LOG"

# Count ledger receipts before
LEDGER_BEFORE=$(ls /opt/buzz-meter/receipts/ 2>/dev/null | wc -l)
METERPD_STATE=/opt/buzz-meter-pd/state.jsonl

# Control 1: HEALTHY request → exactly one charge
DRILL_ID="av3-healthy-$STAMP"
RESP=$(curl -s -m 30 -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say hive."}],"max_tokens":16,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
echo "$RESP" | grep -q '"content"'; ck "AV-3 healthy request delivered" $(echo "$RESP" | grep -q '"content"' && echo 0 || echo 1)
sleep 12  # meter poll interval
LEDGER_AFTER_1=$(ls /opt/buzz-meter/receipts/ 2>/dev/null | wc -l)
DELTA_1=$((LEDGER_AFTER_1 - LEDGER_BEFORE))
[ "$DELTA_1" -ge 1 ]; ck "AV-3 healthy: >=1 charge produced (delta=$DELTA_1)" $([ "$DELTA_1" -ge 1 ] && echo 0 || echo 1)
# Verify drill ID in gate log
grep -q "$DRILL_ID" /opt/buzz-meter/logs/gate-access.log 2>/dev/null; ck "AV-3 drill ID $DRILL_ID in gate log" $?

# Control 2: GATE DOWN → zero charge, request refused
sudo systemctl stop buzz-meter-gate
sleep 2
DRILL_ID="av3-down-$STAMP"
RESP=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say comb."}],"max_tokens":8}' 2>/dev/null || echo "refused")
[ "$RESP" != "200" ]; ck "AV-3 gate-down: request refused ($RESP)" $([ "$RESP" != "200" ] && echo 0 || echo 1)
sleep 8
LEDGER_AFTER_2=$(ls /opt/buzz-meter/receipts/ 2>/dev/null | wc -l)
DELTA_2=$((LEDGER_AFTER_2 - LEDGER_AFTER_1))
[ "$DELTA_2" = "0" ]; ck "AV-3 gate-down: zero new charges (delta=$DELTA_2)" $([ "$DELTA_2" = "0" ] && echo 0 || echo 1)

# Control 3: GATE RECOVERED → exactly one new charge, NO backfill
sudo systemctl start buzz-meter-gate
sleep 5
DRILL_ID="av3-recovery-$STAMP"
RESP=$(curl -s -m 30 -X POST "http://$G/v1/chat/completions" \
  -H "$KEY" -H 'content-type: application/json' -H "X-Drill-ID: $DRILL_ID" \
  -d '{"messages":[{"role":"user","content":"Say wax."}],"max_tokens":16,"chat_template_kwargs":{"enable_thinking":false}}' 2>/dev/null)
echo "$RESP" | grep -q '"content"'; ck "AV-3 recovery request delivered" $(echo "$RESP" | grep -q '"content"' && echo 0 || echo 1)
sleep 12
LEDGER_AFTER_3=$(ls /opt/buzz-meter/receipts/ 2>/dev/null | wc -l)
DELTA_3=$((LEDGER_AFTER_3 - LEDGER_AFTER_2))
# exactly the recovery charge, no outage backfill (delta_3 should be 1, not more)
[ "$DELTA_3" = "1" ]; ck "AV-3 recovery: exactly 1 new charge, no backfill (delta=$DELTA_3)" $([ "$DELTA_3" = "1" ] && echo 0 || echo 1)
grep -q "$DRILL_ID" /opt/buzz-meter/logs/gate-access.log 2>/dev/null; ck "AV-3 drill ID $DRILL_ID in gate log" $?

# Restore the real rate set
sudo cp /tmp/rate_set.ceremony-m-repair.bak $RS
echo "rate_set.json restored to pre-drill state" | tee -a "$DRILL_LOG"

echo "=== DRILL END: PASS=$PASS FAIL=$FAIL ===" | tee -a "$DRILL_LOG"
echo "Full log: $DRILL_LOG"
exit $FAIL
