# x0x #622 runner re-review: three remaining failure-boundary blockers

Backend Astra, 2026-09-10 America/Denver. Candidate **`9b5df485`**;
independent worktree, build worktree untouched. Verdict: **NOT ACCEPTED for
live execution**. The corrections materially improve the packet, but its
caller still turns failed evidence and failed cleanup into success.

## Verified progress and scope

- The shipped `--fast` suite reproduced **11/11** in an empty Linux
  user/network/PID namespace. The namespace had loopback only; no public
  mesh traffic, production process or production identity was used.
- Candidate GitHub checks were all successful: 11 check-run records across
  the branch/main runs, including the normal seven main checks. Workflow
  count and check-run count are different quantities.
- The explicit CLI/API shim, direct collector status capture, exclusive
  attempt directory creation, finite configured attempt loop, and the R5/R6
  documentation corrections are present. The accepted binary digests remain
  unchanged. The corrected counter claim and artifact expiry policy stand.
- The builder's approximately 21-minute slow suite and new offline run were
  not repeated in this re-review. Their receipts remain builder evidence;
  the failures below are independently reproduced at the real runner boundary.
  A short collector-shaped stub is fault injection, not a valid capture.
- No new reply from David appeared on #622 at this check. No public comment,
  host installation, cloud change or live measurement was performed.

## F1 — P1: sampler and logger failure can still produce an accepted interval

`scripts/x0x-622/run-capture.sh:288` and `:291` discard the helper exit
statuses with `wait ... || true`. The postcheck at lines 201-231 counts error
records but does not reject them or validate sampling coverage across the
window. One healthy sample is enough, even if the sampler immediately dies.
The log helper's success and coverage are never required at all.

Actual runner probes, with a healthy control and the same stub API:

| Injected boundary behavior | Runner result | Stored disposition |
|---|---|---|
| Healthy collector, real sampler | 0 | accepted |
| One healthy JSONL record, sampler exits 22 | 0 | accepted |
| One healthy record plus three timeout records, sampler exits 21 | 0 | accepted |
| Log helper immediately exits 9 | 0 | accepted |

The sampler's standalone T4 proves that the callee emits 22, but not that its
caller honors 22. A completed collector does not repair a failed evidence
writer. A series with only its first sample cannot prove peer continuity.

Required: supervise each helper, preserve spontaneous failure separately
from the runner's intentional stop, and reject insufficient health/log
coverage. Validate timestamps, gaps, health shape and the declared error
policy across the actual interval. Bound shutdown without swallowing an
already failed helper. Exercise all of these through `run-capture.sh`, not
only through `sampler.py` or a separately constructed shim.

## F2 — P1: final evidence write failure is explicitly ignored

`run-capture.sh::mark_attempt` (lines 115-121) discards failures writing
`ATTEMPT.json` and the failure marker. The caller then sets `EXIT_RC=0`
for an accepted status. This contradicts the spec's promise that a full
bounded filesystem becomes a reported failure.

Reproduction: the collector-shaped test plants an `ATTEMPT.json` symlink
to Linux `/dev/full` inside its own fresh test directory. That injects
ENOSPC at the final write without filling the host disk. The final receipt
cannot be written, yet the actual runner returns **0**. No outside file
or production mount was changed by the probe.

Required: a failed terminal receipt commit must prevent overall success.
Use a checked write/finalization boundary and preserve the original failure
if a secondary failure marker also cannot be written. Report failure on
stderr/exit status when storage cannot hold a receipt; do not promise a
durable failed marker on a full volume. Tests must fault the final write,
not only the sampler's initial open.

## F3 — P1: the lease and cleanup still depend on a cooperative runner

The watchdog at lines 97-99 sends TERM only to the runner. Foreground node
start/check/stop commands have no timeout. `finish()` disables its signal
traps and kills the watchdog before unbounded waits and node stop. It also
ignores a nonzero node-stop result (line 134) and clears its ownership flag.
The proposed systemd unit has no independent runtime deadline.

Two actual runner probes:

- A node-stop command returning failure produced **exit 0 / accepted** and
  no stopped-node marker. The emitted warning does not change the result.
- A node-start command blocked in `sleep 30` delayed the TERM handler:
  after TERM, the runner was still alive two seconds later. The isolated
  test supervisor killed its process group; no shutdown command ran.

The second probe is a cancellation reproduction, not a 601-second lease
retest. Source inspection establishes that the watchdog uses the same TERM
path. It is therefore not an independently enforced upper bound. Likewise,
a runner killed outright cannot execute its cleanup trap; the external node
needs its own expiry mechanism. Killing only helper parent PIDs also does
not establish that every descendant has stopped.

Required: bound startup/check/stop and all waits, cover partial startup,
retain ownership until stopped, and distinguish measurement acceptance from
cleanup success. Enforce the node's deadline outside this shell (for example
a reviewed systemd runtime limit), with bounded graceful then forced cleanup
of owned groups. Test blocked start, failed/blocked stop, an uncooperative
helper and runner death, preserving an unrelated sentinel. Do not introduce
any host-wide shutdown or production service action.

## Reproduction and next handoff

Probe source: [x0x-622-rereview-probe.py](../receipts/x0x-622-rereview-probe.py).
Observed result: [x0x-622-rereview-result.json](../receipts/x0x-622-rereview-result.json).
Run from the reviewed worktree on this laptop:

```powershell
wsl --exec timeout --kill-after=5s 60s unshare --user --map-root-user --net --pid --fork --kill-child bash -c 'ip link set lo up && exec python3 /mnt/c/Users/travi/wt-astra-x0x-622-rereview/docs/receipts/x0x-622-rereview-probe.py'
```

The enclosing PID namespace also removes residual test watchdogs when the
probe ends. The harness reports observed failures rather than labeling them
as valid measurement results. Its synthetic collector does not establish
any actual 300-second or 1200-second window.

Use the same zCode build session for a bounded correction of F1-F3. Preserve
the original dispatch and append the correction record. Keep the upstream
collector unchanged; do not reopen attribution or binary provenance work.
Return a new pin with caller-level regression evidence for independent review.

Oracle colocation remains a plausible option, not an accepted launch plan.
Complete the transient-unit startup/token bootstrap and disk/log placement
recipe together with F3: the current `systemd-run ...` sketch is incomplete,
while the runner defaults to starting an existing unit and requires its token
before starting. Prove the configured storage ceiling covers the actual
writable paths, not merely a proposed mount. No purchase is needed to fix
these local control-flow defects. No live launch is authorized by this review.

David still needs the real timed public-mesh capture, with send-attempt rates
clearly distinguished from wire bandwidth. The separate per-peer delivery
control remains unperformed. These runner corrections are preparation for
that evidence, not a substitute for it.
