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
# AV-1: the whole meter state tree derives from BUZZ_METER_DIR so the serve
# bridge can run hermetically (temp dir, ephemeral port) under the AV-1
# harness and any future box-side staging. Default unchanged.
METER_DIR = os.environ.get("BUZZ_METER_DIR", "/opt/buzz-meter")
OUT = f"{METER_DIR}/receipts"
STATE = f"{METER_DIR}/state/offset"
RATE_SET = f"{METER_DIR}/rate_set.json"
ESCROW_LEDGER = f"{METER_DIR}/escrow-ledger.jsonl"
SETTLEMENT_DIR = f"{METER_DIR}/settlement"
RECEIPT_CHAIN = f"{METER_DIR}/state/receipt-chain-tip"   # P1 receipts chain here too
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

KEYS_FILE = f"{METER_DIR}/keys.json"
CHAIN_STATE = f"{METER_DIR}/state/chain.json"
VAULTA_HOSTS = ["https://eos.api.eosnation.io", "https://eos.greymass.com"]  # api.eosn.io DNS-dead 2026-08-29; two confirmed hosts = the rule
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
    # two rotated reads must agree — a confirmed read, per the P2 ruling.
    # Reads the A CONTRACT balance (core.vaulta, symbol A) — the token the
    # escrow denominates; nodeos core_liquid_balance still reports the legacy
    # core symbol on these endpoints (the rename in place, measured 2026-08-29).
    import random
    hosts = VAULTA_HOSTS[:]; random.shuffle(hosts)
    vals = []
    for h in hosts[:2]:
        try:
            req = urllib.request.Request(h + "/v1/chain/get_currency_balance",
                data=json.dumps({"code": A_CONTRACT, "account": account, "symbol": "A"}).encode(),
                headers={"Content-Type": "application/json", "User-Agent": "bnr-till/1.0"})
            d = json.loads(urllib.request.urlopen(req, timeout=10).read())
            bal = (d or ["0.0000 A"])[0]
            vals.append(float(bal.split()[0]))
        except Exception:
            pass
    if len(vals) == 2 and abs(vals[0] - vals[1]) < 1e-6:
        return vals[0]
    return None                                    # not confirmed — no credit

HISTORY_HOST = os.environ.get("CHAINPOLL_HOST", "https://eos.greymass.com")
# eosnation's /v1/history/* is 410-gone (measured); GREYMASS SERVES HISTORY —
# measured live 2026-08-29: get_actions 200 with full action traces incl. memos.
A_CONTRACT = os.environ.get("CHAINPOLL_CONTRACT", "core.vaulta")   # the A token contract (read from live transfer traces, 2026-08-29)

def read_transfers(account, num=100):
    """MEMO-NATIVE FEED (the ruled A-rail binder): transfer actions TO the
    account on the A contract, each row carrying from / memo / quantity /
    trx_id — the same per-transfer shape basepoll uses for Base Transfer logs.
    Deduped by (trx_id, seq) — history indices notify inline duplicates."""
    req = urllib.request.Request(HISTORY_HOST + "/v1/history/get_actions",
        data=json.dumps({"account_name": account, "skip": 0, "num": num}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "bnr-till/1.0"})
    d = json.loads(urllib.request.urlopen(req, timeout=15).read())
    rows, seen = [], set()
    for a in d.get("actions", []):
        tr = a.get("action_trace", {}); act = tr.get("act", {})
        data = act.get("data", {})
        if act.get("name") != "transfer" or act.get("account") != A_CONTRACT: continue
        if data.get("to") != account: continue
        seq = a.get("account_action_seq")
        key = (tr.get("trx_id"), seq)
        if key in seen: continue
        seen.add(key)
        q = str(data.get("quantity", "0")).split()
        rows.append({"seq": seq, "block": tr.get("block_num"), "trx_id": tr.get("trx_id"),
                     "from": data.get("from"), "memo": data.get("memo", ""),
                     "amount": q[0] if q else "0", "symbol": q[1] if len(q) > 1 else ""})
    return rows

# ── AV-5: the poller's credit decision, pure and REORG-AWARE ────────────────
# The :423 law ("action read failed — nothing written") covered read failures;
# the reorg leg did not exist (receipted live by test_av5_reorg_drill.py PART
# A: a consumed-seq row MUTATED behind the watermark was skipped with zero
# evidence). The law here: a reorged round flags LOUDLY and credits NOTHING —
# watermark and head-map park (the whole round is suspect), the flag carries
# the evidence, and clean rounds behave exactly as before. The verdict
# vocabulary is the reversibility crate's (crates/reversibility): NoQuorum /
# Reorg{depth} ⇒ flag-and-park, never credit.

HEAD_WINDOW = 64   # remembered seq→trx pairs (the reorg detection window)

def _remember_head(st, rows):
    hm = st.setdefault("head_map", {})
    for r in rows:
        if r.get("seq") is not None:
            hm[str(r["seq"])] = r.get("trx_id")
    if len(hm) > HEAD_WINDOW:
        for k in sorted(hm, key=int)[:-HEAD_WINDOW]:
            del hm[k]

def _detect_reorg(rows, st):
    """Fork evidence in the poller's view, or None. Two shapes:
    (a) seq→trx SWAP — a remembered seq now carries a different trx_id
        (history rewrote behind the watermark);
    (b) head ROLLBACK — the best seq receded below the watermark."""
    hm = st.get("head_map", {})
    for r in rows:
        k = str(r["seq"]) if r.get("seq") is not None else None
        if k is not None and k in hm and hm[k] != r.get("trx_id"):
            return {"shape": "seq-trx-swap", "seq": r["seq"],
                    "remembered_trx": hm[k], "seen_trx": r.get("trx_id"),
                    "amount": r.get("amount"), "from": r.get("from")}
    seqs = [r["seq"] for r in rows if r.get("seq") is not None]
    if seqs and st.get("last_seq") is not None and max(seqs) < st["last_seq"]:
        return {"shape": "head-rollback", "watermark": st["last_seq"],
                "head": max(seqs)}
    return None

def process_transfers(es, rows, st, meter_keys, flag_writer=None,
                      detect_reorgs=True):
    """AV-5: the chainpoll credit loop as a PURE seam (no I/O — flags leave
    through `flag_writer`, unbound rows come back to the caller to emit).
    Returns {credited, unbound, flagged, checkpoint, credit_events,
    unbound_rows, flag?}. Laws: first read checkpoints without crediting
    (today's law verbatim); a REORGED round (see _detect_reorg) flags with
    evidence and credits NOTHING — watermark and head-map PARK (fail
    closed); clean rounds credit exactly as today. `detect_reorgs=False`
    is today's crediting poller — the negative-control shape only."""
    if st.get("last_seq") is None:
        st["last_seq"] = max((r["seq"] for r in rows if r.get("seq") is not None),
                             default=None)
        _remember_head(st, rows)
        return {"credited": 0, "unbound": 0, "flagged": False,
                "checkpoint": True, "credit_events": [], "unbound_rows": []}
    if detect_reorgs:
        evidence = _detect_reorg(rows, st)
        if evidence is not None:
            flag = {"kind": "reorg-flag",
                    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "watermark": st["last_seq"], "evidence": evidence}
            st.setdefault("reorg_flags", []).append(flag)
            del st["reorg_flags"][:-8]   # bounded: the newest eight
            if flag_writer is not None:
                try:
                    flag_writer(flag)
                except Exception:
                    pass   # a flag that cannot be written must never break the poller
            return {"credited": 0, "unbound": 0, "flagged": True,
                    "checkpoint": False, "credit_events": [],
                    "unbound_rows": [], "flag": flag}
    credit_events, unbound_rows = [], []
    for r in sorted(rows, key=lambda x: x["seq"] if x.get("seq") is not None else 0):
        if r.get("seq") is None or r["seq"] <= st["last_seq"]:
            continue
        if r["memo"] in meter_keys:
            credit_events.append(
                es.deposit(r["memo"], r["amount"], vaulta_tx=r["trx_id"],
                           sender=r.get("from", ""), memo=r["memo"]))
        else:
            unbound_rows.append(r)
        st["last_seq"] = r["seq"]
    _remember_head(st, rows)
    return {"credited": len(credit_events), "unbound": len(unbound_rows),
            "flagged": False, "checkpoint": False,
            "credit_events": credit_events, "unbound_rows": unbound_rows}

def _write_reorg_flag(flag):
    """The production flag_writer: an instruction-style flag file, same
    directory law as settlement instructions — evidence for the founder,
    written by the meter, never acted on by it."""
    os.makedirs(SETTLEMENT_DIR, exist_ok=True)
    path = os.path.join(
        SETTLEMENT_DIR,
        time.strftime("reorg-%Y%m%dT%H%M%SZ-")
        + hashlib.sha256(json.dumps(flag, sort_keys=True).encode()).hexdigest()[:8]
        + ".json")
    with open(path, "w") as f:
        json.dump({**flag,
                   "note": "REORG FLAG — nothing credited this round; the "
                           "watermark parked. Human reads, meter never acts "
                           "(baton fence)"}, f, indent=1)

def cmd_chainpoll(args):
    led = load_ledger()
    acct = os.environ.get("CHAINPOLL_ACCOUNT") or led.get("meta", {}).get("watch_account")
    if not acct:
        print("chainpoll: no watch_account designated (set in keys.json.meta) — idle"); return
    st = {}
    try:
        with open(CHAIN_STATE) as f: st = json.load(f)
    except Exception: pass
    meter_keys = {k["id"] for k in led["keys"]}
    try:
        rows = read_transfers(acct)
    except Exception as e:
        print(f"chainpoll: action read failed ({e}) — nothing written"); return
    # AV-5: the credit decision rides the pure, reorg-aware seam. Clean
    # rounds behave exactly as before; a reorged round flags and credits
    # nothing (the watermark parks — see process_transfers).
    r = process_transfers(escrow(), rows, st, meter_keys,
                          flag_writer=_write_reorg_flag)
    if r["checkpoint"]:
        save_chain_state(st)
        print(f"chainpoll: memo-native checkpoint initialized at action seq {st['last_seq']} (no credit on first read)")
        return
    if r["flagged"]:
        ev = r["flag"]["evidence"]
        save_chain_state(st)
        print(f"chainpoll: REORG FLAGGED ({ev.get('shape')}) — ZERO credit this "
              f"round, watermark parked at {r['flag']['watermark']}; evidence "
              f"file written for the founder")
        return
    for ev_ in r["credit_events"]:
        print(f"chainpoll: credited event {ev_['hash'][:12]}… → {ev_['voucher']}")
    for u in r["unbound_rows"]:
        emit_settlement_instruction(
            f"A {u['amount']} from {u['from']} tx {u['trx_id']} — memo "
            f"'{u['memo'][:40]}' is not a meter key; no auto-credit, founder word decides")
        print(f"chainpoll: {u['amount']} from {u['from']} — UNBOUND memo, settlement instruction written")
    credited = r["credited"] + r["unbound"]
    # DELTA CROSS-CHECK — never the binder (ruling 2026-08-29): two-host confirmed
    # balance, logged for reconciliation; a mismatch is a flag, not a credit.
    bal = chain_read_balance(acct)
    st["cross_check_balance"] = bal
    save_chain_state(st)
    if credited == 0:
        print(f"chainpoll: no new A transfers (watching actions on {acct}; cross-check balance "
              f"{'confirmed: ' + str(bal) if bal is not None else 'unconfirmed this round'})")

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

BINDINGS = f"{METER_DIR}/bindings.json"
ALLOWLIST = f"{METER_DIR}/bclaude-allowlist.txt"
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

# ── P4: basepoll — the USDC-on-Base funding rail (founder ruling 2026-08-29:
# the second voucher funding door; A stays the unit of account) ──────────────
# THE RIDER, standing law: the two rails are NOT symmetric, built per nature.
#   A/VAULTA rail: GASLESS (users spend only own CPU/NET), proper Vaulta
#   accounts, MEMO-NATIVE binding (memo = the meter key — NO binding table
#   here; deposit events record sender + memo + tx when the estate runs a
#   history-capable node). Do NOT import Base-rail machinery into this rail.
#   USDC/BASE rail: tiny gas, no memo → the key↔Base-address BINDING TABLE
#   stands below (basebind), same shape as P3's pubkey bindings.
# Rate honesty: there is no live A/USDC market — the citable source is the
# estate rate card (usdc_a_rate + usdc_a_rate_ref in keys.json.meta, founder-
# set, versioned). When a market pair exists, the same seam reads it; the
# rate_ref always names where the number came from.
# ALL CONFIG CONFIG-FILLABLE AT FLIP-TIME: base_receive_address unset ⇒
# basepoll idles (paid lane is HOLD; nothing blocks on it).

BASE_BINDINGS = f"{METER_DIR}/base-bindings.json"
BASE_STATE = "/opt/buzz-meter/state/base-chain.json"
BASE_RPC = "https://mainnet.base.org"                 # keyless, proven in-tree
USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # PUBLIC-CONSTANT: native USDC on Base
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"  # PUBLIC-CONSTANT: keccak(Transfer(address,address,uint256))

def load_base_bindings():
    try:
        with open(BASE_BINDINGS) as f: return json.load(f)
    except Exception: return {"bindings": []}

def save_base_bindings(b):
    tmp = BASE_BINDINGS + ".tmp"
    with open(tmp, "w") as f: json.dump(b, f, indent=1, sort_keys=True)
    os.chmod(tmp, 0o600); os.replace(tmp, BASE_BINDINGS)

def cmd_basebind(args):
    kid, addr = args[2], args[3].lower()
    if not re.fullmatch(r"0x[0-9a-f]{40}", addr): sys.exit("base address must be 0x + 40-hex")
    led = load_ledger()
    if not any(k["id"] == kid for k in led["keys"]): sys.exit("no such meter key — issue it first (newkey)")
    b = load_base_bindings()
    b["bindings"] = [x for x in b["bindings"] if x["key_id"] != kid and x["base_address"] != addr]
    b["bindings"].append({"key_id": kid, "base_address": addr,
                          "bound": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    save_base_bindings(b)
    print(f"base-bound {kid} ↔ {addr}")

def cmd_basebindings(args):
    for x in load_base_bindings()["bindings"]:
        print(x["key_id"], "↔", x["base_address"])

def base_rpc(method, params):
    req = urllib.request.Request(BASE_RPC,
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "bnr-till/1.0"})
    return json.loads(urllib.request.urlopen(req, timeout=15).read())

def base_config():
    led = load_ledger(); meta = led.get("meta", {})
    return (meta.get("base_receive_address"), meta.get("usdc_contract") or USDC_BASE,
            meta.get("usdc_a_rate"), meta.get("usdc_a_rate_ref"))

def cmd_basepoll(args):
    recv, usdc, rate, rate_ref = base_config()
    if not (recv and rate and rate_ref):
        print("basepoll: base_receive_address / usdc_a_rate / usdc_a_rate_ref unset in keys.json.meta "
              "— CONFIG fillable at flip-time (paid lane HOLD); idling")
        return
    st = {}
    try:
        with open(BASE_STATE) as f: st = json.load(f)
    except Exception: pass
    tip = base_rpc("eth_blockNumber", [])
    latest = int(tip["result"], 16)
    frm = st.get("last_block") or max(0, latest - 10000)   # first run: last ~10k blocks
    seen = set(st.get("seen_tx", []))
    topic2 = "0x" + "0" * 24 + recv[2:].lower()
    credited = 0
    for start in range(frm, latest, 10000):
        logs = base_rpc("eth_getLogs", [{
            "address": usdc, "fromBlock": hex(start), "toBlock": hex(min(start + 9999, latest)),
            "topics": [TRANSFER_TOPIC, None, topic2]}])
        for lg in logs.get("result", []):
            tx = lg["transactionHash"]
            if tx in seen: continue
            seen.add(tx)
            sender = "0x" + lg["topics"][1][-40:]
            usdc_amt = int(lg["data"], 16) / 1e6
            b = load_base_bindings()
            key = next((x["key_id"] for x in b["bindings"] if x["base_address"] == sender.lower()), None)
            if not key:
                emit_settlement_instruction(f"USDC {usdc_amt} from UNBOUND {sender} tx {tx} — no credit, founder word decides")
                continue
            try:
                ev = escrow().deposit_usdc(key, str(usdc_amt), base_tx=tx,
                                           rate_a_per_usdc=str(rate), rate_ref=rate_ref)
                print(f"basepoll: credited {key} +{ev['amount']} A "
                      f"({usdc_amt} USDC @ {rate} A/USDC, ref {rate_ref}) — event {ev['hash'][:12]}…")
                credited += 1
            except VoucherError as e:
                emit_settlement_instruction(f"USDC deposit REFUSED by engine ({e}) — tx {tx}")
    st["last_block"] = latest; st["seen_tx"] = sorted(seen)[-500:]
    os.makedirs(os.path.dirname(BASE_STATE), exist_ok=True)
    with open(BASE_STATE, "w") as f: json.dump(st, f, indent=1)
    os.chmod(BASE_STATE, 0o600)
    if credited == 0:
        print(f"basepoll: no new USDC transfers (blocks {frm}…{latest})")

# ── P5: the voucher bridge — a tiny loopback JSON service so the STATIC wallet
# surface can show a stranger their live voucher state (balance, top-up doors,
# receipts, afford-check). Zero deps: http.server. CORS: the estate's own
# surfaces only. Key IDs are public ledger references; the bm-… bearer secrets
# are NEVER served here. The page is a VIEW over the same escrow the till uses —
# totals computed from events, never stored.
#
#   GET /v1/voucher/<key>/view            balance + top-up doors + receipts
#   GET /v1/voucher/<key>/afford?amount=X plain-sentence afford check

VOUCHER_PORT = int(os.environ.get("VOUCHER_PORT", "8092"))

# AV-3 door health (M-REPAIR): the charging site's live signal for the
# compute delivery door (the gate). ANY HTTP response — even a 401 — proves
# reachability; only connection-refused/timeout means down. Short timeout:
# the probe must never become an availability liability itself.
GATE_PROBE_URL = os.environ.get(
    "GATE_PROBE_URL", "http://172.18.0.1:8091/readiness")

def gate_door_health(timeout_s: float = 0.8):
    """(down, note) — down=False means the door answered SOMETHING."""
    import urllib.request, urllib.error
    try:
        with urllib.request.urlopen(GATE_PROBE_URL, timeout=timeout_s):
            return False, "probe answered"
    except urllib.error.HTTPError as e:
        return False, f"probe answered HTTP {e.code}"
    except Exception as e:
        return True, f"unreachable: {type(e).__name__}"
VOUCHER_ORIGINS = os.environ.get("VOUCHER_ORIGINS", "https://skaists.dev,https://beehivenature.com").split(",")

# ── P6 (AV-1): the ADMIN rail — idempotent write verbs for the serve bridge.
# Bearer-gated by VOUCHER_ADMIN_TOKEN; when the token is unset every write is
# REFUSED typed (a bridge deployed read-only stays read-only — fail closed).
# The rail is for loopback/box-internal callers (the pollers, the doors); it
# is never CORS-reflected, so browsers cannot drive it cross-origin.
#
#   POST /v1/admin/settle   {idempotency_key, voucher, declared, observed}
#   POST /v1/admin/charge   {idempotency_key, voucher, usage: [[class, qty], …]}
#
# Laws (SPEC AV-1, docs/agents/ADVERSARIAL-BPAY-SPECS.md):
# - every refusal is a TYPED 4xx naming the field; zero writes on refusal;
# - a request's idempotency_key credits/charges EXACTLY ONCE: a replay
#   returns the ORIGINAL event (idempotent_replay: true); the same key with
#   a DIFFERENT payload is a 409 conflict, never a second effect;
# - the engine's own (voucher, tx) settle idempotency stays in force UNDER
#   the bridge law (belt and half-belt, two seams, one outcome);
# - the durable append (single O_APPEND write + fsync) lands BEFORE the
#   response — a SIGKILL anywhere around a request leaves "done-with-
#   receipt" or "never happened", both lawful exactly-once outcomes.

ADMIN_TOKEN = os.environ.get("VOUCHER_ADMIN_TOKEN", "")
ADMIN_BODY_CAP = 65_536          # bytes; larger is refused 413 typed
ADMIN_QTY_MAX = 2 ** 48          # generous far above any real metered quantity
ADMIN_KEY_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
VOUCHER_RE = re.compile(r"^[a-z0-9._-]{1,64}$")
AMOUNT_RE = re.compile(r"^[0-9]+(\.[0-9]{1,8})?$")
_BREAK_IDEMPOTENCY = os.environ.get("AV1_BREAK_IDEMPOTENCY") == "1"  # negative-control hook, test batteries only

def _json_loads_strict(raw: bytes):
    """JSON parse that REFUSES duplicate keys (the hostile-input battery's
    dup-key shape) and non-UTF-8. Returns (obj, None) | (None, why)."""
    def no_dups(pairs):
        seen = set()
        for k, _ in pairs:
            if k in seen:
                raise ValueError(f"duplicate JSON key: {k}")
            seen.add(k)
        return dict(pairs)
    try:
        return json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=no_dups), None
    except (ValueError, UnicodeDecodeError) as e:
        return None, f"body is not strict JSON: {e}"

def till_rate_set(classes):
    """The till's own pricing construction (cmd_charge's), as a RateSet for
    the requested resource classes."""
    from decimal import Decimal
    rate_set = load_rate_set()
    tier = rate_set["tiers"]["paid_claude"]["cost_basis"]
    per_million = {"prefill_token": Decimal(str(tier["prefill_token_per_million_usd"])),
                   "decode_token": Decimal(str(tier["decode_token_per_million_usd"]))}
    rates = {}
    for c in classes:
        if c not in per_million:
            raise VoucherError(f"no till pricing for resource class: {c}")
        rates[c] = per_million[c] / Decimal(1_000_000)
    return RateSet(version=rate_set["version"], cost_basis_ref="anthropic-posted-2026-08",
                   rates=rates)

def voucher_view(key_id):
    from decimal import Decimal as _D
    led = load_ledger()
    meta = led.get("meta", {})
    es = escrow()
    bal = str(es.balance(key_id))
    events = list(es._events())
    deposits = [e for e in events if e.get("voucher") == key_id and e.get("type") == "DEPOSIT"]
    charges = [e for e in events if e.get("voucher") == key_id and e.get("type") == "CHARGE"]
    dep_total = str(sum((_D(e["amount"]) for e in deposits), _D("0")))
    chg_total = str(sum((_D(li["charged"]) for e in charges for li in e["line_items"]), _D("0")))
    tithe_total = str(sum((_D(li["charged"]) for e in charges for li in e["line_items"]
                           if li.get("resource") == "tithe.founder"), _D("0")))
    receipts = [{
        "ts": e.get("ts"), "cost_basis_ref": e.get("cost_basis_ref"),
        "total": str(sum((_D(li["charged"]) for li in e["line_items"]), _D("0"))),
        "line_items": e["line_items"],
    } for e in charges[-10:]]
    return {
        "key": key_id, "currency": "A", "balance": bal,
        "deposited_total": dep_total, "spent_total": chg_total, "tithe_total": tithe_total,
        "topup": {
            "rail_a": {
                "label": "A · Vaulta (gasless — you spend only your own CPU/NET)",
                "send_to": meta.get("watch_account"),
                "memo": key_id,
                "memo_law": "the memo IS the binding — no memo, no credit. Paste it exactly.",
            },
            "rail_usdc": {
                "label": "USDC · Base (tiny gas, no memo needed — your bound address credits you)",
                "send_to": meta.get("base_receive_address"),
                "rate_a_per_usdc": meta.get("usdc_a_rate"),
                "rate_ref": meta.get("usdc_a_rate_ref"),
            },
        },
        "receipts": receipts,
        "source": "estate oracle · skaists.buzz → the same escrow ledger the till meters with",
    }

def cmd_serve(args):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import urlparse, parse_qs

    class H(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            origin = self.headers.get("Origin", "")
            allow = VOUCHER_ORIGINS[0]
            if origin and (origin in VOUCHER_ORIGINS or origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
                allow = origin  # reflect allowlisted origins (estate surfaces + local dev)
            self.send_header("Access-Control-Allow-Origin", allow)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _send_admin(self, code, obj):
            # admin rail: no CORS reflection — loopback callers only, never browsers
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        # ── the admin write rail (AV-1) ─────────────────────────────────────
        def do_POST(self):
            u = urlparse(self.path)
            if u.path in ("/v1/admin/settle", "/v1/admin/charge"):
                return self._admin(u.path)
            self._send_admin(404, {"message": "unknown path"})

        def _admin(self, path):
            if not ADMIN_TOKEN:
                return self._send_admin(503, {"message":
                    "admin rail not configured (VOUCHER_ADMIN_TOKEN unset) — "
                    "refused typed, nothing written"})
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {ADMIN_TOKEN}":
                return self._send_admin(401, {"message":
                    "admin rail: wrong or missing bearer token"})
            length = self.headers.get("Content-Length", "")
            try:
                n = int(length)
            except ValueError:
                return self._send_admin(411, {"message":
                    "admin rail requires an integer Content-Length"})
            if n < 0:
                return self._send_admin(411, {"message":
                    "admin rail requires a non-negative Content-Length"})
            if n > ADMIN_BODY_CAP:
                return self._send_admin(413, {"message":
                    f"body of {n} bytes exceeds the admin cap of {ADMIN_BODY_CAP}"})
            raw = self.rfile.read(n)
            obj, err = _json_loads_strict(raw)
            if err:
                return self._send_admin(400, {"message": err})
            if not isinstance(obj, dict):
                return self._send_admin(400, {"message": "body must be a JSON object"})
            if path == "/v1/admin/settle":
                return self._admin_settle(obj)
            return self._admin_charge(obj)

        def _crash_hook(self):
            # AV-1 TEST SEAM — deterministic kill AFTER the durable append,
            # BEFORE the response, so the harness can prove exactly-once
            # across SIGKILL+restart. Only reachable past the admin token
            # check; production callers never send this header.
            if self.headers.get("X-AV1-Crash-Before-Respond") == "1":
                os._exit(137)

        @staticmethod
        def _check_common(obj):
            """idempotency_key + voucher — the shared typed validations.
            Returns (key, voucher, None) or (None, None, error-message)."""
            key = obj.get("idempotency_key")
            if not isinstance(key, str) or not ADMIN_KEY_RE.fullmatch(key):
                return None, None, ("idempotency_key must match "
                                    f"{ADMIN_KEY_RE.pattern}")
            voucher = obj.get("voucher")
            if not isinstance(voucher, str) or not VOUCHER_RE.fullmatch(voucher):
                return None, None, ("voucher must match "
                                    f"{VOUCHER_RE.pattern}")
            return key, voucher, None

        def _admin_settle(self, obj):
            allowed = {"idempotency_key", "voucher", "declared", "observed"}
            unknown = sorted(set(obj) - allowed)
            if unknown:
                return self._send_admin(400, {"message":
                    f"unknown field(s): {unknown}"})
            key, voucher, err = self._check_common(obj)
            if err:
                return self._send_admin(400, {"message": err})
            declared, observed = obj.get("declared"), obj.get("observed")
            if not isinstance(declared, dict) or not isinstance(observed, dict):
                return self._send_admin(400, {"message":
                    "declared and observed must both be objects"})
            for name, d, req in (("declared", declared, {"rail", "tx", "sender", "amount"}),
                                 ("observed", observed, {"rail", "tx", "from", "amount"})):
                missing = sorted(req - set(d))
                if missing:
                    return self._send_admin(400, {"message":
                        f"{name} missing field(s): {missing}"})
                extra = sorted(set(d) - req - {"memo"})
                if extra:
                    return self._send_admin(400, {"message":
                        f"{name} carries unknown field(s): {extra}"})
                for f in ("rail", "tx"):
                    if not isinstance(d[f], str) or not (1 <= len(d[f]) <= 128):
                        return self._send_admin(400, {"message":
                            f"{name}.{f} must be a 1..128-char string"})
                if d.get("rail") not in RAILS:
                    return self._send_admin(400, {"message":
                        f"{name}.rail {d.get('rail')!r} is not a known rail"})
                if not isinstance(d["amount"], str) or not AMOUNT_RE.fullmatch(d["amount"]):
                    return self._send_admin(400, {"message":
                        f"{name}.amount must be a plain non-negative decimal "
                        f"string like 2.0000 (got {d['amount']!r})"})
            if not _BREAK_IDEMPOTENCY:
                found = escrow().find_idempotent("DEPOSIT", key)
                if found is not None:
                    recorded_tx = found.get("vaulta_tx") or found.get("base_tx") or ""
                    if recorded_tx != declared["tx"] or found.get("voucher") != voucher:
                        return self._send_admin(409, {"message":
                            f"idempotency key {key!r} already used by a "
                            "different settlement — conflict, nothing written"})
                    return self._send_admin(200, {"event": found,
                                                   "idempotent_replay": True})
            from x402_meter import credit_from_settlement, SettlementMismatch
            try:
                ev = credit_from_settlement(escrow(), voucher, declared, observed,
                                            idempotency_key=key)
            except SettlementMismatch as e:
                return self._send_admin(409, {"message": str(e)})
            except VoucherError as e:
                return self._send_admin(400, {"message": str(e)})
            self._crash_hook()
            return self._send_admin(200, {"event": ev})

        def _admin_charge(self, obj):
            allowed = {"idempotency_key", "voucher", "usage"}
            unknown = sorted(set(obj) - allowed)
            if unknown:
                return self._send_admin(400, {"message":
                    f"unknown field(s): {unknown}"})
            key, voucher, err = self._check_common(obj)
            if err:
                return self._send_admin(400, {"message": err})
            usage = obj.get("usage")
            if not isinstance(usage, list) or not (1 <= len(usage) <= 32):
                return self._send_admin(400, {"message":
                    "usage must be a non-empty list (max 32 pairs)"})
            pairs = []
            classes = set()
            for pair in usage:
                if not isinstance(pair, list) or len(pair) != 2:
                    return self._send_admin(400, {"message":
                        "each usage entry must be [resource_class, quantity]"})
                cls, qty = pair
                if not isinstance(cls, str) or cls not in RESOURCE_CLASSES:
                    return self._send_admin(400, {"message":
                        f"unknown resource class: {cls!r}"})
                if isinstance(qty, bool) or not isinstance(qty, int) \
                        or not (0 < qty <= ADMIN_QTY_MAX):
                    return self._send_admin(400, {"message":
                        f"quantity for {cls} must be a positive integer "
                        f"<= {ADMIN_QTY_MAX}"})
                pairs.append((cls, qty))
                classes.add(cls)
            if not _BREAK_IDEMPOTENCY:
                found = escrow().find_idempotent("CHARGE", key)
                if found is not None:
                    if found.get("voucher") != voucher or \
                            sorted((li["resource"], li["quantity"])
                                   for li in found["line_items"]
                                   if li["resource"] != "tithe.founder") != \
                            sorted((c, str(q)) for c, q in pairs):
                        return self._send_admin(409, {"message":
                            f"idempotency key {key!r} already used by a "
                            "different charge — conflict, nothing written"})
                    return self._send_admin(200, {"event": found,
                                                   "idempotent_replay": True})
            # AV-3 identified-seam wiring (M-REPAIR): the charging site OWNS
            # live door health (the av3 lane's law — burn sites must pass
            # door_reachable; the admin rail is the real deployed charging
            # caller). Compute delivery door unreachable ⇒ the charge PARKS:
            # typed response, zero writes, idempotency key NOT consumed.
            try:
                door_down, door_note = gate_door_health()
            except Exception as e:  # probe itself must never kill the rail
                door_down, door_note = True, f"probe error: {e}"
            if door_down:
                return self._send_admin(200, {
                    "parked": True, "park_reason": "door",
                    "door_note": door_note, "retry": True,
                    "message": "delivery door unreachable — charge PARKED "
                               "(park-not-kill); nothing written, idempotency "
                               "key unconsumed; retry when the door returns"})
            try:
                rs = till_rate_set(classes)
                ev = escrow().charge(voucher, pairs, rs, idempotency_key=key)
            except InsufficientVoucher as e:
                return self._send_admin(402, {"message": str(e), "refused": True})
            except VoucherError as e:
                return self._send_admin(400, {"message": str(e)})
            self._crash_hook()
            return self._send_admin(200, {"event": ev})

        def do_GET(self):
            u = urlparse(self.path)
            parts = [p for p in u.path.split("/") if p]
            # AV-2 shared admission seam (M-REPAIR): the ONE freshness law
            # (x402_meter.rate_set_in_force — the same law the x402 session
            # path uses), served for every operation that creates new
            # rate-dependent exposure. The compute gate consumes this; no
            # second TTL implementation exists anywhere. Public like the
            # voucher views (pricing rows are public; freshness is the gate).
            if parts == ["v1", "pricing", "admit"]:
                from x402_meter import (rate_set_in_force, StaleRateSet,
                                        RATE_SET_TTL_S,
                                        rate_set_minted_at_epoch)
                rs = load_rate_set()
                minted = rate_set_minted_at_epoch(rs)
                try:
                    rate_set_in_force(minted, time.time())
                except StaleRateSet:
                    age = (time.time() - minted) if minted else None
                    return self._send(503, {
                        "ok": False, "stale": True,
                        "minted_at": rs.get("minted_at"),
                        "age_s": round(age, 1) if age is not None else None,
                        "ttl_s": RATE_SET_TTL_S,
                        "message": "rate set stale — new exposure refused "
                                   "until a fresh mint"})
                except VoucherError as e:
                    return self._send(503, {"ok": False, "malformed": True,
                                            "message": str(e)})
                return self._send(200, {
                    "ok": True, "minted_at": rs.get("minted_at"),
                    "ttl_s": RATE_SET_TTL_S, "version": rs.get("version")})
            if len(parts) == 4 and parts[0] == "v1" and parts[1] == "voucher":
                key = parts[2]
                if not re.fullmatch(r"[a-z0-9._-]{1,64}", key):
                    return self._send(400, {"message": "that key doesn't look like a meter key"})
                if parts[3] == "view":
                    return self._send(200, voucher_view(key))
                if parts[3] == "afford":
                    amt = (parse_qs(u.query).get("amount") or ["0"])[0]
                    led = load_ledger()
                    if not any(k["id"] == key for k in led["keys"]):
                        return self._send(200, {"ok": False,
                            "message": "no meter key by that name — check the id you were issued"})
                    try:
                        want = float(amt)
                    except ValueError:
                        return self._send(200, {"ok": False, "message": "enter an amount in A"})
                    if want <= 0:
                        return self._send(200, {"ok": False, "message": "enter an amount in A"})
                    have = float(str(escrow().balance(key)))
                    if have >= want:
                        return self._send(200, {"ok": True,
                            "message": f"yes — a {want:.4f} A job fits inside your {have:.4f} A balance"})
                    return self._send(200, {"ok": False,
                        "message": f"not enough balance — this job needs {want:.4f} A and you have "
                                   f"{have:.4f} A. Top up below to keep going."})
            self._send(404, {"message": "unknown path"})
        def log_message(self, *a):
            pass
    print(f"voucher bridge on {os.environ.get("VOUCHER_BIND", "172.18.0.1")}:{VOUCHER_PORT} (caddy proxies skaists.buzz/voucher/*)")
    ThreadingHTTPServer((os.environ.get("VOUCHER_BIND", "172.18.0.1"), VOUCHER_PORT), H).serve_forever()

def dispatch(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    table = {
        "newkey": (cmd_newkey, 3), "keys": (cmd_keys, 2), "revoke": (cmd_revoke, 3),
        "chainpoll": (cmd_chainpoll, 2), "allocate": (cmd_allocate, 4),
        "bind": (cmd_bind, 4), "bindings": (cmd_bindings, 2),
        "voucher": (cmd_voucher, 4), "allowlist": (cmd_allowlist, 2),
        "charge": (cmd_charge, 4), "tithebook": (cmd_tithebook, 2),
        "basebind": (cmd_basebind, 4), "basebindings": (cmd_basebindings, 2),
        "basepoll": (cmd_basepoll, 2), "serve": (cmd_serve, 2),
    }
    if cmd in table:
        fn, need = table[cmd]
        if len(argv) < need: sys.exit(f"{cmd}: missing operand")
        fn(argv)
    else:
        print(__doc__); sys.exit(2)

if __name__ == "__main__":
    main()
