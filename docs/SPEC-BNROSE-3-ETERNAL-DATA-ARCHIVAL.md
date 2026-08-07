**ROUTING** · **Destination:** `beehive-nature/docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md`
**Delivery:** Cowork drafts; committed this session (see ROUTING discrepancy note in the R7 receipt)
**Founder read required:** yes — archival mandate + notary doctrine

# SPEC — BNRoSe-3 · Eternal-Data Archival (skeleton)

**Serves:** L1 (eternal data) primarily; underwrites L2 (eternal runtime) by
providing the store a cold-start verifier replays against.
**Status:** SKELETON. Seeded with RULED Items B and C from
`docs/dispatches/DISPATCH_CLAUDECODE_BNROSE_ADDENDUM_R7.md` (2026-08-07).
**Authority:** R7 Items B and C, founder-ruled. Routed to Cowork by founder word
("INDEX row 4 → Cowork", 2026-08-07).
**Scope discipline:** specs only, no implementation. Any Zano crypto claim is cited
to a hyle-team source file/function or marked UNVERIFIED and stopped. No security
language stronger than "sound by construction / isolated by design."

---

## 1. Universal Chain Mirror (RULED — R7 Item B)

**Mandate generalized from Zano-only to ALL adapter chains.**

### 1.1 Mirror scope
Each adapter chain's **entire** blockchain — genesis + full block log — is mirrored
to **Autonomi (primary) + Arweave (mirror)**, on a per-chain epoch cadence.

### 1.2 Purpose
Every action gains full-node-level verification features **agnostic to device**:
light clients resolve against the eternal store instead of trusting servers.

### 1.3 The two-part sandwich (honest limit — stated verbatim per acceptance)

> The eternal store anchors verifiable HISTORY up to the last mirrored epoch; the
> LIVE TIP (current state, fresh consensus) requires a thin live layer per chain —
> headers/state-proofs from the running network. Actions ride the live layer;
> verification and replay ride the eternal store.

**This spec does not claim the mirror alone provides live full-node capability.**
History and replay are what the eternal store provides, sound by construction; the
live tip is a separate thin layer per chain.

### 1.4 Per-chain capture adapters (initial set)

| Chain | Capture adapter | Notes | Source status |
|---|---|---|---|
| **Vaulta** | SHIP deterministic trace/delta capture | The `chain-eos` read path is a SHIP stream ingester (VERIFIED-FACTS A47) | adapter posture VERIFIED read-only; capture-to-store is new work |
| **Zano** | Archival-mode node + pre-prune capture | Cadence **strictly shorter** than the Zenith retention period once published; full **pre-HF6 and pre-Zenith** logs captured **BEFORE** each activation | **UNVERIFIED** — Zenith retention period not yet published; cadence cannot be fixed until it is. Flagged, not assumed (cite-or-stop) |
| **exSat EVM** | Standard EVM block/receipt export + light-client proofs | chainId 7200 / `0x1c20` verified live (VERIFIED-FACTS A51) | endpoint VERIFIED; export pipeline new work |

**Standing rule:** a new adapter chain requires a **named capture adapter** before
mirroring is claimed for it. No chain is "mirrored" by assertion.

### 1.5 Per-chain cadence table (to be filled as each cadence is ruled)

| Chain | Epoch cadence | Constraint | State |
|---|---|---|---|
| Vaulta | TBD | — | awaiting ruling |
| Zano | TBD | < Zenith retention (once published); pre-activation full-log capture is mandatory regardless of cadence | **blocked on UNVERIFIED retention period** |
| exSat EVM | TBD | — | awaiting ruling |

---

## 2. External Notary (RULED IN — R7 Item C, founder 2026-08-07)

Added as an **OPTIONAL** notary layer above the primary commitment layer.

### 2.1 Mechanism
Per archived epoch, the **Merkle root** of that epoch's mirrored content is anchored
via **OP_RETURN to BCH**; **BTC (OpenTimestamps-style)** is an acceptable alternate
or supplement.

### 2.2 Doctrine — ANCHOR, NOT WAREHOUSE (verbatim per acceptance)

> BCH/BTC never carries bulk block bodies — bulk stays on Autonomi/Arweave + owned
> archival nodes. The notary buys consensus-diverse, jurisdiction-diverse
> proof-of-work timestamping of WHAT the archive contained and WHEN, surviving
> correlated failure of Vaulta commitments and the storage networks.

### 2.3 Hierarchy
- **Vaulta** = primary commitment layer (unchanged).
- **External notary** = optional, per-epoch, cost-ceiling **pennies**.

### 2.4 Verification path (worked example — spec-level, no code)

A third party verifies an epoch's timestamp as follows:

1. **Retrieve** the epoch's mirrored content from Autonomi/Arweave by its content
   address (the address published in the epoch's archival record).
2. **Recompute** the epoch Merkle root over the retrieved content, using the
   declared leaf ordering and hash function (declared in the archival record;
   fixed per epoch).
3. **Fetch** the on-chain anchor: the OP_RETURN output on BCH (or the OpenTimestamps
   proof on BTC) referenced by the epoch record.
4. **Match** the recomputed root against the anchored root. Equality establishes
   that the archive contained exactly that content at or before the anchoring
   block's timestamp.
5. **Diversity check:** because the anchor lives on a proof-of-work chain
   independent of Vaulta and of the storage networks, the timestamp survives
   correlated failure or capture of any one of those three — this is the property
   the notary buys, stated as a property, not a guarantee of the underlying chains.

**Cost ceiling:** pennies per epoch (a single OP_RETURN / OpenTimestamps commitment;
no bulk data on the notary chain by the §2.2 doctrine).

---

## Placeholders (await their own dispatches — NOT drafted here)

- §3 Epoch record format (leaf ordering, hash function, content-address schema)
- §4 Cold-start verifier procedure (full replay from genesis to last mirrored epoch)
- §5 Owned-archival-node operations and their relationship to Autonomi/Arweave

---

## Acceptance status

**R7 Item B:**
- [x] Mirror scope generalized to all adapter chains (§1.1).
- [x] Two-part sandwich stated **verbatim**; mirror-alone-is-not-live-full-node stated (§1.3).
- [x] Per-chain cadences declared **as a table** (§1.5) — values TBD per future rulings; Zano row correctly **blocked on UNVERIFIED** Zenith retention.
- [ ] Cold-start-verifier acceptance (retrieve genesis + every block body, replay to last epoch) — belongs to §4, a placeholder here; not claimable until the epoch record format (§3) is ruled.
- [ ] COURSE_SYNC receipt — owed by the committing seat.

**R7 Item C:**
- [x] Clause present; **anchor-not-warehouse doctrine verbatim** (§2.2).
- [x] Worked verification example, spec-level, no code (§2.4).
- [x] Cost ceiling stated — pennies per epoch (§2.3, §2.4).
- [ ] COURSE_SYNC receipt — owed by the committing seat.

---

## UNVERIFIED register (this doc)

1. **Zano Zenith retention period** — not yet published; the mandated capture
   cadence ("strictly shorter than Zenith retention") cannot be fixed until it is.
   The pre-activation full-log capture requirement stands regardless. Cite-or-stop:
   no Zano source fixes this value today. (§1.4, §1.5)
2. Whether SHIP capture (Vaulta) and EVM export (exSat) preserve enough to satisfy
   the §4 cold-start replay bar — a capture-completeness question, open until §3/§4
   are ruled and a replay is demonstrated.
