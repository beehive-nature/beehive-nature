# Z2.B recon round 7 — the bPay fee descriptor (design) + box-resident LN policy (formalized) + 7702 handoff

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Design the
technology-neutral bPay fee descriptor against watchpay's proven
envelope: L2 gas, L1-folded gas, LN routing msat, and channel-op L1.
Map bounds, evidence, failure, refund/reconcile semantics for each.
Then formalize the box-resident LN signing/spend-cap policy from
existing law. Hand EIP-7702 authorization to the hardware-signing
lane; don't solve it here. No implementation yet."

All of this is design over ALREADY-PINNED evidence (R0–R6) and
existing estate law. No new sources fetched; nothing implemented.

## Part 1 — the bPay fee descriptor (technology-neutral design)

### Shape

```
FeeDescriptor {
  class:         L2Gas | L1FoldedGas | LNroutingMsat | ChannelOpL1
  units:         WeiGasProduct | Msat | SatsVbyte          // explicit, never implicit
  worst_case:    canonical-decimal amount                  // the ONLY lawful bound basis
  pays_on_failure: bool                                   // gas pays on revert; LN does not
  evidence:      GasReceipt | FoldedGasReceipt | LNPaymentResult | L1TxReceipt
  refund:        Eip1559Unspent | FoldedSameAsGas | NothingOnFail | UtxoChange
  reconcile:     ReservationLedger | PaymentLedger | UtxoSet | ChannelState
  expiry:        None | BlockTimestamp | HtlcTimeout
}
```

`watchpay`'s `NativeFeeCeilings` is the L2Gas member, proven through
two review rounds; the descriptor does not replace it — it generalizes
the envelope so every rail speaks one fee vocabulary with per-class
policy.

### Per-class semantics matrix

| | L2Gas (proven) | L1FoldedGas | LNroutingMsat | ChannelOpL1 |
|---|---|---|---|---|
| **Bound** | per-tx `gas_limit × max_fee_per_gas`; cumulative = reservation ledger; `priority ≤ max_fee`; declared == derived; approval never MAX | SAME single product (Arbitrum: L1 charge gas-folded into `gasUsedForL1`; tips ignored) — the class exists for the per-chain L1 HEADROOM hint on `per_tx_gas_limit`, not new math | `fee_limit_msat` declared per payment (+ amount itself is the spend, not a fee); time-bound exposure via HTLC expiry, not gas | sats/vbyte ceiling on a PSBT envelope; compose→validate(ceiling)→organ-sign |
| **Evidence** | receipt `gas_used × effective_gas_price`, envelope-validated (gas ≤ limit; price ∈ [priority, maxFee]; legacy exact gasPrice; status ∈ {0,1}; pairs complete) | same, plus optional `gasUsedForL1` sub-report for attribution | payment result: preimage, fee-paid-msat, route; in-flight = UNKNOWN state until result | L1 tx receipt + confirmations; fee = size × feerate |
| **Failure** | underfunded → revert (fail-closed); impossible evidence refuses the whole transition; reservation NOT freed without valid evidence | underfunded → revert; basefee-cap below current → fail (Arbitrum docs) | HTLC fail/timeout → NO fee owed on failed parts (failure is cheap); retry = new payment keyed by a NEW payment_hash | mempool stall → replacement = NEW attempt with its own reservation (R1 replacement law); never in-place |
| **Refund / reconcile** | unspent gas auto-refunds (1559); fee evidence shrinks the reservation DOWN, clamped to the tx's own worst case | identical (single product) | nothing to refund on failure; settled payments reconcile the ledger to actual fee; unknown in-flight NEVER auto-retries (human gate) | UTXO change returns on-chain; reconcile against L1 evidence |
| **Idempotency key** | (from, nonce) + tx_hash + plan/batch identity | same | **payment_hash** (native idempotency — better than nonces) | tx_hash + channel-op intent record |

**Design laws carried into every class:** worst-case bounds are
declared-==derived and overflow-checked; evidence is validated for
possibility BEFORE mutating any ledger (gas vs limit, price vs
envelope, status domain, pair completeness); a failed call never frees
reserved exposure without evidence; unknown states resolve only
through explicit gates; every refusal names its field.

**The asymmetry worth naming (founder's R6 point, formalized):**
Arbitrum adds NO new fee mathematics — L1FoldedGas reuses L2Gas's
product with a headroom hint. The genuinely NEW semantics live in
LNroutingMsat (`pays_on_failure = false`, HTLC-timeout expiry,
payment_hash idempotency) and ChannelOpL1 (organ-signed, UTXO-change
refund, replacement-as-new-attempt).

## Part 2 — box-resident LN signing/spend-cap policy (formalized FROM existing law)

Nothing here is new law — it is existing estate law restated for the
LN rail, per the founder's instruction:

1. **One node, estate-keyed** (nodes-on-the-box law): the box runs the
   LN node — the Alby Hub wrap from R6's reuse verdict. The TV/every
   other surface is a window into it.
2. **Key ceremony** (wallet ceremony constitution: nobody operates
   someone else's wallet; keys never requested/held/exported): the node
   key is generated ON-BOX at init under the founder's ceremony;
   macaroon/API scoping per consuming surface; no key export path
   exists or gets built.
3. **Spend caps** (PAY-panel capGate law, generalized): per-action msat
   caps + rolling-window budget. Every payment reserves
   amount + fee_limit against the window ceiling BEFORE send — the
   watchpay reservation ledger law restated with msat units and
   payment_hash idempotency; unknown in-flight payments never
   auto-retry (human gate).
4. **Autonomy ladder** (Buzz Box addendum): GREEN = routine payments
   within caps, auto; YELLOW = channel/liquidity operations
   (incl. their L1 legs) — coordinate with agents; RED = key
   ceremonies, allowlist/cap changes, watchtower onboarding — founder
   only.
5. **Channel ops sign at the organ**: low-frequency, high-value L1
   legs take the Trezor compose→validate→external-sign rhythm (where it
   DOES map), through the ChannelOpL1 fee class above.
6. **Watchtower = optional adapter** (hosted-X ruling class): third-
   party monitoring is replaceable, never required; first-party peers
   where feasible (first-party-only law).
7. **Audit**: every payment flows the ledger states
   intent→inflight→settled|failed|unknown — the proven state machine,
   LN-keyed.

Open item (not solved here, per order): whether the node key itself
can/should be organ-derived (Trezor-backed channel keys are not a
thing; the honest current answer is box-resident hot-ish under caps —
flagged for review with the hardware lane).

## Part 3 — EIP-7702 authorization: HANDED OFF

Per the founder's instruction, 7702 (type-4 delegation; delegate gains
unrestricted EOA access; requires bounded allowlists + organ review)
is **handed to the hardware-signing lane** with the R6 evidence memo
as its input. Not solved here; no further z2.b work queued on it.

## Explicitly not done

No code, no types committed, no crate touched, no vector executed. The
descriptor and policy are DESIGNS for review; watchpay's envelope is
untouched and remains the only implemented fee machinery.

## Sources

All banked: R0–R6 dispatches (954708ed, a5c454fa, 334376bd, 0db24923,
5beed9a0, 6567b865) — watchpay ceiling/evidence/reservation laws,
Arbitrum fee composition (docs.arbitrum.io, pinned R6), LN structure +
Alby Hub wrap verdict (R6), 4337/7702 pins (R6); estate law: wallet
ceremony constitution, nodes-on-the-box, Buzz Box autonomy addendum,
PAY-panel spend-cap lane, first-party-only law, hosted-X
optional-adapter ruling.
