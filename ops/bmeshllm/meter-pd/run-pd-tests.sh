#!/usr/bin/env bash
# run-pd-tests.sh — the P-D battery (founder constraint verbatim: distinguish
# COMPLETE / PARTIAL-CANCELLED / FAILED-TIMEOUT / UNKNOWN-WEDGED without
# pretending partial token observations are completed billable work; raw
# evidence preserved separately from any billing decision; payment and
# delivery state separate). All artifacts land in a scratch PD_ROOT.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
R="$D/pd-receipt.log"; say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$R"; }
pass() { say "PASS $*"; }; faild() { say "FAIL $*"; FAILED=1; }
FAILED=1; FAILED=0
export PD_ROOT=$(mktemp -d /tmp/meter-pd-test.XXXXXX)
python3 - <<'PY' 2>&1 | tee -a "$R"
import os, json, sys, importlib.util
sys.path.insert(0, os.environ.get("PD_SCRIPT_DIR", "."))
spec = importlib.util.spec_from_file_location("mpd", os.path.join(os.environ.get("PD_SCRIPT_DIR", "."), "meter-pd.py"))
mpd = importlib.util.module_from_spec(spec); spec.loader.exec_module(mpd)
R = os.environ["PD_ROOT"]
def say(s): print(s)
P,F,E = lambda: os.listdir(os.path.join(R,"receipts")), lambda: os.listdir(os.path.join(R,"receipts-failure")), lambda: os.listdir(os.path.join(R,"evidence"))
ok = lambda c,m: (say(("PASS " if c else "FAIL ")+m), None)[0]

rs = mpd.meter.load_rate_set()
FIX_COMPLETE = """2.20.000.001 I slot launch_slot_: id  0 | task 44 | processing task, is_child = 0
2.30.475.416 I slot print_timing: id  0 | task 44 | prompt eval time =   123.45 ms /     39 tokens
2.31.100.001 I slot print_timing: id  0 | task 44 | eval time =   6789.01 ms /    128 tokens"""
FIX_PARTIAL = """2.24.509.579 W srv          stop: cancel task, id_task = 31
2.24.699.597 I slot      release: id  0 | task 31 | stop processing: n_tokens = 28, truncated = 0"""
FIX_WEDGE = "2.10.000.001 I slot launch_slot_: id  0 | task 77 | processing task, is_child = 0"

# B1 COMPLETE
seen=set(); mpd.parse_delivery(FIX_COMPLETE, rs, "test-key", seen)
ok(len(P())==1 and len(F())==0 and len(E())==0, "B1 COMPLETE -> exactly one PAYMENT receipt, no failure/evidence artifacts")
pay=json.load(open(os.path.join(R,"receipts",P()[0])))
ok(pay.get("line_items") is not None and pay.get("total_computed") is not None, "B1 the payment receipt keeps the billable shape (line_items/total_computed)")
ok(seen=={"44"}, "B1 completed id harvested via the parser's own seen-set")

# B2 PARTIAL/CANCELLED
mpd.parse_delivery(FIX_PARTIAL, rs, "test-key", seen)
ok(len(P())==1, "B2 PARTIAL produced NO payment receipt (still 1)")
ev=[json.load(open(os.path.join(R,"evidence",f))) for f in E()]
part=[e for e in ev if e["state"]=="PARTIAL/CANCELLED"]
ok(len(part)==1, "B2 PARTIAL -> one evidence record")
p=part[0]
ok(p["billing"] is None and "line_items" not in p and "total_computed" not in p, "B2 billing:null, no billable shape ANYWHERE on the partial record")
ok(p["observed"]["n_tokens_at_stop"]==28, "B2 observed n_tokens=28 stored under observed (raw)")
ok(any("stop: cancel task, id_task = 31" in l for l in p["raw_lines"]), "B2 raw lines preserved verbatim")

# B3 FAILED/TIMEOUT from a gate verdict line
fr=mpd.ingest_gate_verdict(json.dumps({"ts":"t","key_id":"k1","path":"/v1/chat/completions","verdict":504,"phase":"header-timeout","ms":3026}))
ok(fr and fr["state"]=="FAILED/TIMEOUT" and fr["payment"]=="none", "B3 gate 504 -> FAILED/TIMEOUT failure receipt, payment explicitly none")
first_fail_id=fr["record_id"]

# B4 UNKNOWN/WEDGED (launched, never settled)
res=mpd.parse_delivery(FIX_WEDGE, rs, "test-key", seen)
ok(res["wedged"]==["77"], "B4 task 77 classified UNKNOWN/WEDGED")
fails=[json.load(open(os.path.join(R,"receipts-failure",f))) for f in F()]
w=[f for f in fails if f["state"]=="UNKNOWN/WEDGED"]
ok(len(w)==1 and w[0]["source"]=="meter-wedge-detector", "B4 wedge marker emitted by the detector")

# B5 separation + chaining
ok(os.path.exists(os.path.join(R,"state","receipt-chain-tip")) and os.path.exists(os.path.join(R,"state","failure-chain-tip")), "B5 both chain tips exist")
ok(open(os.path.join(R,"state","receipt-chain-tip")).read()!=open(os.path.join(R,"state","failure-chain-tip")).read(), "B5 payment tip != failure tip (separate chains)")
ok(w[0]["provenance"]["prior_failure_id"]==first_fail_id, "B5 failure chain links predecessor (delivery chain)")
states=[json.loads(l)["state"] for l in open(os.path.join(R,"state.jsonl"))]
ok(set(states)=={"COMPLETE","PARTIAL/CANCELLED","FAILED/TIMEOUT","UNKNOWN/WEDGED"}, f"B5 state stream carries all four states: {sorted(set(states))}")

# B6 non-pretense audit: nothing outside receipts/ has a billable shape
import glob
bad=[f for f in glob.glob(os.path.join(R,"receipts-failure","*.json"))+glob.glob(os.path.join(R,"evidence","*.json"))
     if "line_items" in open(f).read() or "total_computed" in open(f).read()]
ok(not bad, "B6 ZERO billable shapes outside the payment chain")
say(f"BATTERY-DONE root={R}")
PY
say "=== P-D battery end ==="
ls "$PD_ROOT" 2>/dev/null | tr '\n' ' '; echo
exit $FAILED
