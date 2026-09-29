# Sprint 01 — runnable shared Rust reference

## Objective

Deliver a small runnable Rust reference for the approved authority/accounting/state-machine rules. Use the existing Python reference as regression context, not as an unquestioned oracle. Do not build the entire blockchain stack in one change.

## Scope

1. Inspect the baseline, run its tests and record the actual state. Preserve both source packages and this handoff.
2. Create a minimal Cargo workspace with modules for domain/asset identity, capabilities, tariffs/rounding, FeePlan/resource budgets, cumulative receipts and payment/delivery states. Begin with test-only adapter interfaces. Pin the actual Rust toolchain and dependencies used.
3. Implement exclusive reservations, bounded delegation, conservation, exact integer charges, acceptance/replay rules, idempotent submission and failure reconciliation. Establish cross-language golden fixtures for the portable data format, including range checks.
4. Port relevant economic tests; add the v0.3 scenarios with deterministic simulated time and mock routes. Clearly state what is simulated.
5. Add a command-line demonstration of one approved compute obligation and one storage obligation with separate funded budgets and unrelated outward identifiers. Compute succeeds; storage either has unknown payment status or confirmed payment with incomplete delivery. No fresh duplicate debit and no privacy/cost downgrade.
6. Document a separate exSat-derived native/EVM integration spike: pin official source/version and license; identify actual callback/asset-mapping APIs; build the rejection/rollback test for the selected local runtime. Do not report the spike as integrated until executed against that runtime.

## Required acceptance cases

- Wrong domain/asset/recipient/policy, expired quotes, overflows and unauthorized conversions reject.
- Concurrent reservations cannot spend one allocation twice.
- Child capabilities cannot replicate the parent budget.
- Cumulative receipts only charge the newly accepted delta and cannot replay.
- Total provider credit, authorized fees, remaining reserve and refund conserve funded value.
- Sponsorship exhaustion leaves permitted local/read-only functions available; no new user charge is invented.
- A lost acknowledgement causes reconciliation of the original submission, not a fresh authorization.
- Payment confirmation and delivery completion remain independent facts.
- Work already accepted and paid is not rerun or reversed merely because another leg fails.
- Unknown/unsupported cryptographic suites reject; simulation verifiers cannot reach real-money entry points.
- The b-first UI fixture preserves exact underlying assets without implying a fixed exchange rate.
- Mainnet identifiers, privileged keys and personal biometric fixtures are absent.

## Evidence to deliver

Commands and output for formatting, linting, tests and the demo. File diff and a brief implemented/mocked/missing table. Distinguish baseline test results from newly executed tests. Do not substitute a roadmap for code when the task environment can execute the milestone.

## Not in this milestone

Mainnet or public deployment; actual fund movements; production ZK/FHE; biometric enrollment; Trezor firmware; independent chain or rollup deployment; public repo publication; operator provisioning; any assertion of cryptographic anonymity or long-horizon identity immunity.
