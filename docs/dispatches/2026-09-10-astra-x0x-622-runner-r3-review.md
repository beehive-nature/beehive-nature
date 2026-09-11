# x0x #622: review of 1df62813, remaining cleanup and deployment boundaries

Backend Astra, 2026-09-10 America/Denver. Separate review worktree; builder
worktree unchanged. **Not accepted for live launch.** The prior direct
sampler/log/ATTEMPT failure cases now reject correctly. Three remaining
groups of defects are below, with concrete corrections rather than a new lane.

## What passed and what was actually run

The shipped fast suite reproduced **21/21** with an init process that reaps
orphan children and a procfs mounted for the test PID namespace. The earlier
bare-namespace run had six failures; adding a reaper reduced that to three,
and mounting namespace-local procfs removed the pgrep-related false failures.
Those setup artifacts are not counted as product findings. The final exact
suite ran under the command shape below with `test_runner.py --fast`.

The targeted cleanup probes additionally reproduce a healthy exit 0 control,
an ignored cleanup-receipt write failure, an unbounded TERM-ignoring stop,
and an unclean partial-start cancellation. They use the real runner with
synthetic API/collector/node commands. Sampling is deterministic in these
cleanup probes, to isolate cleanup from in-flight sampler termination timing.
The shipped suite independently exercises the real sampler.

No public mesh, actual systemd service, production identity, deployment,
filesystem-image provisioning, or upstream comment was involved. The
approximately 21-minute slow suite was not independently rerun this round;
its reported 3/3 remains builder evidence. The binary pin, unchanged upstream
collector, counter correction and artifact policy remain accepted. David's
#622 comment IDs were unchanged at the check.

## G1 — P1: stop escalation is not bounded, and cancellation loses partial ownership

`scripts/x0x-622/run-capture.sh:156` uses `timeout` without a kill-after
deadline. A command that ignores TERM keeps that timeout process waiting.
In `finish`, the watchdog has already been stopped and the signal traps
disabled. The forced-stop branch is never reached until the first call
returns, so this is not a bounded graceful-then-forced sequence.

Actual reproduction: `X0X_STOP_TIMEOUT=1`, force timeout 1, helper grace 1;
stop command `trap '' TERM; while :; do sleep 1; done`. The runner remained
alive after ten seconds and never reached the forced-stop marker. The
external isolated test supervisor killed it. The builder's TF3c uses a
cooperative sleeping command; that does not test TERM refusal.

There is a second ownership hole at lines 242-246. `NODE_OWNED` becomes 1
only after `run_bounded` returns. A signal during that wait goes directly
to cleanup while it is still 0. The probe started a separate harmless sleep
process, wrote its PID, then kept the start command pending. TERM returned
130 promptly, but neither node-stop callback ran and the separate process
was still alive. The probe itself then killed that process.

Required: a real forced-kill deadline for every bounded node command and
its owned descendants; test a TERM-ignoring start/stop, not just sleep.
Track provisional ownership before launch can create resources, using a
unique reserved run/unit identity so a collision cannot cause cleanup of
someone else's unit. Cleanup must cover resources created before the start
command returns, verify they stopped, and preserve that disposition. Keep
the independent service runtime limit as a backstop, not a substitute for
immediate cancellation cleanup.

## G2 — P1: the new cleanup receipt repeats the old unchecked-write failure

`run-capture.sh:210-212` prints a warning when writing `CLEANUP.json` fails,
but leaves the success code unchanged. The checked ATTEMPT write now works;
the law was not carried to the newly added final receipt.

The probe places `CLEANUP.json -> /dev/full` inside its own fresh evidence
directory. The runner completes the measurement and node stop, prints
`cleanup receipt write failed`, and still exits **0**. This is an injected
ENOSPC write failure, not a filled host filesystem or a production change.

Required: failure to commit the cleanup disposition must prevent overall
success. Preserve measurement and cleanup outcomes separately, but return
a nonzero final result if either required terminal record cannot be written.
Test both terminal filenames; no durable error marker is promised on a full
volume. Do not turn a pre-existing failure back into success.

## G3 — P1: the default unit does not use the promised identity or prepared log directory

The spec says the daemon uses dedicated account `x0xm`. Neither the actual
`X0X_NODE_START` default at runner line 79 nor the copied systemd-run command
sets User/Group or --uid/--gid. Launched by the documented root operator,
the system service defaults to root. Creating/chowning a directory does not
change the service identity. This follows
[systemd's User/Group documentation](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml).
The actual command must enforce the promised separation before colocation.

The fresh-mount recipe also creates `log/` before mounting the new filesystem
over its parent, then immediately chowns that now-hidden subdirectory.
On a newly formatted filesystem it has not been recreated. This is source
inspection of the specified ordering, not a live Oracle mount test.

Required: create all required directories after the verified mount, then
set ownership/modes. Set the dedicated service User/Group in the actual
runner command and spec, and gate launch on the expected mount and paths.
Test the generated deployment command/configuration itself, rather than a
handwritten substitute. The builder's TF3d starts a separate `timeout 6`
stub; it establishes the stub's expiry, not the real unit's UID or filesystem
layout. No production launch is needed to catch these command-shape defects.

## Reproduction and handoff

Files: [probe](../receipts/x0x-622-r3-probe.py),
[namespace init](../receipts/x0x-622-namespace-init.py),
[observed result](../receipts/x0x-622-r3-result.json).

```powershell
wsl --exec timeout --kill-after=5s 75s unshare --user --map-root-user --net --pid --fork --kill-child --mount-proc bash -c 'ip link set lo up && exec python3 /mnt/c/Users/travi/wt-astra-x0x-622-r3/docs/receipts/x0x-622-namespace-init.py python3 /mnt/c/Users/travi/wt-astra-x0x-622-r3/docs/receipts/x0x-622-r3-probe.py'
```

All runner processes are confined to a fresh PID/network namespace with
loopback only. The enclosing namespace removes any remaining fault-injected
watchdogs/stop commands when the review ends. Synthetic short windows are
not a public 300-second or 1200-second measurement.

Same zCode build session, same bounded scope: fix G1-G3 and append the
receipt. Keep the accepted earlier changes. Return a new pin for review;
do not create a new feature lane, purchase a VPS, install on Oracle or post
an upstream success claim. The real capture and separate delivery control
are still unperformed. Oracle remains a plausible host once the actual
isolation and cleanup commands meet their declared behavior.
