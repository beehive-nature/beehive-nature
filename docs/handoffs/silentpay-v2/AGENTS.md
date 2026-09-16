# Coding instructions — bMESHasi / Silent Pay

## Context and source of truth

Read START-HERE.md, docs/DECISIONS.md, docs/SPRINT-01.md, baseline/silentpay_v2/spec/SILENTPAY-V2.md and baseline/silentpay_v03_design/ADDENDUM-0.3.md. Preserve the approved architectural direction. Earlier claims about third-party runtime capabilities must be rechecked against pinned official releases before implementation; design approval is not technical verification.

Do not spend the first task rewriting the whole architecture. Identify concrete incompatibilities, record them, then implement the bounded milestone.

## Implementation direction

Use Rust for the shared off-chain core: intent and asset types, bounded capabilities, integer billing, receipt validation, fee/resource policies, and separate payment/delivery state machines. Keep native C++ and EVM contracts as chain-specific enforcement layers. Keep proof, compute, storage and settlement implementations replaceable.

Use exSat as the primary reference for qualifying native Vaulta/EVM composition. Treat same-host atomic coordination as a property to prove in an integration test for the exact runtime/version; never extend it to external chains. Do not inherit Bitcoin bridge custody or staking requirements.

## Required invariants

- One authoritative funding domain per note/reservation. Delegation allocates rather than duplicates budgets.
- Bind full chain identity, token/native asset identity and precision; tickers alone are not asset IDs.
- No binary floating-point monetary arithmetic. Check overflow and underflow. Define canonical serialization and rounding. Honor each adapter's integer range; do not truncate EVM-sized values into native-sized fields.
- A b display does not establish b issuance, backing, price, or equivalence to A, dollars, or an RWA token.
- Fees are separately bounded, including retries, failure charges and refunds. Sponsorship cannot cause a duplicate human charge.
- Valid evidence and funding are prerequisites; a signed assertion is not automatically proof of computation or measurement.
- Nullification, accepted credit/change and authoritative state update are atomic inside the qualified domain.
- Unknown submission status is not failure. Reconcile the original obligation rather than create another spend.
- Keep payment and delivery status separate; paid storage can still be incompletely delivered.
- Keep the logical gas tank private. Do not put raw biometrics, stable hardware certificates, global intent IDs, private receipts or storage DataMaps on public chains or permanent archives.
- Do not implement a universal delete-forever promise for immutable storage.
- newbee, raver and cypherpunk are capability/resource profiles, not reduced privacy or automatic governance privilege.

## Working permissions and boundaries

Only modify the selected project directory. Do not overwrite baseline sources silently. Do not upload private conversations, hardware data, secrets, or source archives to public services. Do not publish a repository, push a branch, install privileged software, buy infrastructure, start paid services, deploy contracts, initiate wallets, move live assets, or enable real-money deposits without specific approval. Test fixtures only for this milestone.

Mocks must be named and isolated as test/simulation implementations. No always-true verifier in a production path. Unsupported proof suites reject. Do not claim that passing economic tests demonstrates privacy, Sybil resistance, MITM resistance, cryptographic soundness, or finality.

## Reproducibility

Pin toolchain and dependency versions in the implementation commit. Record selected upstream references and license findings before copying code. Prefer minimal dependencies and no mandatory hosted service for the core.

Run the existing baseline from baseline/silentpay_v2 with `python -m unittest discover -s tests -v`. New Rust work should include a reproducible Cargo workspace, lockfile where appropriate, format check, lint check and unit/integration test commands. Save actual command output and distinguish environment blockers from failures.

Do not delete tests to obtain a passing result. Add regression tests for every corrected bug. Use a branch for review when working inside an existing repository; inspect its instructions and status first.
