# WORKERB2 — R19 verification + the zArcheology return report · 2026-09-16

**Seat:** Workerb 2. **Mission:** R19 (signed capability/version binding,
RED first) — **landed by the lane owner** (`69c55be6`) while this seat
stood down per the one-writer rule. This seat's role reverted to its
founding craft: **independent verification** + the founder-mandated
return report ("R19 should report which assumptions were right, wrong, or
underspecified back to zArcheology; that report is its return trigger").

**Independent reproduction:** this seat ran both configurations at the
owner's tip — default 112 / live-nwc 115 (1 ignored), all 9
capability-binding probes green, clippy 0, fmt clean, live sends OFF,
RV/DG untouched. The verification below reads the landed source directly.

---

## Verification verdict

**GREEN at the unit level — 8/8 founder attacks + positive control:**
same-version/different-content (hash ≠ label) · strip-binding breaks the
signature · LN/EVM leg swap · upgrade-during-Unknown governed by the
BOUND manifest · evidence-inheritance refused (RB-2 named) ·
crash/restart binding-preservation · replacement cannot inherit the
newer manifest · mixed old/new legs stay distinct. The hash-is-the-
authority design is clean: the version string is deliberately excluded
from the canonical hash input, and `implementation_id` rides BOTH the
manifest canonical bytes and the leg binding — "same declared
capabilities, different implementation" cannot masquerade as unchanged
authority. The journal-preserves-never-creates law is enforced as a
lookup refusal (AB-2: no snapshot → refuse, never reconstruct).

**TWO FOUNDER-SPECIFIED RECEIPTS ARE INCOMPLETE:**

1. **No serialization, no durability.** `capability.rs` contains zero
   serde derives and zero filesystem code; the "crash/restart" attack
   clones the in-memory `JournalAuthRecord`. The founder's threshold —
   *"if that survives serialization and signature verification, we've
   crossed an important threshold"* — **has not been crossed**. Nothing
   has yet crossed a process or disk boundary.
2. **The single golden trace does not exist as one test.** The binding
   module touches `RailLedger`/`LifecycleState` **zero times** — it is a
   standalone island, not wired into the pay path; "during Unknown" in
   the attack names is not a ledger state the tests create. The required
   end-to-end trace (H1 signed → opened → Unknown → crash → adapter
   becomes H2 → reopen → H2-only evidence refused → H1-valid evidence
   accepted → Settled → new authorization binds H2) exists only as
   scattered unit pieces.

---

## The zArcheology return report (the return trigger)

### RIGHT — assumptions validated by implementation

1. **Hash-carries-authority is the correct data design.** Excluding the
   version string from the hash input and proving same-version
   substitution caught (attack 2) settles it: the hash, not the label,
   is the authority boundary.
2. **Per-leg binding inside the signed bytes is sufficient and composable.**
   AB-0 (strip breaks signature) holds; mixed old/new legs remain
   naturally distinct because each leg carries its own hash (attack 8)
   — no homogenization mechanism needed refuting.
3. **Implementation identity belongs in the commitment** at BOTH levels
   (manifest canonical bytes + leg binding). Same-capabilities-different-
   implementation produces a different hash, as specified.
4. **Journal-preserves-never-creates is enforceable as a refusal** — the
   journal need not be trusted to reconstruct anything; absence of a
   snapshot is a hard refusal naming AB-2.
5. **The positive control composes** — historical H1 obligations and new
   H2 authorizations coexist without interference (RB-6), confirming the
   "historical facts attached to payments" shape is implementable.

### WRONG — assumption not as specified

1. **"Use the real bsigner/signature verification path."** The landed
   implementation uses **k256 BIP-340** — the NWC adapter's live event-
   signing machinery, explicitly "NOT a bespoke verifier." It is a real,
   shipped, exercised estate path — but it is **not bsigner** (whose
   surface is ML-DSA/ML-KEM + envelope + keys). **Ruling needed:** is the
   requirement (a) bsigner specifically (→ a re-signing migration slice),
   or (b) any already-shipped non-bespoke estate verification path (→
   k256 qualifies, and is arguably MORE real than wiring PQ signatures
   solely for this module)? This seat's verification finding: no defect
   either way — a spec-provenance ambiguity.

### UNDERSPECIFIED — implemented defensibly; ruling or next slice

1. **"Durable journal binding."** Landed as in-memory records;
   crash-modeled-by-clone. The spec never said "file-backed," but the
   founder's threshold sentence makes serialization the entire point of
   the receipt. Underspecified → next slice must make it literal.
2. **"Persist exactly what was signed."** The landed code recomputes
   canonical bytes deterministically at verify-time rather than storing
   the signed bytes verbatim. Equivalent TODAY (canonicalization is
   pure); the law's letter protects against future canonicalization
   changes silently altering what verifies — persisting the bytes is
   the stronger form.
3. **Ledger wiring.** The CD→MP→RB→AB specs were reconciled as a
   standalone module; the authorization path (NwcRail pay/resolve) does
   not yet consult it. Whether binding gates the pay path directly or
   wraps it was left open — the golden trace requires the wiring.

### NEXT SLICE (R20 candidate, from this report)

serde on the binding objects · file-backed journal with reopen-from-disk
round-trip · persist the signed canonical bytes verbatim · wire the
binding into the rail's open/resolve path (open requires a VERIFIED
authorization; Unknown-resolution validates evidence under the BOUND
manifest) · **the single golden trace test, verbatim as the founder
wrote it** · the bsigner-vs-k256 ruling applied. Stop before RV/DG
stands.

**No lane code was touched by this seat (one-writer). This report is the
return trigger.**
