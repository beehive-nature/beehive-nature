# 2026-10-14 · BTMD Track E / E1 — the bounded-fairness candidate: scheduler built and unit-proven; the source-built daemon wedges (deterministic executor starvation); screening blocked, counterexample retained

Order: founder Track E disposition 2026-10-13 ("Authorize the next
bounded engineering experiment. No additional founder approval
required."). Deliverable status per the order's own failure rule: **E1
has NOT passed — the counterexample is retained, the deadline is not
weakened, no failure category is erased.**

## What was built (committed here)

1. **Instrumentation first (Phase 0, `be150addc`)**: t0 gossip-diagnostics
   snapshots beside t1 in every trial + per-kind attribution in the
   analyzer (charged vs demanded = shed bytes, per topic family AND wire
   purpose, bridged by the daemon's own `subscribed_topics` hex8 map).
   Verified against the 30 existing s9study trials.
2. **The E1 scheduler** (`scripts/btmd/e1/sg-pubsub-e1.patch` against
   pristine saorsa-gossip-pubsub 0.5.87 from crates.io): a bounded
   reserved sub-budget for VERIFIED joined-store sync —
   - config: `reserved_share_permille` (0=off, max 500) +
     `reserved_peer_permille` (default 500);
   - split token buckets sharing ONE hard rate (general = 1−share);
   - per-peer admission (each peer ≤ permille-share of the reserved rate
     per second, allowance map bounded at 512 rows; a capped peer gets
     ordinary treatment — never silence);
   - controlled cross-bucket borrowing above one-second floors in BOTH
     directions;
   - deferral (the crate's existing backpressure machinery) when neither
     bucket can serve above the floors — never an unlimited bypass;
   - five new counters + a reserved-token gauge in the snapshot;
   - split OFF = byte-identical legacy math by construction.
3. **The x0x wiring** (`x0x-e1.patch`): `[gossip] leaf_reserved_share_permille`
   / `leaf_reserved_peer_permille` keys, the config bridge, and
   `add_reserved_store_topic` called ONLY from the KV store open/join
   funnel — host-attested by construction (the daemon's own verified
   registry), never topic labels, never wire claims.
4. **Unit invariants (6/6 green, in-crate, deterministic virtual clock)**:
   split-off keeps reserved counters at zero; reserved scopes charge the
   reservation; both-floored deferral is backpressure and refills after
   one second; the per-peer cap yields ordinary treatment, not silence;
   ordinary borrowing respects the reserved floor; total admission never
   exceeds the single-bucket budget. (The published crate's own test
   build cannot compile outside upstream's workspace — its tests import
   an unpublished fixture — so the run stubs that one module; the stub
   lives in the build script, never in the patch.)
5. **Reproducible build** (`scripts/btmd/e1/build-e1.sh`): pristine crate
   + patches + version marker `0.47.1-e1` + `[patch.crates-io]`, release
   build on the repo-pinned toolchain (1.95.0). Two documented build
   accommodations: the optional voice feature's deps are unpublished on
   crates.io (removed for the candidate; the rig never uses voice), and
   the unpublished test fixture stub above. Candidate binary sha256:
   f0f0e63d9f3451b02c7c8095b4678f440f84d6f565656e21943cacf9f56a83a4 PUBLIC-CONSTANT
   PUBLIC-CONSTANT.
6. **The screening campaign runner** (`scripts/btmd/e1/screen-run.sh`):
   4 interleaved legs × ≥10 rounds (shed / baseline / shedhi / e1) on the
   frozen scale-9 rig, 180 s windows, identical workload, per-trial
   receipts. NOT RUN — blocked by the wedge below.

## The blocking finding: the source-built daemon starves its executor (deterministic)

Every rig trial with the sg-patched build wedges (8/8: smoke ×2,
null-config ×2, gdb-capture, bisect repeat ×3) while controls run clean:

| build | sg | x0x | result |
|---|---|---|---|
| upstream release v0.47.1 | — | — | clean (40+ trials to date) |
| pristine source, my env | pristine | pristine | clean 2/2 |
| comment-only sg patch | one comment | pristine | clean 2/2 |
| x0x patch only | pristine | patched | clean 1/1 |
| **sg patch (share=0 enforced)** | **patched** | pristine | **WEDGED 8/8** |

- Signature (the daemon's own watchdog): `runtime_heartbeat=49.31s
  stale (>= 3s) — executor starvation: tokio stopped polling tasks`;
  the daemon then cycles self-restarts (its unsupervised-handoff
  mechanism), which is what the battery sees as the API wedge.
- Stack evidence (gdb, 8 samples across ~30 s of the stall, seed node):
  four tokio workers blocked in `std::sys::sync::mutex::futex::Mutex::
  lock_contended` inside `LeafEgressLimiter::reserve_protected` (callers:
  `spawn_key_cache_control_flusher`, `send_to_peer_bounded_outcome_
  tracked`, `parallel_send_to_peers`) and one inside
  `LeafEgressLimiter::snapshot` (caller: the gossip-diagnostics route) —
  with NO thread executing inside the limiter's critical section in any
  sample. All other workers parked; the runtime itself alive.
- The wedge reproduces with `reserved_share_permille = 0` — the E1
  admission path is provably unreachable — so the trigger is not the
  scheduler's decision logic (which passes all six unit invariants) but
  something in the patched crate's always-on surface (the changed
  struct layouts, the added lock acquisition in `snapshot`, or a
  compile-perturbation exposing an upstream latent defect in the
  #384 family).
- Exonerated by experiment: allocator (jemalloc build wedges too),
  toolchain (repo pin 1.95.0 confirmed active), dependency drift (lock
  diff is the voice-removal entries + the path swap only; the relocked
  binary is hash-identical), mere recompilation (comment-only clean),
  the x0x wiring (bisectB clean), load level (9-node deterministic at
  2 nodes the patched build runs quiet).

## Honest verdict for this beat

- **E1 screening: NOT PERFORMED.** No delivery claim of any kind is made
  for the candidate. Scale-9 remains FAIL/unreliable-within-gate;
  LEAF-SHED-NORMAL-1 remains unqualified for W@tch-shaped leaves.
- The scheduler's DESIGN invariants are unit-proven; the candidate
  DAEMON cannot currently carry them through a live trial.
- Retained per the order: this counterexample and the revised next task.

## Next implementation task (precise)

Root-cause the limiter state-mutex starvation in the patched build:
1. Bisect the sg patch internally (struct/snapshot-only vs
   reserve-path-only builds) — the isolation tree and scripts are in
   place.
2. Prime suspect: the snapshot path's mutex acquisitions under the
   diagnostics cadence interacting with `reserve_protected`'s hot-path
   contention — measure with the existing gdb sampling rig
   (`scripts/tmp/e1/` staging, to be promoted into the tree if it
   recurs).
3. If the convoy is an upstream latent defect (no-holder waiters = lost
   wakeup or guard-across-await in the recovery lane), file it upstream
   with these stacks via the standing watch — it is Track E-relevant
   independent of E1 (the #384 watchdog exists because upstream has
   seen this class).

Raw receipts: WSL `~/btmd/runs/{e1-smoke*,e1-null*,e1-gdb,bisA*,noop*}`,
stack samples `/tmp/stall-samples/` (to be preserved under
`~/btmd/e1/`), build trees `~/btmd/e1/{build,bisectA,bisectB,noop}`.

HUMAN INTERACTION: NONE · NEXT OWNER: this seat continues on the next
wake; independent review judges E1 when a screening actually runs.

## E1-CONCURRENCY-001 — ROOT CAUSE FOUND, REPAIRED, VERIFIED (2026-10-15)

Founder order 2026-10-15 (same seat, no approval gate). Mission
accomplished on the concurrency defect; E1 remains unqualified on
delivery grounds (below).

### Root cause (convicted by the minimal reproducer)

`LeafEgressLimiter::snapshot()` — the E1 patch added a SECOND
`self.lock_state()` inside the SAME struct literal
(`reserved_tokens: self.lock_state().reserved_tokens` after the
upstream `pending_recovery_intents: self.lock_state().intents.len()`).
Struct-literal temporaries live to the end of the statement, so the
first guard was STILL HELD when the second acquisition ran: a
self-deadlock on the non-reentrant state mutex.

This explains every observation:
- fires at ANY share value (snapshot runs whatever the config) — the
  share=0 rig wedge;
- the "no holder" stacks — the holder was the snapshot thread itself,
  parked re-acquiring its own guard (reproducer stacks show two
  threads inside `snapshot` at the two lock sites, egress.rs:739/752);
- executor starvation: the diagnostics route blocks inside the lock
  forever; every reservation caller piles onto the futex; the
  runtime heartbeat goes stale; the daemon self-restarts (its
  unsupervised-handoff) — the restart cycles the rig saw;
- all controls clean (upstream, pristine, comment-only, x0x-only):
  exactly one lock acquisition per expression in each.

### The minimal reproducer (committed as the regression)

`scripts/btmd/e1/e1_concurrency_repro.rs` — in-crate, limiter-only,
16 threads across the four real caller shapes (protected/data/
recovery/snapshot), watchdog asserting no 10s op-class stall, gdb
stack dump on failure. **Wedges the original implementation at
share=0 and share=250; passes against the repair** (30s: 18k
protected + 18k data + 6k recovery ops, 718 snapshots, zero stalls).
Bound: default 20s, env-tunable — CI-safe.

### The repair (the order's preferred shape)

ONE hoisted short critical section before the struct literal reads
both gauges and drops the guard — `snapshot()` now acquires the state
mutex exactly once, counters stay outside the hot-path lock. No mutex
replacement, no lock-free structures, no watchdog or timeout changes.

### Post-repair verification

- Crate: 7/7 E1 tests (6 scheduler invariants + reproducer), plus the
  crate's own egress suite green.
- Rebuilt candidate (build-e1.sh, toolchain pin 1.95.0; sha256
  ff71bcac06ae8cf9c516758720a0a54f141a5a2e5bd1187407f1436de22fade2 PUBLIC-CONSTANT
  PUBLIC-CONSTANT):
  - **Null config, scale 9: CLEAN** (full verdict, no restarts).
  - **E1-enabled (share 250, peer 500), scale 9: NO WEDGE** — full
    trial, zero daemon restarts; the reservation ENGAGES (leaves show
    reserved_tokens at the 1 MiB reserved burst cap; reserved_msgs
    18/18/46/46 charged on the sync-active leaves; reserved counters
    present in all 9 nodes' diagnostics).
- Upstream control: clean 40+ prior trials (unchanged).

### Honest delivery result of the first E1-enabled trial (single trial, not a distribution)

sync 1/20 WITHIN-GATE, 19/20 LATE (all recovered within the 180s
window), **0 lost, 0 unknown**. No starvation, no wedge — but
within-gate delivery did not improve over stock shed in this one
trial. E1 remains **unqualified**; the original performance-comparison
campaign (bandwidth/delivery/memory/CPU/recovery under the same
workload) resumes from here.

### Next precise question for the comparison phase

Which lane carries the within-gate eager forwarding of store records —
the data lane (where the reservation lives) or the recovery lane
(`try_reserve_recovery*`, where no reservation applies yet)? The
recovery-lane IHAVE/ANTI_ENTROPY rows in the attribution deltas name
the suspect; if the recovery lane is the within-gate carrier, the
reservation must extend there under the same bounded-fairness rules.

[skip ci]
