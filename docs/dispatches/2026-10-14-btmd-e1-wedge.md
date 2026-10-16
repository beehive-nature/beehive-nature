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

## E1-PATH-ATTRIBUTION-001 — DECIDED: the recovery lane is the bottleneck (2026-10-15)

Founder order 2026-10-15 (+ two independent-review harness findings,
both cured here). Tools: `scripts/btmd/e1/e1-attribution.mjs`
(per-purpose charged/demanded/shed on store topics per node, bridged
by the daemon's own topic-hex8 map, correlated with per-op delivery
latencies from the ledger).

### Evidence (e1fix-on, the repaired candidate, share 250)

- Every late delivery clusters at **61–64 s** — the anti-entropy
  cycle, not the eager/lazy fast path.
- The SEED (observe_only, never sheds): store-topic EAGER/IHAVE/IWANT/
  ANTI_ENTROPY all **0 shed** — the publisher is not the bottleneck.
- The recipient leaves (n1/n2, shed_normal): store-topic
  **EAGER fully charged (0 shed)** — the record relay itself flows.
  The shed sits almost entirely in **IHAVE** — the lazy ANNOUNCEMENT
  lane that tells remote replicas "I hold this record, pull it":
  n1 `btmd/store/one IHAVE demanded 9,642,276 B / charged 146,412 B /
  shed 9,495,864 B / deferred 2,724`; IWANT likewise ~78% shed. Remote
  replicas never hear the announcement, so the record arrives only via
  the ~60 s anti-entropy sweep.
- Source confirms the mechanism: under `shed_normal`, relayed Normal
  traffic reserves through `try_reserve_recovery*` (escrow/rotation),
  NOT `try_reserve_data` — the lane where the E1 reservation lives.
  reserved_msgs 18/46 vs 44–51 MB total leaf demand quantifies the
  mismatch.
- All three study legs corroborate: baseline (nothing sheds IHAVE)
  10/10 within gate; stock shed 1/10; budget×10 (IHAVE never
  exhausted) 10/10; E1-data-lane 1/20. One mechanism explains every
  leg.

### Determination (the order's two options)

**Recovery lane is the bottleneck.** The next implementation beat
extends the reservation into `try_reserve_recovery*` for verified
store scopes under the SAME combined hard budget, per-peer caps,
borrowing floors, and negative controls — no new authority, no second
budget. (If that extension still fails within-gate, THEN queueing/
peer-admission/downstream delays get investigated.)

### Harness repairs (independent review findings 1 and 2 — cured)

1. Reproducer boundedness: on wedge it now dumps stacks and
   `exit(1)` — no `join()` on deadlocked workers; the process exit
   code is the externally-bounded failure signal. Passes on the
   repair, wedges+exits-nonzero on the original.
2. `screen-run.sh` v2: fail-fast (any trial error or missing verdict
   aborts the campaign nonzero with a FAILED ledger — no `|| echo`
   swallowing) and the **e1off leg** — the EXACT candidate binary with
   the reservation OFF — isolating the scheduler effect (e1 vs e1off)
   from the build difference (e1off vs stock shed). 5 interleaved
   legs: baseline / shed / shedhi (release) + e1off / e1 (candidate).
   The comparison campaign runs AFTER the recovery-lane extension —
   per the order's sequencing, attribution first.

[skip ci]

## E1-RECOVERY-RESERVATION-001 — implemented, first verification 16/20 within gate (2026-10-15)

Corrections (review, PR #429 issuecomment-6202373075) — all cured and
committed @c668c5088: (1) attribution now computes true t0→t1 DELTAS for
per-purpose rows (finding unchanged: n1 window IHAVE shed dominates);
(2) screen-run.sh validates each verdict's run_id+label+shape — stale or
malformed files fail; (3) the reproducer's gdb dump runs under
`timeout 10`.

The extension: verified joined-store scopes in the RECOVERY lane
(IHAVE/IWANT) get the same bounded reservation as the data lane,
charged from the SAME shared buckets — one combined budget, per-peer
caps, borrowing floors, counted fall-through to the ordinary
escrow/rotation path when unfunded. Critical-class recovery never
passes through; share=0 is byte-identical. 5 new invariants (12/12 E1
tests green); the peer-cap test caught a missing counter increment
(fixed), and the no-double-charge test caught the SAME self-deadlock
class in its own harness (inline `lock_state().generation` as a call
argument — hoisted, the trap documented in place).

Rebuilt candidate (build receipt updated). **Verification trial
(scale 9, share 250/peer 500): sync 16/20 WITHIN-GATE (was 1/20 with
the data-lane-only reservation), 4/20 late-recovered, 0 lost, 0
unknown, no wedge, no restarts.** The recovery-lane reservation is the
mechanism the attribution predicted.

The 5-leg × 10-trial interleaved campaign (baseline / shed / shedhi on
the release binary + e1off / e1 on the candidate — fail-fast, verdict
identity validated) is RUNNING; its distribution decides whether the
remaining 4/20 gap is reservation tuning or the capacity ceiling the
founder flagged (if unique IHAVE demand exceeds the hard budget's 10s
deliverable, announcement coalescing/dedup is the next mechanism, not
more priority).

[skip ci]

## E1 comparison campaign — 5 legs × 10 interleaved trials (2026-10-15/16)

Evidence: `docs/dispatches/evidence/2026-10-15-btmd-e1-campaign/`
(campaign.json — individual outcomes preserved; summary.md). Runner:
screen-run.sh v2 (fail-fast, verdict identity validated). Zero trial
failures; 50/50 verdicts.

| leg | within-gate (mean share of pairs) | LATE latency median | NEVER |
|---|---|---|---|
| baseline (release, observe_only) | 20/20 × 10 trials (100%) | — | 0 |
| shed (release, stock) | ~42.5% | 58.3 s | 3 |
| shedhi (release, budget×10) | 100% | — | 0 |
| e1off (candidate, share 0) | ~55% | 56.8 s | 0 |
| **e1 (candidate, share 250)** | **~76%** | **15.6 s** | **0** |

The controlled comparison (e1 vs e1off — identical binary, identical
budget, the ONLY difference being the reservation): within-gate
delivery rises from ~55% to ~76% of pairs and the late tail collapses
from the ~57 s anti-entropy cycle to a median of 15.6 s; the NEVER
tail is absent in both candidate legs (3 occurrences in stock shed).
The build-version control (e1off vs shed, share 0 in both) shows
~55% vs ~42.5% within this sample's spread (0–18/20 per trial) —
recorded, not explained.

**Verdict (screening-level, n=10/leg):** the recovery-lane reservation
is a real, direction-positive mechanism — but 100% within-gate is NOT
reached, and the remaining late deliveries sit just past the gate
(median 15.6 s, max 21.2 s). That shape matches the founder's capacity
ceiling: a reservation redistributes bandwidth, it does not create it.
The named next mechanism is announcement COALESCING/DEDUPLICATION of
IHAVE for store scopes (the retry storm — 2,724 deferrals for ~10
unique records — is dedup-shaped), not more priority. E1 remains
UNQUALIFIED for promotion; stronger claims need n≥30/leg.

[skip ci]

## E1-IHAVE-COALESCE-001 — scoping measurement (2026-10-16)

Founder-named next optimization, scoping step executed from the
campaign's own receipts (window deltas; `scripts/btmd/e1/e1-coalesce-scope.mjs`):

- **e1 leg**: IHAVE deferrals Δ = 425,195 over 90 node-trials → retry
  multiplicity ≈ **472× per unique record per node**.
- **e1off leg**: ≈ 314× per unique record per node.

The IHAVE load is overwhelmingly RETRIES of ~10 unique announcement
identities per trial. Bounded coalescing/deduplication is the correct
next mechanism — exactly the founder's capacity question: the
reservation redistributes bandwidth; the demand curve itself is
inflated ~300–470× by redundant re-announcements. Design constraints
carried forward: coalescing must not suppress DISTINCT records, must
not delay the FIRST useful announcement, the hard budget stays
unchanged, and qualification is n≥30 interleaved trials per leg.

[skip ci]
