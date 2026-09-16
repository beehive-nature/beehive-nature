# Z2.B recon round 9 — the EVM/L2 rail adapter contract + the minimal unified bPay rail trait

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Design the EVM/L2
rail adapter contract using the same lifecycle/interface discipline as
R8, grounded in watchpay's already-tested envelope and the x402
first-line door. Then synthesize LN + EVM/L2 into one minimal bPay rail
trait. Keep rail-native differences explicit — don't force LN semantics
into EVM shapes or vice versa. No implementation yet."

## Evidence grounding

- **watchpay** (65 offline tests, two adversarial review rounds): the
  proven EVM payment-contract engine — bounded envelope, declared==
  derived, fee ceilings + reservation budget, receipt→tx→batch binding,
  compose/validate/external-sign split, Unknown-never-auto-retries.
- **The estate x402 door** (read in-tree today, `crates/bsigner/src/
  x402.rs`): a PRE-SIGNATURE OFFER GATE — "the deciding organ refuses
  any offer it does not like BEFORE it signs, never after"; per-call +
  cumulative caps from a policy file "in the member's hand — this organ
  reads and never writes"; offers only gateable inside SELLER-SIGNED
  envelopes verified offline against the key pinned in the allowlist
  row (destination never separable from its pinned seller key);
  ONE-SIGNATURE seller+tithe split validated as schema invariants on
  the instruction; hard DEFAULT_PER_SIGNATURE_CAP ($1-class); "the
  buyer signs and never submits: submission is the rail adapter's job."
- **Formulary doctrine** (docs/RAIL-FORMULARY-1.md): AGENTS 1st =
  "BASE (spend-permissions enforce the genesis allowance on-chain; x402
  agent-payable, Base-native)"; CONTRAINDICATION: "single-passkey
  custody = a candle" → bzDiD succession.
- **Fee composition**: Arbitrum resolved gas-folded (R6). **Base is
  OP-stack — its L1-data fee may be a SURCHARGE outside the gas×price
  product. UNRESOLVED: flagged as a required probe before any EVM-on-
  Base build** (the descriptor may need a fifth sub-shape,
  `L1SurchargeGas`; watchpay's single-product ceiling must NOT be
  assumed to hold on Base until pinned).

## Part 1 — the EVM/L2 rail adapter contract (R8 discipline)

```
EvmPayment {                      // the rail send unit; watchpay-shaped
  identity: (payer, nonce) + tx_hash,     // NO native payment_hash —
                                          // idempotency is CONSTRUCTED
  envelope: PlanRef (sealed),             // watchpay envelope, identity-bound
  fee: FeeDescriptor::L2Gas | L1FoldedGas // (+ possible L1SurchargeGas,
                                          //   Base probe pending)
  state: Intent → Signed → InFlight → Settled | Reverted | Unknown
}
Settled evidence = receipt (status, from/to, logs) + REQUIRED readback
                  for value-moving calls (watchpay R1 law) — tx-hash
                  fallback forbidden by construction.
Reverted evidence = receipt status 0 (+ optional revert-data class:
                  PaymentAlreadyExists-style named errors).
InFlight = mempool; replacement = NEW attempt with its OWN reservation
                  (R1 law — never in-place).
```

Binding rules (watchpay laws, restated as the seam contract):
1. **Identity binding**: every transition binds plan-hash/batch-id
   against persisted attempts (R1); duplicate tx_hash plan-wide
   refused; nonce binds tx to its intent.
2. **Fee law**: per-tx worst case + plan-wide reservation ledger;
   evidence validated for possibility BEFORE mutation (R2); pays_on_
   failure = TRUE (reverts pay gas — the explicit EVM/LN asymmetry).
3. **The x402 door (inbound)**: an offer is gateable ONLY as a pinned
   seller-signed envelope (bsigner law) → gate checks member policy
   (caps, allowlist, per-signature ceiling) BEFORE compose → compose
   bounded (approve NEVER Amount::MAX; envelope ceilings) → organ
   signs → ADAPTER submits (buyer signs and never submits — bsigner's
   split verbatim). x402 FACILITATORS = relay/sponsor class → optional
   adapter, never required; the first-party door is the box.
4. **Spend caps — three layers, two binding**: ON-CHAIN spend
   permissions (Base smart wallet, genesis allowance — binding for
   agents per formulary) + OUR reservation ledger (binding audit/
   budget) + Hub-analog: session-key scopes. bsigner's per-signature
   hard ceiling rides the gate.
5. **Custody**: passkey smart wallets + bzDiD succession
   (contraindication law); agent session keys under on-chain
   permissions; ceremonies at the organ.
6. **Addresses are STATIC** (0x…, EIP-681/x402 URIs) — the explicit
   inversion of LN's ephemeral invoices.

## Part 2 — the minimal unified bPay rail trait

The unity is OPERATIONS + LAWS + LEDGER, not a forced common `send`:

```
trait PaymentRail {
  type PaymentId;                  // LN: PaymentHash · EVM: (Nonce, TxHash)
  type Evidence;                   // LN: Preimage(+fees) · EVM: Receipt(+Readback)
  type Addr;                       // LN: EphemeralInvoice · EVM: StaticAddress
  type Fee: FeeDescriptor;         // R7 vocabulary (shared, class-tagged)

  // shared operations
  info() / balance() / history() / events() -> event-bus   // push law

  // shared LIFECYCLE LEDGER (identical states, rail-native evidence)
  //   Intent → InFlight → Settled | Failed | Unknown (+EVM pre-state Signed)
  // shared LAWS (the whole stack rides every rail):
  //   idempotency-by-identity · worst-case reservation budget ·
  //   possible-evidence-before-mutation · expiry blocks new intents,
  //   never old evidence · unknown never auto-retries ·
  //   refusal names its field · replacement = new attempt
}
```

Rail-native differences kept EXPLICIT (each is a type, not a hack):
pays_on_failure (LN false / EVM true); idempotency (native payment_hash
vs constructed nonce+hash); addresses (ephemeral vs static); expiry
(HTLC-timeout vs block/mempool reality); evidence (preimage knowledge
vs receipt+readback); enforcement layers (Hub-native budgets vs
on-chain spend permissions); the inbound door (NWC invoice vs x402
pinned offer). Nothing LN-shaped is forced into EVM, and the reverse.

## Not done

No implementation; watchpay untouched; no Base assumption taken (the
L1-surcharge probe is a precondition, not a footnote).
