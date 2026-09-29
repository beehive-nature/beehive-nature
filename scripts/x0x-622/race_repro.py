#!/usr/bin/env python3
"""Race-hardening: repeat the teardown-sensitive healthy window N times.

The round-3 defect was a timing race: the runner's group-TERM reached the
sampler's in-flight CLI child, whose -15 death was recorded as an error
sample and failed coverage only when the stop landed mid-request. The fix
(pid-only TERM + drain, and no error records once stopping) is mechanical;
this script proves the race is gone by hammering the same window shape.
"""
import os
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_runner as T

N = int(sys.argv[1]) if len(sys.argv) > 1 else 8
stub = T.ThreadingHTTPServer(("127.0.0.1", 12710), T.StubAPI)
decoy = T.ThreadingHTTPServer(("127.0.0.1", 12700), T.Decoy)
for srv in (stub, decoy):
    threading.Thread(target=srv.serve_forever, daemon=True).start()
time.sleep(0.3)

tmp = tempfile.mkdtemp(prefix="x0x-622-race-")
bindir, d_cli, d_daemon = T.make_stub_binaries(tmp)
coll = T.py_coll(os.path.join(tmp, "coll.py"), "time.sleep(1.2)\n")
fails = 0
try:
    for i in range(N):
        T.reset_stub()
        ev = os.path.join(tmp, f"ev-{i}")
        os.makedirs(ev)
        nenv, _, _, _ = T.node_stub(tmp, f"race{i}")
        env = T.base_env(bindir, d_cli, d_daemon, ev, coll,
                         X0X_WINDOW_SECS=300, X0X_ATTEMPTS_MAX=1,
                         X0X_LEASE_SECS=700, **nenv)
        rc, out = T.run_runner(env, timeout=90)
        att, _ = T.load_attempt(ev)
        ok = rc == 0 and att and att["status"] == "accepted"
        errs = 0
        d = T.evidence_dirs(ev)
        if d:
            p = os.path.join(ev, d[0], "health-series.jsonl")
            if os.path.exists(p):
                errs = sum(1 for ln in open(p) if '"error"' in ln)
        print(f"run {i}: rc={rc} status={att and att.get('status')} "
              f"error_records={errs} -> {'OK' if ok and errs == 0 else 'FAIL'}",
              flush=True)
        if not (ok and errs == 0):
            fails += 1
finally:
    stub.shutdown(); stub.server_close()
    decoy.shutdown(); decoy.server_close()
import shutil
shutil.rmtree(tmp, ignore_errors=True)
print(f"summary: {N - fails}/{N} clean")
sys.exit(1 if fails else 0)
