# BIND-1 — The Kernel Seam

Status: **APPROVED — v0.1, 2026-07-11.** All founder gates closed: K-3 through K-7 ruled step-by-step, §10 residuals G-1 and G-2 closed the same day. This document is frozen at its landed sha: any change to these bytes requires a version bump and a re-gate; it does not inherit this approval.
Resolves `SPEC-performance-set` §7.5, which carried the question open behind constraints K-1 and K-2. Companion to `CONSTITUTION.md`, which it does not amend; the seven primitives bind unchanged.

---

## 0. What this document binds

The boundary where the skaists social layer (ATProto: signed repos, records, the firehose) meets the Beehive Nature Reserve Kernel (the event bus, the seven primitives). Everything that ever moves from one to the other moves through the rules below, and nothing else does.

The question §7.5 refused to answer casually: *whether a `set` becomes a `CanonicalEventV1` — and if so, whether it is an Event or an Evidence.* The seven primitives are a constitutional interface. This document answers at that level or not at all.

---

## 1. The constitutional answer

An Event is *"a completed action producing an immutable, replayable fact."* The kernel can replay the **record**, never the **gig**. What the sense adapter witnesses is a **publication**: a signed record appeared at an at-uri, with a cid, at a time, from a DID. That is the occurrence. The record's **content** — "I performed this set at this venue" — is a **claim about the world**, and the constitution's word for claims is Evidence: provenance-stamped, confidence computed *from provenance, never by popularity or authority*.

This extends Article III's existing ruling — AI outputs are *"Evidence with provenance `AIInference` — never truth, never authority"* — to human self-attestation. The same ruling dissolves an apparent tension elsewhere in the canon: F-V1's *"every statement a ledgered Event"* and Article III were never in conflict. The publication is the Event; the content's epistemic class is Evidence.

---

## 2. The fence, inherited

**K-1 — `CanonicalEventV1` never carries media, on any path.** The Event carries references and digests, never bodies. *(Recorded at §7.5's carry; binds here by construction — see K-3.)*

**K-2 — `setStatus` never enters the kernel.** Absolute. Not even the publication-Event. Status is state; sets are attestations; only attestations may be promoted (`STATUS-1`).

---

## 3. Invariants — the five rulings

**K-3 — Claims cross as Evidence; completed protocol actions cross as Events; an attestation is always the former, carried by the latter.**
The sense adapter's Event records what the kernel witnessed — publication only: at-uri, cid, digest, DID, timestamp — never the body (K-1). The claim within crosses as Evidence, provenance-classed, confidence computed from provenance. A self-claim never becomes occurrence.

**K-4 — Promotion is allowlisted and predicate-gated.**
Commit-signature verified; bytes re-hashed against the pinned cid at ingest; schema-valid under the product validator, whose digest joins the Evidence provenance; type on the allowlist. Unlisted or invalid publications do not cross. Every allowlist addition is a founder gate — the ingest mirror of Q-8: *a new register of speech gates outward; a new class of reality gates inward.* The bus is the kernel's curated intake of reality, never a mirror of the firehose's noise.

**K-5 — The seam has its own eyes.**
Content integrity is absolute at ingest: nothing forged crosses the predicate. Completeness and identity are *graded*. A single relay subscription yields informational-grade crossings only. Settlement-critical Evidence requires independent confirmation — N-of-M sources with disjoint infrastructure, or the adapter's own direct read-back from the owning PDS: `IndependentSocialView`, the type-boundary sibling of R-004's `IndependentChainView`. DID resolution verifies the signed PLC operation log across at least two independent views, never the current document alone; and no Evidence reaches settlement grade from a DID whose `did:plc ↔ did:autonomi` binding is not bidirectionally verified. Single-source social evidence informs; it never triggers. Asking one oracle twice is not independence.

**K-6 — The fifth reality speaks the old tongue.**
`SourceChain` gains `AtProto`; `source_ref` is the at-uri with its pinned cid; `canonicalized_by` names the sense adapter; `EventType` gains the census's variants additively — the interface versions by addition, never mutation. `Evidence` is promoted from dispute-local to `shared-types` as the general primitive, extended at the seam with `subject_did`, `source_ref`, `validator_digest`, and `view_grade`; dispute-engine's `favors` becomes a domain wrapper. `Provenance` gains `SignedSelfAttestation` for cid-pinned, commit-signed, validator-green human claims — `UserClaim` remains the word for unsigned assertion — and machine publications reuse `AiInference` exactly as Article III pre-wired it. Evidence rides in the Event payload on the one bus; its base weights are policy, revisable, never doctrine.

**K-7 — The seam never unremembers.**
*Idempotence by construction:* `event_id` derives deterministically from `(source_chain, source_ref)` — the same publication witnessed twice, by replay, backfill, or a second source, collapses to one Event; re-witnessing **raises `view_grade`**, never duplicates. *Deletion crosses as information, never as erasure:* a post-ingest deletion emits a `SocialRecordRetracted` Event referencing the original; the original Event and its Evidence stand immutable — retraction informs confidence downstream, removes nothing, and deletions of never-crossed records emit nothing at all. *Supersession lands in Knowledge, keyed by reference, never by clock:* a superseding record crosses as its own Event+Evidence carrying the predecessor ref; version chains link correctly even when the predecessor arrives late. *Two times, held apart:* the Event's `timestamp` is witness time — when the adapter verified the crossing; any time the record claims is content, an Evidence-grade claim like every other. A backfilled January record witnessed in July is a July Event about a January claim; forged timestamps never touch bus ordering. *Verification is historical:* signatures verify against the PLC op-log state at commit time, so P-6 rotation never invalidates an honestly-signed past. *Gaps are confessed:* a cursor gap lowers the window's completeness grade; the adapter never pretends a continuity it didn't witness.

---

## 4. The census — allowlist v1

| Source | Crosses as | Ground |
|---|---|---|
| `social.skaists.alpha.performance.set` (valid, signed, cid-pinned) | Event (publication) + Evidence (`SignedSelfAttestation`) | K-3, K-4 |
| `social.skaists.alpha.performance.setStatus` | **nothing, ever** | K-2, absolute |
| Circle outcomes (when their lexicon lands) | **Event** — a completed protocol action, replayable from signed meeting artifacts | Respect → emission path |
| Emission mints | **Event** (Settlement-class) | GOV-3's one-way bridge, mechanized |
| bQueenBee's Q-6 audit publications | Event (publication) + Evidence (`AiInference` — informational floor, never auto-enforce) | F-V1 + Article III via K-3 |
| `fm.teal.*`, `community.lexicon.calendar.*`, all else | **default-deny** — addable only through the founder gate | K-4 |

---

## 5. The predicate, operationalized

A publication crosses if and only if, in order:

1. **Commit signature verifies** against the DID's signing key chain — the repo commit, not merely transport. The seam trusts cryptography, never TLS.
2. **Bytes re-hash to the pinned cid** on the adapter's side of the wire. *Hash at the source before transport*, enforced at the constitutional boundary.
3. **The product validator passes** — `lovernment_core::performance::validate_set` and siblings — and the **validator's digest is recorded in the Evidence provenance.** The organ born red on 2026-07-11 is load-bearing here.
4. **The type is on the allowlist** (§4). Default-deny.

Failure at any step: the publication does not cross, and nothing is fabricated in its place.

---

## 6. Trust grades

| Grade | Requires | May |
|---|---|---|
| **Informational** | predicate pass, single source | inform Knowledge, Reputation inputs |
| **Confirmed** | predicate pass + independent re-witness (second disjoint source **or** direct PDS read-back via `IndependentSocialView`) | everything above, plus feed non-settlement automation |
| **Settlement** | Confirmed + DID's PLC op-log verified across ≥2 independent views + bidirectional `did:plc ↔ did:autonomi` binding verified | participate in money-adjacent computation — and even then, per R-004, never as a lone trigger |

Grades are recorded in `view_grade` and only ever rise (K-7).

---

## 7. Mapping — the schema deltas

**`SourceChain`**: `+ AtProto`.
**`source_ref` convention**: `at://<did>/<collection>/<rkey>#<cid>`.
**`canonicalized_by`**: `"sense-atproto"`.
**`EventType`**, additive, `#[non_exhaustive]` discipline going forward: `PerformanceSetPublished`, `SocialRecordRetracted`, `CircleConcluded`, `EmissionMinted`, `AgentPublicationLogged`.
**`Evidence`** promotes to `shared-types` as the general primitive: `provenance, confidence, signed, verified, payload_hash` + seam extensions `subject_did, source_ref, validator_digest, view_grade`. Dispute-engine wraps it, restoring `favors` as domain flavor.
**`Provenance`**: `+ SignedSelfAttestation` (base weight: §10 G-1). `AiInference` reused unchanged.

---

## 8. What the adapter owes

The `sense-atproto` adapter is a kernel-side crate under full OR law: product code, red-first, its negative suite proving that forged commits, mismatched cids, invalid records, unlisted types, and instruction-shaped text inside record string fields all fail to cross — *signed proves provenance, never benignity* (Q-8's lesson, at ingest). `normalize()` stays pure: same inputs, same Events, so the b-indexer remains a rebuildable derived view.

---

## 9. The cost of this design, stated once, without softening

**The kernel is deliberately blind to invalid reality.** Spam waves, malformed-record abuse, harassment campaigns conducted in records that fail the predicate — none of it crosses, so none of it is kernel-visible. That observability lives at the social layer or nowhere. This is the price of a bus that is not an archive of noise.

**Settlement grade has an adoption gate.** A performer without a `did:autonomi` binding caps at informational-and-confirmed forever. Early users feel that as friction. The alternative — settlement-grade identity resting on `plc.directory` alone — is a single oracle under someone else's roof, and this document chooses friction.

**Retractions can be noisy.** An account mass-deleting emits a retraction per crossed record. Rate and aggregation of retraction Events are adapter policy, tunable; the immutability of what they reference is not.

---

## 10. Founder gates — closed 2026-07-11

**G-1 — `SignedSelfAttestation` base weight. CLOSED — 0.55.**
Ruled at **0.55** — below `AiInference` (0.60), well above `UserClaim` (0.30). Reasoning: cryptography proves *who said it and that it hasn't changed*, never *that it is true*; a self-interested claim discounts below disinterested machine inference, while cid-pinning and validation lift it far above bare assertion. The modifiers (`signed`, `verified`, `view_grade`) raise it contextually from there. The float is policy: revisable at the dispute-engine's review tier, never doctrine.

**G-2 — K-5's N-of-M, initial deployment values. CLOSED — 2-of-3.**
Ruled at **2-of-3** — the owning PDS direct read-back plus two relay subscriptions with disjoint infrastructure, any two agreeing. Deployment-contract class, exactly as R-004's node-disjointness is: recorded beside the doctrine, tuned without re-gating it.

---

## 11. Next actions — docket seeds

1. `shared-types`: promote `Evidence` to the general primitive; dispute-engine wrapper restores `favors`. One file, red-first against existing dispute tests.
2. `shared-types`: `EventType` additive variants + `SourceChain::AtProto`, `#[non_exhaustive]` discipline.
3. `sense-atproto` crate skeleton: predicate harness with the negative suite of §8.
4. `IndependentSocialView` type boundary, mirroring the `dro-signer` C5 pattern.
5. Retraction wiring: `SocialRecordRetracted` emission + idempotent `event_id` derivation, property-tested for replay collapse.

Each is one-file-one-docket shaped, volume-meter drafted, Seat-3 merged, per ORDERS-1.
