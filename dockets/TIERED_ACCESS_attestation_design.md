⟨Research → Design/Code · Tiered access by device/evidence attestation · 2026-07-16⟩

# Tiered Access — the attestation ladder of BNRi OS

**Goal (founder, 2026-07-16):** one DID, any domain, any device — but *what you
can do* is decided by **what evidence the device can attest**, not what it claims.
This is the enforcement layer under §2.5 (did:autonomi + UCAN + self-auth): the
UCAN `Delegation` already carries capabilities; this doc defines **where the
ceiling comes from**. Autonomous sovereignty means the *user's own hardware* is
the authority — no platform account, no central attestor as a single point.

## 1. Design law (from the constitution, applied here)
- Devices are **identity adapters** (`identity.hardware`, `identity.mobile`) —
  replaceable, capability-named, never brand-bound. A "Trezor tier" is really a
  **hardware-isolated-signer tier**; Trezor is today's reference implementation.
- **Evidence, not device model, sets the tier.** A GrapheneOS Pixel with locked
  bootloader out-attests a rooted flagship. The ladder ranks *evidence classes*.
- Platform attestors (Google, Apple) are **optional strengtheners, never
  gatekeepers** — sovereignty requires a path to every tier that no corporation
  can revoke. (GrapheneOS is the proof case: full hardware attestation with zero
  Google services, via Auditor/attestation.app's TOFU model.)

## 2. Evidence classes (pinned to current sources, 2026-07-16)
| Class | What it proves | Reference implementations |
|---|---|---|
| **E5 · Hardware-isolated signer** | key lives in a dedicated signer with its own screen/buttons; host compromise ≠ key compromise | Trezor Safe: factory device-certificate in the Secure Element (OPTIGA Trust M on Safe 3/5; Safe 7 adds TROPIC01, independently auditable), challenge-sign authenticity check |
| **E4 · Hardware keystore + verified boot** | key in SE/TEE + OS integrity chain | Android StrongBox/TEE key attestation (⚠ root cert rotated 2026-02-01; verifiers must trust the new RKP root); GrapheneOS hardware attestation via Auditor (TOFU, works w/o Google); Apple Secure Enclave + App Attest (attest key → per-request assertions with anti-replay counter) |
| **E3 · Hardware-backed key, weaker/no boot proof** | key non-exportable, but OS state unproven to us | TPM 2.0 laptop key; passkey/WebAuthn platform authenticator; iOS w/o App Attest path |
| **E2 · Software key on a machine we provision** | key on disk/HSM-less, but declarative config + our ops | VPS (NixOS peer): software key + SSH-key-only + config-hash self-report — no hardware root a stranger should trust |
| **E1 · Session-only** | someone holds the DID's recovery/passphrase right now | browser https session after self-auth, no device enrollment |
| **E-bio · Liveness/wearable (modifier, not a class)** | a live human is present at the device *now* | biometric unlock gating the E4/E5 key's use (Secure Enclave/StrongBox biometric-bound keys); wearables: today's consumer bands generally expose **no open attestation API** — treat as presence signal paired through the phone's E4, never as a key root. FOUNDER-HONEST: a wearable-rooted tier is speculative until a device with verifiable attestation is chosen. |

## 3. The tier ladder → capability ceilings (what the UCAN may contain)
Tier = the **maximum capability set** a `Delegation` issued to that device may
carry. The `capability` crate enforces the rest (audience, time, wildcards).

| Tier (evidence) | Ceiling — MAY | MUST NOT |
|---|---|---|
| **T5 = E5** | everything incl. `wallet/spend`, escrow co-sign, `governance/execute`, key rotation, issuing delegations to lower tiers | — |
| **T4 = E4 (+E-bio for sensitive ops)** | `wallet/send-limited` (per-tx + daily caps), `farm/toggle`, `governance/vote`*, `zbdata/read-write`, day-to-day console | unbounded spend; root-key ops |
| **T3 = E3** | `farm/*`, `servers/*`, `wallet/view`, `bdata/*`, draft-anything | any spend; zbData write |
| **T2 = E2 (VPS)** | `farm/operate`, indexer/read-API serve, `permanence/anchor-submit` | **holds no user funds, ever**; no governance |
| **T1 = E1** | `*/view` of public faces, own profile read | anything mutating value or identity |
*Governance/vote additionally requires the **Respect** unique-human bond (Sybil
resistance is a person property, not a device property — the two compose).

Cross-domain UX consequence: walk into skaists.social on your phone (T4) — you
vote and manage; the *same* DID on a cafe browser (T1) sees, but the spend
button isn't degraded, it's **absent** (capability-gated render, §5 matrix).

## 4. Enrollment shape (one flow, five devices) — detail in T3 task
1. Device generates a key **in its best keystore**; produces its evidence
   (Trezor: cert+challenge-sig · Android/GrapheneOS: attestation chain or
   Auditor TOFU pairing · iOS: App Attest object · TPM: quote · VPS: config
   attestation).
2. The DID's **T5 device countersigns** the enrollment (a UCAN delegation with
   that device's tier ceiling) — the root of trust is *your* hardware chain,
   not a vendor. First device bootstrap = the DID's own genesis (self-auth).
3. Re-attestation cadence per class (E4 continuous via assertions/Auditor
   schedule; E2 per-boot config hash). Failure ⇒ delegation auto-expires to T1
   — a *quiet* fall, violet guard-state in the UI, never a lockout scare.
4. Revocation = revoke the delegation (UCAN), instant across domains.

## 5. What this changes in code (→ dispatch T2)
The `capability` crate gains: `EvidenceClass` (E1–E5 + EBio modifier),
`Tier` (T1–T5), `tier_of(evidence) -> Tier`, and `Delegation` gaining an
optional `tier_ceiling` checked in `allows()`. Verification of the evidence
itself (cert chains, App Attest CBOR, TPM quotes) stays **behind traits per
platform adapter** — same discipline as `Verifier`/`ProofVerifier`.

## 6. The bLOVErAi advisory layer (founder-directed, 2026-07-16)

**Consent law — FLAG, load-bearing, above every feature:** every bLOVErAi
action is **voluntary, informed, consented, and at no harm to anyone**. It
proposes; only the human's explicit act (a signed UCAN delegation) makes
anything real. No dark patterns, no default-on, no nudge that spends. Refusal
is a first-class state (the violet guard-state), never a degraded one. This is
the constitution's AI-as-replaceable-sense-adapter doctrine plus a consent
gate: **bLOVErAi advises with statistics; the human governs with signatures.**

Two advisory domains, one law:
- **Money (resolves open-question 1):** T4 spend caps stop being a founder
  guess. bLOVErAi derives *suggested* defaults from real statistics — anchor:
  BLS Consumer Expenditure Survey 2024, average annual expenditures
  **$78,535/consumer unit ≈ $215/day** (quintile range ≈ $96–$412/day) —
  personalized to the user's own (zbData-private) history. Suggested shape:
  daily cap ≈ the user's own p95 daily spend, per-tx cap ≈ daily/3, both
  presented with the *why* ("this covers 95% of your days") and ratified by
  the human before entering the delegation. Re-proposed quarterly; never
  auto-applied. Stats live locally; personal spend history is zbData — the
  advisory runs where the data lives, nothing leaves.
- **Life (the mission statement):** bLOVErAi's larger purpose is extending the
  human's healthy, youthful, disease-free span — statistics-literate guidance
  over *consented* health signals. The E-bio wearable presence signal may
  double as health telemetry **only under a separate, explicit, revocable
  opt-in** (never bundled with auth consent; two different questions, two
  different signatures). All health data is zbData (self-encrypted,
  datamap-holder-only); guidance is informational, sourced, and marked
  advisory — bLOVErAi is not a physician and says so. No harm includes: no
  coercive framing of health "scores," no third-party disclosure, ever.

## Open founder questions (do not design past)
1. ~~T4 spend caps — values?~~ **Resolved in shape** (§6: bLOVErAi-proposed,
   statistics-anchored, human-ratified). Remaining: approve the p95/daily÷3
   starting shape, or set a different one?
2. Wearable: is there a specific device you intend (Apple Watch pairs into the
   iOS E4 chain; open-hardware options are weaker today)?
3. VPS tier: comfortable that T2 explicitly never custodies funds (farming
   rewards land at the user's Arbitrum address, not on the box)?
4. Do platform attestations (Play Integrity / App Attest) get *bonus* standing
   (faster limits-raising), or strictly nothing (pure sovereignty posture)?

## Sources (retrieved 2026-07-16)
[Android key attestation](https://developer.android.com/privacy-and-security/security-key-attestation) ·
[Play Integrity 2026 / root rotation](https://android-developers.googleblog.com/2025/10/stronger-threat-detection-simpler.html) ·
[GrapheneOS attestation compatibility](https://grapheneos.org/articles/attestation-compatibility-guide) ·
[GrapheneOS Auditor](https://github.com/GrapheneOS/Auditor) · [attestation.app](https://attestation.app/about) ·
[Apple App Attest / DCAppAttestService](https://developer.apple.com/documentation/devicecheck/dcappattestservice) ·
[App integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity) ·
[Trezor Safe device authentication](https://trezor.io/learn/security-privacy/how-trezor-keeps-you-safe/trezor-safe-device-authentication-check) ·
[Trezor secure elements](https://trezor.io/learn/security-privacy/how-trezor-keeps-you-safe/secure-elements-in-trezor-safe-devices)
