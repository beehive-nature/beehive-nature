# A1 — LAYER-1 AMENDMENT (RULED)
**Authority:** Seat 0 (King Bee), explicit word "A1 go", 2026-08-07 — transcribed by the research seat (courier). This amends ruled spec text; the founder's word is the ruling.
**Applies to:** R8 (b-domain) Layer-1 AND R6 §2-A Tier 2 (same collision).
**Reason on record:** Autonomi 2.0 removed mutable record types (Pointer/Scratchpad/Register/GraphEntry gone with maidsafe/autonomi 0.10.2, archived 2026-05-22 — Code's receipt). A mutable pointer is not buildable; a frozen selection rule over immutable records is.

## AMENDED LAYER-1 WORDING (supersedes the held "Autonomi pointer" text):

> `name → H(name) → deterministically derived Autonomi address → append-only set of immutable, owner-signed, monotonically-versioned records → resolver selects the highest-valid-revision record (valid = owner signature verifies; ties broken by content-hash order).`
> The kernel freezes the **derivation + selection function**, not a mutable slot. Nothing is overwritten; history is the record.

**Rollback/staleness note (in-spec):** a replayed old revision cannot win against a higher one; the per-epoch Vaulta checkpoint (BNRoSe-2) anchors the latest-known revision as the staleness backstop.

## ACCEPTANCE
- R8 kernel spec carries the amended wording verbatim and remains one page, marked FROZEN.
- The spec-level test-vector table includes at least one multi-revision case: highest-valid wins; a replayed lower revision loses; an invalid-signature revision at any height is ignored.
- R6 §2-A Tier 2 updated to the same record model. COURSE_SYNC receipt per file.

## SCOPE FENCE
Only the wording amendment above. **That is out of scope. Execute the prompt as written.**
