**ROUTING** · **Destination:** `beehive-nature/docs/SPEC-SPEND-RECEIPT-1.md`
**Delivery:** Cowork drafts; committed direct (desktop-Cowork commits, push founder-gated)
**Founder read required:** yes — one structural decision surfaced in §4

# SPEC — SPEND RECEIPT SCHEMA (skeleton, v0.1-draft)

**Serves:** L3 (b-metered ephemeral compute) primarily; L1 (eternal data) for receipt
permanence — per the BNRoSe-0 Charter leg-citation rule.
**Authority:** `RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08.md` §3 (L-SCHEMA binds —
standardize early, before adoption spreads). Ruled inputs also from
`RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW` (resource-quantity denomination; b only where
physical resources are consumed), `RULINGS_TESTNET_A_MVP_CUSTODY` (A-first for MVP),
`RULING_BDID_HIERARCHY` (the spender is a bDiD).
**Status:** SKELETON. Unruled areas are **fence-held**, not invented.
**Discipline:** LAW 8a — any source claim in this doc carries `crate @ ref`.

---

## 1. What this schema is for

The spend-view UX is **aggregate first, itemized beneath**: one total by default, full
per-rail breakdown one level down. Autonomy hides the mechanism, **never the accounting**.
This schema is the strongly-typed object behind both views, so the total and the breakdown
can never disagree — the total is *computed from* the line items, never stored independently.

## 2. The object

```
SpendReceipt {
  schema_version   : string            // "1.0.0-draft"
  receipt_id       : string            // content-addressed; see §5
  spender_bdid     : BdidRef           // (c) — WHO spent
  occurred_at      : timestamp         // forward-only; see §6
  operation        : OperationRef      // WHAT caused the spend
  total            : Amount            // (a) — see §4, computed not stored
  line_items       : [LineItem]        // (b) — one per adapter-rail-resource triple
  provenance       : Provenance        // (d)
}

LineItem {
  adapter          : string            // the BNR adapter that consumed the resource
  rail             : Rail              // WHICH RAIL — see enum below
  resource_class   : ResourceClass     // WHAT PHYSICAL THING — see enum below
  quantity         : uint              // EXACT resource quantity, integer
  quantity_unit    : string            // unit of `quantity` (mesh_second, byte, chunk…)
  charged          : Amount            // b/A charged for THIS line
  rate             : Rate              // how quantity became charged — see §4
  rail_receipt     : RailReceipt?      // tx hash / chunk address / block ref, if the rail emits one
}

Amount { value : decimal, unit : "b" | "A" }     // MVP: "A" (A-first ruling)

Rate {
  value          : decimal             // charged-units per one quantity_unit
  rate_set_ref   : string              // WHICH rate table, versioned — see §4 fence-hold
  observed_at    : timestamp
}

Provenance {
  caused_by        : string            // upstream receipt/operation id
  anchors          : [AnchorRef]       // Hive / Arweave anchor refs, existing anchor pattern
  prior_receipt_id : string?           // chain of receipts for one operation
}

Rail          = vaulta | autonomi | arweave | arbitrum | hive | zano | exsat | mesh | other
ResourceClass = mesh_second | vram_byte_second | ram_byte | cpu_microsecond
              | net_byte | chunk_count | storage_byte | chain_fee
```

`Rail` and `ResourceClass` are **closed enums by design** — an unlisted rail or resource
class must be added by ruling, not by a caller passing a free string. That is the same
lesson as the mint gate: a caller-supplied classification is not a classification.

## 3. Denomination law (ruled, non-negotiable)

`quantity` is the **physical thing consumed**, as an exact integer in its own unit.
**It is never fiat-pegged and never rewritten.** If b appreciates 100×, a receipt saying
*"3,600 mesh_seconds"* remains exactly as true as the day it was written. This is why the
resource quantity — not the price — is the durable field.

## 4. ⚠ STRUCTURAL FINDING — the total requires a rate, and the rate is unruled

**Surfaced, not solved.** The ruling asks for both:
- (a) a **single total** in b/A, and
- (b) line items denominated as **resource quantities** — mesh-seconds, VRAM-byte-seconds,
  RAM bytes, chunk counts, chain fees.

Those are **heterogeneous units**. Mesh-seconds and chunk-counts cannot be summed into one
number without a **conversion rate per resource class**. So a total in b/A is only
well-defined once a resource→b/A rate exists — and **that rate is exactly the tokenomics
that is not ruled** (w, T0, Design D params are all behind the standing gate).

**The schema's answer, which requires no unruled constant:** every line carries *both* its
exact `quantity` **and** the `charged` amount **and** the explicit `rate` (with a versioned
`rate_set_ref`) used to convert one to the other. Consequences:

- `total` = **sum of `line_items[].charged`** — homogeneous, so it sums correctly.
- `quantity` is preserved exactly, so appreciation cannot corrupt the itemization.
- The rate is **explicit and auditable**, never baked silently into a price.
- A historical receipt stays **recomputable**: given the preserved quantities and a new rate
  set, the same spend can be re-priced without rewriting history.

**FENCE-HOLD:** this spec defines the *shape and provenance* of `Rate`. It does **not** set
any rate value, rate-setting authority, or rate-update cadence. Those are founder/tokenomics
rulings. `rate_set_ref` is deliberately an opaque versioned reference so the schema can
freeze now and the values land later without a schema change. **No tokenomics constant
appears in this document.**

## 5. Fence-held (named, not invented)

| Item | Why held |
|---|---|
| `receipt_id` derivation | Content-addressing scheme not ruled. Candidate: hash over the canonical serialization — but canonicalization rules are their own decision |
| Rate values / authority / cadence | §4 — tokenomics, gated |
| Whether receipts are per-operation or per-epoch-batched | Cost and privacy tradeoff; unruled |
| Signature / attestation over the receipt | Depends on the passkey succession question, explicitly still open |
| On-chain vs off-chain receipt storage | Touches the multi-asset escrow and BNRoSe-3 archival decisions |
| Privacy posture | A per-bDiD spend record is a behavioural trace; the multipersona ruling implies persona-scoping, but the receipt-visibility rule is **not** ruled |

## 6. Inherited invariants

- **World A / bTiMeLiNe:** `occurred_at` is forward-only. Receipts are **append-only**; a
  receipt is never edited, only superseded by a later one referencing it via
  `prior_receipt_id`. A receipt claiming an earlier `occurred_at` than one already recorded
  for the same operation is **refused**, per the replay ruling.
- **b spend boundary:** a `SpendReceipt` exists **only** where a function consumed physical
  resources. Access is free at point of use and generates **no** receipt — if a receipt
  exists for pure access, that is a bug in the caller, not a line item.
- **A-first:** MVP emits `unit: "A"`. `unit: "b"` becomes valid when b tokenomics are final.

## 7. Acceptance (for whoever implements)

- [ ] Total is **computed** from line items in code, never stored as an independent field.
- [ ] `quantity` is integer and exact; no float accumulation into resource quantities.
- [ ] Unknown `rail` / `resource_class` values are **rejected**, not coerced.
- [ ] A receipt with `line_items: []` and a non-zero `total` fails validation.
- [ ] Round-trip: serialize → deserialize → re-serialize is byte-identical (needed before
      `receipt_id` can be content-addressed at all).
- [ ] No fiat currency field exists anywhere in the schema.
