#!/bin/sh
# BT-MESH-DEPENDABILITY-001 — the scale-9 dependability study (next
# experiment, founder disposition 2026-10-13).
#
# N=10 independent trials per leg, INTERLEAVED (round r runs all three
# legs back-to-back so fleet/thermal conditions distribute across legs):
#   shed      — byte_policy=shed_normal, stock thresholds (the config
#               whose s9 behavior is under study)
#   baseline  — observe_only control (false-failure rate of the rig
#               itself at the same workload)
#   shedhi    — shed_normal with the leaf budget raised 10x (the
#               carve-out PROXY: upstream has no store-topic class knob,
#               so this leg separates "class-driven shedding on transit
#               paths" from "budget-magnitude boundary")
#
# Every trial: scale 9, pinned v0.47.1, identical workload profile,
# BTMD_SWEEP_MS=180000 so late convergence is RECORDED per op (never
# truncated to the gate), idle 30s. Individual outcomes preserved —
# analysis never averages across trials.
#
# Runner law: one rig at a time, subnet 81 only, teardown after each
# trial (the btmd driver owns that). Run as root with BTMD_RIG=1.

set -u
BIN=/home/travi/.cache/btmd-target/debug/btmd
PINS=/home/travi/btmd/pins
WORK=/home/travi/btmd/runs
SUBNET=81
ROUNDS="${1:-10}"

export BTMD_RIG=1 BTMD_SWEEP_MS=180000

r=1
while [ "$r" -le "$ROUNDS" ]; do
  for leg in shed baseline shedhi; do
    RUN="s9study-r${r}-${leg}"
    echo "=== $RUN $(date -u +%H:%M:%S) ==="
    case "$leg" in
      shed)
        "$BIN" trial --label shed --run-id "$RUN" --version v0.47.1 --scale 9 \
          --idle-secs 30 --subnet-third $SUBNET \
          --binaries-root "$PINS" --work-root "$WORK" \
          --gossip byte_policy=shed_normal || echo "TRIAL-ERROR $RUN"
        ;;
      baseline)
        "$BIN" trial --label baseline --run-id "$RUN" --version v0.47.1 --scale 9 \
          --idle-secs 30 --subnet-third $SUBNET \
          --binaries-root "$PINS" --work-root "$WORK" || echo "TRIAL-ERROR $RUN"
        ;;
      shedhi)
        "$BIN" trial --label shedhi --run-id "$RUN" --version v0.47.1 --scale 9 \
          --idle-secs 30 --subnet-third $SUBNET \
          --binaries-root "$PINS" --work-root "$WORK" \
          --gossip byte_policy=shed_normal \
          --gossip leaf_egress_soft_bytes_per_sec=655360 \
          --gossip leaf_egress_hard_bytes_per_sec=1310720 \
          --gossip leaf_egress_burst_bytes=41943040 || echo "TRIAL-ERROR $RUN"
        ;;
    esac
  done
  r=$((r + 1))
done
echo "STUDY-COMPLETE $(date -u +%H:%M:%S)"
