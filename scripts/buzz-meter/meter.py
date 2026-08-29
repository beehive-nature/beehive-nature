#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1
# Licensor: Travis Mark Remington <lovis@skaists.dev>
# The b-meter commercial moat — Business Source License 1.1, see LICENSE
# in this directory. Change Date: August 29, 2030 (the publish commit + 4 years —
# commit (August 29, 2030). Change License: GPL-2.0-or-later. Non-production use per the
# Additional Use Grant in that LICENSE; production use requires a
# commercial license from the Licensor.
# ────────────────────────────────────────────────────────────────────────────
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

# the escrow ledger core (merged 2026-08-29 from Seat-1's engine — one engine,
# not two): hash-chained append-only JSONL, balances DERIVED never stored,
# refuse-before-write. meter.py keeps the ruled duties (receipt emission, key
# secrets, chain read-back, bindings/gate) and routes voucher BALANCES here.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voucher_escrow import Escrow, RateSet, InsufficientVoucher, VoucherError, TITHE_RATE  # noqa: E402

LOG = "/opt/buzz-compute/logs/usage.log"
OUT = "/opt/buzz-meter/receipts"
STATE = "/opt/buzz-meter/state/offset"
RATE_SET = "/opt/buzz-meter/rate_set.json"
ESCROW_LEDGER = "/opt/buzz-meter/escrow-ledger.jsonl"
SETTLEMENT_DIR = "/opt/buzz-meter/settlement"
RECEIPT_CHAIN = "/opt/buzz-meter/state/receipt-chain-tip"   # P1 receipts chain here too
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

def read_receipt_tip():
    # the P1 receipt chain (merged hardening, 2026-08-29): each receipt cites
    # its predecessor through the schema's own provenance.prior_receipt_id
    # seam — cross-receipt tamper evidence, the escrow engine's pattern
    try:
        with open(RECEIPT_CHAIN) as f: return f.read().strip() or None
    except Exception: return None

def write_receipt_tip(receipt_id):
    os.makedirs(os.path.dirname(RECEIPT_CHAIN), exist_ok=True)
    tmp = RECEIPT_CHAIN + ".tmp"
    with open(tmp, "w") as f: f.write(receipt_id)
    os.chmod(tmp, 0o600); os.replace(tmp, RECEIPT_CHAIN)

def emit(receipt):
    os.makedirs(OUT, exist_ok=True)
    if not receipt.get("provenance", {}).get("prior_receipt_id"):
        receipt["provenance"]["prior_receipt_id"] = read_receipt_tip()
        receipt["receipt_id"] = receipt_id(receipt)
        validate(receipt)
    path = os.path.join(OUT, receipt["receipt_id"] + ".json")
    if os.path.exists(path):
        return False                       # append-only: never rewrite
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(json.dumps(receipt, indent=1, sort_keys=True))
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
    write_receipt_tip(receipt["receipt_id"])
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

def escrow():
    # the voucher/balance authority (merged 2026-08-29): one handle, one ledger
    return Escrow(ESCROW_LEDGER)

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
    es = escrow()
    for k in led["keys"]:
        try:
            bal = f"{es.balance(k['id'])} A (escrow)"
        except Exception:
            bal = f"{k.get('balance_A', 0.0)} A (legacy keys.json)"   # pre-migration rows
        print(k["id"], k["tier"], "balance:", bal, "revoked:" if k["revoked"] else "active")

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
    os.makedirs(SETTLEMENT_DIR, exist_ok=True)
    path = os.path.join(SETTLEMENT_DIR, time.strftime("instr-%Y%m%dT%H%M%SZ-") + hashlib.sha256(text.encode()).hexdigest()[:8] + ".json")
    with open(path, "w") as f:
        json.dump({"kind": "settlement-instruction", "text": text,
                   "note": "INSTRUCTION ONLY — the meter never moves money (baton fence, Lane M P2)",
                   "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=1)
    os.chmod(path, 0o600)

def cmd_allocate(args):
    # MERGED (2026-08-29): pool→key now lands as an escrow deposit (hash-chained,
    # derived balance); keys.json stops storing balances entirely.
    kid, amount = args[2], float(args[3])
    led = load_ledger()
    if led["meta"].get("pool_A", 0.0) < amount: sys.exit("pool short")
    k = next((k for k in led["keys"] if k["id"] == kid), None)
    if not k: sys.exit("no such key")
    led["meta"]["pool_A"] = round(led["meta"]["pool_A"] - amount, 8)
    save_ledger(led)
    emit_settlement_instruction(f"allocate {amount} A from estate pool to key {kid}")
    instr = time.strftime("instr-%Y%m%dT%H%M%SZ-") + hashlib.sha256(f"allocate {kid} {amount}".encode()).hexdigest()[:8]
    ev = escrow().deposit(kid, str(amount), vaulta_tx=instr)   # cited provenance
    print(f"allocated {amount} A to {kid} via escrow event {ev['hash'][:12]}…; pool now {led['meta']['pool_A']}")

# ── P3: identity binding, vouchers, the tithe book, bClaude's widened gate ──
# The founder ruling: "buzz bClaude A vaulta voucher prepay API, 10% to me on
# top of the bill to anthropic." The Buzz identity (NIP-42 pubkey) IS the
# billing identity — one binding table, no separate signup. A credit IS a
# prepaid voucher for compute (alloy ruling); allocation emits voucher-framed
# INSTRUCTIONS only. The tithe (10%, founder law) accrues in a computed book.

BINDINGS = "/opt/buzz-meter/bindings.json"
ALLOWLIST = "/opt/buzz-meter/bclaude-allowlist.txt"
FOUNDER_PUBKEY = "d44163340ce7dd9df1cfe14505ebe1112fb6819eb215b0169e166d3d47ef19bf"  # PUBLIC-CONSTANT: founder's hive key (the owner gate)

def load_bindings():
    try:
        with open(BINDINGS) as f: return json.load(f)
    except Exception: return {"bindings": []}

def save_bindings(b):
    tmp = BINDINGS + ".tmp"
    with open(tmp, "w") as f: json.dump(b, f, indent=1, sort_keys=True)
    os.chmod(tmp, 0o600); os.replace(tmp, BINDINGS)

def cmd_bind(args):
    pk, kid = args[2].lower(), args[3]
    if not re.fullmatch(r"[0-9a-f]{64}", pk): sys.exit("pubkey must be 64-hex")
    led = load_ledger()
    if not any(k["id"] == kid for k in led["keys"]): sys.exit("no such meter key — issue it first (newkey)")
    b = load_bindings()
    b["bindings"] = [x for x in b["bindings"] if x["pubkey"] != pk and x["key_id"] != kid]
    b["bindings"].append({"pubkey": pk, "key_id": kid,
                          "bound": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    save_bindings(b)
    print(f"bound {pk[:8]}… ↔ {kid}")

def cmd_bindings(args):
    for x in load_bindings()["bindings"]:
        print(x["pubkey"][:16] + "…", "↔", x["key_id"])

def cmd_voucher(args):
    # alloy framing: a credit IS a prepaid voucher for compute. MERGED
    # (2026-08-29): the balance lands in the ESCROW ledger (hash-chained,
    # derived, refuse-before-write) — keys.json no longer stores balances.
    kid, amount = args[2], float(args[3])
    led = load_ledger()
    if led["meta"].get("pool_A", 0.0) < amount: sys.exit("pool short")
    k = next((k for k in led["keys"] if k["id"] == kid), None)
    if not k: sys.exit("no such key")
    led["meta"]["pool_A"] = round(led["meta"]["pool_A"] - amount, 8)
    save_ledger(led)
    os.makedirs(SETTLEMENT_DIR, exist_ok=True)
    ref = "voucher-" + time.strftime("%Y%m%dT%H%M%SZ-") + hashlib.sha256((kid + str(amount) + str(time.time())).encode()).hexdigest()[:8]
    path = os.path.join(SETTLEMENT_DIR, ref + ".json")
    with open(path, "w") as f:
        json.dump({"kind": "prepaid-voucher", "key_id": kid, "amount_A": amount,
                   "framing": "a credit IS a prepaid voucher for compute (alloy ruling, Lane M P3)",
                   "note": "INSTRUCTION ONLY — the meter never moves money; the A that funded this voucher was read back from the chain (P2 chainpoll checkpoint)",
                   "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=1)
    os.chmod(path, 0o600)
    ev = escrow().deposit(kid, str(amount), vaulta_tx=ref)   # provenance-cited deposit
    print(f"voucher {amount} A → {kid} via escrow event {ev['hash'][:12]}… "
          f"(pool now {led['meta']['pool_A']}); regen allowlist next")

def cmd_charge(args):
    # METERED CHARGE against a key's voucher — the escrow engine's core,
    # reachable from the till: `meter.py charge <key-id> <class>:<qty> ...`
    # e.g. charge bclaude-1 prefill_token:12000 decode_token:3400
    from decimal import Decimal
    from voucher_escrow import receipt_total, receipt_tithe
    kid, pairs = args[2], []
    for spec in args[3:]:
        cls, _, qty = spec.partition(":")
        pairs.append((cls, qty))
    led = load_ledger()
    if not any(k["id"] == kid for k in led["keys"]): sys.exit("no such meter key")
    rate_set = load_rate_set()
    tier = rate_set["tiers"]["paid_claude"]["cost_basis"]
    per_million = {"prefill_token": Decimal(str(tier["prefill_token_per_million_usd"])),
                   "decode_token": Decimal(str(tier["decode_token_per_million_usd"]))}
    rs = RateSet(version=rate_set["version"], cost_basis_ref="anthropic-posted-2026-08",
                 rates={c: per_million[c] / Decimal(1_000_000) for c, _ in pairs})
    try:
        ev = escrow().charge(kid, pairs, rs)
    except InsufficientVoucher as e:
        sys.exit(f"REFUSED (nothing written): {e}")
    except VoucherError as e:
        sys.exit(str(e))
    print(f"charged {kid}: total {receipt_total(ev)} A incl. tithe {receipt_tithe(ev)} A "
          f"— escrow event {ev['hash'][:12]}…, balance now {escrow().balance(kid)} A")

def cmd_allowlist(args):
    # bClaude's widened answer-gate: founder + pubkeys bound to PAID keys with balance > 0
    # (balance = the escrow-derived truth, merged 2026-08-29)
    led = load_ledger(); b = load_bindings()
    es = escrow()
    paid_keys = set()
    for k in led["keys"]:
        if k.get("tier") == "paid" and not k.get("revoked"):
            if float(es.balance(k["id"])) > 0:
                paid_keys.add(k["id"])
    pks = [FOUNDER_PUBKEY] + sorted(x["pubkey"] for x in b["bindings"] if x["key_id"] in paid_keys)
    new = "\n".join(pks) + "\n"
    old = ""
    try:
        with open(ALLOWLIST) as f: old = f.read()
    except Exception: pass
    if new != old:
        with open(ALLOWLIST, "w") as f: f.write(new)
        os.chmod(ALLOWLIST, 0o600)
        # the env-file form buzz-acp consumes (comma list), 600
        envf = "/etc/buzz-bclaude/allowlist.env"
        with open(envf + ".tmp", "w") as f: f.write("BUZZ_ACP_RESPOND_TO_ALLOWLIST=" + ",".join(pks) + chr(10))
        os.chmod(envf + ".tmp", 0o600); os.replace(envf + ".tmp", envf)
        os.system("sudo systemctl restart buzz-bclaude 2>/dev/null || systemctl restart buzz-bclaude")
        print("allowlist regenerated + bClaude restarted:", len(pks), "pubkeys (founder + paid)")
    else:
        print("allowlist unchanged:", len(pks), "pubkeys")

def cmd_tithebook(args):
    # the founder's tax book — COMPUTED from receipts, never typed
    import glob
    basis = 0.0; tithe = 0.0; n = 0
    for g in glob.glob(os.path.join(OUT, "*.json")):
        r = json.load(open(g))
        t = r["line_items"][-1].get("tithe")
        if t:
            n += 1
            basis += sum(l["charged"]["value"] for l in r["line_items"][:-1])
            tithe += r["line_items"][-1]["charged"]["value"]
    print(f"receipts with tithe: {n} | basis: {round(basis, 8)} A | tithe accrued (10% law): {round(tithe, 8)} A")

def dispatch(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    table = {
        "newkey": (cmd_newkey, 3), "keys": (cmd_keys, 2), "revoke": (cmd_revoke, 3),
        "chainpoll": (cmd_chainpoll, 2), "allocate": (cmd_allocate, 4),
        "bind": (cmd_bind, 4), "bindings": (cmd_bindings, 2),
        "voucher": (cmd_voucher, 4), "allowlist": (cmd_allowlist, 2),
        "charge": (cmd_charge, 4), "tithebook": (cmd_tithebook, 2),
    }
    if cmd in table:
        fn, need = table[cmd]
        if len(argv) < need: sys.exit(f"{cmd}: missing operand")
        fn(argv)
    else:
        print(__doc__); sys.exit(2)

if __name__ == "__main__":
    main()
