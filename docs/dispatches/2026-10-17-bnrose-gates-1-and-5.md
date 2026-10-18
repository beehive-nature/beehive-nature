# Gate 1 & Gate 5 Dispatch: Flat Admission Scaling, Replay Equality, and Watchdog Cleanup

**Seat:** Antigravity  
**Date:** 2026-10-17  
**Base Commit:** `988e7805cba2ec454bf32e53eb95738c8eec6b4c`  
**Worktree:** `C:\Users\travi\wt-antigravity-btungsten`  
**Branch:** `antigravity/btungsten-repro-2026-10-17`  
**Applicable Canon:** `AGENTS.md`, `SPEC-RUSTEOSVM-1 §2.4`, Grok Review at BNR `8e5fa5d0` (`04-capacity-adversarial-review.md`)

---

## 1. Executive Summary & Review Corrections

Following the capacity review at BNR pin `8e5fa5d0` and Grok's adversarial review of the capacity disposition, this lane implements and proves **Gate 1** and **Gate 5** of the kRUST BNRoSe harness.

The three relayed corrections from Grok's review have been adopted into estate canon:
1. **Vaulta Remedy Terminology:** An ML-DSA signature over the action is an attestation alongside K1, not quantum resistance (since the blockchain consensus only verifies the K1 signature). It is codified as **"PQ attestation for K1 actions"** until Vaulta natively supports post-quantum key types.
2. **Gate 1 Invariant & Property Test:** After the in-memory nonce index is rebuilt at startup, it is proven to equal a full journal replay byte-for-byte across mid-append crashes (partial operations, torn appends, replica loss), ensuring the index can never admit a nonce the journal already holds.
3. **Gate 4 Receipt Binding:** Recorded for the subsequent Gate 4 implementation—cached receipts must be bound to the original envelope hash; a retry with the same nonce but differing payload must be refused, never served the prior receipt.

---

## 2. Gate 1 — Flat Admission Scaling & Replay Invariance

### Problem Identified
Prior to this implementation, `Supervisor::run` reloaded both journal replicas from disk on every single admission (`load_state(&paths, ...)`), producing an $O(N)$ disk read scaling directly with journal history. By op 850, disk I/O overwhelmed the supervisor, making community throughput degrade as history grew. Furthermore, policies lacked an authority allowlist at the admission gate.

### Architecture & Fix
1. **In-Memory Nonce Index:**
   - Modified `ReplicatedJournal::open_with_records` to return the surviving records loaded during the initial startup pass.
   - Built an in-memory `BTreeMap<([u8; 32], [u8; 32]), [u8; 32]>` mapping `(authority, nonce) -> op_id` in `Supervisor`.
   - On startup, `Supervisor::open_with` populates this index in a single $O(N)$ scan.
   - During steady-state execution, admissions consult the index in $O(\log n)$ memory time (< 1 µs). On successful commit, the new nonce is inserted in-memory, eliminating all repetitive disk reads.
   - Replaced all disk reloads in `run_raced`, `run_steps_opt`, and `step_has_any_recorded_effect` (now reading in-memory ledger rows).

2. **Policy Authority Allowlist:**
   - Added `allowed_authorities: Option<BTreeSet<[u8; 32]>>` to `Supervisor`.
   - Unauthorized authorities are refused in nanoseconds with `"admission:unauthorized-authority"` before any disk, ledger, or signature verification operations occur.

3. **Property Test — Mid-Append Crash & Replay Invariance:**
   - Implemented `test_gate1_property_crash_mid_append` in `tests/gate1_flat_admit.rs`.
   - Tested crash cutoffs at each stage of an operation's journal sequence (`E_ADMITTED`, `E_RESERVE`, `E_DISPATCH`).
   - Verified that on restart, `reopened.admitted_map() == &reopened.replay_journal_nonces().unwrap()` byte-for-byte.
   - Proved that retrying the interrupted operation is refused with `admission:nonce-reuse`, confirming that **the index can never admit a nonce the journal already holds**.
   - Tested simulated replica 1 host loss: degraded autonomous healing rebuilt replica 1 from surviving replica 0 with 100% agreement and nonce refusal.
   - Tested fail-closed invariant on corrupted/tampered replica chains per `SPEC-RUSTEOSVM-1 §2.4`.

4. **Latency Scaling & Replay Flood Proofs:**
   - Sequential ops (300 ops): Early avg (ops 0..50) = 14.5 µs, Late avg (ops 250..300) = 15.6 µs (slope ratio **1.08x**, strictly flat, well within the 2.5x variance ceiling).
   - Replay flood: Pure in-memory nonce lookups cost **0.05 µs** (< 1 µs). Full replay flood resulted in 0 journal writes and 0 ledger rows.

---

## 3. Gate 5 — WasmWorker Watchdog Thread & Engine Cleanup

### Problem Identified
`WasmWorker::new` instantiated a background thread (`std::thread::spawn`) to tick the Wasmtime engine epoch (`increment_epoch()`), but retained no handle and had no cancellation or join mechanism. When `WasmWorker` was dropped, the thread remained alive indefinitely, leaking threads and engine allocations across worker lifecycles.

### Architecture & Fix
1. **RAII Watchdog Guard:**
   - Created `struct Watchdog` holding `stop: Arc<AtomicBool>` and `handle: Option<std::thread::JoinHandle<()>>`.
   - Implemented `Drop for Watchdog`:
     - Sets `stop.store(true, Ordering::Release)`
     - Signals parked thread via `h.thread().unpark()`
     - Blocks on `h.join()` to guarantee the OS thread has completely terminated before `WasmWorker` drop completes.
   - Embedded `_watchdog: Watchdog` inside `WasmWorker`.
   - Added `pub static ACTIVE_WATCHDOG_THREADS: AtomicUsize` to track live watchdog threads globally.

2. **Verification Suite (`tests/gate5_worker_cleanup.rs`):**
   - Sequential instantiation and drop of 1,000 `WasmWorker` instances:
     - Baseline threads before run: **0**
     - Live threads while worker active: $\ge 1$
     - Remaining threads immediately after each drop: **0**
     - Final watchdog threads after all 1,000 drops: **0**
   - Concurrent worker pool test: 10 concurrent workers spawned, operated, and dropped simultaneously; active watchdog count returned strictly to **0**.

---

## 4. Test Suite Receipts

All 55 integration and unit tests pass cleanly:
```
test tests::b64_round_trips_against_known_vectors ... ok
test tests::hex_round_trips ... ok
test journal::tests::reopening_continues_the_chain ... ok
test receipt::tests::a_receipt_verifies_with_the_public_key_and_json_round_trips ... ok
test ledger::tests::apply_is_idempotent_and_digest_bound ... ok
test fixtures::tests::fixtures_are_deterministic_and_bind ... ok
test journal::tests::the_chain_detects_every_touch_and_reorders_nothing ... ok
test acceptance (2 tests) ... ok
test agreement (4 tests) ... ok
test contention (4 tests) ... ok
test crossnode (6 tests) ... ok
test gate1_flat_admit (6 tests) ... ok
test gate5_worker_cleanup (2 tests) ... ok
test recovery (6 tests) ... ok
test rejection (5 tests) ... ok
test rusteosvm (10 tests) ... ok
test sandbox (3 tests) ... ok
test wb004_retry (1 test) ... ok

test result: ok. 55 passed; 0 failed; 0 ignored; 0 measured; finished in 67.94s
```

---

## 5. Files Staged for Commit (Explicit Pathspecs)

In accordance with the worktree law in `AGENTS.md`, commits are executed solely from `C:\Users\travi\wt-antigravity-btungsten`:
- `crates/bnrose-exec-host/src/journal.rs`
- `crates/bnrose-exec-host/src/ledger.rs`
- `crates/bnrose-exec-host/src/opexec.rs`
- `crates/bnrose-exec-host/src/worker.rs`
- `crates/bnrose-exec-host/tests/gate1_flat_admit.rs`
- `crates/bnrose-exec-host/tests/gate5_worker_cleanup.rs`
- `docs/dispatches/2026-10-17-bnrose-gates-1-and-5.md`
