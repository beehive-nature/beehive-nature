#!/usr/bin/env python3
"""meter-pd.py — P-D: delivery-state semantics for the b-meter (off-production).

A COPY that extends the production meter's parser with the four delivery
states, per the founder constraint:

    COMPLETE          timing pair seen            -> payment-receipt chain (unchanged shape)
    PARTIAL/CANCELLED stop-cancel + slot release  -> EVIDENCE ONLY (billing: null; the
                       with n_tokens observed        observed token count is raw evidence,
                                                    never presented as completed billable work)
    FAILED/TIMEOUT    gate verdict 504/502         -> failure-receipt chain (separate chain tip)
    UNKNOWN/WEDGED    launched, never settled,     -> wedge marker + failure receipt
                       silence window expired

SEPARATION LAWS (the constraint, made structural):
  * payment state and delivery state NEVER share an artifact: the payment
    chain (receipts/) receives only COMPLETE; the failure chain
    (receipts-failure/) receives only FAILED/WEDGED; PARTIAL lives in
    evidence/ with "billing": null and no line_items/total_computed at all.
  * raw evidence (the exact log lines) is preserved verbatim beside every
    non-COMPLETE record — any future billing decision re-derives from it.

All paths default under PD_ROOT (env; tests point it at a scratch dir). The
production meter (/opt/buzz-meter/meter.py) and its state are never touched.
"""
import json, os, re, sys, time, hashlib

SRC = os.environ.get("METER_SRC", "/opt/buzz-meter/meter.py")
PD_ROOT = os.environ.get("PD_ROOT", "/tmp/meter-pd")
WEDGE_SILENCE_S = float(os.environ.get("WEDGE_SILENCE_S", "120"))

sys.path.insert(0, os.path.dirname(SRC))
import importlib.util
_spec = importlib.util.spec_from_file_location("meter_orig", SRC)
meter = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(meter)
# redirect the ORIGINAL emitter's sinks to the scratch root (payment chain)
RECEIPTS = os.path.join(PD_ROOT, "receipts")
EVIDENCE = os.path.join(PD_ROOT, "evidence")
FAILURES = os.path.join(PD_ROOT, "receipts-failure")
STATE_JSONL = os.path.join(PD_ROOT, "state.jsonl")
PAY_TIP = os.path.join(PD_ROOT, "state", "receipt-chain-tip")
FAIL_TIP = os.path.join(PD_ROOT, "state", "failure-chain-tip")
for d in (RECEIPTS, EVIDENCE, FAILURES, os.path.dirname(PAY_TIP)):
    os.makedirs(d, exist_ok=True)
meter.OUT = RECEIPTS
meter.RECEIPT_CHAIN = PAY_TIP

LAUNCH_RE = re.compile(r"slot launch_slot_: id\s+\d+ \| task (\d+) \| processing task")
CANCEL_RE = re.compile(r"stop: cancel task, id_task = (\d+)")
RELEASE_RE = re.compile(r"slot\s+release: id\s+\d+ \| task (\d+) \| stop processing: n_tokens = (\d+)")
GATE_RE = re.compile(r"\{.*\}")

def _canon(o): return json.dumps(o, sort_keys=True, separators=(",", ":"))
def _id(kind, obj):
    o = dict(obj); o.pop("record_id", None)
    return kind + "-" + hashlib.sha256(_canon(o).encode()).hexdigest()[:24]

def append_state(rec):
    with open(STATE_JSONL, "a") as f: f.write(json.dumps(rec) + "\n")

def evidence_record(task, state, observed, lines):
    rec = {
        "record_id": "", "kind": "delivery-evidence", "task_id": task,
        "state": state,                       # PARTIAL/CANCELLED | COMPLETE | ...
        "observed": observed,                 # raw numbers as seen — NOT billable
        "billing": None,                      # THE LAW: no billing decision is made here
        "billing_note": "delivery observation only; any billing decision is a separate future act",
        "raw_lines": lines,                   # verbatim evidence preserved
        "ts": time.time(),
    }
    rec["record_id"] = _id("evidence", rec)
    with open(os.path.join(EVIDENCE, rec["record_id"] + ".json"), "w") as f:
        json.dump(rec, f, indent=1)
    append_state(rec)
    return rec

def failure_receipt(state, source, detail):
    """FAILED/TIMEOUT and UNKNOWN/WEDGED land on their OWN chain — delivery
    failure records, never payment receipts."""
    read_tip = lambda p: (open(p).read().strip() if os.path.exists(p) else None)
    rec = {
        "record_id": "", "kind": "failure-receipt", "state": state,
        "source": source,                     # 'gate' | 'meter-wedge-detector'
        "detail": detail,
        "payment": "none",                    # payment state explicitly separate
        "provenance": {"prior_failure_id": read_tip(FAIL_TIP)},
        "ts": time.time(),
    }
    rec["record_id"] = _id("failure", rec)
    with open(os.path.join(FAILURES, rec["record_id"] + ".json"), "w") as f:
        json.dump(rec, f, indent=1)
    with open(FAIL_TIP, "w") as f: f.write(rec["record_id"])
    append_state(rec)
    return rec

def ingest_gate_verdict(line):
    """P-D's cross-source leg: the bounded gate's JSON verdicts become
    FAILED/TIMEOUT (504/502) failure receipts — request-level, upstream-agnostic."""
    try: v = json.loads(line)
    except Exception: return None
    if not isinstance(v, dict) or "verdict" not in v: return None
    code = v.get("verdict"); phase = v.get("phase", "")
    if code in (502, 504) or phase in ("stream-idle-cut", "header-timeout"):
        return failure_receipt("FAILED/TIMEOUT", "gate",
                               {"verdict": code, "phase": phase, "ms": v.get("ms"), "key_id": v.get("key_id")})
    return None

def parse_delivery(text, rate_set, key_ref, seen_tasks, ledger=None):
    """The four-state parser. COMPLETE reuses the production parse_stream and
    emitter (payment chain); everything else is evidence/failure-side.
    `ledger` (optional, persisted dict with complete/partial/wedged lists)
    makes artifact emission WRITE-ONCE per task across restarts, replays and
    duplicate log input — the replay-safety law."""
    led = ledger or {}
    partial_seen = set(led.get("partial", []))
    wedged_seen = set(led.get("wedged", []))
    launched, cancels, releases = {}, {}, {}
    results = {"complete": [], "partial": [], "release_only": [], "wedged": []}
    for line in text.splitlines():
        m = LAUNCH_RE.search(line)
        if m: launched.setdefault(m.group(1), []).append(line); continue
        m = CANCEL_RE.search(line)
        if m: cancels.setdefault(m.group(1), []).append(line); continue
        m = RELEASE_RE.search(line)
        if m:
            releases.setdefault(m.group(1), (int(m.group(2)), line)); continue
    # COMPLETE via the production parser — THE CALLER'S seen/ledger set is the
    # dedupe set passed INTO parse_stream (composite catch: a fresh set here
    # re-emitted every task on replayed/duplicated text)
    before_seen = set(seen_tasks)
    results["complete"] = meter.parse_stream(text, None, rate_set, key_ref, seen_tasks, live=True)
    completed_ids = seen_tasks - before_seen
    if ledger is not None:                     # persist the write-once set: replay/restart
        ledger.setdefault("complete", [])
        ledger["complete"] = list(set(ledger["complete"]) | completed_ids)
    for r in results["complete"]:
        emit_payment(r)
    # PARTIAL/CANCELLED: cancelled tasks with a release carrying n_tokens
    for task in cancels:
        if task in partial_seen: continue
        if ledger is not None: ledger.setdefault("partial", []).append(task)
        if task in releases:
            n, line = releases[task]
            results["partial"].append(evidence_record(
                task, "PARTIAL/CANCELLED",
                {"n_tokens_at_stop": n, "note": "observed tokens at stop — raw evidence, not billable"},
                cancels[task] + [line]))
        else:
            results["release_only"].append(evidence_record(
                task, "PARTIAL/CANCELLED", {"n_tokens_at_stop": None},
                cancels[task]))
    # releases without cancel (server-side stop) — evidence ONLY if the task
    # did NOT complete: llama-server prints a release line for EVERY task,
    # completed ones included (composite battery catch, 2026-09-16)
    for task in releases:
        if (task not in cancels and task not in partial_seen
                and task not in completed_ids and task not in seen_tasks):
            if ledger is not None: ledger.setdefault("partial", []).append(task)
            n, line = releases[task]
            results["release_only"].append(evidence_record(
                task, "PARTIAL/CANCELLED",
                {"n_tokens_at_stop": n, "note": "stopped without client-cancel on record"},
                [line]))
    # UNKNOWN/WEDGED: launched, never settled in THIS segment; the persistent
    # open-task sweep in the watch loop ages cross-segment silence — this
    # branch only fires for tasks whose whole lifecycle is inside one segment
    for task in launched:
        if (task not in cancels and task not in releases and task not in completed_ids
                and task not in wedged_seen):
            if ledger is not None: ledger.setdefault("wedged", []).append(task)
            results["wedged"].append(task)
            failure_receipt("UNKNOWN/WEDGED", "meter-wedge-detector",
                            {"task": task, "silence_s": WEDGE_SILENCE_S,
                             "note": "launched, never settled — timing silence",
                             "raw_lines": launched[task]})
            evidence_record(task, "UNKNOWN/WEDGED", {"tokens": None}, launched[task])
    return results

def emit_payment(r):
    if meter.emit(r):     # the production emitter, sinks redirected to PD_ROOT
        # the delivery-state stream carries COMPLETE too — the payment receipt
        # is the billing act; this line is the delivery observation
        append_state({"record_id": _id("state", {"t": r["receipt_id"]}), "kind": "delivery-state",
                      "task_ref": r.get("provenance", {}).get("task"), "state": "COMPLETE",
                      "receipt_id": r["receipt_id"], "billing": "payment-receipt-emitted",
                      "ts": time.time()})

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "--watch":
    # composite watch: byte-offset tails + a PERSISTED task ledger (write-once
    # across restarts/replays) + the cross-segment open-task wedge sweep.
    LLAMA_LOG = os.environ.get("PD_LLAMA_LOG", "/dev/null")
    GATE_LOG = os.environ.get("PD_GATE_LOG", "/dev/null")
    LEDGER_F = os.path.join(PD_ROOT, "state", "tasks-ledger.json")
    OFFSET_F = os.path.join(PD_ROOT, "state", "offsets.json")
    def _load(p, d):
        try:
            with open(p) as f: return json.load(f)
        except Exception: return d
    ledger = _load(LEDGER_F, {"complete": [], "partial": [], "wedged": [], "gate_seen": []})
    offs = _load(OFFSET_F, {"llama": 0, "gate": 0})
    seen = set(ledger["complete"])
    open_tasks = {}   # task -> first-seen ts (launched, not yet settled)
    pending_cancel = {}  # task -> cancel lines seen; a release may land in a LATER segment
    while True:
        try:
            with open(LLAMA_LOG, errors="replace") as f:
                f.seek(offs["llama"]); text = f.read(); offs["llama"] = f.tell()
            if text:
                # a server restart begins a fresh task-id space (composite
                # catch: post-SIGKILL ids repeat) — no open-task carryover
                if "server is listening" in text or "model loaded" in text:
                    if open_tasks:
                        open_tasks.clear()
                # settle-tracking for the sweep: what this segment settles
                seg_launch, seg_settle = set(), set()
                for line in text.splitlines():
                    m = LAUNCH_RE.search(line)
                    if m: seg_launch.add(m.group(1)); continue
                    m = CANCEL_RE.search(line)
                    if m: seg_settle.add(m.group(1)); continue
                    m = RELEASE_RE.search(line)
                    if m: seg_settle.add(m.group(1)); continue
                    if "print_timing" in line:
                        mm = re.search(r"task (\d+)", line)
                        if mm: seg_settle.add(mm.group(1))
                now = time.time()
                for t in seg_launch:
                    open_tasks.setdefault(t, now)
                for t in seg_settle:
                    open_tasks.pop(t, None)
                # cross-segment cancel/release matching (composite catch: the
                # cancel line and its n_tokens release can land in different
                # 5s polls — match them across segments, evidence complete)
                for line in text.splitlines():
                    m = CANCEL_RE.search(line)
                    if m: pending_cancel.setdefault(m.group(1), []).append(line); continue
                    m = RELEASE_RE.search(line)
                    if m and m.group(1) in pending_cancel:
                        t = m.group(1)
                        if t not in ledger["partial"]:
                            ledger["partial"].append(t)
                            evidence_record(t, "PARTIAL/CANCELLED",
                                            {"n_tokens_at_stop": int(m.group(2)),
                                             "note": "observed tokens at stop — raw evidence, not billable"},
                                            pending_cancel[t] + [line])
                        del pending_cancel[t]
                parse_delivery(text, meter.load_rate_set(), "estate-compute-key-1", seen, ledger)
            with open(GATE_LOG, errors="replace") as f:
                f.seek(offs["gate"]); gtext = f.read(); offs["gate"] = f.tell()
            for line in gtext.splitlines():
                if not line.strip(): continue
                h = hashlib.sha256(line.encode()).hexdigest()[:16]
                if h in ledger["gate_seen"]: continue    # replay-safe: write-once verdicts
                ledger["gate_seen"].append(h)
                ingest_gate_verdict(line)
            # cross-segment wedge sweep: silence beyond the window, still open,
            # and NOT completed by now (composite catch: a task that completes
            # just after its window must not be marked wedged)
            now = time.time()
            for t, ts in list(open_tasks.items()):
                if now - ts > WEDGE_SILENCE_S and t not in ledger["wedged"] and t not in seen:
                    ledger["wedged"].append(t)
                    del open_tasks[t]
                    failure_receipt("UNKNOWN/WEDGED", "meter-wedge-detector",
                                    {"task": t, "silence_s": WEDGE_SILENCE_S,
                                     "note": "open task aged past the silence window (cross-segment sweep)",
                                     "first_seen": ts})
                    evidence_record(t, "UNKNOWN/WEDGED", {"tokens": None}, [])
            # persist the ledger + offsets (atomic-ish: write-then-rename)
            for path, obj in ((LEDGER_F, ledger), (OFFSET_F, offs)):
                tmp = path + ".tmp"
                with open(tmp, "w") as f: json.dump(obj, f)
                os.replace(tmp, path)
        except FileNotFoundError:
            pass
        time.sleep(5)
