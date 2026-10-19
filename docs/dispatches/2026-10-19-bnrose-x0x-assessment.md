# BNRoSe → x0x: bounded integration assessment — 2026-10-19

Serves **L2 (rebuildable runtime)** and **L3 (bounded execution resources)** under SPEC-BNROSE-0 §0.1. Source review only; no architecture decision ratified and no x0x integration or speedup claimed.

Requested by founder while remediating x0x's dependency audit. BNR source pinned to `49b88d7b294687711b9871f34a74b961f7d5f62a`; x0x remediation PR: https://github.com/loviswaternakamoto/x0x/pull/3. Keep kernel integration out of that security patch.

## Recommendation

Use the current Rust execution kernel as an optional, locally owned control-plane component above x0x. Each peer retains its own policy, keys, execution journal and right to refuse work. x0x continues to own transport, identity, group membership and dissemination. No mandatory central scheduler, shared sovereign key, new consensus claim, or changes to PQ transport are implied.

The first candidate should be a non-spending diagnostic/maintenance intent executed in shadow mode: verify the existing x0x authorization, derive a versioned canonical envelope, ask the core for admission, and record the verdict without changing production behavior. Only after byte/authority equivalence and measured overhead should execution be wired through a local durable supervisor.

## Current source, not the older composition scaffold

- `crates/bnrose-exec-core/src/lib.rs::{admit,handle_admit,transition,handle_step}`: no_std, fixed request/verdict arrays, injected clock, strict WB001 decoding, policy domain/capability/amount/payload/time checks, and operation/effect digest bindings. The core has no keys or I/O. **It does not authenticate the caller's signature**; that belongs at the receiving host boundary.
- `crates/bnrose-exec-host/src/{journal,ledger,opexec,worker}.rs`: durable pre-effect records, digest-bound effect ledger, bounded Wasmtime worker, native/Wasm agreement mode, and recovery. UNKNOWN never supplies authorization for another dispatch. Local duplicate exclusion is not distributed consensus or proof of external finality.
- `crates/bnrose-netpart/src/lib.rs`: explicit separate roles for local safety, independent destination idempotency, and observed finality. This is a partition harness; it is not a production x0x coordination protocol.
- `crates/bnrose-evolve/src/{attest,evidence,controller}.rs`: policy/proposal/verification/promotion are distinct authorities; unknown attempt usage is charged at its reservation; unresolved work is not silently rerun. `attest::SigAlg` and its envelope verification support ML-DSA variants; these are distinct from the older host receipt format.
- `crates/event-bus/src/lib.rs::EventBus` is still an in-memory broadcast seam (no-subscriber drops, lag signals), and `composition` still contains mock settlement. These older pieces must not be mistaken for the newer execution kernel, nor used as durable delivery replacements.

## Expected benefit and evidence needed

| Goal | Plausible mechanism | Adoption evidence |
| --- | --- | --- |
| Performance / speed | Bound admitted work and avoid unauthorized duplicate work; native core avoids mandatory Wasm instantiation per action | Same workload/hardware baseline vs adapter: p50/p95/p99 admission and completion latency, CPU/op, queue wait, journal/fsync cost, failed/duplicate attempts; no gain claimed before measuring |
| Security | Explicit policy checks, pre-effect intent records, bounded workers and verifiable outcomes | Forged/stale/wrong-scope requests refuse, resource exhaustion refuses, lost response remains UNKNOWN, tamper/restart controls fail closed, PQ authority remains independently checked |
| Scalability | Per-peer bounded queues and locally sharded ownership can constrain coordination state | Per-peer memory, bytes sent, repair amplification, queue depth, fairness and throughput under partitions; no global all-events fanout or mandatory remote approver |
| Safe autonomous maintenance | Evolve's separated policy/verifier/promoter roles and evidence-bound decisions | Pinned baseline/candidate checks, protected policy/verifier, measured canary and rollback; implementation cannot redefine its own permission or success criteria |

The checked-in **historical** `docs/receipts/bnrose-rust-001/bench-local-release.json` reports native admission 8.4 µs, warm Wasm admission 30.8 µs, paranoid admission 26.9 µs, and full lifecycle 56 ops/s with journal/ledger fsyncs and Ed25519 receipts, on a Windows x86_64 development box with 238-byte WB001 envelopes. These are source-reported prior results, not remeasured today, not x0x workload numbers and not distributed-capacity proof. In particular the full durable lifecycle must stay off x0x's packet/gossip hot path unless a benchmark justifies it. Do not remove durability or agreement checks merely to improve a headline.

## Compatibility constraints

1. **PQ authority is a hard integration boundary.** `bnrose-exec-host/src/receipt.rs::Receipt::{sign_statement,verify}` uses libcrux Ed25519, and `keys.rs::SupervisorKeys::from_root` derives its Ed25519 seed. This cannot substitute for x0x's ML-DSA authorization. Keep identity/signature verification at the existing x0x boundary; any BNR receipt used as PQ authority needs an explicitly versioned, algorithm-bound adapter with negative downgrade tests. `bnrose-evolve/src/attest.rs` already verifies bsigner ML-DSA envelopes, but that is not a drop-in equivalence proof for x0x identities or the older WB001 host format.
2. The execution core and host manifests explicitly declare Apache-2.0. Other BNR workspace crates inherit AGPL; inspect the selected dependency closure and wire formats before linking them upstream. No whole-workspace dependency is proposed.
3. One supervisor's ledger only controls effects routed through it. Remote effects require destination-owned idempotency, independent reconciliation and a preserved UNKNOWN outcome. x0x group invitation provenance cannot be manufactured by an intent wrapper; its missing base-member snapshot failure remains its own defect.
4. Evolve's README explicitly says its command workers are wall-time bounded/reaped, **not sandboxed**, and its unanchored SHA3 journal can be consistently rewritten by a store writer. Use the stated anchoring and process-isolation boundaries; do not transfer the exec-host Wasmtime sandbox claim onto the evolve executor.

No implementation, benchmark, cryptographic audit or runtime test was performed for this assessment. Next useful work is the bounded non-spending shadow adapter plus an identical-workload comparison, in its own branch and Proposed ADR if architecture/protocol/authority changes are selected.
