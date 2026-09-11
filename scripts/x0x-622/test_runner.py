#!/usr/bin/env python3
"""Regression suite for scripts/x0x-622/run-capture.sh — the correction round
for backend Astra's review of the #622 measurement packet (review b7076f86).

Modes (combine as needed):
  --fast      (default) stub-boundary tests, seconds each; uses the real
              upstream collector for the subprocess-boundary probes
  --slow      adds three real-window paths through the runner (~20 min total):
              scoped lease expiry, the 300s accept path, and the peer-collapse
              rejection path — all still offline against a stub API
  --offline   runs the pinned REAL daemon + real collector inside an empty
              user+network namespace (loopback only, no route): the
              independent diagnostic-shape receipt (pubsub_stages.message_kinds
              exists — correcting the builder's false gap claim) and the
              real-binary collector subprocess boundary against a decoy on
              the default port. Never a mesh capture; peers are expected 0.

Findings covered:
  R1 decoy on 12700 receives ZERO calls from the unchanged collector, with
     both the stub CLI (fast) and the pinned real daemon+CLI (offline);
  R2 sampler records are complete parseable JSONL; a forced collector exit 7
     survives the runner verbatim; nothing is masked;
  R3 lease expiry / cancellation stop only owned helpers + the test node —
     an unrelated sentinel survives; no host-wide action anywhere;
  R4 exclusive evidence dirs (collision refused, earlier evidence intact),
     retry budget, duration/digest/shape gates refused before launch,
     failed attempts retained and labeled;
  R5 offline shape receipt proves message_kinds present in the pinned binary.

Requires: python3 and network access once to unpack the blake3 wheel into
/tmp/x0x-622-pydeps (PYTHONPATH'd; no pip/venv needed).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
RUNNER = os.path.join(HERE, "run-capture.sh")
SAMPLER = os.path.join(HERE, "sampler.py")
DEFAULT_COLLECTOR = "/mnt/c/Users/travi/x0x-622-src/scripts/capture-egress.py"
DEFAULT_BINROOT = ("/mnt/c/Users/travi/buzz-repair/2026-09-10/"
                   "x0x-622-pinned-binaries/linux-x64-gnu")
PYDEPS = "/tmp/x0x-622-pydeps"   # blake3 unpacked from its wheel, PYTHONPATH'd
STUB_TOKEN = "stub-token-not-a-secret"

results: list[dict] = []


def record(name: str, ok, detail="") -> bool:
    entry = {"test": name, "pass": bool(ok), "detail": str(detail)[:400]}
    results.append(entry)
    print(json.dumps(entry), flush=True)
    return bool(ok)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, body, code=200):
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class StubAPI(Handler):
    """Instrumented API on 12710 — the shim's lawful target."""
    state = {"version": "0.41.4", "peers": 1, "uptime_base": 50_000.0}
    start_mono = time.monotonic()
    hits: list[str] = []

    def _uptime(self):
        return int(self.state["uptime_base"] + (time.monotonic() - self.start_mono))

    def do_GET(self):
        type(self).hits.append(self.path)
        if self.path == "/health":
            self._json({"ok": True, "version": self.state["version"],
                        "status": "healthy", "peers": self.state["peers"],
                        "uptime_secs": self._uptime()})
        elif self.path == "/diagnostics/gossip":
            self._json({
                "ok": True, "stats": {},
                "participation": {
                    "mode": "leaf", "reason": "default_leaf",
                    "passthrough_refresh_runs": 0,
                    "epidemic_forward_bytes": 0, "epidemic_forward_msgs": 0,
                    "relay_bytes": 0, "relay_msgs": 0,
                    "unsubscribed_refused_frames": 0},
                "subscribed_topics": [], "outbound_by_topic_named": {},
                "egress_budget": {"leaf_max_eager_degree": 2,
                                  "byte_policy": "observe_only",
                                  "applies_to_leaf": True},
                "pubsub_stages": {
                    "message_kinds": {"eager": 0, "ihave": 0, "iwant": 0,
                                      "graft": 0, "prune": 0,
                                      "anti_entropy": 0, "other": 0,
                                      "decode_failed": 0},
                    "outbound_by_topic": {
                        "802ee0ebd00757bd": {"eager": {"bytes": 0, "msgs": 0},
                                             "lazy": {"bytes": 0, "msgs": 0}}}},
                "discovery_cache_entries": {"agents": 0, "machines": 0,
                                            "users": 0}})
        elif self.path == "/diagnostics/transport":
            self._json({"ok": True, "peers": self.state["peers"], "nat": "stub"})
        else:
            self._json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or b"{}")
        self.state.update(body)
        self._json({"ok": True})


class Decoy(Handler):
    """Decoy on the DEFAULT port 12700 — must receive zero calls."""
    hits: list[str] = []

    def do_GET(self):
        type(self).hits.append(self.path)
        self._json({"ok": True, "version": "DECOY-DEFAULT", "peers": 9})

    def do_POST(self):
        self.do_GET()


STUB_CLI = r'''#!/usr/bin/env python3
import argparse, json, os, sys, urllib.request
ap = argparse.ArgumentParser(add_help=False)
ap.add_argument("--api", default="127.0.0.1:12700")  # mimics DaemonClient::new
known, rest = ap.parse_known_args()
if rest[:1] == ["health"]:
    url = f"http://{known.api}/health"
elif rest[:2] == ["diagnostics", "gossip"]:
    url = f"http://{known.api}/diagnostics/gossip"
elif rest[:2] == ["diagnostics", "transport"]:
    url = f"http://{known.api}/diagnostics/transport"
else:
    print(json.dumps({"ok": False, "error": "unsupported subcommand"}))
    sys.exit(1)
req = urllib.request.Request(url)
tok = os.environ.get("X0X_API_TOKEN")
if tok:
    req.add_header("Authorization", "Bearer " + tok)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        body = json.load(r)
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
    sys.exit(1)
print(json.dumps({"ok": True, "data": body}))
'''


def sha256_of(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def write_script(path, text):
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, 0o755)
    return path


def make_stub_binaries(tmp):
    bindir = os.path.join(tmp, "bin")
    os.makedirs(bindir)
    cli = write_script(os.path.join(bindir, "x0x"), STUB_CLI)
    daemon_stub = write_script(os.path.join(bindir, "x0xd"), "#!/bin/sh\nexit 0\n")
    return bindir, sha256_of(cli), sha256_of(daemon_stub)


def node_stub(tmp, tag):
    """File-backed test node; per-tag flags so tests never share state."""
    state = os.path.join(tmp, f"node-{tag}-state.txt")
    with open(state, "w") as f:
        f.write("active\nsuccess\n0\n")
    started = os.path.join(tmp, f"node-{tag}-started.flag")
    stopped = os.path.join(tmp, f"node-{tag}-stopped.flag")
    env = {"X0X_NODE_START": f"touch {started}",
           "X0X_NODE_STOP": f"touch {stopped}",
           "X0X_NODE_CHECK": f"cat {state}"}
    return env, state, started, stopped


def base_env(bindir, d_cli, d_daemon, evidence_root, collector, **over):
    env = dict(os.environ)
    env.update({
        "X0X_BIN_DIR": bindir, "X0X_EVIDENCE_ROOT": evidence_root,
        "X0X_COLLECTOR": collector,
        "X0X_EXPECT_SHA256_X0X": d_cli, "X0X_EXPECT_SHA256_X0XD": d_daemon,
        "X0X_API_TOKEN": STUB_TOKEN, "X0X_API": "127.0.0.1:12710",
        "X0X_SAMPLER_INTERVAL": "0.3",
        # a log follower that actually emits lines, like the real daemon's
        # log file does — an empty service.log is failed evidence (§5.2)
        "X0X_LOG_FOLLOW":
            "while sleep 1; do date -u +%Y-%m-%dT%H:%M:%SZ; done",
        "X0X_PYTHON": sys.executable, "PYTHONPATH": PYDEPS})
    env.update({k: str(v) for k, v in over.items()})
    return env


def run_runner(env, timeout=90, sig=None, sig_after=None):
    proc = subprocess.Popen(["bash", RUNNER], env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, start_new_session=True)
    if sig and sig_after:
        time.sleep(sig_after)
        proc.send_signal(sig)
    try:
        out, _ = proc.communicate(timeout=timeout)
        return proc.returncode, out
    except subprocess.TimeoutExpired:
        proc.kill()
        out, _ = proc.communicate()
        return "TIMEOUT", out


def reset_stub():
    StubAPI.hits.clear()
    StubAPI.state.update({"version": "0.41.4", "peers": 1})


def evidence_dirs(root):
    if not os.path.isdir(root):
        return []
    return sorted(d for d in os.listdir(root)
                  if os.path.isdir(os.path.join(root, d)))


def load_attempt(root, idx=0):
    dirs = evidence_dirs(root)
    if len(dirs) <= idx:
        return None, ""
    d = os.path.join(root, dirs[idx])
    p = os.path.join(d, "ATTEMPT.json")
    return (json.load(open(p)) if os.path.exists(p) else None), d


def parse_series(path):
    recs = []
    if path and os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    recs.append(json.loads(line))
    return recs


def ensure_blake3():
    """blake3 for the real collector, without pip: fetch the matching CPython
    manylinux wheel from PyPI and unpack it into PYDEPS (PYTHONPATH'd)."""
    env = {**os.environ, "PYTHONPATH": PYDEPS}
    if subprocess.run([sys.executable, "-c", "import blake3"],
                      env=env).returncode == 0:
        return True
    import platform
    import urllib.request
    tag = f"cp{sys.version_info.major}{sys.version_info.minor}"
    machine = platform.machine() or "x86_64"
    d = json.load(urllib.request.urlopen("https://pypi.org/pypi/blake3/json"))
    url = next(u["url"] for u in d["urls"]
               if tag in u["filename"] and "manylinux" in u["filename"]
               and machine in u["filename"] and u["filename"].endswith(".whl"))
    os.makedirs(PYDEPS, exist_ok=True)
    wheel = "/tmp/x0x-622-blake3.whl"
    with urllib.request.urlopen(url) as r, open(wheel, "wb") as f:
        shutil.copyfileobj(r, f)
    subprocess.check_call([sys.executable, "-m", "zipfile", "-e", wheel, PYDEPS])
    return subprocess.run([sys.executable, "-c", "import blake3"],
                          env=env).returncode == 0


def py_coll(path, body):
    """Collector-shaped PYTHON stub (the runner invokes the collector through
    $X0X_PYTHON, so bash stubs would die as SyntaxErrors)."""
    return write_script(path,
        "#!/usr/bin/env python3\n"
        "import argparse, time\n"
        "ap = argparse.ArgumentParser()\n"
        "ap.add_argument('--window-secs', type=int, default=0)\n"
        "ap.add_argument('--out-dir')\n"
        "a = ap.parse_args()\n" + body)


def direct_collector(window, outdir, path_dir):
    return subprocess.run(
        ["env", f"PATH={path_dir}:{os.environ['PATH']}",
         sys.executable, DEFAULT_COLLECTOR, "--window-secs", str(window),
         "--out-dir", outdir],
        capture_output=True, text=True, timeout=90,
        env={**os.environ, "X0X_API_TOKEN": STUB_TOKEN,
             "PYTHONPATH": PYDEPS})


# --------------------------------------------------------------------------- #
def fast_suite(args):
    stub = ThreadingHTTPServer(("127.0.0.1", 12710), StubAPI)
    decoy = ThreadingHTTPServer(("127.0.0.1", 12700), Decoy)
    for srv in (stub, decoy):
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    tmp = tempfile.mkdtemp(prefix="x0x-622-test-")
    bindir, d_cli, d_daemon = make_stub_binaries(tmp)
    coll_ok = py_coll(os.path.join(tmp, "coll_ok.py"),
        "time.sleep(1)\n"
        "open(a.out_dir + '/t0.json', 'w').write('{\"t0\":1}\\n')\n"
        "open(a.out_dir + '/t1.json', 'w').write('{\"t1\":1}\\n')\n")
    coll_7 = py_coll(os.path.join(tmp, "coll_7.py"), "raise SystemExit(7)\n")
    coll_30 = py_coll(os.path.join(tmp, "coll_30.py"), "time.sleep(30)\n")
    try:
        # T1: real collector subprocess boundary, fast dt-reject path
        reset_stub(); Decoy.hits.clear()
        shim_dir = os.path.join(tmp, "shim")
        os.makedirs(shim_dir)
        write_script(os.path.join(shim_dir, "x0x"),
                     f'#!/bin/sh\nexec {bindir}/x0x --api 127.0.0.1:12710 "$@"\n')
        outdir = os.path.join(tmp, "t1-direct")
        os.makedirs(outdir)
        proc = direct_collector(5, outdir, shim_dir)
        ok = (proc.returncode != 0 and len(Decoy.hits) == 0
              and len(StubAPI.hits) >= 3
              and os.path.exists(os.path.join(outdir, "gossip-t0.json")))
        record("T1-real-collector-boundary-decoy-zero", ok,
               f"rc={proc.returncode} decoy={len(Decoy.hits)} stub={len(StubAPI.hits)}")

        # T1b: the decoy is not vacuously quiet — no shim means decoy MUST see calls
        reset_stub(); Decoy.hits.clear()
        outdir_b = os.path.join(tmp, "t1b-noshim")
        os.makedirs(outdir_b)
        direct_collector(2, outdir_b, bindir)
        record("T1b-harness-detects-unbound-collector",
               len(Decoy.hits) >= 3, f"decoy={len(Decoy.hits)} must be >=3")

        # T2: forced collector exit 7 survives the runner verbatim
        reset_stub()
        ev = os.path.join(tmp, "ev-t2"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "t2")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_7,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        att, d0 = load_attempt(ev)
        ok = (rc == 7 and att and str(att["collector_exit"]) == "7"
              and att["status"] == "failed-collector"
              and os.path.exists(os.path.join(d0, "FAILED")))
        record("T2-collector-exit7-propagates", ok, f"rc={rc} attempt={att}")

        # T3: happy path; sampler JSONL is complete and honest
        reset_stub()
        ev = os.path.join(tmp, "ev-t3"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "t3")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        att, d0 = load_attempt(ev)
        recs = parse_series(os.path.join(d0, "health-series.jsonl")) if d0 else []
        full = bool(recs) and all(
            "ts" in r and "mono" in r and ("health" in r or "error" in r)
            for r in recs)
        healthy = [r for r in recs if "health" in r]
        ok = (rc == 0 and att and att["status"] == "accepted" and full
              and healthy
              and all(r["health"].get("peers") == 1 for r in healthy)
              and all(r["health"].get("uptime_secs", 0) > 0 for r in healthy))
        record("T3-honest-sampler-records-accepted", ok,
               f"rc={rc} records={len(recs)} healthy={len(healthy)}")

        # T4: sampler write failure surfaces (direct unit)
        rc4 = subprocess.run(
            [sys.executable, SAMPLER, "--x0x", os.path.join(bindir, "x0x"),
             "--out", "/proc/x0x-622-unwritable", "--interval", "0.2",
             "--max-lifetime", "2"],
            capture_output=True, text=True).returncode
        record("T4-sampler-write-failure-exits-22", rc4 == 22, f"rc={rc4}")

        # T5: collision refused, earlier evidence untouched
        ev = os.path.join(tmp, "ev-t5"); os.makedirs(ev)
        victim = os.path.join(ev, "fixed-attempt1")
        os.makedirs(victim)
        with open(os.path.join(victim, "t0.json"), "w") as f:
            f.write("ORIGINAL")
        nenv, _, _, _ = node_stub(tmp, "t5")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=2,
                       X0X_LEASE_SECS=700, X0X_DIR_STAMP="fixed", **nenv)
        rc, out = run_runner(env)
        intact = open(os.path.join(victim, "t0.json")).read() == "ORIGINAL"
        no_new = evidence_dirs(ev) == ["fixed-attempt1"]
        record("T5-collision-refused-evidence-intact",
               rc == 5 and intact and no_new,
               f"rc={rc} intact={intact} dirs={evidence_dirs(ev)}")

        # T6: retry budget enforced (2 attempts, both fail)
        reset_stub()
        ev = os.path.join(tmp, "ev-t6"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "t6")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_7,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=2,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        dirs = evidence_dirs(ev)
        statuses = []
        for d in dirs:
            p = os.path.join(ev, d, "ATTEMPT.json")
            statuses.append(json.load(open(p))["status"] if os.path.exists(p) else "?")
        record("T6-retry-budget-two-attempts-then-stop",
               rc == 7 and len(dirs) == 2
               and statuses == ["failed-collector", "failed-collector"],
               f"rc={rc} statuses={statuses}")

        # T8: cancellation stops only owned helpers; sentinel survives
        reset_stub()
        ev = os.path.join(tmp, "ev-t8"); os.makedirs(ev)
        nenv, _, _, stopped8 = node_stub(tmp, "t8")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_30,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=3600, **nenv)
        sentinel = subprocess.Popen(["sleep", "300"], start_new_session=True)
        rc, out = run_runner(env, timeout=60, sig=signal.SIGINT, sig_after=2.0)
        time.sleep(0.5)
        sentinel_alive = sentinel.poll() is None
        sentinel.terminate(); sentinel.wait()
        att, d0 = load_attempt(ev)
        ok = (rc == 130 and sentinel_alive and os.path.exists(stopped8)
              and att and att["status"] == "cancelled"
              and os.path.exists(os.path.join(d0, "FAILED")))
        record("T8-cancel-owned-only-sentinel-survives", ok,
               f"rc={rc} sentinel={sentinel_alive} attempt={att}")

        # T9: duration validated before launch (node never started)
        ev = os.path.join(tmp, "ev-t9"); os.makedirs(ev)
        nenv, _, started9, _ = node_stub(tmp, "t9")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=299, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        record("T9-window-below-floor-refused-prelaunch",
               rc == 2 and not os.path.exists(started9) and "300" in out,
               f"rc={rc} node_started={os.path.exists(started9)}")

        # T9b: digest gate refuses wrong bytes prelaunch
        env = base_env(bindir, "0" * 64, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        record("T9b-digest-gate-refuses",
               rc == 2 and "digest mismatch" in out, f"rc={rc}")

        # T9c: preflight shape gate refuses wrong version
        reset_stub()
        ev = os.path.join(tmp, "ev-t9c"); os.makedirs(ev)
        nenv, _, _, stopped9c = node_stub(tmp, "t9c")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        StubAPI.state["version"] = "0.41.3"
        rc, out = run_runner(env)
        record("T9c-shape-gate-refuses-wrong-version",
               rc == 2 and "version" in out and os.path.exists(stopped9c),
               f"rc={rc}")
        reset_stub()

        # ---- round-2 caller-boundary tests (re-review f8b3cb46 F1-F3) ----

        def fake_sampler(name, body):
            return write_script(os.path.join(tmp, name),
                "#!/usr/bin/env python3\n"
                "import json, sys, time, signal\n"
                "out = sys.argv[sys.argv.index('--out') + 1]\n"
                "f = open(out, 'a')\n" + body)

        # TF1a: sampler dies exit 22 after one healthy record -> NOT accepted
        reset_stub()
        ev = os.path.join(tmp, "ev-tf1a"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf1a")
        s22 = fake_sampler("sampler22.py",
            "f.write(json.dumps({'ts': time.time(), 'mono': time.monotonic(),"
            " 'health': {'peers': 1}}) + '\\n')\n"
            "raise SystemExit(22)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_SAMPLER=s22, **nenv)
        rc, out = run_runner(env)
        att, _ = load_attempt(ev)
        record("TF1a-sampler-exit22-rejected", rc == 1 and att
               and att["status"] == "failed-sampler"
               and att["sampler_exit"] == "22",
               f"rc={rc} attempt={att}")

        # TF1b: one healthy + three error records, exit 21 -> NOT accepted
        reset_stub()
        ev = os.path.join(tmp, "ev-tf1b"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf1b")
        s21 = fake_sampler("sampler21.py",
            "f.write(json.dumps({'ts': time.time(), 'mono': time.monotonic(),"
            " 'health': {'peers': 1, 'uptime_secs': 5000}}) + '\\n')\n"
            "for _ in range(3):\n"
            "    f.write(json.dumps({'ts': time.time(),"
            " 'error': 'request timeout'}) + '\\n')\n"
            "raise SystemExit(21)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_SAMPLER=s21, **nenv)
        rc, out = run_runner(env)
        att, _ = load_attempt(ev)
        record("TF1b-sampler-exit21-rejected", rc == 1 and att
               and att["status"] == "failed-sampler",
               f"rc={rc} attempt={att}")

        # TF1c: log helper exits 9 immediately -> NOT accepted
        reset_stub()
        ev = os.path.join(tmp, "ev-tf1c"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf1c")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_LOG_FOLLOW="exit 9", **nenv)
        rc, out = run_runner(env)
        att, _ = load_attempt(ev)
        record("TF1c-log-helper-exit9-rejected", rc == 1 and att
               and att["status"] == "failed-log-helper",
               f"rc={rc} attempt={att}")

        # TF1d: sampler TERM-clean but silent after one full record ->
        # coverage validation must reject it
        reset_stub()
        ev = os.path.join(tmp, "ev-tf1d"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf1d")
        s_gap = fake_sampler("sampler_gap.py",
            "f.write(json.dumps({'ts': time.time(), 'mono': time.monotonic(),"
            " 'health': {'peers': 1, 'uptime_secs': 5000}}) + '\\n')\n"
            "f.flush()\n"
            "signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))\n"
            "while True:\n    time.sleep(1)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_SAMPLER=s_gap, **nenv)
        rc, out = run_runner(env)
        att, _ = load_attempt(ev)
        record("TF1d-coverage-gap-rejected", rc == 1 and att
               and att["status"] == "failed-coverage",
               f"rc={rc} attempt={att}")

        # TF2: terminal receipt write faulted (ATTEMPT.json -> /dev/full)
        reset_stub()
        ev = os.path.join(tmp, "ev-tf2"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf2")
        coll_full = py_coll(os.path.join(tmp, "coll_full.py"),
            "import os\n"
            "os.symlink('/dev/full', a.out_dir + '/ATTEMPT.json')\n"
            "time.sleep(1.2)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_full,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        att_path = None
        for d in evidence_dirs(ev):
            p = os.path.join(ev, d, "ATTEMPT.json")
            if os.path.islink(p):
                att_path = p
        record("TF2-receipt-write-failure-fails-run",
               rc == 6 and att_path is not None
               and "RECEIPT" in out.upper(),
               f"rc={rc} symlink_retained={att_path is not None}")

        # TF3a: TERM during a BLOCKED node start is honored promptly; the
        # blocked job (own group) is killed, not left behind
        reset_stub()
        ev = os.path.join(tmp, "ev-tf3a"); os.makedirs(ev)
        marker = os.path.join(tmp, "tf3a-start-entered")
        nenv, _, _, _ = node_stub(tmp, "tf3a")
        nenv.update({
            "X0X_NODE_START": f"touch {marker}; exec sleep 347",
            "X0X_NODE_STOP": "true", "X0X_NODE_FORCE_STOP": "true"})
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        proc = subprocess.Popen(["bash", RUNNER], env=env,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True,
                                start_new_session=True)
        t0 = time.monotonic()
        while not os.path.exists(marker) and time.monotonic() - t0 < 5:
            time.sleep(0.05)
        proc.send_signal(signal.SIGTERM)
        try:
            out, _ = proc.communicate(timeout=3)
            prompt = True
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            prompt = False
            proc.kill()
            out, _ = proc.communicate()
            rc = proc.returncode
        time.sleep(0.5)
        leftover = subprocess.run(["pgrep", "-f", "sleep 347"],
                                  capture_output=True).returncode == 0
        record("TF3a-term-during-blocked-start",
               prompt and rc == 130 and not leftover,
               f"prompt={prompt} rc={rc} blocked_job_left={leftover}")

        # TF3b: node stop FAILS -> measurement may be accepted but the run
        # cannot return success (cleanup disposition is separate)
        reset_stub()
        ev = os.path.join(tmp, "ev-tf3b"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf3b")
        nenv.update({"X0X_NODE_STOP": "false", "X0X_NODE_FORCE_STOP": "false"})
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env)
        att, _ = load_attempt(ev)
        record("TF3b-node-stop-failure-fails-run",
               rc == 8 and att and att["status"] == "accepted"
               and "CLEANUP FAILED" in out,
               f"rc={rc} attempt={att}")

        # TF3c: node stop BLOCKS -> bounded graceful, then forced path saves
        # cleanup; run stays accepted
        reset_stub()
        ev = os.path.join(tmp, "ev-tf3c"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf3c")
        nenv.update({"X0X_NODE_STOP": "sleep 25; false",
                     "X0X_NODE_FORCE_STOP": "true"})
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_STOP_TIMEOUT=4, **nenv)
        t0 = time.monotonic()
        rc, out = run_runner(env, timeout=60)
        took = time.monotonic() - t0
        att, _ = load_attempt(ev)
        record("TF3c-blocked-stop-bounded-forced",
               rc == 0 and took < 15 and att and att["status"] == "accepted",
               f"rc={rc} took={took:.0f}s attempt={att}")

        # TF3d: runner KILLED outright -> the node's own runtime expiry still
        # removes it; an unrelated sentinel survives; evidence retained
        reset_stub()
        ev = os.path.join(tmp, "ev-tf3d"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf3d")
        nenv.update({"X0X_NODE_START":
                     "nohup timeout 6 sleep 311 >/dev/null 2>&1 & exit 0"})
        coll_30b = py_coll(os.path.join(tmp, "coll_30b.py"), "time.sleep(30)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_30b,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        sentinel = subprocess.Popen(["sleep", "300"], start_new_session=True)
        proc = subprocess.Popen(["bash", RUNNER], env=env,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                start_new_session=True)
        t0 = time.monotonic()   # wait until the window is actually running
        while not evidence_dirs(ev) and time.monotonic() - t0 < 8:
            time.sleep(0.25)
        time.sleep(0.5)
        proc.send_signal(signal.SIGKILL)
        proc.wait(timeout=5)
        t0 = time.monotonic()
        while (subprocess.run(["pgrep", "-f", "sleep 311"],
                              capture_output=True).returncode == 0
               and time.monotonic() - t0 < 10):
            time.sleep(0.5)
        node_gone = subprocess.run(["pgrep", "-f", "sleep 311"],
                                   capture_output=True).returncode != 0
        sentinel_alive = sentinel.poll() is None
        sentinel.terminate(); sentinel.wait()
        subprocess.run(["pkill", "-f", "x0x-622/sampler.py"],
                       capture_output=True)
        record("TF3d-runner-death-independent-node-expiry",
               node_gone and sentinel_alive and evidence_dirs(ev),
               f"node_expired_on_its_own={node_gone} sentinel={sentinel_alive}"
               f" evidence={evidence_dirs(ev)}")

        # TF3e: uncooperative (TERM-ignoring) collector -> bounded
        # graceful-then-FORCED cleanup; cancellation stays prompt
        reset_stub()
        ev = os.path.join(tmp, "ev-tf3e"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tf3e")
        coll_stubborn = py_coll(os.path.join(tmp, "coll_stubborn.py"),
            "import signal\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "import time\ntime.sleep(60)\n")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_stubborn,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_HELPER_GRACE=2, **nenv)
        t0 = time.monotonic()
        rc, out = run_runner(env, timeout=30, sig=signal.SIGINT, sig_after=2.0)
        took = time.monotonic() - t0
        stubborn_gone = subprocess.run(["pgrep", "-f", "coll_stubborn"],
                                       capture_output=True).returncode != 0
        record("TF3e-uncooperative-helper-forced",
               rc == 130 and took < 10 and stubborn_gone,
               f"rc={rc} took={took:.0f}s helper_gone={stubborn_gone}")

        # ---- round-3 tests (re-review adcbcfc5 G1-G3) ----------------------

        # TG1a: a TERM-IGNORING stop command cannot outlive its bound; the
        # forced path is actually reached (marker files), bounded in time
        reset_stub()
        ev = os.path.join(tmp, "ev-tg1a"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "tg1a")
        stop_ran = os.path.join(tmp, "tg1a-graceful-attempted")
        force_ran = os.path.join(tmp, "tg1a-forced-attempted")
        nenv.update({
            "X0X_NODE_STOP":
                f"touch {stop_ran}; trap '' TERM; while :; do sleep 1; done",
            "X0X_NODE_FORCE_STOP": f"touch {force_ran}; false",
            "X0X_STOP_TIMEOUT": "1", "X0X_STOP_FORCE_TIMEOUT": "1",
            "X0X_KILL_AFTER": "2", "X0X_HELPER_GRACE": "1"})
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        t0 = time.monotonic()
        rc, out = run_runner(env, timeout=60)
        took = time.monotonic() - t0
        record("TG1a-term-ignoring-stop-bounded-forced-reached",
               rc == 8 and took < 15
               and os.path.exists(stop_ran) and os.path.exists(force_ran),
               f"rc={rc} took={took:.0f}s graceful={os.path.exists(stop_ran)}"
               f" forced={os.path.exists(force_ran)}")

        # TG1b: cancellation DURING a pending start still cleans up the
        # resource the start already created (provisional ownership)
        reset_stub()
        ev = os.path.join(tmp, "ev-tg1b"); os.makedirs(ev)
        entered = os.path.join(tmp, "tg1b-start-entered")
        stopped1b = os.path.join(tmp, "tg1b-node-stopped")
        sleeper = os.path.join(tmp, "tg1b-owned-sleeper.sh")
        write_script(sleeper, "#!/bin/sh\nsleep 300\n")
        nenv, _, _, _ = node_stub(tmp, "tg1b")
        nenv.update({
            "X0X_NODE_START":
                f"touch {entered}; nohup bash {sleeper} >/dev/null 2>&1 & "
                "exec sleep 30",
            # [-] so the pattern never matches this command's own cmdline
            "X0X_NODE_STOP":
                f"pkill -f 'tg1b[-]owned' ; touch {stopped1b}",
            "X0X_NODE_FORCE_STOP": "pkill -9 -f 'tg1b[-]owned' || true"})
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        proc = subprocess.Popen(["bash", RUNNER], env=env,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True,
                                start_new_session=True)
        t0 = time.monotonic()
        while not os.path.exists(entered) and time.monotonic() - t0 < 5:
            time.sleep(0.05)
        proc.send_signal(signal.SIGTERM)
        try:
            out, _ = proc.communicate(timeout=5)
            prompt = True
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            prompt = False
            proc.kill()
            out, _ = proc.communicate()
            rc = proc.returncode
        time.sleep(0.5)
        res_gone = subprocess.run(["pgrep", "-f", "tg1b[-]owned"],
                                  capture_output=True).returncode != 0
        record("TG1b-cancel-during-start-cleans-owned-resource",
               prompt and rc == 130 and res_gone
               and os.path.exists(stopped1b),
               f"prompt={prompt} rc={rc} resource_gone={res_gone}"
               f" stop_ran={os.path.exists(stopped1b)}")

        # TG2: CLEANUP.json write faulted -> /dev/full (healthy control beside)
        for case, inject in (("healthy", False), ("cleanup-full", True)):
            reset_stub()
            ev = os.path.join(tmp, f"ev-tg2-{case}"); os.makedirs(ev)
            nenv, _, _, _ = node_stub(tmp, f"tg2{case}")
            collector = coll_ok
            if inject:
                collector = py_coll(os.path.join(tmp, "coll_cleanup_full.py"),
                    "import os\n"
                    "os.symlink('/dev/full', a.out_dir + '/CLEANUP.json')\n"
                    "time.sleep(1.2)\n")
            env = base_env(bindir, d_cli, d_daemon, ev, collector,
                           X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                           X0X_LEASE_SECS=700, **nenv)
            rc, out = run_runner(env)
            att, _ = load_attempt(ev)
            if inject:
                record("TG2-cleanup-receipt-write-failure-fails-run",
                       rc == 6 and att and att["status"] == "accepted"
                       and "CLEANUP.json" in out,
                       f"rc={rc} attempt={att and att['status']}")
            else:
                record("TG2-healthy-control-still-zero",
                       rc == 0 and att and att["status"] == "accepted",
                       f"rc={rc} attempt={att and att['status']}")

        # TG3a: the ACTUAL generated node defaults carry the promised shape
        # (unique unit, dedicated identity, runtime limit, bounded log volume)
        out = subprocess.run(["bash", RUNNER, "--print-node-defaults"],
                             capture_output=True, text=True,
                             env={**os.environ, "X0X_RUN_TAG": "shape-a"})
        text = out.stdout
        out_b = subprocess.run(["bash", RUNNER, "--print-node-defaults"],
                               capture_output=True, text=True,
                               env={**os.environ, "X0X_RUN_TAG": "shape-b"})
        unit_a = next(l for l in text.splitlines() if l.startswith("RUN_UNIT="))
        unit_b = next(l for l in out_b.stdout.splitlines()
                      if l.startswith("RUN_UNIT="))
        checks = {
            "unique-unit": unit_a != unit_b and "x0x-measure-shape-a" in unit_a,
            "user-group": "User=x0xm" in text and "Group=x0xm" in text,
            "runtime-max": "RuntimeMaxSec=" in text,
            "bounded-log": "append:/var/lib/x0x-measure/log/x0xd.log" in text,
            "stop-targets-unit": f"systemctl stop {unit_a.split('=', 1)[1]}" in text,
            "collect": "--collect" in text,
        }
        record("TG3a-generated-unit-shape", all(checks.values())
               and out.returncode == 0, json.dumps(checks))

        # TG3b: the storage gate — refuse a non-mountpoint prelaunch; accept
        # a real mountpoint with log/ present AND the evidence root beneath it
        reset_stub()
        plain = os.path.join(tmp, "not-a-mount"); os.makedirs(plain)
        ev = os.path.join(tmp, "ev-tg3b"); os.makedirs(ev)
        nenv, _, started3b, _ = node_stub(tmp, "tg3b")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT=plain, **nenv)
        rc, out = run_runner(env)
        refused = rc == 2 and "not a real mountpoint" in out \
            and not os.path.exists(started3b)
        os.makedirs("/dev/shm/log", exist_ok=True)
        ev2 = "/dev/shm/ev-tg3b-pos"
        env = base_env(bindir, d_cli, d_daemon, ev2, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT="/dev/shm", **nenv)
        rc2, out2 = run_runner(env)
        att2, _ = load_attempt(ev2)
        record("TG3b-storage-mount-gate",
               refused and rc2 == 0 and att2 and att2["status"] == "accepted",
               f"refused={refused} mount_run_rc={rc2}"
               f" attempt={att2 and att2['status']}")

        # ---- round-4 tests (re-review 5e69d0f9 R4-1..R4-3) ------------------

        # TH1: hard ceilings just above the packet bounds are refused
        # prelaunch (no node start, no attempt dirs); boundary values run
        reset_stub()
        ev = os.path.join(tmp, "ev-th1a"); os.makedirs(ev)
        nenv, _, started_h1, _ = node_stub(tmp, "th1a")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=10801, **nenv)
        rc_lease, out_lease = run_runner(env)
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=4,
                       X0X_LEASE_SECS=700, **nenv)
        rc_att, out_att = run_runner(env)
        record("TH1-ceilings-refused-prelaunch",
               rc_lease == 2 and "10800s" in out_lease and rc_att == 2
               and "ceiling of 3" in out_att
               and not os.path.exists(started_h1)
               and not evidence_dirs(ev),
               f"lease_rc={rc_lease} attempts_rc={rc_att}"
               f" node_started={os.path.exists(started_h1)}")

        reset_stub()
        ev = os.path.join(tmp, "ev-th1b"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "th1b")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=3,
                       X0X_LEASE_SECS=10800, **nenv)
        rc_b, out_b = run_runner(env)
        att_b, _ = load_attempt(ev)
        record("TH1-boundary-values-run",
               rc_b == 0 and att_b and att_b["status"] == "accepted",
               f"rc={rc_b} attempt={att_b and att_b['status']}")

        # TH2a: different-device evidence root refused prelaunch, not created
        reset_stub()
        ev = os.path.join(tmp, "ev-th2a")          # deliberately NOT created
        nenv, _, started_h2, _ = node_stub(tmp, "th2a")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT="/dev/shm", **nenv)
        rc, out = run_runner(env)
        record("TH2a-cross-device-evidence-root-refused",
               rc == 2 and "outside the required mount" in out
               and not os.path.exists(ev)
               and not os.path.exists(started_h2),
               f"rc={rc} root_created={os.path.exists(ev)}")

        # TH2b: symlink and traversal escapes refused prelaunch
        reset_stub()
        base2 = "/dev/shm/ev-th2b"
        os.makedirs(base2, exist_ok=True)
        os.makedirs("/tmp/th2b-evil", exist_ok=True)
        lnk = os.path.join(base2, "lnk")
        if not os.path.islink(lnk):
            os.symlink("/tmp/th2b-evil", lnk)
        nenv, _, started_h2b, _ = node_stub(tmp, "th2b")
        env = base_env(bindir, d_cli, d_daemon, lnk, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT="/dev/shm", **nenv)
        rc_l, out_l = run_runner(env)
        trav = "/dev/shm/ev-th2b/../../../th2b-esc"
        env = base_env(bindir, d_cli, d_daemon, trav, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT="/dev/shm", **nenv)
        rc_t, out_t = run_runner(env)
        record("TH2b-symlink-and-traversal-escapes-refused",
               rc_l == 2 and "outside the required mount" in out_l
               and rc_t == 2 and not os.path.exists("/dev/th2b-esc")
               and not os.path.exists(started_h2b),
               f"symlink_rc={rc_l} traversal_rc={rc_t}")

        # TH2c: an unsafe X0X_DIR_STAMP is refused regardless of the gate
        reset_stub()
        ev = os.path.join(tmp, "ev-th2c"); os.makedirs(ev)
        nenv, _, started_h2c, _ = node_stub(tmp, "th2c")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_DIR_STAMP="../esc", **nenv)
        rc, out = run_runner(env)
        record("TH2c-unsafe-stamp-refused",
               rc == 2 and "traversal" in out and not evidence_dirs(ev)
               and not os.path.exists(started_h2c),
               f"rc={rc}")

        # TH3a: Astra's exact post-start-collision shape is now a PRELAUNCH
        # refusal — node never starts, victim byte-identical, checked
        # REFUSED receipt exists
        reset_stub()
        ev = os.path.join(tmp, "ev-th3a"); os.makedirs(ev)
        victim = os.path.join(ev, "fixed-attempt1")
        os.makedirs(victim)
        with open(os.path.join(victim, "t0.json"), "w") as f:
            f.write("ORIGINAL")
        nenv, _, started_h3, _ = node_stub(tmp, "th3a")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_DIR_STAMP="fixed", **nenv)
        rc, out = run_runner(env)
        refused_receipt = os.path.join(ev, "REFUSED-fixed-attempt1.json")
        record("TH3a-collision-prelaunch-refusal-with-receipt",
               rc == 5
               and open(os.path.join(victim, "t0.json")).read() == "ORIGINAL"
               and not os.path.exists(started_h3)
               and os.path.exists(refused_receipt)
               and os.path.getsize(refused_receipt) > 0,
               f"rc={rc} node_started={os.path.exists(started_h3)}"
               f" receipt={os.path.exists(refused_receipt)}")

        # TH3b: post-start preflight failure leaves checked terminal records
        # in the RESERVED dir (FAILED + ATTEMPT + CLEANUP) and stops the node
        reset_stub()
        ev3 = "/dev/shm/ev-th3b"
        os.makedirs(ev3, exist_ok=True)
        nenv, _, started_h3b, stopped_h3b = node_stub(tmp, "th3b")
        env = base_env(bindir, d_cli, d_daemon, ev3, coll_ok,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, X0X_REQUIRE_MOUNT="/dev/shm", **nenv)
        StubAPI.state["version"] = "0.41.3"
        rc, out = run_runner(env)
        reset_stub()
        dirs = evidence_dirs(ev3)
        d0 = os.path.join(ev3, dirs[0]) if dirs else ""
        record("TH3b-poststart-preflight-failure-receipts",
               rc == 2 and dirs and os.path.exists(started_h3b)
               and os.path.exists(stopped_h3b)
               and d0 and os.path.exists(os.path.join(d0, "FAILED"))
               and os.path.exists(os.path.join(d0, "ATTEMPT.json"))
               and os.path.exists(os.path.join(d0, "CLEANUP.json")),
               f"rc={rc} dirs={dirs} node_started={os.path.exists(started_h3b)}"
               f" stopped={os.path.exists(stopped_h3b)}")
    finally:
        stub.shutdown(); stub.server_close()
        decoy.shutdown(); decoy.server_close()
        shutil.rmtree(tmp, ignore_errors=True)


def slow_suite(args):
    stub = ThreadingHTTPServer(("127.0.0.1", 12710), StubAPI)
    decoy = ThreadingHTTPServer(("127.0.0.1", 12700), Decoy)
    for srv in (stub, decoy):
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    tmp = tempfile.mkdtemp(prefix="x0x-622-slow-")
    bindir, d_cli, d_daemon = make_stub_binaries(tmp)
    try:
        # T7: scoped lease expiry — collector must OUTLIVE the lease; the
        # runner's invariant demands lease > window+300, so this is a ~10 min
        # test by construction (window 300, lease 601, collector sleeps 650)
        reset_stub(); Decoy.hits.clear()
        coll_650 = py_coll(os.path.join(tmp, "coll_650.py"), "time.sleep(650)\n")
        ev = os.path.join(tmp, "ev-t7"); os.makedirs(ev)
        nenv, _, _, stopped7 = node_stub(tmp, "t7")
        env = base_env(bindir, d_cli, d_daemon, ev, coll_650,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=601, **nenv)
        sentinel = subprocess.Popen(["sleep", "900"], start_new_session=True)
        t0 = time.monotonic()
        rc, out = run_runner(env, timeout=700)
        took = time.monotonic() - t0
        sentinel_alive = sentinel.poll() is None
        sentinel.terminate(); sentinel.wait()
        att, d0 = load_attempt(ev)
        ok = (rc == 124 and sentinel_alive and 590 < took < 660
              and os.path.exists(stopped7)
              and att and att["status"] == "interrupted-lease"
              and os.path.exists(os.path.join(d0, "FAILED")))
        record("T7-lease-expiry-scoped-sentinel-survives", ok,
               f"rc={rc} took={took:.0f}s sentinel={sentinel_alive} attempt={att}")

        # T11: full accept path — REAL collector through the runner (300s)
        reset_stub(); Decoy.hits.clear()
        ev = os.path.join(tmp, "ev-t11"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "t11")
        env = base_env(bindir, d_cli, d_daemon, ev, args.collector,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        rc, out = run_runner(env, timeout=340)
        att, d0 = load_attempt(ev)
        console = ""
        if d0 and os.path.exists(os.path.join(d0, "collector-console.txt")):
            console = open(os.path.join(d0, "collector-console.txt")).read()
        ok = (rc == 0 and att and att["status"] == "accepted"
              and "Window accepted" in console
              and "epidemic_forward_bytes" in console
              and len(Decoy.hits) == 0)
        record("T11-real-collector-accept-path", ok,
               f"rc={rc} decoy={len(Decoy.hits)} attempt={att}")

        # T11b: peers collapse at t1 — real collector rejects; evidence kept
        reset_stub()
        ev = os.path.join(tmp, "ev-t11b"); os.makedirs(ev)
        nenv, _, _, _ = node_stub(tmp, "t11b")
        env = base_env(bindir, d_cli, d_daemon, ev, args.collector,
                       X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                       X0X_LEASE_SECS=700, **nenv)
        proc = subprocess.Popen(["bash", RUNNER], env=env,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True,
                                start_new_session=True)
        time.sleep(15)  # t0 + several samples happen with peers=1
        urllib.request.urlopen(urllib.request.Request(
            "http://127.0.0.1:12710/control",
            data=json.dumps({"peers": 0}).encode(),
            headers={"Content-Type": "application/json"}), timeout=5)
        out, _ = proc.communicate(timeout=340)
        rc = proc.returncode
        att, d0 = load_attempt(ev)
        console = ""
        if d0 and os.path.exists(os.path.join(d0, "collector-console.txt")):
            console = open(os.path.join(d0, "collector-console.txt")).read()
        ok = (rc == 1 and "Not a usable default Leaf window" in console
              and att and att["status"] == "failed-collector"
              and os.path.exists(os.path.join(d0, "FAILED")))
        record("T11b-peer-collapse-rejected-evidence-retained", ok,
               f"rc={rc} attempt={att}")
    finally:
        stub.shutdown(); stub.server_close()
        decoy.shutdown(); decoy.server_close()
        shutil.rmtree(tmp, ignore_errors=True)


def offline_receipt(args):
    """Runs INSIDE an empty user+net namespace."""
    links = json.loads(subprocess.check_output(["ip", "-j", "link"], text=True))
    assert [l["ifname"] for l in links] == ["lo"], "isolated loopback required"
    assert open("/proc/net/route").read().count("\n") == 1, "no route may exist"

    binroot = os.path.abspath(args.binroot)
    tmp = tempfile.mkdtemp(prefix="x0x-622-offline-")
    decoy = ThreadingHTTPServer(("127.0.0.1", 12700), Decoy)
    threading.Thread(target=decoy.serve_forever, daemon=True).start()
    out = {"kind": "x0x-622-offline-shape-receipt", "public_mesh": False}
    home = os.path.join(tmp, "home")
    os.makedirs(home)
    state = os.path.join(tmp, "state")
    config = os.path.join(tmp, "daemon.toml")
    with open(config, "w") as f:
        f.write(f'''api_address = "127.0.0.1:12710"
bind_address = "127.0.0.1:0"
data_dir = "{state}"
identity_dir = "{os.path.join(tmp, "identity")}"
mdns_enabled = false
port_mapping_enabled = false
zero_peer_restart_secs = 0
[update]
enabled = false
''')
    env = {"PATH": binroot + ":/usr/bin:/bin", "HOME": home,
           "XDG_DATA_HOME": os.path.join(home, "data"),
           "XDG_CONFIG_HOME": os.path.join(home, "config"),
           "RUST_LOG": "warn", "NO_PROXY": "*",
           "PYTHONPATH": PYDEPS}
    log = open(os.path.join(tmp, "daemon.log"), "w")
    daemon = subprocess.Popen(
        [os.path.join(binroot, "x0xd"), "--config", config,
         "--no-hard-coded-bootstrap", "--disable-peer-cache",
         "--skip-update-check"],
        cwd=tmp, env=env, stdout=log, stderr=log, start_new_session=True)
    try:
        health = None
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen("http://127.0.0.1:12710/health",
                                            timeout=1) as res:
                    health = json.load(res)
                break
            except Exception:
                if daemon.poll() is not None:
                    raise RuntimeError(f"daemon exited {daemon.returncode}")
                time.sleep(0.25)
        assert health is not None, "daemon did not expose health in time"
        token = open(os.path.join(state, "api-token")).read().strip()
        env["X0X_API_TOKEN"] = token
        req = urllib.request.Request("http://127.0.0.1:12710/diagnostics/gossip",
                                     headers={"Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=3) as res:
            gossip = json.load(res)
        stages = gossip.get("pubsub_stages", {})
        out["health_version"] = health.get("version")
        out["participation"] = gossip.get("participation")
        out["message_kinds"] = stages.get("message_kinds", "ABSENT")
        out["has_egress_budget"] = "egress_budget" in gossip
        out["has_outbound_by_topic"] = "outbound_by_topic" in stages

        # real collector through the runner's shim recipe, fast dt-reject
        shim_dir = os.path.join(tmp, "shim")
        os.makedirs(shim_dir)
        write_script(os.path.join(shim_dir, "x0x"),
                     f'#!/bin/sh\nexec {binroot}/x0x --api 127.0.0.1:12710 "$@"\n')
        evdir = os.path.join(tmp, "evidence")
        os.makedirs(evdir)
        proc = subprocess.run(
            ["env", f"PATH={shim_dir}:/usr/bin:/bin",
             sys.executable, args.collector,
             "--window-secs", "5", "--out-dir", evdir],
            env=env, capture_output=True, text=True, timeout=60)
        out["collector_rc"] = proc.returncode
        out["collector_rejected_short_window"] = proc.returncode != 0
        out["decoy_default_port_hits"] = len(Decoy.hits)
        out["raw_t0_kept"] = os.path.exists(os.path.join(evdir, "gossip-t0.json"))
    finally:
        if daemon.poll() is None:
            os.killpg(daemon.pid, signal.SIGTERM)
            try:
                daemon.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(daemon.pid, signal.SIGKILL)
                daemon.wait(timeout=5)
        decoy.shutdown(); decoy.server_close()
        log.close()
    out["own_child_stopped"] = daemon.poll() is not None
    ok = (out.get("health_version") == "0.41.4"
          and isinstance(out.get("message_kinds"), dict)
          and out.get("has_egress_budget") and out.get("has_outbound_by_topic")
          and out.get("decoy_default_port_hits") == 0
          and out.get("collector_rejected_short_window")
          and out.get("raw_t0_kept") and out.get("own_child_stopped"))
    record("T10-offline-pinned-daemon-shape-and-boundary", ok,
           json.dumps(out)[:400])
    with open("/tmp/x0x-622-offline-receipt.json", "w") as f:
        json.dump(out, f, indent=2)
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--slow", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--collector", default=DEFAULT_COLLECTOR)
    ap.add_argument("--binroot", default=DEFAULT_BINROOT)
    args = ap.parse_args()
    if not (args.fast or args.slow or args.offline):
        args.fast = True

    if args.offline and os.environ.get("X0X_622_IN_NS") != "1":
        # re-exec ourselves inside an empty user+net namespace
        cmd = ["unshare", "--user", "--map-root-user", "--net", "bash", "-c",
               "ip link set lo up && X0X_622_IN_NS=1 exec " + " ".join(
                   [sys.executable, os.path.abspath(__file__), "--offline",
                    "--collector", os.path.abspath(args.collector),
                    "--binroot", os.path.abspath(args.binroot)])]
        rc = subprocess.run(cmd).returncode
        failed = [r for r in results if not r["pass"]]
        sys.exit(rc)

    if args.fast or args.slow:
        if not ensure_blake3():
            record("blake3-deps-ready", False,
                   "could not provision blake3 from PyPI")
    if args.fast:
        fast_suite(args)
    if args.slow:
        slow_suite(args)
    if args.offline:
        offline_receipt(args)

    failed = [r for r in results if not r["pass"]]
    print(json.dumps({"summary": {"total": len(results),
                                  "failed": len(failed)}}, indent=1))
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
