# G2-A — banchor receipt writes fail closed (2026-09-07)

Issue [#16](https://github.com/beehive-nature/beehive-nature/issues/16).
Design packet: Astra's G2 backend docket (local draft in `wt-astra-g2`,
base `2c50588a`). Builder: zCode, fresh session, worktree `wt-zcode-g2a`,
branch `lane/g2a-receipts`. **Pinned candidate for review — nothing
merged to main, no deployment, no production surface touched.**

## 0. Baseline reproduced before editing

`powershell.exe -NoProfile -File scripts/review/g2-replay-red.ps1` (from
Astra's draft worktree, unchanged `replay.rs`): **2 passed, 1 failed** —
`writer_failure_must_be_reported`: "receipt write failed, but Replay::ev
returned () instead of an error; stored_bytes=0"; both controls green.
Exactly the docket's observation. The red harness itself is untouched and
stays Astra's baseline artifact (their worktree); the production contract
below supersedes it as the always-green battery.

## 1. The defect and the cure

`Replay::ev` ignored `writeln!`/`flush` results, never synced storage, and
silently dropped events on a closed writer; every caller discarded the
outcome — navigation and click acted before unchecked receipts, `end`
claimed success regardless. Cure, in `crates/banchor/src/replay.rs`:

- **Typed `ReceiptError`** — `WriteFailed`, `StorageUnavailable` (a
  DISTINCT stop reason: `ErrorKind::StorageFull`/`WriteZero`, with
  stop-and-free wording, never retry-into-silence), `SyncFailed`,
  `Closed`, `Poisoned`, `RecordTooLarge`.
- **The acknowledgment boundary**: encode the complete record (JSONL
  envelope unchanged) → size-admission → `write_all` → `flush` → `sync`
  → only then `Ok`. `sync` is `File::sync_all` (fsync / FlushFileBuffers):
  a storage-synchronization REQUEST, not a power-loss proof — stated in
  the module docs. Creation/metadata durability: `Replay::open` fsyncs
  the PARENT DIRECTORY on Unix (fail-closed; the directory's own creation
  is not recursively synced — scope stated); Windows has no public
  directory-fsync equivalent, so it is UNPROVEN there (wording corrected
  in review round 1 — the first draft claimed a Unix step the code did
  not perform; §6/P2). Process death between boundaries is not emulated:
  a killed process does not emulate storage loss (distinct failures;
  neither proves the other), and what survives is the reader's (G2-B)
  problem; every writer boundary IS covered deterministically by
  injected faults.
- **Poison law**: any write/flush/sync failure poisons the writer — later
  appends return `Poisoned`; a stream that may end mid-record is never
  quietly extended. The only explicit recovery is a fresh `Replay::open`
  — which since review round 1 creates its file EXCLUSIVELY and bumps a
  `-N` suffix on same-second/concurrent name collisions, so a replacement
  session can never append to the damaged file it replaces (§6/P1-1).
  `close()`d writers refuse with `Closed`.
- **Size admission before storage**: `MAX_RECORD_BYTES = 4 MiB`, derived
  from the existing shapes (largest event = `snapshot`, embedding the
  1200-node-capped formatted tree ≈ low hundreds of KiB per line; 4 MiB
  admits everything with an order of magnitude of slack). Refusal leaves
  the stream undamaged (not poison) — the event is unrecordable, and the
  seat layer halts on it anyway. Free-space observations are advisory
  only; the real write/sync result is the sole authority; no recovery
  inventory is launched per receipt.
- **Instrumentation seam**: `ReceiptSink` trait (File in production) +
  `Replay::attach` + a `#[cfg(test)]` fault module
  (`None`/`PartialWrite`/`RefuseWrite`/`RefuseFlush`/`RefuseSync`/
  `StorageFull`, plus a shared-handle sink for inspecting stored bytes).

## 2. Propagation (`crates/banchor/src/seat.rs`)

- New `SeatError` variants: `Receipt`, **`ReceiptAfterAction`** (says the
  action HAPPENED and its receipt did not — the action is neither undone
  nor retried), `EndReceiptIncomplete`, `Halted`.
- `record`/`record_after_action` helpers: any recording failure sets
  `halted`; `handle` then admits only `end`/`status` — no further action
  execution for the failed recording session; **no automatic retries** of
  navigation/clicks/approvals.
- `start`: the first receipt is a gate — failure kills the session before
  it begins (browser + replay drop = cleanup on failure).
- `navigate`/`click`: act inside a borrow block, then
  `record_after_action` — the split is reported honestly. `approve`
  records BEFORE executing the approved action: if the receipt fails, the
  action does not run and the single-use plan stays consumed.
- `agentloop` (M2): all 11 direct `seat.ev` sites converted to
  propagating `record?` — the loop stops when recording fails.
- `end`: cleanup ALWAYS runs (page closed, chromium dropped, temp profile
  erased); the `session_end` receipt is attempted, and on failure `end`
  returns `EndReceiptIncomplete` naming the path — it never claims a
  complete receipt. Success returns `receipt_complete: true`.
- `status` reports `halted`. `session_end` records `ok/halted` honestly.
- One adjacent pre-existing mislabel fixed in the click site (owned file):
  the action's returned `url_before` used to carry the POST-click URL; it
  is now captured before the click (receipt keeps `navigated_to`).

## 3. Tests — 70 passed, 0 failed (was 44 in this crate)

Fault battery (each fault beside a positive control): refused write;
**partial write** (torn prefix visible on the sink, unacknowledged, never
extended — next append refused as `Poisoned`); flush refusal; sync
refusal; storage exhaustion (distinct `StorageUnavailable`); closed
writer; oversized record (zero bytes stored, stream stays usable, normal
event records right after); REAL OS refusal via read-only handle (the
production-shaped twin of the red probe: typed failure, zero stored
bytes); envelope preservation (`t`/`t_ms`/`ev` keys verified).

Seat level (no browser; read-only handle = deterministic failing writer):
receipt failure halts the session (only `end`/`status` run; `end` still
cleans up and reports the incomplete receipt); approve-receipt-failure
does NOT execute the approved action; gate-flow positive control with the
`gated` + `session_end` lines read back from disk.

## 4. Commands and gates

```
cargo test -p banchor --locked    # 70 passed, 0 failed
cargo fmt -p banchor -- --check   # clean
```

Platform gate: built and run on Windows (rustc 1.98.1) — the crate's
tests are OS-neutral (read-only-handle refusal works on both Windows and
Unix). CI already runs `cargo test --workspace --locked` and
`fmt --all --check`; no shared-workflow change was needed or made
(the docket's coordination clause is satisfied by not touching it).

## 5. Remaining limits (explicit, not hidden)

- **G2-B owns the reader**: persisted offsets, resume, duplicates,
  truncation/torn-tail tolerance, corruption, consumer lag, missing-tail
  honesty. The writer's poison law deliberately refuses to resume a
  damaged stream in place.
- Power-loss durability and Windows creation/metadata durability are
  documented as UNPROVEN, not claimed.
- No process-kill test, by design: process death does not emulate storage
  loss; what survives a kill is a reader question (G2-B).
- `MAX_RECORD_BYTES` is derived from current shapes, not a product of
  measurement on live replays (none exist on this seat); revisit if
  receipt shapes grow.

## 6. Corrections after review round 1 (2026-09-07, same build session)

[Review packet](2026-09-07-astra-g2a-review.md) — verdict "changes
required", four findings; all confirmed real on inspection and fixed.
Tests now **73 passed / 0 failed**; `cargo fmt -p banchor -- --check`
clean; the `unused_must_use` compiler warning is gone. PR #18 and issue
#16 remain open; the corrected head replaces `8d9fbbce` as the pinned
candidate.

- **P1-1 (fresh open could extend the torn stream it replaced)** —
  `Replay::open` now creates EXCLUSIVELY (`create_new`) and bumps a `-N`
  suffix on collision (same stem in the same second, or a concurrent
  same-stem racer; bounded at 1000, fail-closed). A replacement session
  owns a brand-new file and the damaged original stays byte-identical.
  Regression `fresh_open_never_extends_an_existing_stream` reproduces the
  reviewer's probe shape (10-byte torn tail + fresh open + acknowledged
  append) and asserts a different path, untouched torn bytes, and five
  same-stem sessions owning five distinct files.
- **P1-2 (`end` could falsely report completeness)** — completeness is
  now tracked independently of the sink: `receipt_gaps` latches on ANY
  refused receipt (poison or admission), and a successful small
  `session_end` write no longer retroactively completes the session —
  `end` returns `receipt_complete:false, gaps:true` and the stored
  `session_end` line itself carries `"gaps"`/`"halted"`. A FAILED end
  stores its `(path, why)` disposition and a repeated `end` replays the
  same `EndReceiptIncomplete` — cleanup can no longer erase the failure
  evidence. A fresh `start` resets its own state (never the previous
  session's). Regressions:
  `end_reports_gaps_after_an_unrecordable_action_receipt` (the oversized
  click-receipt case) and
  `repeated_end_never_upgrades_an_incomplete_receipt`.
- **P1-3 (agentloop dropped one receipt result and misclassified
  post-action errors)** — the unparseable-branch `model_choice` record
  now propagates (`?`; NOT silenced with `let _ =`; the miss was a bug in
  my bulk-conversion script that only surfaced on single-line call sites
  — the compiler warning was the tell and I failed to chase it). The
  click `Err(e)` arm now distinguishes receipt failures
  (`ReceiptAfterAction`/`Receipt`): those EXIT the loop immediately —
  outcome preserved verbatim (executed-but-unreceipted vs recording
  failure), no retry prompt (a second model pick could double-execute
  the first action), no secondary record burying the original error. The
  `agent_end` summary is skipped when halted, and the loop-level
  invariant — no model request and no further action after a
  receipt-failure exit, only cleanup — is asserted by structure and
  named in a comment at the exit.
- **P2 (Unix directory-sync claim exceeded the implementation)** — now
  the code performs what the docs claimed: `Replay::open` fsyncs the
  parent directory on Unix after exclusive creation, fail-closed (a
  refused dir sync fails the open), with the scope stated (the
  directory's own creation is not recursively synced); Windows remains
  explicitly UNPROVEN. Module docs and §1 now describe exactly what is
  done, and keep the process-death vs power-loss distinction. Smoke
  regression `open_on_unix_syncs_the_parent_directory` (unix-only;
  skipped on this Windows seat, runs in CI).

Pre-existing dead-code warnings in axtree/cdp (unused `format`,
`ClickOutcome`, …) are untouched by this lane and remain as on main.

## 7. Corrections after review round 2 (2026-09-07, same build session)

[Re-review packet](2026-09-07-astra-g2a-rereview.md) at `cd50ac3b`: two
P1 findings remained. Both fixed; tests **77 passed / 0 failed**; fmt
clean; PR #18 and issue #16 remain open; the corrected head replaces
`cd50ac3b` as the pinned candidate.

- **P1 (repeated `end` erased an admission gap)** — the terminal
  disposition is now an explicit `EndDisposition` (`Failed { path, why }`
  / `Gappy { path }` / `Clean`) stored on EVERY end outcome, not only
  failed ones. An ended-with-gaps session (successful final marker,
  refused receipts before it) replays `receipt_complete:false,
  gaps:true` with its path on every subsequent `end`, forever; a failed
  final write still replays its `EndReceiptIncomplete`; a fresh `start`
  resets only its own state. Regression
  `repeated_end_after_admission_gap_stays_incomplete` runs the reviewer's
  combined sequence verbatim (oversized action receipt → first end
  incomplete → second end still incomplete with the same path).
- **P1 (agent-loop finalization lost the original error)** — the click
  receipt-failure arm now RETAINS the typed `SeatError` (not a formatted
  note) and sets `executed = true` when the action happened
  (ReceiptAfterAction is an executed action, never "refused"). The
  finalization boundary is extracted into `agentloop_finalize`, whose law
  is: cleanup always runs via `end`, but an in-flight receipt failure
  OUTRANKS whatever cleanup reports — the caller receives the ORIGINAL
  typed error (write-failure mode: not the secondary
  `EndReceiptIncomplete`; admission mode: not an `Ok` summary — even
  though end succeeded and stored its gap marker, which the test verifies
  happened). The success path now carries `receipt_complete`/`gaps` from
  `end` into the loop summary instead of discarding them. Regressions:
  both fault modes at the boundary + the healthy control, using the real
  `record_after_action` and fault sinks (no browser, no model).
