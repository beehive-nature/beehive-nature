⟨Research → Design/Code · T3: per-device enrollment & re-attestation flows · 2026-07-16⟩

# T3 — Enrollment flows, device by device

**Companion to** `TIERED_ACCESS_attestation_design.md` (the ladder) — this is
the *how each device climbs onto it*. One universal shape, five instantiations.
Consent law (§6) applies to every step: each enrollment ends in a human act —
a signed delegation the UI shows in plain words before signing ("this phone
will be able to: vote, send up to X/day. It will never be able to: …").

## 0. Universal shape (all devices)
1. **Keygen in the device's best keystore** (never exportable).
2. **Evidence collection** (platform-specific, below).
3. **Countersign by an existing T5 device** — the DID's own hardware chain is
   the root of trust. Display both device fingerprints; human confirms on the
   *T5* screen (its screen is the one host malware can't draw on).
4. **Delegation issued** with tier ceiling = `tier_of(evidence)`, expiry per
   class, consent text rendered from the actual capability list (never a
   summary that could drift from the token).
5. **Re-attestation** on cadence; miss ⇒ quiet decay to T1 (violet guard),
   re-attest to restore. **Revocation** = revoke delegation; propagates via
   the event runtime instantly to all domains.

**Genesis exception (first device ever):** no T5 exists yet — self-auth *is*
the root act. The wizard makes the first E5 enrollment (Trezor) the loudest
moment of onboarding: "this device becomes your sovereignty anchor."

## 1. Trezor (E5 → T5) — **founder has a Safe 7 in hand (2026-07-16)**
- Evidence: factory device-certificate in the Secure Element answering a
  random challenge — challenge-sign, verify cert chain + signature (the Suite
  authenticity-check flow, run by *our* verifier, not Suite). The Safe 7 is
  the best case: OPTIGA Trust M **plus TROPIC01** (the independently
  auditable secure element) plus the MCU — three hardware layers, and the
  TROPIC01 authenticity check is the reference E5 evidence path to build
  against first, on real hardware we possess.
- Keys: identity key via the frozen `messages-zano.proto` v0.3 seam (the
  proven host-side chain-zano work is the precedent).
- Re-attestation: per-connection (it's physically plugged/paired per use).
- UX note: this is the anchor device — enrollment doubles as the un-skippable
  key-backup ceremony (farming brief §6).

## 2. GrapheneOS (E4 → T4, no Google anywhere)
- Evidence: hardware key attestation chain from the secure element, verified
  boot state included; ongoing assurance via the **Auditor** model — TOFU
  pairing to our verifier (same protocol shape as attestation.app: pinned
  persistent key + rolling attestations), optionally *also* attestation.app
  for the user's own monitoring.
- The sovereignty proof case: full T4 with zero Google services. Our verifier
  must accept the GrapheneOS verified-boot keys as first-class (per their
  attestation-compatibility guidance), not treat non-stock as "failed."
- Re-attestation: scheduled (Auditor-style, e.g. daily) + on sensitive ops.

## 3. Stock Android (E4 → T4)
- Evidence: hardware key attestation chain (StrongBox where present, TEE
  otherwise) verified against the Android attestation roots — **must trust
  the post-2026-02-01 RKP root** (rotation flagged in the Code dispatch).
  Play Integrity is an *optional* strengthener per §1 — never required.
- Re-attestation: fresh attestation per enrollment renewal (e.g. 30d) +
  biometric-bound key use for T4-sensitive abilities (E-bio modifier).

## 4. iOS (E4 → T4)
- Evidence: App Attest — Secure Enclave key, CBOR attestation object at
  enrollment, then **per-request assertions with the monotonic counter**
  (anti-replay) for sensitive ops. DeviceCheck as coarse fallback only.
- Honest limit: App Attest proves app+device integrity to Apple's model; it is
  Apple-rooted (platform attestor), so pure-sovereignty users may prefer
  passkey-only enrollment at E3/T3. Offer both; say why in the consent text.
- Re-attestation: assertions are continuous by construction; attestation
  object refreshed on app reinstall/key loss.

## 5. Laptop (E3 → T3; E4 where measurable boot exists)
- Evidence: TPM 2.0 key + quote (Windows/Linux). On the BNRi OS NixOS laptop,
  the declarative config is itself evidence: measured boot (TPM PCRs) +
  `configuration.nix` closure hash raises to E4 when verifiable.
- Windows dev machines (like the current one): passkey/TPM key ⇒ E3/T3 —
  deliberately *not* trusted with spend; that's what the phone/Trezor are for.
- Re-attestation: per-boot quote.

## 6. VPS (E2 → T2)
- Evidence: software key + NixOS closure hash reported over the enrolled SSH
  channel; optionally TPM-quote if the provider exposes vTPM (stays E2 — we
  don't trust provider infrastructure as a *user* hardware root by design).
- Hard rule restated from the ladder: **T2 never custodies funds** — farming
  rewards pay to the user's Arbitrum address; the kernel peer holds
  delegations for `farm/operate` and serving only.
- Re-attestation: per-boot + config-change events onto the bus.

## 6b. Passkeys & passkey providers (founder-directed, 2026-07-16)
Passkeys are a **credential transport**, and the ladder ranks them by *where
the private key actually lives* — not by the passkey brand:
- **Device-bound passkey in a hardware keystore** (platform authenticators:
  Apple/Google/Samsung/Microsoft on their own hardware; Bitwarden's
  device-bound mode on mobile) → **E3**, or **E4** when the platform's
  attestation chain (§2–4) is also presented. Key can't leave the device.
- **Vault-synced passkey** (Bitwarden vault-stored, Proton Pass all-devices,
  iCloud-Keychain/Google-Password-Manager synced) → the key is portable
  inside an E2E-encrypted *software* vault → **E2-class evidence**, T2-like
  ceiling (view + operate, never spend). Honest reason in the consent text:
  a synced key is only as strong as the vault account's own auth.
- **Integration order:** Bitwarden first (open-source, self-hostable — the
  sovereignty-aligned default; its device-bound mobile mode is the best
  passkey path we can *recommend*), Proton Pass second (all-plans passkeys,
  privacy-aligned), platform providers (Apple/Google/Samsung/Microsoft)
  supported as-is since they ride §2–4 enrollment anyway.
- WebAuthn/FIDO2 is the wire protocol for all of the above — one
  `verify-webauthn` adapter, with the evidence class decided by the
  authenticator's attestation statement (or its absence ⇒ E2 floor).

## 7. Wearables (E-bio modifier; speculative as key root — unchanged)
- Today: presence/liveness signal *through* the paired phone's E4 chain
  (biometric-bound key use). Consumer bands expose no open attestation API.
- §6 consent law bites hardest here: auth-presence and health-telemetry are
  **two separate opt-ins, two separate revocations**. Health data → zbData
  only; bLOVErAi advisory runs local to the data.
- Watch item for a future E-bio upgrade: devices with verifiable attestation
  (e.g. Apple Watch inherits the iOS chain; open-hardware candidates TBD).

## Failure & recovery (uniform)
- Lost/stolen device: revoke from any T4+ device; the revocation event is
  settlement-class on the bus. Panic path: revoke-all-except-anchor.
- Lost anchor (Trezor): recovery = seed restore ceremony onto a new E5 device;
  the DID persists (keys rotate under it — the whole point of DID-not-keys).
- Every fall is quiet-to-T1, never account death; every restore is re-attest,
  never re-identity.

## For Code (next dispatch after the T2 crate lands)
Each §1–6 evidence collector = one `EvidenceVerifier` impl behind the trait
(`verify-trezor`, `verify-android`, `verify-appattest`, `verify-tpm`,
`verify-nix-closure`, `verify-webauthn` — the last one classifies by the
authenticator's attestation statement, E2 floor when absent), each its own
small crate or module, mock-first with a
pinned fixture of the real evidence blob — exactly the adapter discipline.

## Sources
Carried from `TIERED_ACCESS_attestation_design.md` (same retrieval set,
2026-07-16: Android key-attestation docs + RKP rotation, GrapheneOS Auditor /
attestation.app, Apple DCAppAttestService, Trezor Safe device-auth). BLS CES
2024 for §6 anchors.
