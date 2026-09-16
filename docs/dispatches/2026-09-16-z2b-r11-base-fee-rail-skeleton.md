# Z2.B R11 — Base fee RESOLVED (surcharge!), NIP-47 pinned, unified rail skeleton + harness BUILT

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: resolve the Base
L1-data-fee question at source; pin the NIP-47 notification field; if
both resolve cleanly, BUILD the unified bPay rail-trait skeleton + the
R10 parameterized adversarial harness (EVM/watchpay first concrete
member, LN second adapter contract; x402 stays the EVM door; no
production deployment).

## Precondition 1 — Base/OP-stack L1 data fee: SURCHARGE (the dangerous case is REAL)

docs.optimism.io/stack/transactions/fees, own words:
`totalFee = operatorFee + gasUsed*(baseFee + priorityFee) + l1Fee`;
"The L1 Data Fee is the only part of the OP Mainnet transaction fee
that differs from the Ethereum transaction fee"; it scales with
compressed transaction bytes and relayed L1 prices; and — decisively —
**"It is currently not possible to limit the maximum L1 Data Fee that a
transaction is willing to pay"** (attributed to Ethereum tx-format
limitations). It is "deducted directly from the address that sent the
transaction", OUTSIDE the EIP-1559 bid.

Consequence (now encoded): watchpay's single-product ceiling does NOT
bound Base spend. The fee vocabulary gains the fifth class
`L1Surcharge`, and the EVM member carries `base_gate`: a Base-bound
plan without a declared L1-surcharge worst case is REFUSED (named
field `L1Surcharge`). Receipt-field shape for the surcharge (e.g.
`l1Fee` in OP-stack receipts) remains a micro-probe at build time; the
CHARGING MODEL is pinned at source.

## Precondition 2 — NIP-47 notifications pinned (nwc/02.md)

payment_received / payment_sent share the transaction-object payload
(type, state?, invoice, description?, preimage, payment_hash, amount
msat, fees_paid, created_at, expires_at?, settled_at, metadata?),
delivered as Nostr kind 23197 (NIP-44) / 23196 (legacy NIP-04), each
carrying a `p` tag (the client pubkey) for subscription; discovery via
the info event's `notifications` tag or get_info's `notifications`
array. R8's open item closed; the R10-P7 precondition satisfied.

## Built — crates/bpay-rail (branch codex/z2b-bpay-rail, stacked on the CI-green watchpay tip 76b23661)

- `fee.rs` — FeeClass {L2Gas, L1FoldedGas, L1Surcharge, LnroutingMsat,
  ChannelOpL1} with `pays_on_failure()` (the R7 asymmetry encoded:
  gas classes true, LN routing false) + FeeReservation.
- `ledger.rs` — `RailLedger<Id>`: ONE implementation of the whole law
  stack, generic over rail identity — idempotency-by-identity (duplicate
  intent NEVER re-opens: route to lookup), forward-only lifecycle with
  terminal immutability, worst-case fee-window budget (exhaustion
  refused naming the R1 law), possibility-checked evidence
  reconciliation (paid > worst case = impossible; invalid evidence
  refuses BEFORE mutation), expiry-blocks-new-never-old, Unknown
  resolves only to terminal, every refusal names its field.
- `evm.rs` — first concrete member COMPOSING watchpay (never
  rewriting): attempt-state mapping (Intent/Staged/InFlight/Settled/
  Failed/Unknown), constructed idempotency (EvmPaymentId =
  nonce+tx_hash), fee reservations from the plan's proven ceilings
  (L2Gas / L1FoldedGas), and `base_gate` (the R11 refusal).
- `ln.rs` — second member: the R8 adapter contract over `LnMockClient`
  (MOCK NWC-shaped client, named as mock everywhere — no network): NIP-47
  state vocabulary, payment_hash idempotency, preimage settlement
  evidence, OPTIONAL fees_paid (absence lawful — reservation stands;
  fees > fee_limit = impossible), invoice-expiry pre-send refusal,
  transport outage → InFlight→Unknown (never Failed), HTLC timeout →
  Failed with no fee ever.
- `tests/rail_probes.rs` — the R10 harness, parameterized by target:
  shared probes run the law stack once for ALL rails (P2/P3/P4/P5/P6/
  P8); LN probes (happy path with preimage evidence + reconciled fees;
  duplicate-hash route-to-lookup; expired-invoice pre-send refusal;
  outage→Unknown + unknown-never-retries; impossible fees; HTLC-timeout
  never-charges); EVM probes (full watchpay-state mapping; base_gate
  refusal + healthy control; constructed idempotency; fee classes; the
  explicit differential note — the watchpay suite IS the deep EVM
  reference, `cargo test -p watchpay`).

## The harness caught a real bug during construction (receipted)

First run: `reconcile_with_evidence` SETTLED a payment already in
terminal `Failed` — terminal immutability was enforced in `transition`
but not on the evidence path. Exactly the R10-P8 class. Fixed in the
ledger (only InFlight/Unknown reconcile); the probe
(`ln_htlc_timeout_fails_never_charges`) is now the permanent
regression. Adversarial-first construction paid for itself before the
crate ever shipped.

## Evidence

- bpay-rail: **15/15 offline tests**; watchpay **65/65 unchanged**
  (composed, untouched); clippy clean; `cargo fmt --check` clean;
  secret-scan clean; no network anywhere (mock client only); no
  production deployment; x402 remains design-level (bsigner gate
  feeds compose when built).
- Branch `codex/z2b-bpay-rail` stacked on `codex/z2b-watchpay`
  @76b23661 (CI-green) so the path dependency is in-tree.

## Open / next

OP-stack receipt surcharge-field pin at build time; NWC 05/02
field-complete mock coverage (batch/multi_pay deferred); the LN LIVE
adapter (same contract, real NWC transport over our relay) whenever
that build is authorized; x402-door wiring into compose.
