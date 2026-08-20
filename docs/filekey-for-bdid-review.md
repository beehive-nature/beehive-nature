# FileKey → bDiD: Code Review & Take/Leave Assessment

**Reviewed:** [RockwellShah/filekey](https://github.com/RockwellShah/filekey) (reference implementation, ~4,300 lines TS, GPLv3, spec v0.4.7)
**Reviewed against:** bDiD goals — generous onboarding options that meet people where they are; identity durable at civilizational timescales (≥1,000 years) at global population scale.
**Note:** the bDiD repo itself was not accessible from this session, so integration points below are mapped to the stack as described (wallet, connect-wallet, onboard). A second pass against the actual code is recommended once the repo link is shared.

---

## Verdict

**Yes — add it, but as a pattern source, not a dependency.** FileKey is one of the cleanest passkey-derived-identity implementations in the open. Its core insight — a deterministic keypair derived from a WebAuthn passkey PRF, with a BIP39 phrase as the *optional* backup rather than the mandatory first step — is exactly the "meet people where they are" onboarding ramp bDiD wants. But two of its foundational choices (P-256 elliptic-curve crypto, and identity with no rotation story) conflict directly with the 1,000-year durability goal, so the right move is to take its patterns and interop lessons while replacing its cryptographic bones.

---

## TAKE — what serves the stack, and why

### 1. Passkey-PRF deterministic identity derivation (`identity.ts`, `webauthn.ts`)
The chain is: WebAuthn PRF output → HKDF-Extract → `master_prk` → RFC 9180 DeriveKeyPair → identity keypair. Same passkey always reproduces the same identity; nothing is stored anywhere. For bDiD onboarding this means a new user's first key can come from a passkey they already have (iCloud Keychain, Google Password Manager, a YubiKey) — no seed-phrase ceremony before they've done anything. This is seedless onboarding with working production code to study.

Three hard-won lessons in this file alone are worth taking verbatim:

- **`userVerification: "required"` must be pinned at both enrollment and assertion.** CTAP2 returns a *different* PRF secret for UV vs non-UV assertions — under `"preferred"`, a later login can silently skip UV, derive a different secret, and lock the user out of their own identity. FileKey documents and solves this. Any passkey-derived-key system that misses it ships a time bomb.
- **The Safari/WebKit DeriveKeyPair workaround.** WebCrypto on Safari refuses to synthesize a public key from a private-scalar-only import; FileKey computes the point with @noble and imports a complete JWK, byte-identical to the spec. Without this, identity derivation fails on every WebKit browser.
- **Non-extractable private key import** — the derived key never becomes exportable to page JS, closing a raw-key exfiltration route.

### 2. Layered capability detection with graceful fallback (`webauthn.ts`)
`prfBrowserSupport()` (browser-level, tri-state), then post-create `prf.enabled` check (authenticator-level), because a browser can claim PRF while the authenticator can't do it (pre-25H2 Windows Hello). This detection ladder is the mechanical core of "meet people where they are": try the best path, detect honestly, fall back without drama. Take the pattern wholesale for the connect-wallet flow.

### 3. The dual recovery-code system (`recovery.ts`)
Two encodings of the same 32-byte root: a 24-word BIP39 phrase (crypto-natives already know exactly what this is and how to store it) and a self-describing Bech32m string (`fkeyrec1…`) carrying version + namespace, for people who'd rather save one copy-pasteable code. Plus auto-detection of either format on input. This is the "generous options" philosophy in miniature — passkey people never see a seed phrase, seed-phrase people get a familiar one, and both roads lead to the same identity. Directly reusable design for bDiD recovery.

### 4. The offline recovery tool concept (`recover.html`)
A single self-contained HTML file that decrypts/recovers with no service, no server, no network — explicitly built so the identity outlives the app ("even if FileKey disappears, this code still works"). For a protocol with a 1,000-year ambition, this is the most important *architectural* idea in the repo: **recoverability must not depend on the protocol's own infrastructure surviving.** bDiD should have an equivalent — a frozen, self-contained artifact that can reconstruct identity and prove control from the recovery root alone.

### 5. Human-verifiable fingerprints (`identity.ts §4.7`)
Identity fingerprint = 6 BIP39 words derived from the key hash (66 bits), with a short hex form for glancing. Two humans can verify they hold the same identity by reading words aloud. Cheap to implement, huge for DID verification UX — take as-is.

### 6. Bech32m key encoding with version + namespace tag (`sharekey.ts`)
Public keys travel as `fkey1…` strings: human-prefix, typo-detecting checksum, explicit version byte, namespace binding, compressed point, and *ten enumerated rejection checks* with distinct error codes on decode. Compare with raw hex or base64 keys and there's no contest. bDiD's shareable identifiers should adopt this shape (with its own HRP).

### 7. Namespace scoping and collision rejection (`namespace.ts`)
Identities are scoped to a canonical RP-ID baked into the derivation, so the same passkey yields different identities per deployment — no silent cross-site identity correlation. Config-time rejection of namespace tag collisions. One scale caveat below (LEAVE §5).

### 8. Encrypted-to-self local state (`contacts.ts`)
The contact list — a social-graph footprint — is stored encrypted to the user's own identity, unreadable at rest without the passkey, scoped per identity. Any local state a bDiD wallet keeps (contacts, credential cache, session material) should follow this pattern rather than plaintext localStorage.

### 9. (Conditional) Streaming chunked AEAD construction (`cipher.ts`)
64 KiB chunks, per-chunk counter nonces, capped counter, full-transcript AAD, async-generator streaming so arbitrarily large payloads never sit in memory. Only relevant if bDiD stores or transfers encrypted payloads (credential backups, encrypted profile data) — but if it does, this is a careful implementation to model.

---

## LEAVE — what conflicts with the goals, and why

### 1. P-256 / DHKEM ECC for anything long-lived — **the big one**
FileKey's sharing suite is HPKE over P-256. Elliptic-curve crypto falls to a cryptographically relevant quantum computer, and anything encrypted or anchored under it today is exposed to harvest-now-decrypt-later. FileKey's own authors know this — their symmetric self-encryption suite (0x02) is explicitly labeled post-quantum-safe *because it avoids the KEM entirely*. A protocol targeting ≥1,000 years cannot found identity on P-256. For bDiD: use a hybrid post-quantum KEM (ML-KEM-768 + X25519, e.g. X-Wing) for confidentiality and ML-DSA or SLH-DSA alongside classical signatures for identity proofs, keeping ECC only where the WebAuthn layer forces it (the passkey itself is an authn gesture, not the long-term identity key). Note the asymmetry: the *derivation pattern* (PRF → HKDF → DeriveKeyPair) is algorithm-agnostic and survives intact — you swap the target keypair, not the ramp.

### 2. PRF-derived key as *the* identity, with no rotation — leave
In FileKey, `master_prk` is the root forever: one passkey, one identity, and compromise has no rotation story — that's acceptable for a file-sharing tool, fatal for a DID. bDiD's design should invert the relationship: the passkey-derived key is a *control/recovery key* referenced by a rotatable DID document, never the DID's permanent key material itself. Users keep the seedless onboarding; the protocol keeps rotation, delegation, and revocation. This is also what makes the 1,000-year horizon survivable — identities must outlive any single key algorithm, device generation, or compromise event.

### 3. GPLv3 code — decide before copying a single line
FileKey is GPLv3, which is viral: vendoring its code makes the linked work GPLv3. If the raid wants bDiD permissively licensed (MIT/Apache-2) or license-flexible, treat FileKey strictly as a **reference implementation** — reimplement from its spec and patterns (formats, derivation chains, and protocol ideas aren't captured by copyleft; the code expression is). If the raid's ethos is copyleft anyway, this constraint dissolves and the code can be used directly. Either way, make the decision explicitly and record it.

### 4. localStorage as the persistence layer — leave
Fine for a zero-infrastructure PWA; too fragile for wallet-grade durability (evicted under storage pressure, lost on site-data clears, invisible to backup). bDiD's wallet should use IndexedDB with persistent-storage permission at minimum, plus its own durable backup path.

### 5. 4-byte namespace tags at bDiD scale — extend, don't copy
Tags are `SHA-256(rp_id)[0:4]` — 2³² space. FileKey configures a handful of namespaces, so collision rejection at config time suffices. A global DID ecosystem enrolling many thousands of independent namespaces hits birthday-bound collisions around ~65k namespaces. If bDiD envisions an open namespace registry at population scale, widen the tag (8–16 bytes) in its own wire format.

### 6. The app/PWA chrome — leave
`app.ts` (1,388 lines of UI), blog build system, service worker, PWA manifest: FileKey-the-product, not FileKey-the-idea. Nothing there serves the stack.

### 7. The "no server, no registry" constraint — take the spirit, not the letter
FileKey's zero-infrastructure stance is a feature for file sharing but bDiD presumably anchors DIDs somewhere (chain or otherwise). The transferable principle is narrower and stronger: *the client must be able to derive, prove, and recover identity with zero dependence on bDiD's own services being alive.* Keep that invariant; don't inherit the architecture.

---

## How this lands in the onboarding flow

The "generous options" ramp, concretely, becomes a ladder the connect/onboard code walks with honest detection at each rung: passkey with PRF (invisible keys, zero ceremony) → passkey without PRF support (detected via the two-level check; offer enrollment on a supporting authenticator or fall through) → 24-word phrase (crypto-natives, and the universal recovery path) → self-describing recovery code (one string to store). Every rung produces the same identity root feeding the same rotatable DID document. FileKey has production-tested code for rungs 1, 3, and 4 and the detection logic between them.

## Recommended next steps

1. Share the bDiD repo link so this mapping can be checked against the actual wallet/connect/onboard code — especially wherever key generation and recovery currently live.
2. Raid decision: license posture (GPLv3-compatible or clean-room from spec).
3. Raid decision: PQ posture — adopt hybrid KEM/signatures now for long-lived material, or phase it via the DID rotation mechanism.
4. Prototype the PRF detection ladder early; authenticator support variance is the main real-world friction and it shapes the whole onboarding UX.
