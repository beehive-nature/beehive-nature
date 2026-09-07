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
  the module docs, along with creation/metadata durability being
  fsync-of-parent on Unix and UNPROVEN on Windows. Process death between
  boundaries is not emulated: a killed process does not emulate storage
  loss, and what survives is the reader's (G2-B) problem; every writer
  boundary IS covered deterministically by injected faults.
- **Poison law**: any write/flush/sync failure poisons the writer — later
  appends return `Poisoned`; a stream that may end mid-record is never
  quietly extended. The only explicit recovery is a fresh `Replay::open`
  (new timestamped file). `close()`d writers refuse with `Closed`.
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
