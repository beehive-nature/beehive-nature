# DOCKET M-2 — the commons-first mastery ledger

**Status:** SPEC (design). Skeleton crate (`crates/mastery-ledger`) follows on GO.
**Repo:** beehive-nature/beehive-nature (the kernel) — drafted against `main` @ `c8658b9`.
**Wall:** governance/economics ONLY, and it clears k001 **by construction** — see §6.
**Design source:** `MASTERY_LEDGER_commons_first_spec.md` + `OPERANT_REWARD_v2` (Drive,
owner loviswater44@gmail.com, 2026-07-17) — cited, not vendored.
**Ratification:** the b-engine mint stays gated on §5/§1 (unratified). A mastery event
just *exists*; nothing mints. So this is safe to build — and even to publish — ahead of
the reward ruling.

---

## 1. The one claim it makes real

> **"The ledger, not the LMS, is the source of truth."**

Canvas — or any school — becomes replaceable furniture the moment the permanent record
of *who proved what* lives outside it. This docket defines that record: a signed,
DID-bound, consent-carrying mastery event, and the read-seam by which the b-engine
observes it. The LMS drops to *one writer among many*; the ledger is the spine.

## 2. The mastery event — the atom

```
struct MasteryEvent {
    event_id:    Hash,          // content-addressed: sha256(canonical body). Identity.
    subject:     Did,           // a PoUL thread — never an account, never a name
    quest_id:    QuestId,       // which comprehension, from the quest catalog
    quest_hash:  Hash,          // pins the EXACT quest version proven (tamper-evident)
    outcome:     Outcome,       // Passed | Failed — binary; the mint reads only Passed
    attested_by: Vec<Did>,      // peer verifier PoUL threads (the edge; see §4)
    consent:     ConsentRef,    // machine-readable, revocable; required or no event (§3)
    recorded_at: Timestamp,
    signature:   Ed25519Sig,    // over the canonical body (reuse capability's verifier)
}
```

`quest_id`/`quest_hash` **reference** the lesson; the event stores no lesson content and
no health datum — only *this thread proved comprehension of quest X, version H, at time
T*. That referential-not-substantive shape is the wall (§6).

## 3. Invariants — structural, fail-closed (the house pattern)

- **Consent required or no event.** A `MasteryEvent` with no valid, unrevoked
  `ConsentRef` **does not serialize** — enforced in the constructor/serializer, not by a
  caller remembering to check. Same structural gate as `health-vault`'s absent-PII field.
- **Subject is `Did` only** (reuse `capability::Did`). No account, no name field *exists*
  in the type — re-identification is impossible from the record, not merely discouraged.
- **The event records; the engine decides.** A `MasteryEvent` is a *record*, never a
  mint. The b-engine reads `Passed` events and applies `Respect × attestation ×
  QuestWeight × EdgeFactor`, with **420/PoUL/velocity enforced at the ledger — never in
  the event, never in the reader.** Byte-for-byte the `adapter-lti` separation.
- **Edge = distinct PoUL threads.** `attested_by` raises EdgeFactor only for verifiers
  resolving to threads *distinct* from `subject`; an alias ring yields nothing.
- **Tamper-evident by content-addressing.** `event_id = sha256(canonical body)`;
  `quest_hash` pins the version. Editing the record changes its identity — the
  un-suppressible property, applied to learning.

## 4. Attestation vs. consent — the trust model, made explicit

*(This is the first thing I flagged reading the spec, because it decides whether the
ledger can be gamed.)* The `signature` is **the subject's** — so on its own it proves
*ownership and consent*, **not that the subject legitimately passed**. A self-signed
`Passed` is a self-assertion. That is not a flaw to hide; it is a trust gradient to
state:

- **Self-attested** (`attested_by` empty) — lowest confidence. The record exists and is
  owned, but no independent party vouches. The b-engine weights it accordingly.
- **Authority-attested** — a grading authority (a Canvas platform via the `adapter-lti`
  `JwtVerifier`, or an M-3 static quest engine signing its own result) co-signs that the
  comprehension check was actually passed. This is where the ledger meets C-6: the LTI
  admission *is* the authority attestation, and its output becomes a ledger write.
- **Peer-attested** — `attested_by` carries distinct PoUL threads; the strongest, and the
  edge bonus.

So passage-trust comes from **attestation, weighted by the engine**, not from trusting a
lone signature. The ledger stores all three honestly; the confidence lives in the read,
never in a gate that silently drops the weak ones.

## 5. Storage seam — adapter doctrine, substrate-agnostic

```
trait MasteryLedger {
    fn append(&self, e: &MasteryEvent) -> Result<Hash, LedgerError>;  // returns event_id
    fn events_for(&self, s: &Did)     -> Result<Vec<MasteryEvent>, LedgerError>;
    fn since(&self, t: Timestamp)     -> Result<Vec<MasteryEvent>, LedgerError>;  // engine read-path
}
```

- **v1:** `MockLedger` (in-memory, fixtures) — mock-first, no network in tests.
- **L2:** append to the commons. *(Second thing I flagged:)* this is exactly what the
  existing **`adapter-arweave`** is for — it anchors **event-bundle Merkle roots**, which
  is the wrong tool for M-1's static files but the *right* tool here. Mastery events are
  `CanonicalEvent`s; bundle them and anchor the root via `adapter-arweave`. The tool
  finally meets its use case. (Autonomi-private if the founder later wants event privacy;
  the events carry no PHI, no content, no identity, so Arweave-public is safe.)
- **Read/write separation is the security boundary.** The b-engine's read-path is
  `since()` — it observes `Passed` events and mints; it never writes. A reader that cannot
  write cannot forge the history it mints from.

## 6. Wall-clean by construction (k001, and ruling-3's framing)

The wall here is **legal armor, designed against a capture vector — it alleges no one**
(founder ruling, 2026-07-17). The vector it closes: a competency ledger that stored
*lesson content* or a *health datum* would drag health material under the kernel's name.
This type cannot, because it holds only references (`quest_id`, `quest_hash`) and a binary
`outcome`. A mastery ledger for a hemp-nutrition course and a welding course are
byte-identical. That structural identity is the armor: there is no field in which a health
claim could be stored even by a future careless writer.

## 7. Crate & tests

- `crates/mastery-ledger` — pure types + trait + `MockLedger`, sibling of `capability`.
  `#![forbid(unsafe_code)]`, edition 2021, depends on `capability` (`Did` + the Ed25519
  verifier). No health field, by §6.
- Red-then-green fixtures: a signed `Passed` event; a revoked-consent event (must not
  serialize); a self-attested edge (EdgeFactor neutral, no bonus); a distinct-thread edge
  (bonus applies).
- `#[ignore]`d: a real commons append/retrieve round-trip — green when the L2 impl (via
  `adapter-arweave`) lands. The concrete dependency; mock until then.
- Commit per kernel conventions (author/no-sign-off per receipts, secret-scan gates).

## 8. Why it unblocks the decentralized MVP

- Makes the record **permanent and portable before any LMS exists** — M-3's static quest
  engine writes to it; M-4's Canvas, if ever, also just writes to it.
- Nothing mints until §5/§1 ratify — the event merely exists; the engine's mint stays
  gated. Safe to build, and (being category-clean) safe to publish, ahead of the reward.
- The 1,000-year property lands here concretely: a learner's proof of understanding
  outlives every server, school, and seat. That is the point.

## 9. Open edges (parked, not hidden)

- **Two `MasteryEvent` types.** *(Third flag:)* `adapter-lti` already defines a
  `MasteryEvent` — the transient, writer-side parse of an LTI payload — and this docket
  defines another: the canonical, signed *ledger record*. Same name, different roles
  (input vs. record). At integration they must be reconciled to avoid a K-D1-style
  type-fork — likely `adapter_lti::MasteryEvent` (input) → `mastery_ledger::MasteryEvent`
  (record) via an explicit write step. Named here so the collision isn't discovered late.
- **`ConsentRef` shape** — what a machine-readable, revocable consent object *is*
  (a DID-signed grant with a revocation check) is DATA_COMMONS territory; referenced here,
  specced there.
- **`QuestId`/quest catalog** — who curates the catalog and how `quest_hash` is published
  so a verifier can reproduce it, is an M-3 concern.
- **Attestation-confidence weights** — how the engine scores self/authority/peer (§4) is
  §5-adjacent policy data, gated like `QuestParams`.

---

*Governance/economics only. No health content, no claim, no PHI. This records that
comprehension occurred, never what was comprehended.*
