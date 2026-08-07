# COURSE_SYNC RECEIPT — R6 §3, with R7/R8 acknowledgement

**Seat:** Claude Code (Seat 3) · **Filed:** 2026-08-05
**Against:** `DISPATCH_CLAUDECODE_R6_COURSE_SYNTHESIS` (dated 2026-08-06),
`..._BNROSE_ADDENDUM_R7` and `..._BDOMAIN_ADDENDUM_R8` (both dated 2026-08-07).

**Date discrepancy, flagged not resolved:** all three dispatches are dated ahead of the
filing date. Precedence ordering depends on those dates. Escalating rather than assuming
a typo.

---

## §1 — R6 course changes A–F

| | verdict |
|---|---|
| **A · bLOVErAi chassis (rig-core), 4-tier persistence, `context_path` = Tier 2** | **ACKNOWLEDGED — no code/spec impact on my surface.** I hold no bLOVErAi surface. `context_path` is not in any file I have touched. Noted that Tier 2 is "encrypted append-only log to Autonomi (+ Arweave mirror)" — see §3 COLLISION-1, which bears on it. |
| **B · Agent-class split (bLOVErAi / buzz·zBuZz / Beehive 10Ve)** | **ACKNOWLEDGED — no code/spec impact.** No document I have written conflates the three. |
| **C · Onboarding tiers (BYO key / local-only / guest)** | **IMPACTS: `docs/bdid-onboarding-design.md`, `docs/bdid-onboarding-inventory.md`.** Both were written against a different tiering (Class A/B/C rails by who-must-act-first, not by hosted-key posture). They do not contradict C, but they do not express it either. No change applied — outside §1 scope, awaiting dispatch. |
| **D · Zano HF6, deadline-bearing** | **IMPACTS: the Trezor firmware Zano lane.** Full sweep in §2. |
| **E · Messaging (Matrix LEAVE, Zano alias-as-login MODEL)** | **ACKNOWLEDGED — no impact.** |
| **F · Voice seat** | **ACKNOWLEDGED — no impact.** |

## §2 — Zano HF6 sweep (R6 §2-D), AFFECTED vs CLEAN

Swept: `crypto/zano/*`, `core/embed/rust/src/crypto/zano*.rs`, the MicroPython seam, and
every Zano claim in my committed docs.

| item | verdict | basis |
|---|---|---|
| **CLSAG_GGX signature scheme** (`zano_generate_clsag_ggx`) | **CLEAN** | R6 §2-D states the signature scheme (d/v-CLSAG) is **unchanged** at HF6. |
| **Key derivation** (`dependent_key` = `cn_fast_hash` + `sc_reduce32`; `S = s·G`, `V = v·G`) | **CLEAN** | R6 §2-D states key derivation is **unchanged**. |
| **Address encoding** (`zano_address.c`, prefix `0xc5`, 97-char form) | **CLEAN — pending** | Not named as changing. Address format is not a tx-serialization concern. Flagged for file-level confirmation. |
| **Transaction serialization for signing** | **AFFECTED** | R6 §2-D: "new crypto-serialization tx format (one-time resync; **anything parsing raw tx objects must update**)." Firmware that constructs or hashes a tx for signing is parsing raw tx objects by definition. |
| **`txin_gateway` / `tx_out_gateway`** | **AFFECTED** | R6 §2-D: "must be recognized even if never signed." Firmware that hard-refuses unknown input/output variants will refuse valid post-HF6 transactions. |
| **Per-output payment IDs (`subtransfers_by_pid`)** | **AFFECTED (spec-level)** | Changes what a confirmation screen must display per output. |
| **Gateway RPC → `MAP_JON_RPC`, `status_error`** | **CLEAN** | No firmware surface. |
| **SDK → SIWX secure-signing** | **UNVERIFIED** | Cannot determine from the dispatch whether this constrains the device proto contract. Escalating rather than assuming. |
| **WZANO legacy / Bridgeless pilot-only** | **CLEAN** | No firmware surface. |
| **`docs/bdid-onboarding-design.md` Zano row** (fee floor 0.01 ZANO, stranded-dust trap, no activation requirement) | **CLEAN — pending re-verify** | Fee constants are not named as changing, but that claim carries no file-level citation and is therefore **UNVERIFIED** under §0.5. |

**Not modified.** Per R6 §2-D: the Trezor lane's ruled decisions (derivation paths, proto
structures, CLSAG round counts) are untouched. The three AFFECTED rows are reported, not
acted on.

**Deadline:** block 3,833,000, expected 2026-08-25 → 08-27; node/wallet **v2.2.1.505**
required beforehand. Twenty to twenty-two days from this filing.

## §3 — Collisions, escalated by name, not resolved

**COLLISION-1 · R8 Layer-1 "Autonomi pointer at derived address" vs measured Autonomi 2.0.**
R8 ruled: `name → H(name) → Autonomi pointer at derived address → signed bDiD record`.
`docs/storage-substrate-split.md` measured, against primary sources: **Autonomi 2.0
(relaunched 2026-04-07) is immutable content-addressed chunk storage only.** `Pointer`,
`Scratchpad`, `Register` and `GraphEntry` existed in `maidsafe/autonomi` 0.10.2, **archived
2026-05-22**; live `ant-core` 0.5.1 (published 2026-07-29) exposes no mutable record type,
and the Autonomi docs state verbatim: *"This is why Autonomi is immutable rather than
update-in-place."*

A record that must be **updated** (an address changes) cannot be an Autonomi pointer as the
word is used in the archived generation. Immutable-versioned-plus-highest-valid-revision is
buildable; a mutable pointer is not. **This bears on R6 §2-A Tier 2 as well.** Escalating —
this is a ruled shape meeting a measured platform change, and it is not mine to resolve.

**COLLISION-2 · Security-language ceiling (§0.4) vs my committed docs.**
Fifteen docs committed at `77bb420`, `4c6eabc`, `df197de` predate my receipt of this ceiling
and use language plausibly stronger than "sound by construction / isolated by design" —
including *unforgeable*, *cannot be conjured*, *structurally impossible*, *cannot be
weaponized*. No audit has been run. Flagging the exposure; awaiting a dispatch before
editing committed text.

**COLLISION-3 · R8 "adapter transfer or loss can NEVER rebind a Layer-0 keypair" vs the
deployed `.b` contract.** `b-domain/contract/bdomain.cpp:108-117` — `transfer` moves a
domain and then **erases every `chainaddrs` row** for it. That is adapter-layer behaviour
and is consistent with the invariant as I read it, but the invariant is stated about
Layer-0 keypairs and the deployed contract has no Layer-0 concept at all. Reporting the gap
rather than asserting compliance.

## §4 — Attestation

No `Signed-off-by` emitted (§0.6). Credit via `Co-authored-by` on commits. ORDERS-1 v0.8
treated as not in force. Nothing pushed, signed, or ratified on the basis of these dispatches.
