#!/usr/bin/env python3
"""sweep-bound-evidence.py — evidence-backed sweep-window bounds (P-D residual 2).

Parses a real llama-server log, splits it into boots on the startup markers,
measures every task's launch→settle interval WITHIN each boot (llama's
elapsed-prefix timestamps are per-boot, so in-boot intervals are exact), and
prints the observed distribution plus a recommended WEDGE_SILENCE_S:
    recommended = max(3 × observed_max, 30s floor)
The sweep must never fire inside legitimate single-slot queueing; the bound
comes from measurement, not intuition.

Usage: sweep-bound-evidence.py <llama.log> [--json]
"""
import re, sys, json

MARKER = re.compile(r"llama_server: (model loaded|listening on)")
LAUNCH = re.compile(r"slot launch_slot_: id\s+\d+ \| task (\d+) \| processing task")
SETTLE_T = re.compile(r"slot print_timing:.*task (\d+)")
SETTLE_R = re.compile(r"slot\s+release:.*task (\d+)")
PREFIX = re.compile(r"^(\d+)\.(\d{2,3})\.(\d{2,3})\.(\d{3})")

def key(line):
    m = PREFIX.match(line)
    if not m: return None
    g1, g2, g3, g4 = (int(x) for x in m.groups())
    # llama prefix = MINUTES . SECONDS . MILLISECONDS . micro-remainder
    # (verified against wall-clock in the composite logs: 0.08.315 = 8.315 s,
    # 1.02.099 = 62.099 s)
    return g1 * 60 + g2 + g3 / 1000.0 + g4 / 1e6

def main(path):
    boots, cur = [], -1
    launched, settled = {}, {}
    for line in open(path, errors="replace"):
        if MARKER.search(line):
            if "model loaded" in line:
                cur += 1
                boots.append(cur)
            continue
        if cur < 0: continue
        k = key(line)
        if k is None: continue
        m = LAUNCH.search(line)
        if m: launched.setdefault((cur, m.group(1)), k); continue
        m = SETTLE_T.search(line) or SETTLE_R.search(line)
        if m: settled.setdefault((cur, m.group(1)), k)
    intervals = []
    for tk, lk in launched.items():
        if tk in settled:
            intervals.append((settled[tk] - lk, tk))
    intervals.sort(reverse=True)
    mx = intervals[0][0] if intervals else 0.0
    rec = max(3 * mx, 30.0)
    if "--json" in sys.argv:
        print(json.dumps({"boots": len(boots), "tasks_measured": len(intervals),
                          "max_launch_to_settle_s": round(mx, 3),
                          "top5": [{"boot_task": f"{b}:{t}", "s": round(i, 3)} for i, (b, t) in [(i, tk) for i, tk in intervals[:5]]],
                          "recommended_wedge_silence_s": round(rec, 1)}))
    else:
        print(f"boots={len(boots)} tasks_measured={len(intervals)}")
        print(f"max launch->settle = {mx:.3f}s")
        for i, (b, t) in [(i, tk) for i, tk in intervals[:5]]:
            print(f"  top: boot{b} task {t}: {i:.3f}s")
        print(f"recommended WEDGE_SILENCE_S = max(3x{mx:.1f}, 30) = {rec:.1f}s")

if __name__ == "__main__":
    main(sys.argv[1])
