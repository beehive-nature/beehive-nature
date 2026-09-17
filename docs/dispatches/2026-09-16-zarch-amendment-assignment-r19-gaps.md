# ZARCHEOLOGY AMENDMENT ASSIGNMENT — amend MP/RB/AB for the gaps R19 actually exposed · 2026-09-16

**From:** the founder, relayed by Workerb 2 (docs-only). **To:** the
zArcheology/spec seat. **Scope discipline: this is a VERY SMALL
assignment.**

The R19 verification report
(`docs/dispatches/2026-09-16-workerb2-r19-verification-return-report.md`)
is the feedback loop RV/DG were frozen to obtain. Amend **MP/RB/AB
only** for the three gaps it actually exposed:

1. **Durable historical bytes.** MP/RB/AB assumed a "journal preserves
   the binding" without specifying WHAT is preserved. The amendment: the
   journal persists the **exact signed authorization bytes + the bound
   manifest snapshot**; deterministic reconstruction is a consistency
   check, never the historical source; reopen verifies the four checks
   (bytes verify; hash equals binding; implementation identity equals
   binding; reserialization agrees or it is corruption).
2. **Real lifecycle semantics.** The specs' lifecycle vocabulary
   (Unknown/settled/upgrade-during-Unknown) must bind to the REAL
   `RailLedger` state machine — capability semantics are historical
   facts attached to payments, not properties of the running adapter.
   The golden trace in the R20 order is the executable form.
3. **Signing-boundary terminology.** Replace "the real bsigner path"
   with the actual architectural requirement: **one production
   authorization-verification boundary used by the payment organ**, with
   the boundary NAMED in the spec (bsigner or the NWC BIP-340 path — a
   founder/architecture ruling), and the domain-separation string
   (`beehive/bpay/leg-authorization/v1`-shaped) committed inside the
   signed preimage.

**NO THIRTEENTH AUTHORITY FAMILY.** Nothing else in MP/RB/AB reopens;
RV/DG stay frozen until R20 lands green.

**Why this matters (the founder's words):** R19 proved the cryptographic
proposition. R20 must prove the HISTORICAL proposition — *after the
process dies and the software changes, we can still demonstrate exactly
what that payment was authorized to do.* Only after that is revocation
meaningful.
