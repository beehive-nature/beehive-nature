#!/usr/bin/env python3
"""Bounded health sampler for the x0x #622 capture runner.

Writes full timestamped health records — one complete JSON object per line —
to a real file. No substring surgery, no truncation, no unfinished records.
Every request is bounded by --timeout and the sampler's total lifetime is
bounded by --max-lifetime. Request failures are recorded as error records
and surface as a nonzero exit after three consecutive failures; write
failures and invalid JSON surface immediately. Exit codes: 0 clean stop
(SIGTERM from the runner), 21 three consecutive failed samples, 22 write
failure, 23 lifetime exhausted while still sampling.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--x0x", required=True,
                    help="absolute path of the PATH-bound x0x CLI (the runner's shim)")
    ap.add_argument("--out", required=True, help="JSONL output file (appended)")
    ap.add_argument("--interval", type=float, default=60.0)
    ap.add_argument("--max-lifetime", type=float, required=True)
    ap.add_argument("--timeout", type=float, default=10.0)
    args = ap.parse_args()

    stopping = {"flag": False}

    def on_term(_signum, _frame):
        stopping["flag"] = True

    signal.signal(signal.SIGTERM, on_term)
    signal.signal(signal.SIGINT, on_term)

    deadline = time.monotonic() + args.max_lifetime
    consecutive_failures = 0
    try:
        out = open(args.out, "a", encoding="utf-8")
    except OSError as exc:
        print(f"sampler: cannot open output: {exc}", file=sys.stderr)
        sys.exit(22)
    try:
        while not stopping["flag"] and time.monotonic() < deadline:
            rec = {"ts": time.time(), "mono": time.monotonic()}
            try:
                proc = subprocess.run(
                    [args.x0x, "health", "--json"],
                    capture_output=True, text=True, timeout=args.timeout)
                if proc.returncode != 0:
                    rec["error"] = f"exit {proc.returncode}: {proc.stderr.strip()[:200]}"
                else:
                    obj = json.loads(proc.stdout)  # invalid JSON raises, is recorded
                    if obj.get("ok") is False:
                        rec["error"] = "ok:false response"
                    else:
                        rec["health"] = obj.get("data", obj)
                        consecutive_failures = 0
            except subprocess.TimeoutExpired:
                rec["error"] = "request timeout"
            except json.JSONDecodeError as exc:
                rec["error"] = f"invalid json: {exc}"
            try:
                out.write(json.dumps(rec, separators=(",", ":")) + "\n")
                out.flush()
                os.fsync(out.fileno())
            except OSError as exc:
                print(f"sampler: write failed: {exc}", file=sys.stderr)
                sys.exit(22)
            if "error" in rec:
                consecutive_failures += 1
                if consecutive_failures >= 3:
                    sys.exit(21)
            wake = time.monotonic() + args.interval
            while not stopping["flag"] and time.monotonic() < wake:
                time.sleep(min(0.5, max(0.0, wake - time.monotonic())))
        if not stopping["flag"]:
            sys.exit(23)  # lifetime exhausted while the window was still running
    finally:
        out.close()
    sys.exit(0)


if __name__ == "__main__":
    main()
