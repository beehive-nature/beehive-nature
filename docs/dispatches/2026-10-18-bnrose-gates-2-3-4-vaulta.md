# Gates 2, 3, 4 & Vaulta K1 Attestation Dispatch: Device Capacity, Load Shedding, Quantum Retries, and PQ Signatures

**Seat:** Antigravity  
**Date:** 2026-10-18  
**Base Commit:** `e7e18acbe483669bd752765d7fe6eb3cb480db61`  
**Worktree:** `C:\Users\travi\wt-antigravity-btungsten`  
**Branch:** `antigravity/btungsten-repro-2026-10-17`  
**PR:** https://github.com/beehive-nature/beehive-nature/pull/465  
**Applicable Canon:** `AGENTS.md`, `SPEC-RUSTEOSVM-1`, Grok Capacity Review at BNR `8e5fa5d0`, Grok Speed Rules

---

## 1. Executive Summary

This batched commit closes **Gate 4**, **Gate 2**, and **Gate 3**, implements the **Vaulta K1 PQ attestation descriptor**, and folds in the leftover from commit `e7e18acbe`:

1. **Leftover from `e7e18acbe` (Production Mode Authority Roster):**
   - Implemented `Supervisor::open_production`: when the supervisor boots in production mode (`BNROSE_PRODUCTION=1` or `open_production`), a missing `allowed_authorities` file causes the node to refuse to start, eliminating open admission defaults in production. Tested and verified in `gate1_flat_admit::test_gate1_production_mode_refuses_without_authorities_file`.

2. **Gate 4 (Quantum / Lost-Response Retry & Receipt Binding):**
   - Implemented `Supervisor::retry` and `Supervisor::try_serve_cached_receipt`.
   - Cached receipts and retry handling are strictly bound to the original envelope hash (`env_sha`).
   - Retries reusing a nonce with a modified envelope payload are refused with `admission:nonce-reuse — payload mismatch`.
   - Retries of identical intents retrieve the original cached receipt or issue it from durable ledger evidence without double-dispatch.
   - Half-written operations (simulated crash after effect apply) recover on reboot and return the receipt to the client on retry.
   - Tested and verified in `tests/gate4_quantum_retry.rs` (3/3 tests passed).

3. **Gate 2 (Device Capacity Ledger & Anti-Sybil Defense):**
   - Implemented `DeviceCapacityLedger` in `crates/bnrose-exec-host/src/device_capacity.rs`.
   - Enforces hard capacity invariant: sum <= capacity - reserve.
   - 1,000-attempt overcommit storm yields 100% refusals once reserve threshold is breached, with exactly 0 over budget.
   - Sybil defense: verifies device hardware attestation challenge (`verify_capacity_challenge`), rejecting counterfeit capacity claims.
   - Bounded deadline misses under extreme oversubscription load.
   - Tested and verified in `tests/gate2_device_capacity.rs` (3/3 tests passed).

4. **Gate 3 (Cross-DAO Load Shedding & Skew Resiliency):**
   - Implemented `CrossDaoAdmissionControl` in `crates/bnrose-exec-host/src/load_shed.rs`.
   - Evaluated Zipf skew distributions s in {0.8, 1.0, 1.2} under 10x, 100x, and 1,000x load spikes.
   - Explicit load-shed refusals protect local DAO priority traffic (p99 latency bounded).
   - Retry amplification factor is strictly bounded (R_amp <= 1.15).
   - Tested and verified in `tests/gate3_load_shed.rs` (2/2 tests passed).

5. **Vaulta K1 Post-Quantum Attestation Descriptor:**
   - Implemented `crates/bsigner/src/vaulta.rs` with exact descriptor `"PQ attestation for K1 actions"`.
   - Enforces dual-authorization: every Vaulta action carries native secp256k1 signature alongside ML-DSA post-quantum attestation envelope (`bpq1/intent`).
   - Teeth test proves that any K1 action lacking a valid BPQ attestation is 100% refused (`vaulta::tests::test_k1_action_without_bpq_attestation_is_refused_teeth`).

---

## 2. Verification Receipts

All tests passing cleanly across the workspace:
- `crates/bnrose-exec-host`: 26+ integration tests across Gate 1, Gate 2, Gate 3, Gate 4, acceptance, agreement, contention, and crossnode.
- `crates/bsigner`: 82 unit and integration tests passing (including Vaulta teeth test).
