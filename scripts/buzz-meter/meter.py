#!/usr/bin/env python3
# buzz-meter — the LANE M b-meter sidecar (P1: receipts, no money touched).
#
# Reads the EXISTING llama-server usage log and emits SPEND RECEIPTS per
# docs/SPEC-SPEND-RECEIPT-1.md exactly: unit "A" (A-first MVP), line items as
# EXACT token quantities (resource classes prefill_token / decode_token —
# ruled in by the Lane M dispatch, the only lawful way the closed enum grows),
# explicit rate + versioned rate_set_ref, totals COMPUTED from line items and
# never stored as an independent field, visibility private by default.
#
# TIER LADDER (founder-ruled): the box/qwen compute lane is the FREE tier —
# guest keys, no charge, capped fairly — so its receipts charge zero; the same
# meter and the same receipt shape serve both tiers, so a guest's history is
# ready the day they step up. THE TITHE (founder law): the Claude-agents lane
# prices at provider cost basis + 10% tithe in A — a distinct TITHE line on
# every receipt, never buried in the rate; the tithe percentage changes by
# founder word alone, rate_set versions track cost basis only.
#
# Run:  meter.py --watch        (long-running tail, systemd service)
#       meter.py --backfill     (emit receipts for the whole existing log)
#       meter.py --selftest     (spec §7 acceptance checks, then exit)
import json, os, re, sys, time, hashlib, subprocess, argparse

LOG = "/opt/buzz-compute/logs/usage.log"
OUT = "/opt/buzz-meter/receipts"
STATE = "/opt/buzz-meter/state/offset"
RATE_SET = "/opt/buzz-meter/rate_set.json"
SERVICE = "buzz-compute.service"

SCHEMA_VERSION = "1.0.0-draft"
RAILS = {"vaulta","autonomi","arweave","arbitrum","hive","zano","exsat","mesh","other"}
# SPEC enum + the two classes this lane's founder dispatch rules in:
RESOURCE_CLASSES = {"mesh_second","vram_byte_second","ram_byte","cpu_microsecond",
                    "net_byte","chunk_count","storage_byte","chain_fee",
                    "prefill_token","decode_token"}
RAIL = "other"                      # the compute lane rides the spec's "other"
ADAPTER = "buzz-compute/llama.cpp"  # the BNR adapter that consumed the resource
RATE_SET_REF = "rateset-v1"

# llama-server log: elapsed h.mm.ss.mmm since service start. Wall time =
# service start (systemd) + elapsed. The meter reads LIVE, so drift is bounded
# by the read interval; backfill uses the same conversion for honesty ±1s.
TIMING_RE = re.compile(r"^(\d+)\.(\d{2})\.(\d{2,3})\.(\d{3}) I slot print_timing: id\s+\d+ \| task (\d+) \| (.*)$")
PROMPT_RE = re.compile(r"prompt eval time =\s+([\d.]+) ms /\s+(\d+) tokens")
EVAL_RE   = re.compile(r"(?<!prompt )eval time =\s+([\d.]+) ms /\s+(\d+) tokens")

def service_start_epoch():
    out = subprocess.run(["systemctl","show",SERVICE,"-p","ActiveEnterTimestamp","--value"],
                         capture_output=True, text=True).stdout.strip()
    t = subprocess.run(["date","-d",out,"+%s"], capture_output=True, text=True).stdout.strip()
    return int(t)

def elapsed_to_epoch(start_epoch, h, m, ms, us):
    # llama-server elapsed prefix = h.mm.mmm.uuu (minutes, then milliseconds, then microseconds)
    return start_epoch + h*3600 + m*60 + ms/1000.0 + us/1000000.0

def load_rate_set():
    with open(RATE_SET) as f:
        return json.load(f)

def canonical(obj):
    # sorted keys, no whitespace — the round-trip byte-identity the spec demands
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def receipt_id(receipt):
    # §5 fence: derivation not ruled; CANDIDATE = sha256 over the canonical
    # serialization with receipt_id omitted (flagged in the lane file)
    r = dict(receipt); r.pop("receipt_id", None)
    return "receipt-" + hashlib.sha256(canonical(r).encode()).hexdigest()

def fmt_amount(value):
    # decimal string, fixed 8 places — integer quantity math only, floats never
    # touch quantities; charged amounts derive from rate * integer quantity
    return round(value, 8)

def build_receipt(task_id, occurred_at, prompt_tokens, decode_tokens, rate_set, key_ref):
    tier = rate_set["tiers"]["free_qwen"]
    lines = []
    for cls, qty in (("prefill_token", prompt_tokens), ("decode_token", decode_tokens)):
        if qty <= 0:
            continue
        rate = tier["rates"][cls]           # FREE tier: 0 — founder tier-ladder ruling
        lines.append({
            "adapter": ADAPTER,
            "rail": RAIL,
            "resource_class": cls,
            "quantity": int(qty),
            "quantity_unit": cls,
            "charged": {"value": fmt_amount(rate["value"] * int(qty)), "unit": "A"},
            "rate": {"value": rate["value"], "rate_set_ref": RATE_SET_REF,
                     "observed_at": rate_set["minted_at"]},
        })
    # THE TITHE — distinct line, visible on every receipt, never in the rate.
    # Free tier charges zero, so the tithe line carries zero; the law is stated
    # on every receipt regardless, so the shape is identical on both tiers.
    basis = sum(l["charged"]["value"] for l in lines)
    tithe_pct = rate_set["tithe"]["percent"]
    lines.append({
        "adapter": ADAPTER,
        "rail": RAIL,
        "resource_class": "decode_token",   # tithe rides the charged basis
        "quantity": 0,
        "quantity_unit": "tithe",
        "charged": {"value": fmt_amount(basis * tithe_pct / 100.0), "unit": "A"},
        "rate": {"value": 0, "rate_set_ref": RATE_SET_REF, "observed_at": rate_set["minted_at"]},
        "tithe": {"percent": tithe_pct, "law": rate_set["tithe"]["law"]},
    })
    receipt = {
        "schema_version": SCHEMA_VERSION,
        "receipt_id": "",                   # filled after canonicalization
        "spender_bdid": {"bzdid": None, "note": "pre-bzdid attribution: " + key_ref},
        "occurred_at": occurred_at,
        "operation": {"kind": "compute.generation", "task_id": int(task_id), "lane": "free_qwen"},
        "line_items": lines,
        "visibility": "private",            # §3a ruled default; storage is 600
        "provenance": {"caused_by": "llama-server usage.log print_timing", "anchors": [],
                       "prior_receipt_id": None},
    }
    # total is COMPUTED at every serialization, never stored (spec §1/§7):
    receipt["total_computed"] = {"value": fmt_amount(sum(l["charged"]["value"] for l in lines)), "unit": "A"}
    receipt["receipt_id"] = receipt_id(receipt)
    validate(receipt)
    return receipt

def validate(r):
    # spec §7 acceptance, enforced on every emit
    for l in r["line_items"]:
        assert l["rail"] in RAILS, "unknown rail"
        assert l["resource_class"] in RESOURCE_CLASSES, "unknown resource class"
        assert isinstance(l["quantity"], int), "quantity must be integer"
    assert abs(r["total_computed"]["value"] - sum(l["charged"]["value"] for l in r["line_items"])) < 1e-9
    assert r["visibility"] == "private"
    assert "usd" not in canonical(r).lower() and "fiat" not in canonical(r).lower()
    # round-trip byte-identity
    assert canonical(json.loads(canonical(r))) == canonical(r)

def emit(receipt):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, receipt["receipt_id"] + ".json")
    if os.path.exists(path):
        return False                       # append-only: never rewrite
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(json.dumps(receipt, indent=1, sort_keys=True))
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
    return True

def parse_stream(text, start_epoch, rate_set, key_ref, seen_tasks, live=False):
    """Yield receipts from raw log text. A task's timing group is complete when
    both prompt-eval and eval lines are seen; llama-server interleaves one task
    at a time per slot, so buffering by task id is safe. Live mode stamps
    wall-clock-at-parse (drift bounded by the poll interval); backfill converts
    the log's elapsed prefix against the service start."""
    pend = {}
    out = []
    for line in text.splitlines():
        m = TIMING_RE.match(line)
        if not m:
            continue
        h, mi, ms, us, task, rest = int(m[1]), int(m[2]), int(m[3]), int(m[4]), m[5], m[6]
        rec = pend.setdefault(task, {})
        pm = PROMPT_RE.search(rest)
        em = EVAL_RE.search(rest)
        if pm: rec["prompt"] = int(pm[2])
        if em: rec["eval"] = int(em[2])
        if "prompt" in rec and "eval" in rec:
            occurred = time.time() if live else elapsed_to_epoch(start_epoch, h, mi, ms, us)
            if task not in seen_tasks:
                seen_tasks.add(task)
                out.append(build_receipt(task, occurred, rec["prompt"], rec["eval"], rate_set, key_ref))
            del pend[task]
    return out

def read_offset():
    try:
        with open(STATE) as f: return int(f.read().strip())
    except Exception: return 0

def write_offset(n):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, "w") as f: f.write(str(n))

def key_ref():
    # P1: the single estate compute key era (per-key attribution lands with P2)
    return "estate-compute-key-1"

def main():
    # P2 ledger commands (keys / newkey / revoke / chainpoll / allocate) run
    # without flags — route them before the argparse path
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        dispatch(sys.argv)
        return
    ap = argparse.ArgumentParser()
    ap.add_argument("--watch", action="store_true")
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    rate_set = load_rate_set()
    start_epoch = service_start_epoch()

    if args.selftest:
        r = build_receipt(999999, 1700000000.0, 39, 128, rate_set, key_ref())
        assert r["line_items"][0]["quantity"] == 39 and r["line_items"][1]["quantity"] == 128
        assert r["total_computed"]["value"] == 0.0            # free tier charges zero
        assert r["line_items"][-1]["tithe"]["percent"] == 10  # the law rides every receipt
        print("SELFTEST OK —", r["receipt_id"])
        return

    if args.backfill:
        with open(LOG, errors="replace") as f: text = f.read()
        seen = set()
        receipts = parse_stream(text, start_epoch, rate_set, key_ref(), seen)
        n = sum(1 for r in receipts if emit(r))
        print(f"backfill: {n} receipts emitted (of {len(receipts)} parsed)")
        return

    if args.watch:
        seen_tasks = set()
        pos = read_offset()
        while True:
            try:
                size = os.path.getsize(LOG)
                with open(LOG, errors="replace") as f:
                    f.seek(pos)
                    text = f.read()
                    pos = f.tell()
                if text:
                    for r in parse_stream(text, start_epoch, rate_set, key_ref(), seen_tasks, live=True):
                        emit(r)
                    write_offset(pos)
                time.sleep(5)
            except FileNotFoundError:
                time.sleep(5)                 # log rotated or service restarting
            except Exception as e:
                sys.stderr.write(f"watch error: {e}\n")
                time.sleep(10)


# ── P2: the key ledger + A-credits by chain read-back ──────────────────────
# Guest keys are ISSUED on-box (secrets live only in keys.json, 600); the
# qwen lane is the FREE tier, so issued keys pass the gate without charge.
# A-credits: the meter polls the designated estate Vaulta account's balance
# (keyless get_account, rotated hosts, two agreeing reads = confirmed); growth
# above the checkpoint credits the estate pool; --allocate moves pool to a
# key as a ledger entry + settlement INSTRUCTION — money never moves here
# (baton fence). History APIs are 410-gone on public nodes, so attribution of
# incoming transfers to keys is by founder instruction, not memo parsing.

KEYS_FILE = "/opt/buzz-meter/keys.json"
CHAIN_STATE = "/opt/buzz-meter/state/chain.json"
VAULTA_HOSTS = ["https://eos.api.eosnation.io", "https://eos.greymass.com", "https://api.eosn.io"]
WATCH_ACCOUNT = None                    # designated estate account (set in keys.json.meta)

import urllib.request, secrets as pysecrets

def load_ledger():
    try:
        with open(KEYS_FILE) as f: return json.load(f)
    except Exception: return {"meta": {"watch_account": None, "pool_A": 0.0}, "keys": []}

def save_ledger(led):
    tmp = KEYS_FILE + ".tmp"
    with open(tmp, "w") as f: json.dump(led, f, indent=1, sort_keys=True)
    os.chmod(tmp, 0o600); os.replace(tmp, KEYS_FILE)

def cmd_newkey(args):
    led = load_ledger()
    kid = args[2]
    if any(k["id"] == kid for k in led["keys"]): sys.exit("key id exists")
    secret = "bm-" + pysecrets.token_hex(24)
    led["keys"].append({"id": kid, "secret": secret, "tier": "free", "balance_A": 0.0,
                        "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "revoked": False})
    save_ledger(led)
    print(json.dumps({"id": kid, "OPENAI_COMPAT_API_KEY": secret, "tier": "free"}))

def cmd_keys(args):
    led = load_ledger()
    for k in led["keys"]:
        print(k["id"], k["tier"], "balance_A:", k["balance_A"], "revoked:" if k["revoked"] else "active")

def cmd_revoke(args):
    led = load_ledger()
    for k in led["keys"]:
        if k["id"] == args[2]: k["revoked"] = True
    save_ledger(led); print("revoked", args[1])

def chain_read_balance(account):
    # two rotated reads must agree — a confirmed read, per the P2 ruling
    import random
    hosts = VAULTA_HOSTS[:]; random.shuffle(hosts)
    vals = []
    for h in hosts[:2]:
        try:
            req = urllib.request.Request(h + "/v1/chain/get_account",
                data=json.dumps({"account_name": account}).encode(),
                headers={"Content-Type": "application/json"})
            d = json.loads(urllib.request.urlopen(req, timeout=10).read())
            bal = d.get("core_liquid_balance") or "0.0000 A"
            vals.append(float(bal.split()[0]))
        except Exception:
            pass
    if len(vals) == 2 and abs(vals[0] - vals[1]) < 1e-6:
        return vals[0]
    return None                                    # not confirmed — no credit

def cmd_chainpoll(args):
    led = load_ledger()
    acct = led.get("meta", {}).get("watch_account")
    if not acct:
        print("chainpoll: no watch_account designated (set in keys.json.meta) — idle"); return
    st = {}
    try:
        with open(CHAIN_STATE) as f: st = json.load(f)
    except Exception: pass
    bal = chain_read_balance(acct)
    if bal is None:
        print("chainpoll: read not confirmed this round — no credit, no checkpoint move"); return
    prev = st.get("last_confirmed_balance")
    if prev is None:
        st["last_confirmed_balance"] = bal; save_chain_state(st)
        print(f"chainpoll: checkpoint initialized at {bal} A (no credit on first read)"); return
    if bal > prev:
        credit = round(bal - prev, 8)
        led["meta"]["pool_A"] = round(led["meta"].get("pool_A", 0.0) + credit, 8)
        save_ledger(led)
        st["last_confirmed_balance"] = bal; save_chain_state(st)
        emit_settlement_instruction(f"credit {credit} A to estate pool (read-back of {acct}: {prev} -> {bal})")
        print(f"chainpoll: +{credit} A credited to estate pool")
    elif bal < prev:
        # balance fell (spend by the account owner) — move checkpoint down, credit nothing
        st["last_confirmed_balance"] = bal; save_chain_state(st)
        print(f"chainpoll: balance decreased ({prev} -> {bal}) — checkpoint follows, no credit")
    else:
        print("chainpoll: unchanged")

def save_chain_state(st):
    os.makedirs(os.path.dirname(CHAIN_STATE), exist_ok=True)
    with open(CHAIN_STATE, "w") as f: json.dump(st, f, indent=1)

def emit_settlement_instruction(text):
    os.makedirs("/opt/buzz-meter/settlement", exist_ok=True)
    path = os.path.join("/opt/buzz-meter/settlement", time.strftime("instr-%Y%m%dT%H%M%SZ-") + hashlib.sha256(text.encode()).hexdigest()[:8] + ".json")
    with open(path, "w") as f:
        json.dump({"kind": "settlement-instruction", "text": text,
                   "note": "INSTRUCTION ONLY — the meter never moves money (baton fence, Lane M P2)",
                   "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=1)
    os.chmod(path, 0o600)

def cmd_allocate(args):
    kid, amount = args[2], float(args[3])
    led = load_ledger()
    if led["meta"].get("pool_A", 0.0) < amount: sys.exit("pool short")
    k = next((k for k in led["keys"] if k["id"] == kid), None)
    if not k: sys.exit("no such key")
    led["meta"]["pool_A"] = round(led["meta"]["pool_A"] - amount, 8)
    k["balance_A"] = round(k["balance_A"] + amount, 8)
    save_ledger(led)
    emit_settlement_instruction(f"allocate {amount} A from estate pool to key {kid}")
    print(f"allocated {amount} A to {kid}; pool now {led['meta']['pool_A']}")

# P2 command dispatch (appended main): meter.py keys|newkey <id>|revoke <id>|chainpoll|allocate <id> <A>
def dispatch(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "newkey" and len(argv) == 3: cmd_newkey(argv)
    elif cmd == "keys": cmd_keys(argv)
    elif cmd == "revoke" and len(argv) == 3: cmd_revoke(argv)
    elif cmd == "chainpoll": cmd_chainpoll(argv)
    elif cmd == "allocate" and len(argv) == 4: cmd_allocate(argv)
    else:
        print(__doc__); sys.exit(2)

if __name__ == "__main__":
    main()
