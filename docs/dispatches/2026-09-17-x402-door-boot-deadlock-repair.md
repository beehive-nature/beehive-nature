# X402-DOOR BOOT DEADLOCK — RED-FIRST REPAIR (2026-09-17)

**Order:** PR #93's builder mission (verbatim founder text, read from the
routing branch — `docs/dispatches/2026-09-17-ORDER-x402-door-boot-deadlock-builder-mission.md`).
**Base:** origin/main `22af64fb` (merge of #91, the stop receipt).
**Deliverable:** PR #95, branch `zcode/x402-door-boot-deadlock-2026-09-17`,
commits `ba1c7882` (RED) → `d6d8fbf4` (GREEN).

## STATE

GREEN at the repo boundary: the deadlock is reproduced as a durable,
bounded, CI-visible RED test and removed by the smallest coherent change;
single-process exclusivity (D-5) is intact and re-proven. The binary
re-stage and the Base Sepolia ceremony remain the Gesture-D seat's re-run
(hand-back below) — nothing here touches the box, production, or testnet.

## CLAIM

The door's startup sequence `open_exclusive → recover_stranded_settling`
no longer self-deadlocks, because recovery — and every other mutation
through an exclusively-opened instance — now runs UNDER the OS lock the
instance already owns for its process lifetime, serialized in-process.
The OS hold itself is untouched: try-acquired at open, refused-by-name
for a second live opener, kernel-released on process death, never
unlocked by any guard. Non-exclusive openers keep the byte-identical
per-call flock path every existing suite exercises.

## EVIDENCE

- **RED, local (unmodified `22af64fb`, Windows seat):** `cargo test --test
  boot_exclusive` → 3 FAILED / 1 passed in 10.03s — `boot_fresh_journal_
  startup_recovery_completes`, `boot_restart_recovers_stranded_settling_
  under_exclusive_ownership`, `boot_exclusive_instance_serves_mutations_
  under_its_hold` each panic at the 10s deadline naming the
  self-deadlock; `boot_second_exclusive_start_refused_while_first_holds`
  passes (D-5 pin green pre-repair).
- **RED, CI (run 35190658204, Linux, commit `ba1c7882`, door step):** the
  same three SELF-DEADLOCK failures, byte-same shape — deterministic on
  both platforms, matching the box's kernel-stack evidence
  (`locks_lock_inode_wait`, stop receipt §3). Run retained in Actions
  history after the proof branch `zcode/red-proof-gd-f1` was deleted.
- **GREEN, local:** full door crate 40/40 — acceptance 11, adversarial 11
  (including `adv_duplicate_concurrent_settle_executes_exactly_once` and
  `adv_gas_cap_concurrent_reserve_race_admits_exactly_cap` on the
  unchanged flock path), av4_disjointness 2, boot_exclusive 4 (0.09s —
  no waiting, the hang is gone), d_specs 10, r4_audit 2; `cargo fmt
  --check` clean.
- **GREEN, CI (run 35190548739, PR-event, commit `d6d8fbf4`):** `test`
  job SUCCESS — root workspace `cargo build/test --workspace --locked`
  PLUS the door's own step (`cargo test --locked --manifest-path
  ops/x402-door/Cargo.toml` + `--features live-wiring` build) green on
  Linux; `node` job success; `static` failure is the documented
  pre-existing main red `1.4c: crash header did not kill the server`
  (byte-identical on main's own run 35186285355) — bKiMi's #90 lane,
  inherited, NOT this work (the #91/#93 documentation precedent).
- **The repair is one seam in `journal.rs`:** `LockGuard` becomes two
  shapes of one EXCLUSIVE-WRITER authority — `Os(File)` (per-call std
  file lock; non-exclusive path byte-identical) and `Held(MutexGuard)`
  (the already-owned process-lifetime hold; in-process serialization via
  the new `Journal::mutation_lock`, poison-tolerant to mirror kernel
  flock semantics). `wire.rs`, `imp.rs`, `orchestrator.rs`, `config.rs`,
  both Cargo manifests and locks: untouched.

### The eight acceptance bars (ORDER's list)

1. fresh-journal binary reaches listening state — journal-level: fresh
   boot sequence completes GREEN in 0.09s (binary-level listening is the
   ceremony re-run's beat; the listener binds only after recovery
   returns, which now returns);
2. restart with existing journal — seeded-crash restart boot completes;
3. stranded-Settling recovery UNDER exclusive ownership — parked to
   Unknown with the named note, untouched leg stays Reserved, human-gate
   refusal intact, idempotent second pass empty;
4. second process still refused while first owns journal — boot-file pin
   + the authoritative d_specs D-5 law test, both green;
5. crash/restart laws green — d_specs 10/10 including
   `crash_while_settling_restarts_to_unknown_and_reconciles_via_gate`;
6. existing door suites green — 40/40 locally, door step green in CI;
7. no Base Sepolia transaction — no box contact at all from this seat;
8. no Gesture-D promotion — ASSURANCE-LEDGER untouched; the board's
   BLOCKED_INTERNAL row and D(testnet) NOT-EARNED verdict are the
   ceremony's to change, not the builder's.

## BOUNDARY NOT CROSSED

- IF-1 (upto wire), IF-2 (actual amount), IF-3 (gas accounting), IF-4
  (AV-6a error classification) — untouched; queue owned by architecture
  reconciliation (PR #93's INTEGRATION-FINDINGS-QUEUE.md).
- No weakening of `open_exclusive` (still try-lock + named refusal), no
  non-blocking/bypass shortcut on the second acquire — the ORDER's
  binding sentence honored by using the lock already held.
- PR #90 (bKiMi's 1.4c harness repair) untouched; its red documented as
  inherited, never "fixed" from this seat. PR #92 untouched.
- No production deployment, no VV/bPay/zGenealogy surface, no ASSURANCE
  LEDGER or IF-queue edits, no ceremony execution.

## CHANGED

- `ops/x402-door/src/journal.rs` (+53/−14: two-shape LockGuard,
  `mutation_lock`, held-path `acquire_exclusive`, law docs).
- `ops/x402-door/tests/boot_exclusive.rs` (new, 197 lines: four boot
  tests, 10s deadline harness).
- This receipt. Nothing else.

## NEXT OWNER

The sleeping **Gesture-D ceremony executor**, per the ORDER's return
trigger: *deadlock-builder GREEN → rerun staged Base Sepolia ceremony
unchanged.* First beats per stop receipt §8: re-stage the rebuilt binary
on the box (sha + provenance ritual — the sha changes with this repair),
then the unchanged order (pre-flight → multi-leg → AV-6a → AV-5 → AV-8 →
AV-4 → reconciliation), grading F2/F3/F5 honestly as structurally unmet
unless architecture has re-ruled them.

## FOUNDER ACTION

None required for GREEN (merge #95 at ordinary review). If you want the
ceremony re-run before #93's routing artifacts merge, that is order of
operations only — #95 touches no file #93 touches.

— zCode deadlock-builder seat, 2026-09-17 (UTC). Claim → evidence →
boundary not crossed: every claim above carries its run ID or commit SHA.
