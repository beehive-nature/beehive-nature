#!/usr/bin/env python3
"""Independent probes for the remaining #622 runner bounds.

These probes exercise the production runner with the existing test harness
helpers. They stay offline: loopback-only stub API, stub node commands, and a
short failing collector. No public mesh or production service is touched.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.abspath(os.path.join(HERE, "..", "..", "scripts", "x0x-622"))
sys.path.insert(0, SCRIPTS)
import test_runner as T  # noqa: E402


def main() -> int:
    stub = T.ThreadingHTTPServer(("127.0.0.1", 12710), T.StubAPI)
    import threading
    threading.Thread(target=stub.serve_forever, daemon=True).start()
    tmp = tempfile.mkdtemp(prefix="x0x-622-r4-")
    results = []
    try:
        bindir, d_cli, d_daemon = T.make_stub_binaries(tmp)
        collector = T.py_coll(os.path.join(tmp, "collector-7.py"),
                              "raise SystemExit(7)\n")

        # The packet promises no more than two retries (three attempts total).
        ev = os.path.join(tmp, "evidence-attempt-cap")
        os.makedirs(ev)
        nenv, _, _, _ = T.node_stub(tmp, "attempt-cap")
        env = T.base_env(
            bindir, d_cli, d_daemon, ev, collector,
            X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700,
            X0X_ATTEMPTS_MAX=4, **nenv)
        rc, _ = T.run_runner(env, timeout=90)
        dirs = T.evidence_dirs(ev)
        results.append({
            "probe": "attempt-cap",
            "runner_exit": rc,
            "attempts_requested": 4,
            "attempt_dirs": len(dirs),
            "observed_more_than_two_retries": len(dirs) == 4,
        })

        # The packet describes a three-hour wall-clock lease. The runner
        # validates only the lower relationship to the window, so an
        # operator can currently request a lease beyond that declared bound.
        ev = os.path.join(tmp, "evidence-lease-cap")
        os.makedirs(ev)
        nenv, _, _, _ = T.node_stub(tmp, "lease-cap")
        env = T.base_env(
            bindir, d_cli, d_daemon, ev, collector,
            X0X_WINDOW_SECS=300, X0X_LEASE_SECS=10801,
            X0X_ATTEMPTS_MAX=1, **nenv)
        rc_lease, out_lease = T.run_runner(env, timeout=90)
        results.append({
            "probe": "lease-cap",
            "runner_exit": rc_lease,
            "lease_requested_seconds": 10801,
            "attempt_dirs": len(T.evidence_dirs(ev)),
            "accepted_over_three_hour_bound": rc_lease == 7,
            "lease_gate_output_mentions_refusal": "lease" in out_lease.lower()
            and "refus" in out_lease.lower(),
        })

        # The mount gate checks only the named mount and its log/ child. It
        # does not require X0X_EVIDENCE_ROOT to resolve beneath that mount.
        # /dev/shm and /tmp are different devices in this Linux test host.
        mount_root = "/dev/shm"
        mount_log = os.path.join(mount_root, "log")
        log_created = not os.path.isdir(mount_log)
        os.makedirs(mount_log, exist_ok=True)
        ev_outside = os.path.join(tmp, "evidence-outside-mount")
        os.makedirs(ev_outside)
        coll_ok = T.py_coll(os.path.join(tmp, "collector-ok.py"),
                            "time.sleep(1)\n"
                            "open(a.out_dir + '/t0.json', 'w').write('{}\\n')\n"
                            "open(a.out_dir + '/t1.json', 'w').write('{}\\n')\n")
        nenv, _, _, _ = T.node_stub(tmp, "outside-mount")
        env = T.base_env(
            bindir, d_cli, d_daemon, ev_outside, coll_ok,
            X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700,
            X0X_ATTEMPTS_MAX=1, X0X_REQUIRE_MOUNT=mount_root, **nenv)
        rc2, out2 = T.run_runner(env, timeout=90)
        dirs2 = T.evidence_dirs(ev_outside)
        outside_dev = os.stat(ev_outside).st_dev != os.stat(mount_root).st_dev
        results.append({
            "probe": "evidence-root-containment",
            "runner_exit": rc2,
            "mount_gate": mount_root,
            "evidence_root_outside_mount": outside_dev,
            "attempt_dirs_written_outside": bool(dirs2),
            "accepted_with_outside_evidence": rc2 == 0 and bool(dirs2),
            "mount_gate_output_mentions_refusal": "refusing" in out2,
        })

        # A collision is detected only after the node has started. The
        # runner clears EVID to protect the pre-existing directory, then
        # performs cleanup without writing any CLEANUP.json receipt.
        ev_collision = os.path.join(tmp, "evidence-collision-cleanup")
        os.makedirs(os.path.join(ev_collision, "fixed-attempt1"))
        nenv, _, _, stopped_collision = T.node_stub(tmp, "collision-cleanup")
        env = T.base_env(
            bindir, d_cli, d_daemon, ev_collision, collector,
            X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700,
            X0X_ATTEMPTS_MAX=1, X0X_DIR_STAMP="fixed", **nenv)
        rc_collision, out_collision = T.run_runner(env, timeout=90)
        results.append({
            "probe": "collision-cleanup-receipt",
            "runner_exit": rc_collision,
            "node_stop_ran": os.path.exists(stopped_collision),
            "cleanup_receipts": [
                os.path.join(d, "CLEANUP.json")
                for d in T.evidence_dirs(ev_collision)
                if os.path.exists(os.path.join(ev_collision, d, "CLEANUP.json"))
            ],
            "cleanup_receipt_missing_after_started_node": (
                rc_collision == 5
                and os.path.exists(stopped_collision)
                and not any(
                    os.path.exists(os.path.join(ev_collision, d, "CLEANUP.json"))
                    for d in T.evidence_dirs(ev_collision)
                )
            ),
            "output_mentions_collision": "collision" in out_collision.lower(),
        })
    finally:
        stub.shutdown()
        stub.server_close()
        if 'log_created' in locals() and log_created:
            try:
                os.rmdir(mount_log)
            except OSError:
                pass
        shutil.rmtree(tmp, ignore_errors=True)

    print(json.dumps({"kind": "x0x-622-r4-probe", "results": results}, indent=2))
    return 0 if (
        results[0].get("observed_more_than_two_retries", False)
        and results[1].get("accepted_over_three_hour_bound", False)
        and results[2].get("accepted_with_outside_evidence", False)
        and results[3].get("cleanup_receipt_missing_after_started_node", False)
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
