# x0x #622: binary provenance accepted; execution packet returned for correction

Backend Astra, 2026-09-10 America/Denver. Reviewed estate pin `58aa4fc9`
in a separate worktree. The zCode build worktree and production services
were untouched. This is an independent negative review of a proposal, not
a public-mesh measurement or an execution authorization.

**Verdict: do not run the packet as written.** Its upstream binary pin is
usable, but its actual commands do not implement several promised bounds
and evidence guarantees. Six findings follow. References to packet line
numbers mean the original file at `58aa4fc9`, before the review banner.

## What was independently verified

- Upstream build run [34534309338](https://github.com/saorsa-labs/x0x/actions/runs/34534309338)
  succeeded at source `6cc4085c72205df7e4feda006b7052bbca5ddaf6`.
  The downloaded x64 and arm64 CLI/daemon digests all match packet section 0.
  Existing downloadable artifact IDs are `10175109014` (x64 GNU) and
  `10175170184` (arm64 GNU). This verifies these particular bytes, not
  reproducibility of a future build's dependency resolution.
- The exact pinned x64 daemon runs and reports `0.41.4`. Its actual gossip
  response includes `participation` and `pubsub_stages.message_kinds`.
  The latter is NOT missing upstream.
- Review probes ran in a fresh Linux user/network namespace with only
  loopback and no route. Bootstrap, peer cache, mDNS and port mapping were
  disabled; state and identity were temporary. A 60-second outer timeout,
  child resource limits and owned-process cleanup bounded the test.
  Zero peers were expected in this offline test. No apartment public-mesh
  traffic was generated and no live-window eligibility is claimed.
- A read-only Oracle observation found 16,463 MiB available RAM and
  10,214 MiB available root-filesystem space; production x0x was active.
  This does not approve colocating a node. It does mean lack of an eligible
  production *daemon* is not proof that a new *host* must be bought.

Reproduction harness: [x0x-622-packet-review-probe.py](../receipts/x0x-622-packet-review-probe.py).
Machine result: [x0x-622-packet-review.json](../receipts/x0x-622-packet-review.json).
The sampler file-redirection observation in that result is static inspection;
the counter response, endpoint targeting, malformed JSON, pipeline status and
directory-overwrite probes were executed. The shutdown was inspected, never run.

Exact local reproduction (WSL, with the already verified x64 artifacts):

```powershell
wsl --exec timeout --kill-after=5s 60s unshare --user --map-root-user --net bash -c 'set -e; ip link set lo up; exec python3 /mnt/c/Users/travi/wt-astra-x0x-622-review/docs/receipts/x0x-622-packet-review-probe.py /mnt/c/Users/travi/buzz-repair/2026-09-10/x0x-622-pinned-binaries/linux-x64-gnu'
```

The probe refuses a namespace with another interface or an IPv4 route before
starting the daemon. It reports observations rather than treating the known
broken packet behavior as a passing capture. No live capture is authorized
by this reproduction command.

## R1 — P1: the collector can measure the wrong daemon

Packet lines 181-186 preflight an absolute CLI with `--api 127.0.0.1:12710`.
Lines 242-244 then launch the unmodified upstream collector, which invokes
bare `x0x` without that override. No PATH binding or API-address binding is
established for those calls. `X0X_API_TOKEN` selects a credential, not a port.

At the upstream pin, `scripts/capture-egress.py::snapshot` invokes the bare
CLI. `src/cli/mod.rs::DaemonClient::new` selects an explicit API override,
then discoverable daemon files, then port 12700. An empty-namespace decoy
at 12700 received the bare CLI health calls and returned exit 0; the explicit
12710 control reached the pinned daemon. On a clean host the collector may
instead fail because `x0x` is not on PATH. Neither outcome measures the
preflighted node.

Required: bind every collector invocation to the exact CLI and test API,
preferably through a private PATH wrapper around the unchanged collector.
Test the actual collector boundary with a decoy default daemon. The decoy
must receive no calls, and missing/mismatched targets must fail closed.

## R2 — P1: health evidence is malformed and capture failure looks successful

Packet lines 233-237 remove five bytes from pretty-printed CLI JSON, truncate
it to 400 bytes and prepend an unfinished object. They do not redirect it
to a health evidence file or terminate a JSONL record. The exact pinned CLI
output fails JSON decoding after that transformation. The sampler is also
an unbounded helper with cleanup only on the happy path.

Lines 242-246 pipe the collector through `tee` without preserving its status.
A collector-shaped command exiting 7 returned 0 through that pipeline;
the `pipefail` control returned 7. The final journal query starts at the
console file's modification time, potentially near the end of the capture,
so it cannot repair a missing earlier log segment.

Required: persist full parsed health objects with timestamps through a JSON
serializer; bound each call and the entire sampler; capture logs from a saved
start timestamp; propagate collector and evidence-writer failures. A trap or
owned process group must clean up only this run's helpers on failure and
cancellation. Tests must parse the emitted file and preserve a forced nonzero
collector result through the actual runner.

## R3 — P1: the lease shuts down the host and can block deployment

Packet lines 167-174 use `Type=oneshot` with a three-hour sleep followed by
`/sbin/poweroff`. That is host shutdown, not scoped cleanup. The following
daemon-start command sits after synchronous `systemctl enable --now`.
If the lease starts, the oneshot remains activating during its sleep and
the start job waits for it. This can hold deployment until shutdown.
The lease is also described as measured from instance boot, while the
sleep actually begins when the service is started.

These semantics follow systemd's primary documentation for
[oneshot startup](https://github.com/systemd/systemd/blob/main/man/systemd.service.xml)
and [synchronous job waiting](https://github.com/systemd/systemd/blob/main/man/systemctl.xml).
No shutdown command was executed in this review.

The proposed shared-host isolation claim at lines 129-130 also conflicts
with the configured QUIC bind on port 5483, already used by the production
layout. Finally, section 6's `poweroff` neither deletes an instance nor
destroys its volumes or keys.

Required: a genuinely scoped, independently enforced deadline for the test
node and helpers, distinct ports or an isolated network namespace, and no
host shutdown. Cancellation must leave an unrelated sentinel service alive.
Specify shutdown and any later instance disposal as different operations.
Do not install a permanent boot-enabled test service as a temporary lease.

## R4 — P2: retry, disk and evidence exclusivity bounds exist only in prose

Packet lines 91-95 claim at most 1 GiB disk and two retries. A 20 GiB volume
does not enforce the 1 GiB limit; `Restart=always` supplies no aggregate
retry budget, and the logs/state are outside an enforced storage budget.
The memory cap is real but cannot guarantee that a window is never poisoned
by memory pressure. A cap-triggered interval must be rejected.

Lines 213-215 use a second-resolution timestamp, fixed `attempt1`, and
`mkdir -p`, despite recognizing that the upstream collector overwrites.
The reproduced sequence accepted an existing evidence directory and replaced
its t0 file. No immutable/exclusive allocation is provided by those commands.

Required: enforced aggregate lease/retry limits, a real disk/log ceiling or
an explicitly revised enforceable bound, and exclusive creation before the
collector may write. Validate durations before launch, keep rejected runs
immutable, and record cap-triggered refusal. Test directory collision,
exhausted retry budget, deadline and evidence-write failure paths.

## R5 — P2: the proposed upstream diagnostic-gap report is false

Packet lines 290-302 and the builder dispatch assert that no inbound
`message_kinds` counter exists. The exact pinned binary returned:

```json
{"anti_entropy":0,"decode_failed":0,"eager":0,"graft":0,"ihave":0,"iwant":0,"other":0,"prune":0}
```

It is at `pubsub_stages.message_kinds`. At the pinned source,
`src/gossip/pubsub.rs::stage_stats` returns the dependency's
`PubSubStageStatsSnapshot`; `src/server/routes/network.rs::gossip_diagnostics`
serializes it through `augment_pubsub_stage_diagnostics`. A search limited
to x0x's own declarations misses the dependency-provided serialized fields.

Required: correct both packet and dispatch with an appended correction
record and a real response-shape check. Do not report this as missing to
David. These are aggregate stage counters; their existence does not prove
per-peer application delivery or replace published/delivered message IDs
and timestamps. The separate delivery control remains unperformed.

## R6 — P2: rebuilding is presented as refetching identical pinned bytes

Packet lines 58-64 and 319-321 prescribe rerunning upstream CI to retrieve
expired artifacts and require the previous hashes. There is no committed
Cargo.lock, and the pinned build workflow does not use `--locked`. Rerunning
the same source is a new build with potentially different dependency
resolution and toolchain state. The existing artifact pin is still valid;
the same-byte rebuild claim is not established.

Required: retrieve the existing immutable artifact by recorded run/artifact
identity and verify the binary digest. If it expires, preserve an already
verified copy or treat replacement bytes as a new candidate requiring a new
provenance receipt and review. Do not rerun upstream workflows merely to
download files. Do not describe an absent lockfile as a recovered lockfile.

## Bounded handoff and host decision

Use the same zCode build session/worktree for one correction round. Turn the
copy-paste lifecycle into a tested wrapper around the unchanged upstream
collector, with actual command-boundary regressions for the findings above.
Move the undeployed proposal to `docs/specs/` and retain a pointer from its
old location; `ops/` must not present an uninstalled proposal as box parity.
The new pin returns to backend Astra before any public-mesh capture.

First prepare a concrete isolation option on existing Oracle resources:
fresh identity/state, separate ports/network namespace, capped CPU/RAM/disk,
owned cleanup and no production daemon, credentials, routes or firewall
changes. A read-only feasibility assessment is authorized; it is not a live
launch instruction. If that cannot meet the bounds, document why and then
present a temporary-host proposal. New cloud provisioning or firewall policy
is not inferred from the resource snapshot.

David's [current #622 request](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5615274866)
still needs a timed public-mesh Leaf capture with named topic deltas, followed
by the separate delivery control when feasible. This review is neither.
Send-attempt counters remain distinct from wire bandwidth. No new public
comment was posted during this review: our prior readiness reply is still
the last observed comment, and there is no new live result to send yet.

The next Connect Store feature lane remains behind this follow-up. The
original builder record is preserved; the review banner stops its unsafe
commands being mistaken for an accepted execution handoff.
