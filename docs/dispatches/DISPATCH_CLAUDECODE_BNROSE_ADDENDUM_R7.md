# DISPATCH — BNRoSe SKELETON ADDENDUM (R7)
**From:** Founder (LOViS) via research seat (Fable) · **To:** Claude Code
**Date:** 2026-08-07 · **Scope:** Fold three RULED items into the BNRoSe spec skeletons. One file per prompt. Specs only — no implementation code. Cite Zano source file/function for any crypto claim or mark UNVERIFIED and stop. No security language stronger than "sound by construction / isolated by design."

---

## ITEM A — BNRoSe-0 (Charter): the Eternal Computer one-liner

Add to the Charter's framing invariants:

> **The Eternal Computer** = eternal data (Autonomi primary + Arweave mirror) + eternal runtime (BNRoSe deterministic-replay discipline) + b-metered ephemeral compute (bTiMe vouchers on bMeshLLM). Storage that never forgets; a runtime that can always be rebuilt; compute rented by the mesh-second in b.

**Acceptance:** the one-liner appears verbatim in BNRoSe-0; every downstream BNRoSe doc cites which of the three legs it serves. COURSE_SYNC receipt required.

---

## ITEM B — BNRoSe-3 (Eternal-Data Archival): Universal Chain Mirror clause (RULED)

Generalize the archival mandate from Zano-only to ALL adapter chains:

1. **Mirror scope:** each adapter chain's ENTIRE blockchain (genesis + full block log) mirrored to Autonomi (primary) + Arweave (mirror), on an epoch cadence per chain.
2. **Purpose:** every action gets full-node-level verification features agnostic to device — light clients resolve against the eternal store instead of trusting servers.
3. **Two-part sandwich (honest limit, stated in-spec):** the eternal store anchors verifiable HISTORY up to the last mirrored epoch; the LIVE TIP (current state, fresh consensus) requires a thin live layer per chain — headers/state-proofs from the running network. Actions ride the live layer; verification and replay ride the eternal store. The spec must not claim the mirror alone provides live full-node capability.
4. **Per-chain capture adapters (initial set):** Vaulta — SHIP deterministic trace/delta capture; Zano — archival-mode node + pre-prune capture (cadence strictly shorter than the Zenith retention period once published; full pre-HF6 and pre-Zenith logs captured BEFORE each activation); exSat EVM — standard EVM block/receipt export + light-client proofs. New adapter chains require a named capture adapter before mirroring is claimed.

**Acceptance:** a cold-start verifier, given only Autonomi/Arweave content addresses, can retrieve genesis + every block body for each mirrored chain and replay to the last mirrored epoch; the live-tip limitation is stated verbatim; per-chain cadences are declared in a table. COURSE_SYNC receipt required.

---

## ITEM C — BNRoSe-3: External Notary clause (RULED IN by founder, 2026-08-07)

Add as an OPTIONAL notary layer:

1. **Mechanism:** per archived epoch, the Merkle root of that epoch's mirrored content is anchored via OP_RETURN to BCH; BTC (OpenTimestamps-style) is an acceptable alternate or supplement.
2. **Doctrine: ANCHOR, NOT WAREHOUSE.** BCH/BTC never carries bulk block bodies — bulk stays on Autonomi/Arweave + owned archival nodes. The notary buys consensus-diverse, jurisdiction-diverse proof-of-work timestamping of WHAT the archive contained and WHEN, surviving correlated failure of Vaulta commitments and the storage networks.
3. **Hierarchy:** Vaulta = primary commitment layer (unchanged). External notary = optional, per-epoch, cost-ceiling pennies.
4. **Verification path:** the spec documents how a third party recomputes the epoch Merkle root from Autonomi/Arweave content and matches it to the on-chain anchor.

**Acceptance:** clause present with the anchor-not-warehouse doctrine verbatim; a worked verification example (spec-level, no code) included; cost ceiling stated. COURSE_SYNC receipt required.

---

## SCOPE FENCE
Only Items A–C. No new features, no implementations, no unsolicited architecture. Anything beyond this addendum: **That is out of scope. Execute the prompt as written.**
