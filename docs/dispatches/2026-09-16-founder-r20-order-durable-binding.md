# FOUNDER R20 ORDER — durable authorization binding + real lifecycle trace (lane owner executes) · 2026-09-16

**From:** the founder, relayed by Workerb 2 (docs-only; one-writer honored —
this seat writes no lane code). **To:** the `codex/z2b-bpay-rail` lane
owner. **RV/DG remain FROZEN.** R20 is required first.

## The order (verbatim, with the founder's three classifications resolved)

> **R20 — DURABLE AUTHORIZATION BINDING + REAL LIFECYCLE TRACE. RED
> first. RV/DG remain frozen.**
>
> Extend the existing R19 objects; do not invent a second capability
> system.
>
> Persist, durably:
> - exact signed authorization bytes;
> - signature;
> - per-leg `LegBinding`;
> - exact bound `CapabilityManifest` snapshot;
> - manifest content hash;
> - implementation identity;
> - schema/domain identifier required to interpret the signed bytes.
>
> Reopen from a **fresh file-backed journal instance**. No `clone()`, no
> shared in-memory object, no reconstruction from the currently running
> adapter.
>
> On reopen, verify:
> 1. stored signed bytes verify;
> 2. stored manifest canonical hash equals the signed binding;
> 3. implementation identity equals the signed binding;
> 4. deterministic reserialization, where supported, equals the
>    historical signed bytes — but disagreement is corruption/refusal,
>    never replacement of the historical bytes.
>
> Add torn/corrupt controls: truncated authorization, modified manifest
> snapshot, signature mutation, binding mutation, missing snapshot, valid
> snapshot paired with another leg's authorization. Every case fails
> closed before execution.
>
> **Wire the binding into the real `RailLedger` lifecycle.**
>
> Required golden test, as ONE uninterrupted scenario:
>
> **H1 manifest → sign authorization → open real leg → transition real
> ledger to UNKNOWN → persist/drop process objects → live adapter becomes
> H2 → fresh journal/ledger reopen → H2-only evidence refused under H1 →
> H1-valid evidence resolves the same payment identity to Settled →
> create a genuinely new authorization → new leg lawfully binds H2.**
>
> Assert throughout: same `PaymentHash`; no auto-retry; no fresh
> authorization created during recovery; H1 bytes/hash remain
> byte-identical after restart; H2 never contaminates the historical
> record.
>
> **Signing boundary:** route creation and verification through the
> actual production authorization organ. If that is bsigner, use bsigner.
> If architecture says otherwise, name and prove the production boundary
> rather than silently substituting another shipped crypto primitive.
>
> Same final SHA for default/live configuration; full NIP-44 vectors
> remain green; live sends OFF; no deployment.
>
> **STOP after R20. Do not implement RV or DG.**

## The founder's resolved classifications (binding on R20)

1. **"Real bsigner path" — the verifier was right.** k256/BIP-340 is
   real cryptography and avoids a toy verifier, but does **not** satisfy
   a requirement phrased "through bsigner." The architectural
   requirement: **one production authorization-verification boundary
   used by the payment organ** — no parallel crypto implementation
   created for capability tests. If bsigner is that boundary, R20
   integrates there. If the architecture intentionally uses the NWC
   BIP-340 path as that boundary for these authorizations, document that
   explicitly AND RENAME the requirement. **Never claim bsigner merely
   because the primitive is shared.**
2. **Durability is explicit:** persist the **exact signed authorization
   bytes plus the manifest snapshot they commit to**. Deterministic
   reconstruction may run as a CONSISTENCY CHECK — never as the
   historical source. A future serializer/canonicalizer change must not
   be able to reconstruct different bytes and silently change what we
   think was authorized.
3. **Domain separation inside the historical signed object** (R19-exposed
   addition): something equivalent to
   `beehive/bpay/leg-authorization/v1` committed in the signed preimage.
   Schema version alone is insufficient if another estate object can
   serialize into compatible bytes.
