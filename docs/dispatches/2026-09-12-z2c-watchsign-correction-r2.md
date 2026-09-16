# z2.c correction R2 — re-review findings fixed

Seat z2.c (GLM/zCode), 2026-09-12. Order: `2026-09-12-z2c-r1-review.md`
(Astra). Same worktree `../wt-z2c-watchsign`, branch `codex/z2c-watchsign`,
descendant of the re-reviewed `62c60816` (no force, no rewrite).

## Probe reproduced FIRST (as ordered)

`2026-09-12-z2c-r1-probe.rs` appended verbatim to
`crates/watchpay/tests/adapter_signing.rs` at `62c60816`, run with the
reviewer's exact command `cargo test -p watchpay --locked --offline --test
adapter_signing astra_r1 -- --nocapture`: **0 passed / 1 failed** —
exactly as reviewed. At the corrected pin the same probe passes
**verbatim** (run and receipted during development, then removed in favor
of the permanent regressions).

## P1 — verified identity discarded at the final recording boundary

`connect::record_verified_signed` now enforces, BEFORE any ledger write:

- **Verified plan identity**: the result's `request_plan_hash` must equal
  the supplied plan's seal (and the plan must still be internally
  consistent). A result verified under plan A cannot record into plan B's
  ledger even when B's intent carries the same nonce and attempt
  sequence and every transaction field is byte-identical — the refusal
  names `plan_hash` and states that equivalent calldata is never the
  authorization.
- **Verified operation/batch identity**: the result must have been
  verified for exactly `TxDestination::BatchPayment { batch_index }` —
  an approve result (wrong operation) or another batch's result
  (two-batch regression) refuses naming `batch_index` as
  cross-operation.

Refusals leave the destination ledger's bytes, state and reservations
untouched (asserted). Regressions: `verified_result_cannot_cross_plan_identity`
(the reviewer's sequence + matching-plan control), `wrong_operation_result_cannot_record_as_batch_payment`,
`batch_mismatched_result_cannot_record_under_other_batch`.

## P1 — unlocked read/check/write replaced by an exclusive-writer contract

The ledger now holds an OS file lock on `<root>/.lock` across the
ENTIRE read/check/write sequence of every PUBLIC operation:

- Mutations (`write_intent`, `record_signed`, `record_signed_at_attempt`,
  `record_outcome`, `record_unknown`, `cancel_intent`, `resolve_unknown`,
  `abandon_unknown`) take an EXCLUSIVE lock; the public read `attempts`
  takes a SHARED lock. Internal lock-free cores (`*_unlocked`) are
  private and documented as require-lock; there is no lock-free public
  mutation path — every competing mutation participates.
- The lock is std's `File::lock`/`File::lock_shared` (stable since Rust
  1.89; the workspace toolchain is pinned 1.98.1) — `flock(2)` on Unix,
  `LockFileEx` on Windows. Chosen over the fs4 crate after compilation
  showed the std methods resolve natively: zero new dependencies, and
  the lockfile delta is empty this round.
- **PROVEN SCOPE, stated precisely** (also in the ledger module docs):
  mutual exclusion and lock-covered transition atomicity are proven
  across independent handles AND across separate processes; two `open()`s
  of the lock file in one process are two distinct kernel lock owners
  and contend exactly like two processes. A process that dies holding
  the lock has it released by the KERNEL automatically — no stale locks
  after process death (an `flock`/`LockFileEx` property, not our code).
  NOT claimed: any power-loss/fs-journaling guarantee (the z2.b
  durability statement stands unchanged), and any exclusion against
  writers that bypass this crate and write the ledger's plain-JSON files
  directly.

Deterministic contention tests (new `tests/ledger_contention.rs`; no
sleep races — every held-window assertion fails immediately if the lock
is broken because the blocked operation would finish in microseconds):

- `mutation_blocks_while_external_handle_holds_the_ledger_lock` — an
  independent raw handle (not a Ledger instance) holds the lock; the
  mutation (through ANOTHER independent Ledger handle) does not complete
  until release; then the lawful transition wins.
- `read_blocks_while_external_handle_holds_the_ledger_lock_exclusive` —
  even the shared-locked read participates.
- `cancellation_versus_signing_yields_only_lawful_outcomes` — cancel and
  attempt-bound record contend through two independent handles;
  order-independent invariants asserted: exactly one attempt, final
  state ∈ {Signed (cancel refused, reservation = tx worst case),
  Cancelled (record refused, reservation = 0)}.
- `cross_process_lock_holder_blocks_ledger_mutation` — the test binary
  re-executes itself (`--exact --ignored`) as a child process that takes
  the lock and holds 3s; the parent's mutation is blocked for the whole
  hold and completes after the child exits.

## Evidence

- **121 passed / 0 failed** offline: all 114 prior tests retained
  unchanged + 3 identity regressions + 4 contention tests (the 5th
  ledger_contention entry is the child-process holder, `#[ignore]`d and
  spawned only by its parent test).
- Reviewer's R1 probe passes verbatim at this pin.
- `cargo fmt --all --check` clean; `cargo clippy -p watchpay --locked
  --offline --all-targets` zero warnings; `scripts/secret-scan.sh` clean;
  **lockfile unchanged** (std lock, no new dependencies).
- No device preflight, live SDK, wallet access, RPC, real signing,
  broadcast, upload, payment, deployment or merge. No other seat's
  worktree touched. z2.d web release untouched.

## Return

Descendant commit on `codex/z2c-watchsign` (canonical attribution:
founder author, zCode committer, parsed coauthor trailer), pushed without
force; hosted checks reported at the exact SHA in the commit message.
Ready for re-review.
