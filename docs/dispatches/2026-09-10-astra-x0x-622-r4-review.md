# x0x #622 runner correction round 4 review

Backend Astra, 2026-09-10 America/Denver. This is an independent, offline
review of zCode candidate `13bbd756` in a fresh worktree. The zCode build
worktree and production services were untouched. No public-mesh capture was
run and no upstream comment was posted.

## Verdict

**NOT ACCEPTED for the public measurement.** The round-3 fixes hold, but the
runner still has three structural gaps in the bounds and receipt contract.
The machine result is recorded in
[`x0x-622-r4-result.json`](../receipts/x0x-622-r4-result.json), and the
reproduction code is
[`x0x-622-r4-probe.py`](../receipts/x0x-622-r4-probe.py).

## Independent verification

- `python3 scripts/x0x-622/test_runner.py --fast`: **27/27**.
- `python3 scripts/x0x-622/race_repro.py 8`: **8/8** clean windows, with no
  teardown error records.
- `python3 docs/receipts/x0x-622-r4-probe.py`: all four probes reproduced.
- `python3 -m py_compile scripts/x0x-622/*.py` and `bash -n
  scripts/x0x-622/run-capture.sh`: clean.
- Candidate check-runs: all observed runs successful; no public or production
  system was contacted.

## Findings

### R4-1 — P2: lease and retry ceilings remain configurable above the packet bounds

The packet describes a three-hour wall-clock lease and no more than two
retries (three attempts total). `run-capture.sh` validates only that the lease
is numeric and exceeds `window + 300`, and validates only `attempts >= 1`.
There is no upper check.

The actual runner accepted `X0X_LEASE_SECS=10801` and ran, and accepted
`X0X_ATTEMPTS_MAX=4`, creating four immutable attempt directories before
returning the collector's exit 7. That is three retries, beyond the declared
aggregate bound. The exact observations are in the result JSON.

Required: enforce the declared upper bounds before launch (three attempts
maximum and the packet's finite lease ceiling), retain the existing lower and
relationship checks, and add regression cases that refuse values just above
each ceiling without starting the node.

### R4-2 — P1: the storage gate does not bind evidence to the bounded volume

`X0X_REQUIRE_MOUNT` checks that one named path is a mountpoint and that its
`log/` directory exists. It never checks `X0X_EVIDENCE_ROOT` (or its resolved
children) against that mount. The positive TG3b test itself passes an evidence
root on `/tmp` while gating `/dev/shm`; the runner accepts and writes the
attempt there. The independent probe confirmed `/dev/shm` and the evidence
root are different devices and still observed exit 0 with an attempt written
outside the mount.

This defeats the packet's hard disk ceiling: a typo, symlink, or environment
override can send collector output and receipts to the host filesystem while
the mount gate reports success.

Required: when the storage gate is enabled, resolve and validate the real
paths for the evidence root and every runner-created writable subtree, reject
symlink/traversal escapes, and require them to reside on the required mounted
filesystem before starting the node. Add a regression with a different-device
evidence root and an escape path.

### R4-3 — P2: a post-start evidence collision loses the cleanup receipt

The runner starts the node before allocating the first attempt directory. On
collision it sets `EVID=""` to protect the pre-existing directory, then
cleans up the owned node. `finish()` writes `CLEANUP.json` only when `EVID` is
non-empty, so this path has no terminal cleanup receipt even though the node
lifecycle ran.

The independent probe pre-created `fixed-attempt1`, ran with the same stamp,
observed exit 5 and a node-stop marker, and found no `CLEANUP.json` anywhere
in the evidence root. The same conditional also affects preflight failures
that occur after node start but before an attempt directory is created.

Required: reserve a collision-safe owned receipt location before launch, or
write a separate refusal/cleanup receipt without touching the victim; every
path that starts the node must leave a checked terminal cleanup disposition.
Add collision and post-start preflight regressions while proving the original
directory remains byte-identical.

## Disposition

The corrected candidate is returned to the existing zCode build session for
one bounded round. The binary pin, collector, helper supervision, forced
cleanup, provisional ownership, generated systemd identity, and race fix were
left untouched by this review. The live public-mesh capture, delivery control,
and any David Irvine communication remain unperformed pending acceptance.
