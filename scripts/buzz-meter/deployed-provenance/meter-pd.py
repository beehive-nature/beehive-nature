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

def evidence_record(task, state, observed, lines, epoch=""):
    rec = {
        "record_id": "", "kind": "delivery-evidence", "task_id": task,
        "boot_epoch": epoch or None,
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

MODEL_LOADED_MARKER = "llama_server: model loaded"

def _q(epoch, task):
    """boot-epoch-qualified ledger key — task ids are PER-PROCESS and repeat
    after every restart (composite residual #1): '0:2' and '1:2' are two
    DIFFERENT generations that must each bill exactly once."""
    return f"{epoch}:{task}" if epoch else str(task)

def parse_delivery(text, rate_set, key_ref, seen_tasks, ledger=None, epoch=""):
    """The four-state parser. COMPLETE reuses the production parse_stream and
    emitter (payment chain); everything else is evidence/failure-side.
    `ledger` (optional, persisted dict) makes artifact emission WRITE-ONCE per
    task across restarts, replays and duplicate log input; `epoch` qualifies
    ledger keys by server boot (empty = legacy raw keys)."""
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
    # COMPLETE via the production parser — the dedupe set passed INTO it is
    # the persisted ledger's CURRENT-EPOCH completions (raw ids), so replayed
    # or duplicated text can never re-emit, and a repeated numeric id in a
    # NEW boot is a different key and bills independently
    if ledger is not None:
        dedupe = {k.split(":", 1)[1] for k in led.get("complete", []) if k.startswith(_q(epoch, ""))}
        before = set(dedupe)
        epoch_completed_raw = set(dedupe)   # replay guard: tasks completed in THIS boot at ANY past time
    else:
        dedupe = seen_tasks
        before = set(dedupe)
        epoch_completed_raw = set()
    results["complete"] = meter.parse_stream(text, None, rate_set, key_ref, dedupe, live=True)
    completed_ids = dedupe - before
    seen_tasks |= completed_ids
    if ledger is not None:                     # persist the write-once set: replay/restart
        ledger.setdefault("complete", [])
        ledger["complete"] = list(set(ledger["complete"]) | {_q(epoch, t) for t in completed_ids})
    for r in results["complete"]:
        emit_payment(r)
    # PARTIAL/CANCELLED: cancelled tasks with a release carrying n_tokens
    for task in cancels:
        if _q(epoch, task) in partial_seen: continue
        if ledger is not None: ledger.setdefault("partial", []).append(_q(epoch, task))
        if task in releases:
            n, line = releases[task]
            results["partial"].append(evidence_record(
                task, "PARTIAL/CANCELLED",
                {"n_tokens_at_stop": n, "note": "observed tokens at stop — raw evidence, not billable"},
                cancels[task] + [line], epoch=epoch))
        else:
            results["release_only"].append(evidence_record(
                task, "PARTIAL/CANCELLED", {"n_tokens_at_stop": None},
                cancels[task], epoch=epoch))
    # releases without cancel (server-side stop) — evidence ONLY if the task
    # did NOT complete: llama-server prints a release line for EVERY task,
    # completed ones included (composite battery catch, 2026-09-16)
    for task in releases:
        if (task not in cancels and _q(epoch, task) not in partial_seen
                and task not in completed_ids and task not in seen_tasks
                and task not in epoch_completed_raw):
            if ledger is not None: ledger.setdefault("partial", []).append(_q(epoch, task))
            n, line = releases[task]
            results["release_only"].append(evidence_record(
                task, "PARTIAL/CANCELLED",
                {"n_tokens_at_stop": n, "note": "stopped without client-cancel on record"},
                [line], epoch=epoch))
    # UNKNOWN/WEDGED, single-segment form: ONLY in the ledger-less (pure
    # battery) path — the watch path's aging sweep owns cross-segment wedge
    # detection; firing here on a launch whose settle lands in a LATER poll
    # double-marked settled tasks (adversarial catch, 2026-09-16)
    if ledger is None:
        for task in launched:
            if (task not in cancels and task not in releases and task not in completed_ids
                    and task not in epoch_completed_raw
                    and _q(epoch, task) not in wedged_seen):
                results["wedged"].append(task)
                failure_receipt("UNKNOWN/WEDGED", "meter-wedge-detector",
                                {"task": task, "boot_epoch": epoch or None, "silence_s": WEDGE_SILENCE_S,
                                 "note": "launched, never settled — timing silence",
                                 "raw_lines": launched[task]})
                evidence_record(task, "UNKNOWN/WEDGED", {"tokens": None}, launched[task], epoch=epoch)
    return results

def emit_payment(r):
    if meter.emit(r):     # the production emitter, sinks redirected to PD_ROOT
        # the delivery-state stream carries COMPLETE too — the payment receipt
        # is the billing act; this line is the delivery observation
        append_state({"record_id": _id("state", {"t": r["receipt_id"]}), "kind": "delivery-state",
                      "task_ref": r.get("provenance", {}).get("task"), "state": "COMPLETE",
                      "receipt_id": r["receipt_id"], "billing": "payment-receipt-emitted",
                      "ts": time.time()})

def replay(text, rate_set, key_ref, ledger):
    """Replay a FULL llama log (from its first boot) through the parser with
    the persisted ledger: boots are re-enumerated from the log's own startup
    markers, so epoch-qualified keys match the live watch's numbering and
    REPLAY CREATES NOTHING. Assumes the log starts at boot 0 (backfill
    semantics — the same assumption the production --backfill makes)."""
    parts = re.split(r"(?=llama_server: model loaded)", text)
    counts = []
    for i, seg in enumerate(parts):
        if not seg.strip(): continue
        r = parse_delivery(seg, rate_set, key_ref, set(), ledger, epoch=str(i))
        counts.append({"epoch": i, "complete": len(r["complete"]),
                       "partial": len(r["partial"]) + len(r["release_only"]), "wedged": len(r["wedged"])})
    return counts

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
    ledger = _load(LEDGER_F, {"complete": [], "partial": [], "wedged": [], "gate_seen": [], "epoch": 0})
    offs = _load(OFFSET_F, {"llama": 0, "gate": 0})
    epoch = int(ledger.get("epoch", 0))
    open_tasks = {}      # epoch-qualified task -> first-seen ts (launched, not yet settled)
    pending_cancel = {}  # epoch-qualified task -> cancel lines (release may land later)
    while True:
        try:
            with open(LLAMA_LOG, errors="replace") as f:
                f.seek(offs["llama"]); text = f.read(); offs["llama"] = f.tell()
            if text:
                # a server restart opens a FRESH task-id space — bump the boot
                # epoch (ledger keys are epoch-qualified; residual #1 closed)
                # and carry no open/pending state across the boundary
                if MODEL_LOADED_MARKER in text:
                    epoch += 1
                    ledger["epoch"] = epoch
                    open_tasks.clear()
                    pending_cancel.clear()
                now = time.time()
                ep = str(epoch)
                for line in text.splitlines():
                    m = LAUNCH_RE.search(line)
                    if m: open_tasks.setdefault(_q(ep, m.group(1)), now); continue
                    m = CANCEL_RE.search(line)
                    if m: pending_cancel.setdefault(_q(ep, m.group(1)), []).append(line); continue
                    m = RELEASE_RE.search(line)
                    if m:
                        qk = _q(ep, m.group(1))
                        open_tasks.pop(qk, None)
                        # cross-segment cancel/release match (composite catch:
                        # the two lines can land in different 5s polls)
                        if qk in pending_cancel:
                            if qk not in ledger["partial"]:
                                ledger["partial"].append(qk)
                                evidence_record(m.group(1), "PARTIAL/CANCELLED",
                                                {"n_tokens_at_stop": int(m.group(2)),
                                                 "note": "observed tokens at stop — raw evidence, not billable"},
                                                pending_cancel[qk] + [line], epoch=ep)
                            del pending_cancel[qk]
                        continue
                    if "print_timing" in line:
                        mm = re.search(r"task (\d+)", line)
                        if mm: open_tasks.pop(_q(ep, mm.group(1)), None)
                parse_delivery(text, meter.load_rate_set(), "estate-compute-key-1", set(), ledger, epoch=str(epoch))
            with open(GATE_LOG, errors="replace") as f:
                f.seek(offs["gate"]); gtext = f.read(); offs["gate"] = f.tell()
            for line in gtext.splitlines():
                if not line.strip(): continue
                h = hashlib.sha256(line.encode()).hexdigest()[:16]
                if h in ledger["gate_seen"]: continue    # replay-safe: write-once verdicts
                ledger["gate_seen"].append(h)
                ingest_gate_verdict(line)
            # cross-segment wedge sweep: silence beyond the EVIDENCE-BACKED
            # window (sweep-bound-evidence.py), still open, not completed by
            # now, and keyed by boot epoch (residual #2 + #1 closed)
            now = time.time()
            for qk, ts in list(open_tasks.items()):
                if now - ts > WEDGE_SILENCE_S and qk not in ledger["wedged"]:
                    done_epochs = {k.split(":", 1)[0] for k in ledger["complete"]}
                    if qk.split(":", 1)[0] in done_epochs and _raw_of(qk) in {
                        k.split(":", 1)[1] for k in ledger["complete"] if k.startswith(qk.split(":", 1)[0] + ":")}:
                        del open_tasks[qk]; continue      # completed this boot: not wedged
                    ledger["wedged"].append(qk)
                    del open_tasks[qk]
                    ep, raw = qk.split(":", 1) if ":" in qk else ("", qk)
                    failure_receipt("UNKNOWN/WEDGED", "meter-wedge-detector",
                                    {"task": raw, "boot_epoch": ep or None,
                                     "silence_s": WEDGE_SILENCE_S,
                                     "note": "open task aged past the silence window (cross-segment sweep)",
                                     "first_seen": ts})
                    evidence_record(raw, "UNKNOWN/WEDGED", {"tokens": None}, [], epoch=ep)
            # persist the ledger + offsets (atomic-ish: write-then-rename)
            for path, obj in ((LEDGER_F, ledger), (OFFSET_F, offs)):
                tmp = path + ".tmp"
                with open(tmp, "w") as f: json.dump(obj, f)
                os.replace(tmp, path)
        except FileNotFoundError:
            pass
        time.sleep(5)

def _raw_of(qk):
    return qk.split(":", 1)[1] if ":" in qk else qk
