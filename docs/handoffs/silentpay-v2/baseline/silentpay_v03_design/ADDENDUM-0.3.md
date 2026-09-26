# Silent Pay v2 — Design addendum 0.3

**Date:** 8 September 2026  
**Scope:** b-first UI; Autonomi/Arbitrum integration; native Vaulta and EVM boundaries; participation profiles.  
**Status:** Design and acceptance criteria only. No deployed contracts, executed chain integration, Rust compilation, or proof implementation is asserted. This is additive to draft 0.2; it does not replace that source package.

## 1. Decisions supplied by the user

A is the proof-of-concept/MVP reference asset, intended to be replaced by b in the product. The main interface presents b plus a selected dollar or RWA-token valuation. Exact settlement assets remain visible in the private detailed receipt and signed authorization. The three proposed participation profiles are newbee (free lite), raver (full end-user functions), and cypherpunk (autonomous infrastructure operation).

b issuance, backing, decimals, exchange value, redemption, and final home domain have not been defined by this addendum. A UI symbol does not establish any of them. Do not imply b already exists, that b equals A, or that b equals one dollar. During a prototype, label the b-denominated view as a prototype and identify the actual A/test-asset obligation.

## 2. Three identities for money

Separate the display denomination, the service settlement asset, and the execution-resource payment asset. An Autonomi upload uses ANT for storage and ETH for Arbitrum One execution; ARB is not the required gas token for that route. Native Vaulta resource accounting is not identical to EVM gas accounting. [S1, S2, S8]

`AssetId` must bind the full settlement domain, token contract or native-asset identity, and precision. Ticker strings are display metadata. Pin deployments and supported ABI/code versions in an authenticated manifest.

The UI may show a b estimate and an indicative fiat/RWA valuation. An approved plan must instead bind executable conversions, expiry, maximum input, minimum output where appropriate, fees, rounding, and asset-specific ceilings. No live exchange rate may silently enlarge an existing authorization. An RWA valuation display alone does not authorize liquidation of that asset or establish redemption rights.

## 3. ANT settlement adapter

Keep two separate interfaces:

- `AutonomiStorage`: prepare encrypted data, collect quotes, finalize writes, recover private retrieval metadata, verify the chosen delivery condition.
- `ArbitrumAntSettlement`: check the intended chain/contracts, exclusively allocate ANT and ETH, authorize the supported payment call, record submission, verify payment evidence and its selected finality assurance.

Autonomi documents an external-signer prepare/pay/finalize flow. Its returned `payment_type` determines whether to use wave-batch or Merkle payment; the adapter must not guess from file size. Returned addresses and calldata are untrusted until checked against the manifest and approved quote. [S3, S4]

The first design may use a pre-funded adapter under explicit counterparty rules, or user-controlled per-domain funds. Paying with b does not cause native ANT acceptance of b. A route must actually supply ANT and ETH. A sponsor pays from exclusively allocated inventory; projected node earnings are not inventory.

No universal paymaster or token permit capability is assumed. Any delegated payer needs qualified contract support or a plainly disclosed funded service arrangement. Never place the root human signing key in a storage daemon merely to simplify integration.

## 4. Authority and budget structures

`IntentPlan` is wallet-local. Each leg receives an unrelated external session reference. Do not publish a single common intent identifier, persistent hardware certificate, biometric identifier, or shared payer identity as a condition of coordinating the legs.

Proposed fields:

```
LegPlan
  domain + adapter/version + exact service asset
  quote/payload commitment + recipient binding
  display-b ceiling + conversion-policy commitment
  service ceiling + funded reservation evidence
  FeePlan
  delivery policy + settlement assurance policy
  retry/recovery policy + claim deadlines
  privacy requirements

FeePlan
  funding source: user | sponsor | explicit split
  permitted payer + reserved funding references
  user debit ceilings by exact asset
  native execution budget OR native resource budget
  approved conversion + expiry
  failure-charge ceiling + retry ceiling
  refund/credit owner and calculation rule
  privacy policy
```

Use checked integer/rational arithmetic and explicit rounding. EVM quantities require correctly bounded EVM-sized representations at their interfaces. No floating-point token balances. Sponsored execution must not also become an undisclosed user debit.

Native resource budgets may distinguish CPU, NET, and RAM; hardware RAM/VRAM supplied by a compute worker is a different resource and must not share the same meter unit or price assumption.

## 5. Execution architecture

EOS VM is a WebAssembly execution engine. Vaulta EVM's main runtime is an Antelope smart contract; EVM compatibility by itself is not an independent rollup or a new security/scaling guarantee. [S6, S7]

Recommended initial decomposition:

```
b-first client
  -> shared Rust policy/accounting core
     -> bCompUte local/distributed workers
     -> native Vaulta settlement adapter
     -> optional Vaulta EVM application adapter
     -> Autonomi storage + Arbitrum ANT settlement adapters
     -> other independently qualified routes
```

Use chain execution for appropriate authorizations, escrow, commitments, verification, and settlement. Keep bulk inference, model weights, sensor streams, and routine private receipts off globally replicated contract state. Confidentiality and execution evidence remain job-policy requirements, not properties conferred by using Rust or an EVM.

For b on native Vaulta plus an EVM representation, select an authoritative issuance domain and enforce representation backing. Lock/mint and burn/release are candidate mechanisms, not implemented bridges. Identical symbols do not authorize two independent circulating claims on the same backing.

A separate b-native chain is a different deployment decision from issuing an application token on existing Vaulta. It adds consensus, resource economics, operator, recovery, and license obligations. Current Vaulta documentation describes licensing restrictions for Spring; review the exact release before planning reuse. [S8]

## 6. Participation profiles

**newbee — free lite:** useful local functionality and reading already-paid content, with no mandatory funded wallet. Optional paid writes or remote compute require bounded funded sponsorship. When sponsorship ends, local/read-only functions continue; paid work queues or requires explicit approval. No private-data sale or weaker privacy as an implicit subsidy. Autonomi documents read-only operation without ANT, gas, or a wallet, while private retrieval still needs its access material. [S5]

**raver — full end user:** encrypted writes, paid compute, multiple bounded agents, one-approval/multiple-route workflows, recovery, private receipts, and approved asset conversions. Default economics should be explicit usage pricing rather than mandatory recurring subscriptions. Larger resource access must not require weaker authorization.

**cypherpunk — autonomous infrastructure:** optional node, relay, compute, storage, prover, sponsor, and chain-operation modules. Every module has separate budgets, signing authority, revenue accounting, upgrade controls, and failure policy. Operators retain human-controlled authority boundaries. Running an ordinary node is not the same as being selected as a block producer; the current Vaulta system uses elected producers. [S8]

These profiles are capabilities and interface presets, not ranks of personhood or automatic governance privileges. The same identity/recovery framework survives movement between them. Apply scoped quota controls where funded sponsorship requires them; do not require population-uniqueness checks for ordinary local/read-only use.

## 7. The mandatory two-route acceptance test

One approval authorizes compute on native Vaulta and encrypted Autonomi storage paid on Arbitrum. The fixture must define independent budgets, separate external references, and a hard b-level ceiling with pinned conversion rules. Work begins only after the required funding conditions are met.

Compute completes and its accepted charge is settled. Then storage times out.

Track two independent states:

```
PaymentState: unsubmitted | pending | unknown | confirmed(policy) | reverted
DeliveryState: not_started | pending | partial | verified(policy) | failed
```

A service may be paid without being fully delivered. Autonomi explicitly documents partial upload responses after payments and some writes have occurred. Its preparation flow can identify already-stored chunks. Neither an HTTP timeout nor a missing upload-session response proves nonpayment. [S3]

Required behavior:

1. Preserve the earned compute claim; do not rerun or repay it.
2. Reconcile storage payment by exact domain, intended contract/call, payer/nonce and original transaction evidence, applying the quoted assurance policy.
3. Do not create a fresh payment while the prior obligation is unresolved. A bounded replacement transaction must retain the same logical obligation and cannot authorize double execution.
4. Preserve the encrypted input, chunk manifest, private retrieval metadata, upload references, quote references, and payment evidence needed for recovery. Implement durable recovery rather than assuming SDK sessions survive restarts.
5. If payment is confirmed but delivery is incomplete, recover/finalize or re-prepare as supported. New payment for verified missing work requires the approved remaining/recovery budget; do not assume all retries are free or that paid funds are automatically refundable.
6. Mark the whole task complete only when required payment and delivery conditions are both met. A refund after irreversible payment needs its own contractual source or sponsor loss allocation.
7. For each domain, report its actual assurance level. Arbitrum sequencer acknowledgement must not be relabeled Vaulta finality. [S9]

Required private UI result:

> Compute complete and paid. Storage payment [actual status]; delivery [actual status]. No duplicate debit. Recovery remains within the approved budget.

## 8. Rust boundary

Autonomi documents both daemon-backed Rust access and a direct `ant-core` library. [S10] Keep either implementation behind the storage adapter, not embedded in the consensus-independent authorization rules.

Suggested modules: intent, capability, asset/valuation, fee policy, meter, receipt, settlement state, tier policy, and adapters. The deterministic core performs no hidden network request, key export, automatic asset conversion, or policy downgrade. On-chain contracts must enforce their own relevant invariants independently of client checks.

## Sources checked on 8 September 2026

[S1] Autonomi token: https://docs.autonomi.com/token
[S2] Arbitrum FAQ: https://docs.arbitrum.io/learn-more/faq
[S3] Autonomi external signers: https://docs.autonomi.com/developers/sdk/install/how-to-guides/use-external-signers-for-upload-payments
[S4] Autonomi payment model: https://docs.autonomi.com/developers/core-concepts/payment-model
[S5] Autonomi read-only features: https://docs.autonomi.com/developers/guides/build-read-only-features
[S6] EOS VM primary repository: https://github.com/AntelopeIO/eos-vm
[S7] Vaulta EVM primary repository: https://github.com/VaultaFoundation/evm-contract
[S8] Vaulta protocol reference: https://www.vaulta.com/protocol
[S9] Arbitrum finality: https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality
[S10] Autonomi Rust development: https://docs.autonomi.com/developers/developing-in-rust/rust

These references describe upstream systems, not proof that the proposed b adapters are deployed or qualified.
