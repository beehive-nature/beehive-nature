#!/bin/sh
# screen-run.sh — the E1 comparison campaign (v2, E1-PATH-ATTRIBUTION-001
# era). Changes from v1 per the independent review (finding 2):
#   * FAIL-FAST: any trial error aborts the campaign with a nonzero exit
#     and a FAILED marker — no `|| echo` swallowing.
#   * BINARY-VERSION CONTROL: the `e1off` leg runs the EXACT candidate
#     binary with the reservation OFF (share 0), isolating the scheduler's
#     effect (e1 vs e1off) from the build difference (e1off vs shed).
#
# 5 interleaved legs per round:
#   baseline  v0.47.1 release, observe_only        (false-failure control)
#   shed      v0.47.1 release, stock shed_normal   (the failing reference)
#   shedhi    v0.47.1 release, budget x10          (the proxy comparator)
#   e1off     CANDIDATE binary, shed_normal share0 (build-version control)
#   e1        CANDIDATE binary, share 250 peer 500 (the mechanism)
#
# Every trial: scale 9, 180s observation, identical workload, per-trial
# receipts. ROUNDS default 10 (>=10 trials per leg for screening).

set -u
BIN=/home/travi/.cache/btmd-target/debug/btmd
PINS=/home/travi/btmd/pins
WORK=/home/travi/btmd/runs
SUBNET=92
ROUNDS="${1:-10}"
FAILED=0

export BTMD_RIG=1 BTMD_SWEEP_MS=180000

run_trial() {
  run_id="$1"; label="$2"; version="$3"; shift 3
  echo "=== $run_id $(date -u +%H:%M:%S) ==="
  if ! "$BIN" trial --label "$label" --run-id "$run_id" --version "$version" \
      --scale 9 --idle-secs 30 --subnet-third $SUBNET \
      --binaries-root "$PINS" --work-root "$WORK" "$@"; then
    echo "TRIAL-FAILED $run_id"
    echo "$run_id" >> "$WORK/e1-campaign-FAILED.txt"
    FAILED=1
    return 1
  fi
  # A missing verdict is a failed trial, not a skipped one — and an
  # EXISTING one is validated (review correction 2): it must carry this
  # trial's own run_id and label and a well-formed verdicts array, so a
  # stale or malformed file cannot pass as a completed trial.
  v="$WORK/$run_id/receipts/verdict.json"
  if [ ! -f "$v" ]; then
    echo "TRIAL-FAILED-NO-VERDICT $run_id"
    echo "$run_id (no verdict)" >> "$WORK/e1-campaign-FAILED.txt"
    FAILED=1
    return 1
  fi
  # Structural validation (review correction 4): PARSE the JSON — grep on
  # text is not validation. Identity (run_id, trial), shape (verdicts
  # array, verdicts_pass bool, budget hash, version), and per-node CPU/RSS
  # measurements must all be present in every accepted verdict.
  if ! node -e '
    const v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    if (v.run_id !== process.argv[2] || v.trial !== process.argv[3]) process.exit(1);
    if (!Array.isArray(v.verdicts) || typeof v.verdicts_pass !== "boolean") process.exit(1);
    if (!v.budget_sha256 || !v.x0x_version || !Array.isArray(v.cost)) process.exit(1);
    for (const c of v.cost) {
      if (typeof c.cpu_percent_sustained !== "number") process.exit(1);
      if (typeof c.vmhwm_kib !== "number") process.exit(1);
    }
  ' "$v" "$run_id" "$label"; then
    echo "TRIAL-FAILED-BAD-VERDICT $run_id (structural validation)"
    echo "$run_id (bad verdict)" >> "$WORK/e1-campaign-FAILED.txt"
    FAILED=1
    return 1
  fi
  # Binary digests accompany the campaign record (review correction 4).
  sha256sum "$PINS/$version/x0x-linux-x64-gnu/x0xd" >> "$WORK/e1-campaign-binaries.sha256" 2>/dev/null || true
}

r=1
while [ "$r" -le "$ROUNDS" ] && [ "$FAILED" -eq 0 ]; do
  run_trial "e1camp-r${r}-baseline" baseline v0.47.1 || break
  run_trial "e1camp-r${r}-shed" shed v0.47.1 --gossip byte_policy=shed_normal || break
  run_trial "e1camp-r${r}-shedhi" shedhi v0.47.1 \
    --gossip byte_policy=shed_normal \
    --gossip leaf_egress_soft_bytes_per_sec=655360 \
    --gossip leaf_egress_hard_bytes_per_sec=1310720 \
    --gossip leaf_egress_burst_bytes=41943040 || break
  run_trial "e1camp-r${r}-e1off" e1off e1-candidate \
    --gossip byte_policy=shed_normal \
    --gossip leaf_reserved_share_permille=0 || break
  run_trial "e1camp-r${r}-e1" e1 e1-candidate \
    --gossip byte_policy=shed_normal \
    --gossip leaf_reserved_share_permille=250 \
    --gossip leaf_reserved_peer_permille=500 || break
  r=$((r + 1))
done

if [ "$FAILED" -ne 0 ]; then
  echo "E1-CAMPAIGN-FAILED — see $WORK/e1-campaign-FAILED.txt"
  exit 1
fi
echo "E1-CAMPAIGN-COMPLETE $(date -u +%H:%M:%S)"
