#!/usr/bin/env python3
# ─── LICENSE ────────────────────────────────────────────────────────────────
# SPDX-License-Identifier: BUSL-1.1 (test battery for the moat engine — same
# LICENSE in this directory; tests exercise the engine, they are moat code.)
# ────────────────────────────────────────────────────────────────────────────
"""
test_serve_bridge.py — SPEC AV-1: the production serve boundary
(scripts/buzz-meter/meter.py `serve`) under crash, concurrency, and hostile
input. docs/agents/ADVERSARIAL-BPAY-SPECS.md, P0.

Red-test-first: this battery was written BEFORE the write path existed —
against the pre-AV-1 bridge every 1.x case below is RED (no admin write
endpoints: 404; and view crashes untyped where state is missing). The
receipted RED run lives in the AV-1 lane dispatch; the GREEN implementation
lands in the same lane.

Harness law (the spec's own requirements): the server is spawned as a
SUBPROCESS on an ephemeral port with a TEMP ledger dir (BUZZ_METER_DIR);
the client is scripted HTTP; kill points are DETERMINISTIC (a test-only
crash header, honored only for authed admin callers); restart reuses the
SAME ledger dir. Observable behavior only — no assumption about the
process's threading model.

Run:  python3 scripts/buzz-meter/test_serve_bridge.py   (exit 0 = green)
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ADMIN_TOKEN = "av1-admin-token"
KEY_ID = "member-av1"

PASS = []


def ok(label):
    PASS.append(label)
    print(f"  ok: {label}")


def fail(label):
    print(f"FAIL: {label}")
    sys.exit(1)


# ── the harness ─────────────────────────────────────────────────────────────

def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def make_meter_dir(root: Path):
    """A hermetic BUZZ_METER_DIR: one key, a till-shaped rate set (freshly
    minted), an empty hash-chained ledger."""
    d = root / "meter"
    d.mkdir(parents=True, exist_ok=True)
    (d / "keys.json").write_text(json.dumps({
        "meta": {"watch_account": "watch-test", "pool_A": 0.0},
        "keys": [{"id": KEY_ID, "secret": "bm-av1-secret", "tier": "paid",
                  "balance_A": 0.0, "created": "2026-09-16T00:00:00Z",
                  "revoked": False}],
    }))
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (d / "rate_set.json").write_text(json.dumps({
        "version": "av1-test-v1", "minted_at": now, "unit": "A",
        "tithe": {"percent": 10, "law": "the tithe is law, carried as its own line"},
        "tiers": {"paid_claude": {"cost_basis": {
            "prefill_token_per_million_usd": "1000000",
            "decode_token_per_million_usd": "1000000"}}},
        "lanes": [],
    }))
    (d / "escrow-ledger.jsonl").write_text("")
    return d


class Server:
    def __init__(self, root: Path, extra_env=None):
        self.root = root
        self.dir = make_meter_dir(root)
        self.port = free_port()
        self.env = {
            **os.environ,
            "BUZZ_METER_DIR": str(self.dir),
            "VOUCHER_BIND": "127.0.0.1",
            "VOUCHER_PORT": str(self.port),
            "VOUCHER_ADMIN_TOKEN": ADMIN_TOKEN,
        }
        if extra_env:
            self.env.update(extra_env)
        self.proc = None
        self.start()

    def start(self):
        self.proc = subprocess.Popen(
            [sys.executable, str(Path(__file__).parent / "meter.py"), "serve"],
            env=self.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                code, _body, _ = self.get(f"/v1/voucher/{KEY_ID}/view")
                if code == 200:
                    return
            except Exception:
                pass
            if self.proc.poll() is not None:
                fail("server died during startup")
            time.sleep(0.1)
        fail("server never became ready")

    def kill9(self):
        if self.proc and self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()

    def restart(self):
        self.kill9()
        self.start()

    # scripted HTTP client — returns (status, parsed-or-raw-body, headers)
    def request(self, method, path, body=None, headers=None, raw_body=None):
        url = f"http://127.0.0.1:{self.port}{path}"
        data = raw_body if raw_body is not None else (
            json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(url, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read()
                try:
                    return r.status, json.loads(raw), dict(r.headers)
                except Exception:
                    return r.status, raw.decode("utf-8", "replace"), dict(r.headers)
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw), dict(e.headers)
            except Exception:
                return e.code, raw.decode("utf-8", "replace"), dict(e.headers)

    def get(self, path, headers=None):
        return self.request("GET", path, headers=headers)

    def post_admin(self, path, body, headers=None):
        h = {"Authorization": f"Bearer {ADMIN_TOKEN}", **(headers or {})}
        return self.request("POST", path, body=body, headers=h)

    def post_admin_raw(self, path, raw, headers=None):
        h = {"Authorization": f"Bearer {ADMIN_TOKEN}", **(headers or {})}
        return self.request("POST", path, raw_body=raw, headers=h)

    def post_admin_crash(self, path, body):
        """Send a request carrying the deterministic crash header. EXPECTS
        the connection to die mid-response (os._exit in the handler after
        the durable append). Returns True when the server actually died."""
        try:
            self.post_admin(path, body,
                            headers={"X-AV1-Crash-Before-Respond": "1"})
            return False  # a response came back — the hook did not fire
        except Exception:
            return True

    def ledger_bytes(self):
        return (self.dir / "escrow-ledger.jsonl").read_bytes()

    def chain_verifies(self):
        from voucher_escrow import Escrow
        n = Escrow(self.dir / "escrow-ledger.jsonl").verify_chain()
        return n


def settle_body(tx, amount="2.0000", voucher=KEY_ID):
    return {
        "idempotency_key": f"settle-{tx}",
        "voucher": voucher,
        "declared": {"rail": "vaulta", "tx": tx, "sender": "member.av1",
                     "amount": amount},
        "observed": {"rail": "vaulta", "tx": tx, "from": "member.av1",
                     "amount": amount, "memo": voucher},
    }


def charge_body(key, qty=1, voucher=KEY_ID):
    # the till prices TOKEN classes (cmd_charge's construction) — the battery
    # rides the real pricing path, not an invented one
    return {
        "idempotency_key": key,
        "voucher": voucher,
        "usage": [["prefill_token", qty]],
    }


def typed_4xx(resp):
    code, body, _ = resp
    if not (400 <= code < 500):
        return False, f"status {code} is not a typed 4xx: {str(body)[:120]}"
    if not isinstance(body, dict) or not (body.get("message") or body.get("error")):
        return False, f"4xx without a typed message/error: {str(body)[:120]}"
    return True, ""


# ── 1.1 crash mid-settle: exactly-once across SIGKILL + restart ─────────────

def case_1_1(srv):
    tx = "av1-tx-crash"
    body = settle_body(tx)
    # Deterministic kill point: the append lands (durable), the response
    # never does. Test-only header, honored for authed admin callers only.
    if not srv.post_admin_crash("/v1/admin/settle", body):
        fail("1.1: crash header did not kill the server")
    srv.restart()

    code, body2, _ = srv.post_admin("/v1/admin/settle", body)
    if code != 200:
        fail(f"1.1: resubmission after crash not honored ({code}): {body2}")
    evs = [json.loads(l) for l in
           srv.ledger_bytes().decode().splitlines() if l.strip()]
    credited = [e for e in evs if e.get("type") == "DEPOSIT"]
    if len(credited) != 1:
        fail(f"1.1: exactly-once violated — {len(credited)} deposits after "
             f"crash+resubmission")
    if srv.chain_verifies() < 1:
        fail("1.1: chain broken after crash+restart")
    # idempotent resubmission returns the SAME outcome (same event hash)
    code3, body3, _ = srv.post_admin("/v1/admin/settle", body)
    if code3 != 200 or body3.get("event", {}).get("hash") != \
            body2.get("event", {}).get("hash"):
        fail("1.1: identical resubmission diverged")
    ok("1.1: SIGKILL mid-settle → exactly-once across restart; identical "
       "resubmission returns the SAME event; chain verifies")


# ── 1.2 concurrent mixed load ───────────────────────────────────────────────

def case_1_2(srv):
    # seed a balance first
    srv.post_admin("/v1/admin/settle", settle_body("av1-tx-seed-12",
                                                   amount="50.0000"))
    n_threads, per_thread = 8, 12
    outcomes = []
    lock = threading.Lock()

    def worker(w):
        mine = []
        for i in range(per_thread):
            op = (w + i) % 3
            try:
                if op == 0:
                    r = srv.post_admin("/v1/admin/settle",
                                       settle_body(f"av1-tx-{w}-{i}",
                                                   amount="1.0000"))
                elif op == 1:
                    r = srv.post_admin("/v1/admin/charge",
                                       charge_body(f"av1-ch-{w}-{i}", qty=1))
                else:
                    r = srv.get(f"/v1/voucher/{KEY_ID}/view")
                mine.append((op, r[0], r[1]))
            except Exception as e:  # connection-level failure = incoherent
                mine.append((op, None, str(e)))
        with lock:
            outcomes.extend(mine)

    with ThreadPoolExecutor(max_workers=n_threads) as ex:
        list(ex.map(worker, range(n_threads)))

    bad = [(o, c, b) for o, c, b in outcomes
           if c is None or c >= 500 or (o == 2 and c != 200)]
    if bad:
        fail(f"1.2: incoherent responses under concurrency ({len(bad)}): "
             f"{str(bad[:2])[:200]}")

    evs = [json.loads(l) for l in
           srv.ledger_bytes().decode().splitlines() if l.strip()]
    if srv.chain_verifies() != len(evs):
        fail("1.2: chain invalid after concurrent load")
    from decimal import Decimal as D
    dep = sum((D(e["amount"]) for e in evs if e["type"] == "DEPOSIT"), D("0"))
    chg = sum((D(li["charged"]) for e in evs if e["type"] == "CHARGE"
               for li in e["line_items"]), D("0"))
    from voucher_escrow import Escrow
    bal = Escrow(srv.dir / "escrow-ledger.jsonl").balance(KEY_ID)
    if bal != dep - chg:
        fail(f"1.2: conservation drift — Σdeposits {dep} − Σcharges {chg} "
             f"!= balance {bal}")
    ok(f"1.2: {n_threads}×{per_thread} mixed ops — chain valid, conservation "
       f"exact ({dep} − {chg} = {bal}), every response coherent")


# ── 1.3 hostile input battery ───────────────────────────────────────────────

def case_1_3(srv):
    pre = srv.ledger_bytes()
    battery = [
        # (label, path, raw-body bytes or None, extra headers)
        ("malformed JSON", "/v1/admin/settle", b'{"idempotency_key": ', None),
        ("wrong type: amount as list", "/v1/admin/settle",
         json.dumps({**settle_body("x1"), "declared": {**settle_body("x1")["declared"],
                     "amount": ["2.0000"]}}).encode(), None),
        ("negative quantity", "/v1/admin/charge",
         json.dumps({**charge_body("x2"), "usage": [["mesh_second", -5]]}).encode(), None),
        ("oversized integer (u128-overflow shape)", "/v1/admin/charge",
         json.dumps({**charge_body("x3"), "usage": [["mesh_second",
                                                     10**40]]}).encode(), None),
        ("float quantity", "/v1/admin/charge",
         json.dumps({**charge_body("x4"), "usage": [["mesh_second", 1.5]]}).encode(), None),
        ("duplicate JSON keys", "/v1/admin/settle",
         b'{"idempotency_key": "d1", "idempotency_key": "d2", '
         b'"voucher": "m", "declared": {}, "observed": {}}', None),
        ("unknown field", "/v1/admin/settle",
         json.dumps({**settle_body("x5"), "surprise": True}).encode(), None),
        ("missing idempotency_key", "/v1/admin/settle",
         json.dumps({k: v for k, v in settle_body("x6").items()
                     if k != "idempotency_key"}).encode(), None),
        ("unknown resource class", "/v1/admin/charge",
         json.dumps({**charge_body("x7"), "usage": [["warp_second", 1]]}).encode(), None),
        ("bad voucher shape", "/v1/admin/charge",
         json.dumps({**charge_body("x8"), "voucher":
                     "../escape/attempt"}).encode(), None),
        ("unicode-edge voucher", "/v1/admin/charge",
         json.dumps({**charge_body("x9"), "voucher": "ключ-🚀"}).encode(), None),
        ("no auth token", "/v1/admin/settle",
         json.dumps(settle_body("x10")).encode(), {"Authorization": ""}),
        ("wrong auth token", "/v1/admin/settle",
         json.dumps(settle_body("x11")).encode(),
         {"Authorization": "Bearer not-the-token"}),
        ("wrong method on admin path", "/v1/admin/settle", None,
         {"X-Method-Override": "GET"}),  # path exists; body-less POST below
    ]
    for label, path, raw, extra in battery:
        if label == "wrong method on admin path":
            code, body, _ = srv.request("GET", path)
        else:
            code, body, _ = srv.post_admin_raw(path, raw, headers=extra)
        good, why = typed_4xx((code, body, None))
        if not good:
            fail(f"1.3: [{label}] → {why}")

    # oversized body (200 KB) — refused typed, connection survives
    big = b'{"pad": "' + b"A" * 200_000 + b'"}'
    code, body, _ = srv.post_admin_raw("/v1/admin/settle", big)
    good, why = typed_4xx((code, body, None))
    if not good:
        fail(f"1.3: [oversized body] → {why}")

    # process alive + ZERO ledger mutation across the whole battery
    code, _, _ = srv.get(f"/v1/voucher/{KEY_ID}/view")
    if code != 200:
        fail("1.3: process unhealthy after the battery")
    if srv.ledger_bytes() != pre:
        fail("1.3: ledger mutated by the hostile battery")
    ok("1.3: 15-shape hostile battery — every refusal typed 4xx, process "
       "alive, ledger bytes IDENTICAL")


# ── 1.4 unknown-response recovery ───────────────────────────────────────────

def case_1_4(srv):
    # (a) the crash-kill shape: no answer ever arrived, resubmit same key
    body = settle_body("av1-tx-unknown")
    if not srv.post_admin_crash("/v1/admin/settle", body):
        fail("1.4: crash header did not kill the server")
    srv.restart()
    code, again, _ = srv.post_admin("/v1/admin/settle", body)
    if code != 200:
        fail(f"1.4: recovery resubmission refused ({code})")
    # (b) a SECOND replay of an already-answered request: same outcome, no
    # second effect
    code2, replay, _ = srv.post_admin("/v1/admin/settle", body)
    if code2 != 200 or replay.get("event", {}).get("hash") != \
            again.get("event", {}).get("hash"):
        fail("1.4: replay diverged from the original outcome")
    evs = [json.loads(l) for l in
           srv.ledger_bytes().decode().splitlines() if l.strip()]
    n_that_tx = sum(1 for e in evs if e.get("type") == "DEPOSIT"
                    and e.get("vaulta_tx") == "av1-tx-unknown")
    if n_that_tx != 1:
        fail(f"1.4: second effect — {n_that_tx} deposits for one key")
    # (c) the CHARGE seam: the engine alone does NOT idempotent charges —
    # the bridge key is the load-bearing guard. Crash mid-charge, resubmit:
    # exactly one charge, same receipt.
    cb = charge_body("av1-ch-unknown")
    if not srv.post_admin_crash("/v1/admin/charge", cb):
        fail("1.4c: crash header did not kill the server")
    srv.restart()
    code3, receipt, _ = srv.post_admin("/v1/admin/charge", cb)
    if code3 != 200:
        fail(f"1.4c: charge recovery refused ({code3}): {receipt}")
    code4, replay4, _ = srv.post_admin("/v1/admin/charge", cb)
    if code4 != 200 or replay4.get("event", {}).get("hash") != \
            receipt.get("event", {}).get("hash"):
        fail("1.4c: charge replay diverged")
    evs = [json.loads(l) for l in
           srv.ledger_bytes().decode().splitlines() if l.strip()]
    n_charge = sum(1 for e in evs if e.get("type") == "CHARGE"
                   and e.get("idempotency_key") == "av1-ch-unknown")
    if n_charge != 1:
        fail(f"1.4c: second charge effect — {n_charge} charges for one key")
    ok("1.4: unknown-response recovery — settle AND charge resubmissions "
       "return the original outcome; no second effect")


# ── negative control (house law) ────────────────────────────────────────────

def negative_control(root):
    """A deliberately broken variant — the bridge's idempotency lookup
    skipped — MUST double-charge and be caught, proving the harness detects
    the class it claims to. (The SETTLE seam is engine-guarded by
    (voucher, tx) and survives a broken bridge; CHARGE is the seam this
    control must prove the harness can catch.)"""
    srv = Server(root, extra_env={"AV1_BREAK_IDEMPOTENCY": "1"})
    try:
        # seed balance, then two same-key charges against the broken variant
        srv.post_admin("/v1/admin/settle", settle_body("av1-tx-broken",
                                                       amount="10.0000"))
        cb = charge_body("av1-ch-broken")
        code, first, _ = srv.post_admin("/v1/admin/charge", cb)
        if code != 200:
            fail(f"negative control: first charge failed ({code}): {first}")
        code2, second, _ = srv.post_admin("/v1/admin/charge", cb)
        if code2 != 200:
            fail("negative control: broken variant refused the replay — "
                 "cannot demonstrate the class")
        if first.get("event", {}).get("hash") == second.get("event", {}).get("hash"):
            fail("negative control: broken variant returned the ORIGINAL "
                 "event — the harness cannot detect the idempotency class")
        evs = [json.loads(l) for l in
               srv.ledger_bytes().decode().splitlines() if l.strip()]
        n = sum(1 for e in evs if e.get("type") == "CHARGE")
        if n != 2:
            fail(f"negative control: expected 2 charges under the broken "
                 f"variant, saw {n}")
        ok("negative control: idempotency-ignoring variant double-charged "
           "(distinct receipts, 2 charge events) and the battery caught it")
    finally:
        srv.kill9()


# ── main ────────────────────────────────────────────────────────────────────

def main():
    root = Path(tempfile.mkdtemp(prefix="av1-serve-"))
    srv = Server(root)
    try:
        case_1_1(srv)
        case_1_2(srv)
        case_1_3(srv)
        case_1_4(srv)
    finally:
        srv.kill9()
    negative_control(root)

    print("\n=== AV-1 SERVE-BRIDGE — ALL PROOFS PASS ===")
    for i, p in enumerate(PASS, 1):
        print(f"  {i}. {p}")
    _ = json.dumps({"battery": "av1-serve-bridge", "proofs": len(PASS)})


if __name__ == "__main__":
    main()
