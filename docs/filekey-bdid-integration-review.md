# FileKey × bDiD — Integration Review Against the Actual Codebase

**Reviewed:** all six repos — [beehive-nature](https://github.com/beehive-nature/beehive-nature) (kernel, AGPL-3.0-only), [LOVErnment-DAO](https://github.com/skaists/LOVErnment-DAO), [b-domain](https://github.com/beehive-nature/b-domain), [attestation-core](https://github.com/beehive-nature/attestation-core) (MIT/Apache-2.0), [bnri-cosmic](https://github.com/beehive-nature/bnri-cosmic), [sovereignty-explorer](https://github.com/skaists/sovereignty-explorer) — against [RockwellShah/filekey](https://github.com/RockwellShah/filekey) (GPLv3).

**Where the bDiD prototype lives:** `beehive-nature/surfaces/onboarding/index.html` (918 lines — the wallet/connect/onboard ceremony), `crates/onboarding/src/lib.rs` (the identity ladder: Authenticator, RootIdentity, RecoveryPath, Enrolment), `crates/atmirror/src/record_sig.rs` (Ed25519 bDiD record signatures), `docs/bdid-onboarding-design.md` (the 13-rail buildable design), `docs/SPEC-BNROSE-ONBOARD.md`, `dockets/T3_device_enrollment_flows.md`.

---

## Verdict: yes — and more strongly than before

FileKey is not just "good to add." **It is a working implementation of the exact component your prototype has stubbed out.** The onboarding surface says it plainly, three times:

- `PREVIEW=true until real BIP-39 derivation lands` (recovery screen)
- *"These 12 words are stage props. They derive no key, control nothing"* (banner)
- *"recovery derivation is not built yet, so nothing was restored"* (restore path)
- *"Keypair binding — nothing real is derived yet"* (creating screen)

The missing piece — the "key build" that turns a real passkey ceremony into real key material and a real recovery phrase that rebuilds the same identity — is precisely FileKey's core: **WebAuthn PRF → HKDF → `master_prk` → deterministic keypair, with the BIP39 phrase as a second encoding of the same root.** One identity, two doors. That is exactly the shape your recovery screen promises ("these 12 words can rebuild your wallet on any device").

And the license blocker from my first review **dissolves**: the kernel is AGPL-3.0-only, and GPLv3 ↔ AGPLv3 are expressly compatible (GPLv3 §13). FileKey code can be adapted into beehive-nature directly. (Keep it out of `attestation-core`, which is MIT/Apache — but nothing identity-shaped belongs there anyway.)

---

## What your architecture already gets right — don't let FileKey overwrite it

This matters because FileKey and bDiD disagree on one deep point, and **bDiD is correct for its goals**.

**1. "The authenticator is a key, never the identity."** (`crates/onboarding/src/lib.rs:20-22`.) In FileKey, the passkey-derived key *is* the identity — lose the root, lose everything, no rotation. Your constitution rules the opposite: records key off the stable `did:autonomi`; the credential is replaceable; the DID survives device loss and key rotation. **Keep your model.** Use FileKey's derivation to produce *a* key that authorises the root — spend authority, record signing under the DID log — never as the DID itself. This is also what the 1,000-year horizon requires: the DID must outlive any single key algorithm.

**2. The written-code floor is law, not UX.** `Enrolment::complete` refuses without it (`NoWrittenCodeFloor`) — "the only option available to someone poor." FileKey treats the phrase as optional. Your version is stricter and better; FileKey supplies the *mechanism* (phrase ⇄ root, bidirectional), your crate supplies the *obligation*.

**3. Personas as context-scoped derivations.** `biometric-uniqueness-ledger.md`: "Personas = context nullifiers `PRF(seed, context)` below the bDiD." FileKey's `deriveIdentity(masterPrk, namespace)` — same root, per-namespace HKDF-scoped keypair, no cross-context linkability — **is that pattern, already implemented and test-vectored.** The namespace-tag machinery maps directly onto Pairwise `DisclosureMode` (`persona.rs`).

**4. Multi-rung custody with one bDiD.** The surface's ladder — passkey / optical air-gap / FIDO2 / Trezor, "Same bDiD at every rung" — is more generous than FileKey's single passkey path. FileKey slots in as the **passkey rung's engine only**. Trezor rung keeps its own seed ceremony (the 2026-08-14 founder ruling to skip the phrase on Trezor is right and stays).

---

## TAKE — concrete, file-by-file

### 1. The PRF derivation chain → your "key build" (`filekey/reference/src/identity.ts`, `web/webauthn.ts`)
Adapt directly, with one swap: **derive Ed25519, not P-256.** Your record layer already mandates ed25519 (`record_sig.rs`, `did-autonomi-spec` keyAlg). The chain becomes: PRF output (32 B) → HKDF-Extract → `master_prk` → HKDF-Expand(context) → Ed25519 seed. This is *simpler* than FileKey's path — you don't need their RFC 9180 rejection-sampling loop or the Safari WebCrypto JWK workaround (both are P-256/WebCrypto artifacts; ed25519 via @noble has no such trap). What you keep is the labeled-HKDF discipline: exact domain-separation labels as normative constants (`constants.ts` is the model — every label a spec'd byte string).

### 2. The two ceremony bugs already in your prototype (fix before the key build lands)
`surfaces/onboarding/index.html:643-648` — the real `credentials.create()` call:
- `userVerification: 'preferred'` → **must be `'required'`** the moment PRF is added. CTAP2 returns a *different* PRF secret for UV vs non-UV assertions; under `'preferred'` a later login silently derives a different identity. FileKey's `webauthn.ts:68-78` documents the failure and the fix. With `'preferred'` shipped, this becomes a lockout bug that looks like data loss.
- No `residentKey: 'required'`, no `extensions: { prf: {} }` — needed for discoverable credentials (re-auth without stored credential IDs — nothing stored beyond the passkey, which matches your "carries only the opaque public credential id" rule) and for PRF at all.

### 3. The capability-detection ladder (`webauthn.ts:26-35, 84-88`)
Browser-level `getClientCapabilities()['extension:prf']` (tri-state), then post-create `prf.enabled` check — because the browser can claim PRF while the authenticator can't (pre-25H2 Windows Hello). Your Round-7 refusal pattern ("Nothing proceeded silently") is the right UX frame; this gives it the two honest signals to key off. It decides which rung to offer, in `persona==='hw' ? [...] : [...]` order logic you already have at line 319.

### 4. Recovery phrase as *derivation*, not verification (`recovery.ts`)
Your crate stores `WrittenCode { code_hash }` — a secret checked against a hash, which implies a service alive to check it. FileKey's phrase **is the root**: `entropyToMnemonic(master_prk)` / `mnemonicToEntropy(phrase)` — recovery is pure client-side re-derivation, no server, no stored hash, works after BNR itself is gone. For a 1k-year protocol this is the stronger model: adopt it, keep `code_hash` only as a local UX check ("did they write the right thing"). One decision needed: your mock shows **12 words** (128-bit); a 32-byte root needs **24** (FileKey's choice). Either pick 24 words, or make the root 128-bit and expand — settle it before the phrase becomes real, because it's unfixable after.

Also take `decodeRecoveryAuto` (`recovery.ts:97-110`) — format auto-detection on the restore input — and the Bech32m self-describing alternative encoding, which your restore screen (line 617-618's honest word-count refusal) can grow into.

### 5. The offline recovery tool (`web/recover.html` + `build-recover.ts`)
A single self-contained HTML file that restores identity with zero infrastructure. **You already believe in this** — sovereignty-explorer's last commit is literally "Vendor every dependency — the page now makes zero third-party requests." Ship a bDiD equivalent: phrase in → DID + keys re-derived → prove control, entirely offline. This is the artifact that makes "scales for 1,000 years" concrete: identity recovery that survives the death of every BNR service. It also answers your `creating()` screen's promise ("rebuild your wallet on any device") with something inspectable.

### 6. Fingerprint words (`identity.ts:146-162`)
6 BIP39 words from the key hash — human-verifiable identity comparison. Natural fit for the T3 enrollment flows' countersign step ("Display both device fingerprints; human confirms on the T5 screen") — words beat hex on a Trezor screen and over a phone call. Trivial to port.

### 7. Encrypted-to-self local state (`web/contacts.ts`)
Storage key derived from the identity's public key, contents encrypted to self, "storage blocked → session-only" graceful degradation. Pattern for anything the onboarding surface persists locally — ceremony resume state (your `APP.resumeFile` path), persona bindings cache, rail address book from `rails.rs`.

## LEAVE — with reasons

- **FileKey's identity model** (key = identity, no rotation) — your constitution already forbids it; covered above.
- **The HPKE file-sharing suite, share-key format, chunked streaming cipher** (`cipher.ts`, `sharekey.ts`, `wire.ts`) — solves file sharing, which is not the bDiD problem. If the kernel later needs encrypted blob custody, revisit; don't import now.
- **P-256 anywhere long-lived** — your ed25519 mandate sidesteps FileKey's curve entirely; note ed25519 is also pre-quantum, but your rotation-capable DID model is the correct 1k-year answer (rotate algorithms via the DID log when the time comes), which is exactly why LEAVE #1 matters. The biometric doc's harvest-now-decrypt-later reasoning applies to any *encrypted* long-lived material — keep that on symmetric or PQ-hybrid paths.
- **4-byte namespace tags** — birthday-bounds at ~65k namespaces; your persona/context space at 10-billion-human scale should use ≥8-byte context tags.
- **FileKey's PWA/app chrome, blog, service worker** — product, not protocol.

---

## Sharp edges the raid should rule on

1. **RP-ID binding vs. domain mortality.** PRF output is bound to the WebAuthn RP-ID (a DNS name). If the origin domain is ever lost, the passkey door closes — only the written code reopens it. Your written-code floor already covers this, but it means **the phrase is the 1k-year artifact and the passkey is a convenience door**. The UI copy should say so (it currently implies parity). Consider whether `.b` domains (b-domain repo) eventually anchor a sovereign RP-ID story.
2. **12 vs 24 words** — decide now (TAKE #4). Founder-class, since it fixes root entropy forever.
3. **Which keys are PRF-derived.** Design doc F6 already accepts client-side software keys for Vaulta/Hive. A PRF-derived key could *be* that software key — same passkey gesture funds account creation keys — but that couples chain keys to the RP-ID (edge #1). Safer: PRF-derives the bDiD authorising key only; rail keys stay independently generated with the phrase as their backup, per the design doc's derive-all model.
4. **`code_hash` semantics change** if the phrase becomes derivational (TAKE #4) — small `Enrolment` API adjustment, worth doing before more callers exist.

## Suggested build order (slots into Phase 0 of `bdid-onboarding-design.md`)

Phase 0 already ships `rails.rs` with no chain writes. The key build is its natural companion: (1) port the PRF ceremony with UV=required + residentKey + capability ladder; (2) implement `master_prk` → Ed25519 per `did-autonomi-spec`, with test vectors; (3) make the 12/24-word ruling, wire real BIP39 both directions, delete `PREVIEW` and the stage-props banner; (4) ship the offline recovery HTML; (5) fingerprint words into the T3 countersign screen. Each step independently shippable, none touches a chain.
