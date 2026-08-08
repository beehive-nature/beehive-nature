# DISPATCH — b-DOMAIN ADDENDUM FOR THE 10B WORKSTREAM (R8)
**From:** Founder (LOViS) via research seat (Fable) · **To:** Claude Code
**Date:** 2026-08-07 · **Scope:** One page. Fold the ruled frozen-kernel shape into the in-flight 10-billion-scale b-domain workstream. Specs only — no implementation code. Mark anything uncited UNVERIFIED. Security-language ceiling: "sound by construction / isolated by design."

**STATUS NOTE (2026-08-07, post-delivery):** Verification Task 1 is COMPLETE — Code's RAM receipt landed at commit 8840740 (31.34 TiB vs 390.17 GiB, 82.3×, Layer-2 capacity 12.7M–22.1M). A1 RULED 2026-08-07 (founder word "A1 go"): the Layer-1 wording is AMENDED per A1_LAYER1_AMENDMENT_2026-08-07.md in this mailbox — frozen SELECTION rule over immutable, owner-signed, monotonically-versioned records. The hold is LIFTED; execute against the amended wording.

---

## RULED SHAPE (founder-confirmed — do not re-litigate)

**b-domain is NOT a new naming chain.** It is a FROZEN KERNEL + adapters:

- **Layer 0 — bDiD keypair (scales to 10^10, free):** existence = a locally generated keypair. Zero network writes, zero cost, no global consensus required to be born. Owner attestation binds agent keypairs to human keypairs. This is the only layer that arithmetically reaches 10 billion.
- **Layer 1 — the frozen resolution kernel:** one deterministic, never-changing rule: `name → H(name) → deterministically derived Autonomi address → append-only set of immutable, owner-signed, monotonically-versioned records → resolver selects the highest-valid-revision record (valid = owner signature verifies; ties broken by content-hash order)`. Resolution = content-addressed lookup; pay-once; no per-lookup consensus. The kernel freezes the derivation + selection function, not a mutable slot; nothing is overwritten, history is the record. [AMENDED per A1_LAYER1_AMENDMENT_2026-08-07.md — ruled "A1 go"]
- **Layer 2 — anchor ADAPTERS (millions, not billions):** Vaulta account names, Zano aliases, DNS, ATProto handles, ENS et al. plug in as premium, scarce, human-readable attestation sources. **Invariant: adapter transfer or loss can NEVER rebind a Layer-0 keypair.** Chains are demoted from registry to adapter.

## VERIFICATION TASK 1 — VAULTA RAM RECEIPT [COMPLETE — commit 8840740; retained for the record]

File a receipt, with sources, for:
1. Current total Vaulta RAM supply (GB) and the current RAM market price.
2. Bytes consumed by a `newaccount` (research-seat working figure: ~3 KB — verify).
3. Computed maximum feasible native accounts at current supply, and the gap vs 10^10.
4. Secondary receipt: Zano alias ceiling — lifetime chain tx count and block cadence vs 10^10 registrations.

Where sources conflict, file both and mark UNVERIFIED. The receipt caps Layer-2 sizing assumptions permanently.
**Result on record:** 31.34 TiB needed vs 390.17 GiB supply — 82.3× (142.8× with .b rows); binding constraint = SUPPLY, not cost; Layer-2 capacity 12.7M–22.1M accounts.

## ACCEPTANCE CRITERIA
- Kernel spec fits on one page and is marked FROZEN; any future change requires a BNRoSe-6 DAO ratification.
- Two independent resolver implementations, given the same name, derive the identical Autonomi address (spec-level test vector table included).
- Layer-0 identity creation demonstrably requires zero network writes.
- RAM/alias receipts filed with sources before any Layer-2 design lands. [RAM receipt: DONE]
- COURSE_SYNC receipt per item.

## SCOPE FENCE
Only the above. No new naming systems, no additional layers, no implementations. Anything beyond this addendum: **That is out of scope. Execute the prompt as written.**
