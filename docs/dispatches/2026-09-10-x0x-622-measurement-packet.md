# x0x #622 measurement prep: pin resolved, binaries pinned, execution packet staged — awaiting host approval

zCode seat, 2026-09-10, under the founder's measurement orders
(`buzz-repair/2026-09-10/zcode-x0x-622-measurement-orders.md`). Upstream ask
(David, [#622](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5615274866)):
run the existing `scripts/capture-egress.py` on a real public-mesh Leaf and
attach the output; separately, a per-peer published/delivered message-ID
control when possible. No live capture was run from this seat and none is
claimed. Backend Astra owns the public follow-up.

## Completed (receipts)

- **Full #622 discussion read.** No newer comment after our reply
  ([#5627339402](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5627339402));
  David has NOT yet answered the pin question, so current main stands.
- **Upstream re-check (2026-09-10):** newest published release still
  v0.41.3; main still `6cc4085c72205df7e4feda006b7052bbca5ddaf6`; the
  collector has exactly one commit (`bd0d23ff`) — no later fixes to apply.
  Main is versioned `0.41.4`, past the released 0.41.3.
- **Instrumented binaries pinned** = upstream's own CI run **34534309338**
  (build.yml at exactly `6cc4085c`, success): `x0x-linux-x64-gnu` +
  `x0x-linux-arm64-gnu`, executed under WSL (`x0x 0.41.4` / `x0xd 0.41.4`),
  sha256 recorded in the packet §0. Upstream gitignores `Cargo.lock`, so the
  lockfile pin is the CI job's own resolution — stated, not papered over.
  CI artifacts carry no GPG signature (release tarballs do) — flagged, with
  the re-pin trigger.
- **Instrumentation verified in source at the pin**: `gossip_diagnostics`
  emits `participation`/`subscribed_topics`/`outbound_by_topic_named`/
  `egress_budget`/`pubsub_stages`/`discovery_cache_entries` with route
  tests; default Leaf (`reason: "default_leaf"`) absent `--relay`/
  `gossip.relay`; `skip_legacy_dm_bus` exists, default off. This is why the
  oracle 0.41.3 structurally cannot pass §5 and these binaries can.
- **Collector + §5 rules read at the pin.** Confirmed in code: `--out-dir`
  overwrites (`exist_ok=True` + `write_text`) and validates the ≥300 s floor
  only AFTER the window — the packet mandates a new exclusive evidence dir
  per attempt and pre-validated duration.

## The blocker (precise)

No already-approved isolated measurement host exists. Oracle is the
production instance (founder-order 0.41.3; identity/service/ports/ACLs
untouchable; ineligible diagnostics). The laptop is public-mesh-forbidden
(standing law, ops/x0x/LAPTOP-NETWORK.md). A temporary VPS is a cloud-policy
founder gesture outside this build seat. Per the orders, that is a concrete
blocker — not license to claim the measurement or move to new features.

## Prepared

**`ops/x0x/MEASUREMENT-622.md`** — the full execution packet for Astra
review: provenance + digests + re-fetch path; provisioning spec with
declared finite bounds (3h wall-clock with a poweroff lease, MemoryMax 768M,
CPUQuota 200%, ≤1 GiB disk, ≤2 retries); fresh-throwaway-identity deploy
(separate user/ports/state from any prod naming); §5.1 default-Leaf config;
eligibility gate commands; stability gate; mid-window 60 s health sampling
+ service-log continuity (§5.4 items the collector does not enforce);
1200 s collector invocation with idle law; reject/restart protocol that
preserves failed evidence; sanitization rules + the Linux/VPS provenance
disclaimer (no Windows-host reproduction, no before/after, no reduction
claim); scoped cleanup. Pinned binaries staged locally at
`buzz-repair/2026-09-10/x0x-622-pinned-binaries/` (never committed; repo
re-fetch instructions in the packet).

## Unperformed

- The live public-mesh capture itself (blocked on host approval above).
- The per-peer delivery control: needs a second approved instrumented peer;
  also flagged to Astra that **no inbound `message_kinds` counter exists at
  this pin** (source-checked) — David's as-specified receiver-side counter
  is an upstream diagnostic gap; the ID/timestamp comparison remains
  doable at the application layer with approved synthetic traffic. If no
  second peer is approved, this part is reported unperformed — counter
  deltas never substitute.
- Any public posting on #622 (Astra owns; this seat posts nothing).

## Handoff

Astra reviews `ops/x0x/MEASUREMENT-622.md`; founder provisions the temporary
host (or names an approved existing one); the packet runs as written; the
sanitized summary returns to #622 under Astra's name. The Connect Store
candidate `f02f0f6e`/`7302cabf` remains accepted-and-merged locally; its
next feature lane stays behind this upstream measurement request.

---

# CORRECTION ROUND (zCode, 2026-09-10, after review b7076f86)

Backend Astra returned the packet above with six findings. All six are
owned as real defects; none of the original commands survive. What replaces
them: a TESTED wrapper around the UNCHANGED upstream collector, committed
at `scripts/x0x-622/` — `run-capture.sh` (runner), `sampler.py` (bounded
honest sampler), `test_runner.py` (regression suite) — plus the corrected
specification `docs/specs/SPEC-X0X-622-CAPTURE-1.md`. The undeployed
proposal moved out of `ops/` (now a pointer stub there; the reviewed
original stays in git history at `58aa4fc9`/`b7076f86`).

## Findings → corrections, with receipts

- **R1 (wrong daemon):** fixed by a private PATH shim
  (`exec <pinned-x0x> --api <test-api>`) the runner installs and asserts;
  the unchanged collector's bare `x0x` calls cannot reach the default port.
  Receipts: T1 — REAL collector through the shim: decoy on 12700 receives
  **0 calls**, the stub API receives exactly 6 (3 endpoints × t0/t1),
  short-window dt-reject; T1b — without the shim the same harness sees
  decoy=6 (the boundary test is not vacuous); T10 — the same boundary
  against the pinned REAL daemon offline.
- **R2 (malformed evidence, masked failures):** `sampler.py` serializes
  FULL timestamped health objects to JSONL (fsync per record, bounded
  per-request timeout and total lifetime; 3 consecutive failures exit 21;
  write failures exit 22 — T4 receipts exit 22). Collector console goes
  straight to file (no `tee`); the runner propagates a distinctive
  collector exit verbatim — T2 receipts forced exit **7 returning 7**
  through the full runner. Log capture starts from a saved
  `window-start.epoch`.
- **R3 (host poweroff / blocking oneshot / boot persistence):** all
  removed. The lease is now a `setsid` watchdog that TERMs the runner only;
  `finish()` kills ONLY tracked helpers (watchdog group including its inner
  sleep — an early version of this very fix leaked the sleep and held the
  caller's stdout pipe open; caught in seat testing, fixed with group kill
  + full redirection) and stops only the node it started. The test node is
  a TRANSIENT systemd unit, never enabled. T7 receipt: lease fired at
  exactly 601 s → exit 124, status `interrupted-lease`, evidence retained,
  **sentinel process outside the runner survived**; T8 receipt: SIGINT →
  exit 130, `cancelled`, sentinel survived.
- **R4 (prose-only bounds):** duration/digest/shape gates run BEFORE node
  start (T9: 299 s window refused with the node never started; T9b digest
  mismatch refused; T9c wrong version refused by the shape gate). Evidence
  dirs are created with plain `mkdir` — T5: collision on a pre-existing dir
  refused (exit 5) with the original bytes intact. Retry budget enforced —
  T6: exactly 2 attempts, each retained with `FAILED` + `ATTEMPT.json`.
  A cap/restart interval fails post-checks and is retained; peer collapse
  anywhere in the series fails the window (T11b).
- **R5 (false message_kinds claim): RETRACTED with receipt.** The pinned
  daemon emits `pubsub_stages.message_kinds` (eager/ihave/iwant/graft/
  prune/anti_entropy/other/decode_failed), serialized from the dependency's
  `PubSubStageStatsSnapshot` via `augment_pubsub_stage_diagnostics` — the
  builder's grep only covered x0x's own crates. T10 (this seat's own
  offline namespace run of the pinned binary, recipe per the review probe)
  receipts the full participation + message_kinds + egress_budget shape.
  No missing-counter report goes upstream. These are aggregate stage
  counters; the per-peer delivery control remains SEPARATE and, absent a
  second approved peer, UNPERFORMED.
- **R6 (rebuild ≠ refetch):** existing artifact IDs pinned
  (`10175109014` x64 / `10175170184` arm64) beside the accepted digests;
  `gh run rerun` removed from all documents; expiry policy = preserved
  verified local copy or a NEW candidate with fresh provenance review.

## Regression receipts (exact commands, WSL, this seat)

- `python3 scripts/x0x-622/test_runner.py --fast` → **11/11 pass**
  (T1, T1b, T2, T3, T4, T5, T6, T8, T9, T9b, T9c), ~1 min.
- `python3 scripts/x0x-622/test_runner.py --offline` → **1/1 pass**
  (T10; real pinned x0xd 0.41.4 + real collector in an empty user+net
  namespace, loopback only, no route; receipt JSON at
  `/tmp/x0x-622-offline-receipt.json` mirrored into
  `docs/receipts/x0x-622-offline-shape-receipt.json`).
- `python3 scripts/x0x-622/test_runner.py --slow` → **3/3 pass**
  (T7 lease 601 s scoped; T11 REAL collector 300 s accept path through the
  runner, decoy 0; T11b peer-collapse rejection, evidence retained),
  ~21 min. These are SYNTHETIC/stub or offline proofs of the machinery —
  explicitly NOT the 1200-second public-mesh measurement.

Two seat-testing defects found and fixed before these receipts (bash
collector stubs dying under $X0X_PYTHON; the watchdog pipe-hold wedge
above) — recorded because they are exactly the class of silent failure the
review demanded the runner survive.

## Host plan (prepared; NOT launched)

Read-only Oracle assessment (SSH live at assessment time; no mutation):
4 cores; ~16 GiB RAM available; 9.4 GiB free disk; production binds UDP
5483 + loopback 12700; **UDP 5493 and loopback 12710 are free**; systemd
255 + cgroup v2 (transient units); `/dev/loop-control` present; no netns
configured. Concrete scoped-colocation shape in the spec §3: dedicated
user, 2 GiB loop-image disk ceiling holding ALL test state/evidence/logs,
fresh throwaway identity, transient capped unit (MemoryMax=768M,
CPUQuota=100%), runner lease 3 h, distinct ports — no production contact,
no boot persistence, no cloud/firewall change. Trade-off recorded: the
test Leaf shares the box's public IP; if Astra rules that contaminating,
the temporary-VPS fallback (spec §3b reference) applies. A VPS purchase is
NOT a prerequisite without Astra first rejecting this scoped option on the
evidence.

## Unperformed (unchanged)

The live public-mesh capture (awaits Astra re-acceptance of the corrected
spec + founder host word); the per-peer delivery control (awaits a second
approved instrumented peer; app-layer ID/timestamp comparison sketched;
counter deltas never substitute); any public #622 posting (Astra owns; our
readiness reply remains the last comment as of this round).

---

# CORRECTION ROUND 2 (zCode, 2026-09-10, after re-review f8b3cb46)

Astra reproduced the fast suite 11/11 and then found three caller-level
failures — all real, all owned. The runner was rewritten around them; the
unchanged collector, the binary provenance, the R5 retraction and the
artifact policy are untouched. New candidate pin: see the commit carrying
this append.

## F1 — helper failures now reach the runner's result

- Sampler and log helpers are supervised: each helper's liveness is checked
  at window end and its exit status captured and recorded in `ATTEMPT.json`
  (`sampler_exit`, `log_exit`). A helper already dead before the runner's
  stop died spontaneously → attempt failed (`failed-sampler` /
  `failed-log-helper`); a helper alive at window end was stopped BY the
  runner (its stop-time rc is our coercion, recorded but not a failure).
- Coverage is validated across the actual interval, not endpoint-sampled:
  the series must span the window (span vs `dt` from the saved epochs), no
  interior gap beyond `3×interval+3`, zero error records, ≥2 samples, every
  record carries `peers`+`uptime_secs`, uptime is monotonic and advances
  with the window, no peer collapse. An empty `service.log` is failed
  evidence (§5.2 continuity: a silent log proves nothing).
- Receipts (real runner, real sampler where noted): TF1a — sampler exits 22
  after one healthy record → `failed-sampler`, exit 1; TF1b — one healthy +
  three error records, exit 21 → `failed-sampler`; TF1c — log helper
  `exit 9` → `failed-log-helper`; TF1d — sampler TERM-clean but silent after
  one full record → `failed-coverage` (the gap rule, not supervision, does
  the rejecting — a clean-looking helper cannot fake coverage).

## F2 — terminal receipt writes are checked

`mark_attempt` now verifies the write: `ATTEMPT.json` must be written and
nonempty, and the `FAILED` marker too on failed attempts. Any failure →
`run-capture: TERMINAL RECEIPT WRITE FAILED` on stderr, run exits **6**,
attempts abort (storage unreliable), evidence retained as-is, and no
durable marker is promised on a full volume. Receipt: TF2 plants
`ATTEMPT.json → /dev/full` (Astra's exact injection) — collector succeeds,
measurement would be "accepted", the runner still exits 6 with the symlink
retained untouched.

## F3 — cleanup and deadline survive a blocked or dead runner

- Node start/check/stop run through `run_bounded`: background `setsid
  timeout` + interruptible `wait` — a TERM during a BLOCKED start is
  honored immediately. Receipt TF3a: TERM mid-blocked-start → runner gone
  within the 3 s probe budget (exit 130) and the blocked job (own group)
  killed, nothing left behind.
- Cleanup kills owned process GROUPS with bounded graceful-then-forced
  escalation (`X0X_HELPER_GRACE`, then KILL); receipt TF3e: a
  TERM-ignoring collector is force-killed and cancellation completes in 5 s
  (exit 130).
- Cleanup disposition is separate from measurement disposition: node
  ownership is retained until a bounded stop completes; a failed graceful
  stop escalates to `X0X_NODE_FORCE_STOP`. Receipts: TF3b — stop returns
  failure → measurement `accepted` but run exits **8** with `CLEANUP
  FAILED` on stderr; TF3c — stop blocks → graceful bounded at 4 s → forced
  path completes cleanup → run stays accepted (6 s total).
- The node's deadline now lives OUTSIDE the shell: the default lifecycle is
  a `systemd-run` transient unit carrying `RuntimeMaxSec` (lease+600 s) —
  systemd kills it even if the runner is SIGKILLed. Receipt TF3d: runner
  SIGKILLed mid-window → the stub node's own runtime expiry removed it
  within seconds, the unrelated sentinel survived, evidence retained.
- The log helper is itself `timeout`-wrapped to the lease, so no helper
  outlives the run's bounds if the shell dies.

## Concrete lifecycle recipe (spec §3, replacing the ellipsis sketch)

The spec now carries the exact one-time deploy (user, 2 GiB loop-image
mount, config), the full `systemd-run` unit command (RuntimeMaxSec,
MemoryMax/CPUQuota/TasksMax, hardening properties, `StandardOutput=append:`
into the bounded volume — logs never touch the host journal), the
stop/force-stop/check commands, the storage-ceiling proof commands
(`findmnt` + path listing + `df` of the mount, every writable path inside),
and the token bootstrap: fresh units mint `state/api-token` at first boot;
the runner takes `X0X_TOKEN_FILE` and reads it internally after start —
the token never appears on a command line (`X0X_API_TOKEN` env remains the
alternative).

## Regression receipts (exact commands)

- `python3 scripts/x0x-622/test_runner.py --fast` → **21/21 pass** (the
  round-1 eleven + TF1a-d, TF2, TF3a-e), ~3 min.
- `python3 scripts/x0x-622/test_runner.py --slow` → receipts below (T7
  scoped lease, T11 real-collector accept, T11b peer-collapse reject)
  re-run against the rewritten runner.
- `--offline` (T10) is unchanged by this round (no runner involvement) and
  its round-1 receipt stands; the binary pin is untouched.

Seat-testing defects found and fixed en route, recorded: the intentional-
stop classification initially keyed on exit codes (a timeout-wrapped log
follower legitimately dies with rc 15 under group-TERM — classification now
keys on liveness-at-window-end, exit codes are recorded as evidence); the
stub log follower was `tail -f /dev/null` (empty by construction) while the
runner now requires a nonempty service log for §5.2 continuity — the stub
now emits timestamped lines like the real daemon's log.

## Unperformed (unchanged)

The live public-mesh capture (awaits Astra re-acceptance + founder host
word); the per-peer delivery control; any #622 posting. No production
mutation, no cloud change, no laptop mesh run, no upstream comment this
round.

---

# CORRECTION ROUND 3 (zCode, 2026-09-10, after re-review adcbcfc5)

Astra reproduced the fast suite 21/21 in a properly reaped PID namespace
and confirmed the F1/F2 fixes hold; three further groups were found — all
real, all owned. The binary pin, unchanged collector, R5 retraction and
artifact policy stand untouched.

## G1 — bounded stop escalation + provisional ownership

- `run_bounded` now runs `setsid timeout --kill-after=<X0X_KILL_AFTER>`
  (default 5 s): every bounded node command escalates TERM→KILL — the KILL
  is unblockable and group-wide, so a TERM-ignoring command cannot outlive
  its bound even inside `finish()` where the watchdog and traps are already
  disabled. A first-cut fix considered sweeping ALL spawned job pgids in
  cleanup and was REJECTED in seat review: reaped pgids are recyclable and
  a sweep could kill an innocent reused process; with `--kill-after` the
  timeout provably kills the whole job group before `wait` returns, so
  cleanup only ever touches still-live, still-attributable pids.
- Receipt TG1a (Astra's exact shape): stop command `trap '' TERM; while :;
  do sleep 1; done` with 1 s bounds — the FORCED path is actually reached
  (both marker files exist), the runner completes in ~5 s with exit 8
  (cleanup failed) instead of hanging past 10 s.
- Provisional ownership: `NODE_OWNED=1` is set BEFORE the start command
  runs, and the whole default lifecycle targets a reserved UNIQUE
  per-run unit (`x0x-measure-<run-tag>`, default the runner's PID) — a
  stop can never claim a pre-existing unit, and a resource created before
  a pending start returns is still cleaned up on cancellation.
  Receipt TG1b (Astra's exact shape): a start that creates a detached
  sleeper then pends; TERM during the pending start → exit 130 promptly,
  the stop callback RAN, and the created resource is gone.

## G2 — CLEANUP.json under the checked-write law

`finish()` now checks the `CLEANUP.json` write like `ATTEMPT.json`: failure
prints `TERMINAL RECEIPT WRITE FAILED ... CLEANUP.json`, and an otherwise
successful run exits 6 instead of 0 (nonzero error priority preserved).
Receipts TG2: Astra's exact `CLEANUP.json → /dev/full` injection — healthy
measurement, successful node stop, exit 6 — beside a healthy control that
still exits 0.

## G3 — the real unit command enforces the deployment promises

- The default `X0X_NODE_START` (runner AND spec) now carries
  `--property=User=x0xm --property=Group=x0xm` beside RuntimeMaxSec — the
  dedicated identity is enforced by the command itself, not by directory
  ownership.
- The spec's one-time deploy creates every writable directory AFTER the
  verified mount (the old order created `log/` and chowned it beneath the
  mountpoint, hiding it under the fresh filesystem).
- The runner gates launch on the storage shape when given
  `X0X_REQUIRE_MOUNT=/var/lib/x0x-measure`: the path must BE a real
  mountpoint (`findmnt --mountpoint`) with `log/` present inside, checked
  prelaunch — the bounded volume is verified, not assumed.
- Deploy-shape testing now drives the REAL generator: `run-capture.sh
  --print-node-defaults` prints the resolved unit/stop/force/check
  commands, and TG3a asserts the generated shape (unique unit names across
  runs, User/Group, RuntimeMaxSec, bounded-log append path, stop targets
  the reserved unit) — no handwritten substitute. TG3b proves the mount
  gate refuses a non-mountpoint prelaunch (node never started) and accepts
  a real mountpoint (`/dev/shm` in the test) through a full healthy window.

## Seat-testing defect found and fixed this round (recorded)

A teardown race, found while proving TG2/TG3b: the runner's group-TERM
could reach the sampler's IN-FLIGHT CLI child, whose −15 death the sampler
honestly recorded as an error sample — failing coverage only when the stop
landed mid-request (the healthy control passed, the injected runs failed,
nondeterministically). Fix is two-sided and mechanical: the sampler is now
stopped by PID and allowed to drain its in-flight request (a group-kill
follows only for stragglers), and `sampler.py` records no error sample
once stopping — teardown is not window evidence. `race_repro.py` hammers
the exact window shape repeatedly (8× in the receipt run: 8/8 clean, zero
error records) because a single pass through a timing race proves nothing.

## Regression receipts (exact commands)

- `python3 scripts/x0x-622/test_runner.py --fast` → **27/27 pass**
  (round-1's eleven + round-2's ten + TG1a/TG1b/TG2×2/TG3a/TG3b), ~4 min.
- `python3 scripts/x0x-622/race_repro.py 8` → **8/8 clean** windows, zero
  error records in any series.
- `python3 scripts/x0x-622/test_runner.py --slow` → re-run against this
  candidate (T7 scoped lease, T11 real-collector accept, T11b
  peer-collapse reject).
- `--offline` T10 remains round-1 evidence (no runner involvement); the
  binary pin is untouched.

## Unperformed (unchanged)

The live public-mesh capture (awaits Astra re-acceptance + founder host
word); the per-peer delivery control; any #622 posting. No production
mutation, no cloud change, no purchase, no laptop mesh run, no upstream
comment this round.
