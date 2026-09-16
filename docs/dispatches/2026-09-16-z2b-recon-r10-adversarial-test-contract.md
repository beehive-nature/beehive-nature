# Z2.B recon round 10 — the adversarial test contract for the unified bPay rail trait

Seat z2.b (GLM/zCode), 2026-09-16. Roll-forward per the founder order:
"After the unified trait is evidence-backed, roll forward into its
adversarial test contract." The trait IS evidence-backed: both concrete
members stand on proven/tested surfaces (watchpay: 65 tests + two
adversarial review rounds; LN: NIP-47 spec-pinned states + the LIVE
Hub's native vocabulary). DESIGN ONLY — no implementation, no harness
built.

Shape learned from what worked: Astra's probe rounds against watchpay
(reproduce → fix → healthy control) are the template. Every probe
below: (a) names the rail(s) it targets, (b) asserts a NAMED refusal
or a state-machine invariant, (c) carries a healthy control, (d) where
a reference implementation exists, runs differential against it.

## Probe classes

**P1 — identity substitution.**
EVM: changed plan/offer under a live intent (the R1 probe, permanent
regression); mutated derived figures (the R1-review probe, now
compile-time); same-nonce different-tx.
x402: offer re-signed by a stranger key under a pinned destination
(destination/seller-key inseparability — bsigner law); tithe-split
invariant violations (sum(outputs)≠amount, feePayer∈outputs, tithe≠
amount×bp/10000).
LN: payment_hash collision across invoices; evidence for hash A
applied to intent B.

**P2 — expiry races.**
Both rails: intent before expiry + evidence after expiry = ALLOWED;
NEW intent after expiry = REFUSED (named); clock-injection at every
boundary. LN: invoice-expiry vs HTLC-timeout confusion probes (a
timed-out HTLC must NEVER surface as a fee); NWC request-expiration
replay window (expired request replayed → refused, payment state
untouched). EVM: plan-window expiry vs block-timestamp skew; expired
plan's Signed attempt still reconciles.

**P3 — fee/evidence forgery (the R2 class, rail-split).**
EVM: gas_used > gas_limit; price outside [priority, maxFee]; legacy
price ≠ gasPrice; status outside {0,1}; half-pairs; readback missing
on value-moving Settled.
LN: fees_paid > fee_limit (impossible — refuse + flag node); fees_paid
absent (reservation stands); preimage present with state ≠ settled;
settled_at before created_at.
Both: evidence REPLAY (same receipt/preimage set against two intents).

**P4 — idempotency attacks.**
LN: duplicate pay for the same hash → must route to lookup, never a
second payment; make_invoice→lookup cross-binding. EVM: duplicate
tx_hash plan-wide; batch replay under a re-derived batch_id.
x402: same signed offer body submitted twice → the ONE-signature
split's natural idempotency probed (instruction hash dedupe at the
adapter boundary).

**P5 — cap/budget bypass.**
Window-reset race (renewal boundary crossing mid-flight); sharded
splitting (LN MPP shards count as ONE payment — cap on TOTAL, not
parts; EVM multi-batch plans cap on Σ); dual-layer divergence BOTH
directions (Hub says OK / our ledger says no → OUR refusal wins and is
named; reverse → still refused, logged as layer divergence);
per-signature ceiling vs per-call cap interplay at the gate.

**P6 — unknown-state discipline (R1 law, both rails).**
In-flight resolution ambiguity NEVER auto-retries; human gate only;
crash points C1–C4 restated per rail (torn files fail closed —
watchpay law — with LN's ledger in the same discipline: a torn
payment record refuses loudly, never "never sent").

**P7 — transport/DoS semantics.**
NWC over our relay: relay outage mid-pay → Unknown (not Failed);
stale kind-23194 replays; UNSUPPORTED_ENCRYPTION downgrade attempts
(NIP-44 v2 only). EVM: mempool stall → replacement = NEW attempt with
its own reservation, prior attempt Unknown until evidence; RPC
divergence (two receipts for one hash — the two-source receipt
cross-check the watchpay limits note anticipated).

**P8 — state-machine universals.**
Forward-only transitions; terminal states immutable (Settled can never
become Failed — incl. LN preimage-after-expiry edge); abort/discard
only from non-terminal, non-InFlight-with-evidence states; every
refusal names its field (grep-able assertion across the whole probe
set).

## Harness shape (when built)

One probe suite parameterized over rail adapters: probes declare
`targets: [Ln, Evm, Both]`; shared assertions on the LEDGER states
(rail-agnostic — the unified trait's payoff: one state-machine test
body, two adapters); rail-specific evidence bodies per adapter;
healthy controls beside every refusal. Differential legs where
references exist (EVM: the watchpay suite IS the reference — the
adapter's EVM leg must reproduce watchpay's own 65-test behaviors;
LN: state-machine invariants only, no second LN implementation).

## Preconditions (noted, not done)

The Base L1-surcharge fee probe (R9) gates any EVM-on-Base probe leg;
the 02.md notification field pin gates P7's replay-body depth.
