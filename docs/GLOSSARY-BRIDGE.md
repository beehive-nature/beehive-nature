# GLOSSARY-BRIDGE — Silent Pay v2 corpus vocabulary → ratified repository architecture

**Born 2026-09-16, after RULINGS-2026-09-16 (R1–R5) closed the Architecture Reconciliation
Gate.** Purpose: one lookup that converts the external corpus's vocabulary into what the
repository has now ratified, implemented, or queued — so no future seat rediscovers the
naming/provenance problem. Corpus (primary source, never in repo history) is banked at
`docs/handoffs/silentpay-v2/`; the reconciliation record is the zArcheology session artifact
`ARCHITECTURE-RECONCILIATION.md`; the law is `docs/RULINGS-2026-09-16.md`.

## Names — read this first

| term | ratified meaning | where it lives |
|---|---|---|
| **Silent Pay v2** (corpus) | the reconciled architecture; working name **bPay** — PROPOSAL, unratified (collision: Antelope `bpay` + external BPAY) | RULINGS-2026-09-16; ARCH-REC §8b/§G.4 |
| **Silent Payments** | Bitcoin **BIP-352** — a distinct BTC-rail capability, display-only by law; preserved as a replaceable adapter (R5), never the architecture | `surfaces/wallet-adapter-bitcoin.js` not_carried fences; `e2e/profile-caps.mjs` |
| **bpay** (lowercase, economics docs) | the Antelope **block-producer pay** system action — unrelated to bPay-the-architecture | `docs/SPEC-ORIGINATION-1.md:3492+` |

## Intent and fees

| corpus term | repository reality | status |
|---|---|---|
| IntentPlan | typed envelope over the CONSTITUTION **Intent** primitive (Art. I: declarative, never self-executing); nearest live type = watchpay `ValidatedPlan` (mainline @`28116f4a`) | slot ratified; typing rides D2 MINE |
| LegPlan | per-leg policy: domain + exact asset + quote commitment + ceilings + privacy minima | MINE queue (D2) |
| FeePlan | vending rate rows (basis + `tithe_bp` + `upto`) + `spend.rs` `Rate{ratio, rate_set_ref, observed_at}`; corpus's failure-charge/retry ceilings exist nowhere yet | partial; ceilings = MINE queue (D2) |

## Pipeline names → what they actually are here

| corpus name | repository reality |
|---|---|
| COMMIT | exclusive reservation of funded authority — capability exclusive allocation + linkauth + escrow-core holds |
| PROVE | suite-keyed proof verification — the **PLONK/BN254 lane** (RULINGS D1); corpus Groth16/BLS12-381 = qualification evidence only |
| COMPRESS | aggregation/recursion — **absent in both regimes**; open frontier, honestly named |
| SETTLE | per-domain atomic settlement, cross-domain compensation only — vending/x402 opensess→settle LIVE on Jungle4 |
| RETAIN / FORGET | **publication-consent routing, not deletion** — no deletion promise exists anywhere; nearest law = spend-receipt visibility (§3a) |
| GROTH16_BLS381 / HALO2 / STARK / PQ_RESERVED | suite-router names at the crypto-agility seam (algorithm ids + pinned VKs); HALO2/STARK/PQ are reserved names on both sides |

## State, receipts, identity

| corpus term | repository reality |
|---|---|
| PaymentState / DeliveryState | separate machines, paid ≠ delivered — escrow-core (payment side) + watch live-door practice; the typed split is the MINE queue (D2) |
| MeterReceipt | `SpendReceipt` (private by default, `prior_receipt_id` chaining, computed totals) + on-box meter.py |
| FundedNote / Reservation / Capability | voucher-escrow ledger + capability tiers (exclusive allocation) + escrow-core |
| BatchStatement | public settlement commitment — practiced as M9 head-anchoring; now law R3 |
| "proof root is not data availability" | **R3 — ratified** |
| "three identities for money" (display / settlement / gas) | `spend.rs` Denom (B/A) + **R5 rail priority** (gas-abstracting routes first-line) |
| human / agent / receipt identity language | **R1 — ratified** (three domains, never confused; human invariant unweakenable) |
| "no wallet-global identifier links legs" | **R4 — ratified** |
| newbee / raver / cypherpunk | corpus participation profiles = capability presets; same three words as the estate's UX registers (lineage UNKNOWN, no weight) |

## Wire names

| corpus name | status |
|---|---|
| x402 scheme `silentpay-v2`, profile `shielded-reserved-v1` | experimental corpus proposals — **unregistered in any implementation**; a future architecture-name vs wire-scheme-name split is a deliberate decision, not a rename |

*Append-only: new vocabulary lands as new rows with a date, never by editing history.*
