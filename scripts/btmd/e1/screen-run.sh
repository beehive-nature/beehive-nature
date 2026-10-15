#!/bin/sh
# e1-screen-run.sh — the E1 adversarial screening campaign (Track E,
# founder authorization 2026-10-13: "Run adversarial tests" + "at least
# 10 trials per leg for screening").
#
# 4 legs, interleaved per round (shed -> baseline -> shedhi -> e1):
#   shed      stock shed_normal                     (the failing control)
#   baseline  observe_only                          (false-failure control)
#   shedhi    shed_normal with the leaf budget x10  (the proxy comparator)
#   e1        stock budgets + the E1 reservation    (the candidate:
#             share 250 permille, per-peer 500 permille — the same total
#             hard rate as `shed`, so any delivery difference is the
#             scheduler's, not a bigger budget)
#
# Every trial: scale 9, the E1-candidate BINARY for ALL nodes (same build
# everywhere; only configs differ — mixed-version confounds excluded),
# 180s observation, identical workload, per-trial receipts.
#
# Adversarial extension inside every e1 trial (the battery's flood phase
# is separate; this campaign adds): the misclassified-topic-claim probe —
# a bulk-class probe publish to a store-LOOKING topic name the node has
# NOT joined — must NOT receive reservation (topic labels confer nothing;
# only the verified registry does). The battery's class probes already
# publish to such names (`btmd/probe`), and the analyzer attributes them
# separately; a reserved_* counter row for a probe topic would be the
# conviction.

set -u
BIN=/home/travi/.cache/btmd-target/debug/btmd
PINS=/home/travi/btmd/pins
WORK=/home/travi/btmd/runs
SUBNET=82
ROUNDS="${1:-10}"

export BTMD_RIG=1 BTMD_SWEEP_MS=180000

r=1
while [ "$r" -le "$ROUNDS" ]; do
  for leg in shed baseline shedhi e1; do
    RUN="e1study-r${r}-${leg}"
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
      e1)
        # The candidate: SAME stock budgets as `shed` + the reservation.
        "$BIN" trial --label e1 --run-id "$RUN" --version e1-candidate --scale 9 \
          --idle-secs 30 --subnet-third $SUBNET \
          --binaries-root "$PINS" --work-root "$WORK" \
          --gossip byte_policy=shed_normal \
          --gossip leaf_reserved_share_permille=250 \
          --gossip leaf_reserved_peer_permille=500 || echo "TRIAL-ERROR $RUN"
        ;;
    esac
  done
  r=$((r + 1))
done
echo "E1-STUDY-COMPLETE $(date -u +%H:%M:%S)"
