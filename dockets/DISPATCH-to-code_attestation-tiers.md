# DISPATCH → Claude Code — attestation tiers in the `capability` crate

**From:** research/design seat. **Status of this file:** written over the 9p
mount — **verify integrity before acting** (`grep -cP '\x00' <file>` = 0; tail
reads complete; brace-balance any Rust you take from it). Nothing from that
seat self-verifies; you are the oracle.

**Design source:** `TIERED_ACCESS_attestation_design.md` (outputs seat) — the
founder-approved ladder: evidence classes E1–E5 (+ E-bio modifier) → tiers
T1–T5 → capability ceilings. This dispatch is the code slice of it.

## Task — extend `crates/capability` (one commit)

Additive only; no existing API changes. Treat the sketch below as **intent** —
you own the real signatures/style, matching the crate's existing conventions
(`#![forbid(unsafe_code)]`, no `todo!()` in shipped paths, unbuilt
platform-verification behind traits).

1. **`EvidenceClass`** enum: `SessionOnly` (E1), `ProvisionedSoftware` (E2),
   `HardwareKey` (E3), `HardwareKeyVerifiedBoot` (E4), `IsolatedSigner` (E5).
   Serde round-trip. `#[non_exhaustive]`.
2. **`BioPresence`** — a bool-like modifier type (liveness at time of use), NOT
   a class. Composes with E4/E5 checks for sensitive abilities.
3. **`Tier`** enum T1–T5 with `Ord`. `Tier::of(EvidenceClass) -> Tier`
   (E1→T1 … E5→T5 — table is 1:1 today, function exists so it can diverge).
4. **`Delegation.tier_ceiling: Option<Tier>`** (serde default = None so
   existing JSON stays valid). `allows()` unchanged for None.
5. **`allows_at_tier(&self, audience, resource, ability, now, device_tier)`**:
   like `allows()` but false if `tier_ceiling` is set and `device_tier` is
   below it. (Do NOT silently change `allows()` semantics — additive method.)
6. **`EvidenceVerifier` trait** (per-platform adapters implement later):
   `fn classify(&self, evidence: &DeviceEvidence) -> Result<EvidenceClass, _>`.
   `DeviceEvidence` = opaque platform payload enum (Trezor cert+sig, Android
   attestation chain, Apple App Attest object, TPM quote, VPS config-hash) —
   carry raw bytes/strings only; **do not** invent field semantics for
   platform blobs we haven't parsed (chain-exsat-evm precedent).
7. **Tests:** tier ordering; ceiling gating (T4 device vs T5-ceiling delegation
   fails, T5 passes); None-ceiling back-compat; serde round-trips incl. old
   JSON without `tier_ceiling`; E-bio composition helper.

## Gates (as always)
`cargo fmt --all --check` · `cargo build --workspace --locked` ·
`cargo test --workspace --locked` (baseline 354/0/1 + your new tests, nothing
else moves). Commit message prefix `capability:`; NO Signed-off-by (ORDERS-1 §3).
Update `Cargo.lock` only if you add deps (design needs none).

## Explicitly out of scope (later dispatches)
Real platform verification (Android root-cert chain — note the 2026-02-01 RKP
root rotation; App Attest CBOR; Trezor OPTIGA cert; TPM quotes) · Ed25519
`Verifier` impl · enrollment flows (T3 spec, in progress at the design seat).
