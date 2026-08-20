# SPEC-ONBOARDING-IDENTITY-1 v0.1 — Onboarding & Identity Layer

Status: DRAFT for founder ratification. Spec only, no implementation.
Companion to: SPEC_KEYRING-1 (custody tiers, bzDiD binding), SPEC_DOCTRINE-HARVEST-1 D1 (trust boundary).

---

## 0. Standing laws

| Law | Source |
|---|---|
| Custody tiers: T-H (hardware seed), T-F (FIDO2/passkey), T-S (software rotatable), T-P (platform/custodial) | SPEC_KEYRING-1 §1 |
| bzDiD = verification-method succession (add keys, never lose old ones; old methods degrade to recovery, not root authority) | SPEC_KEYRING-1 §3 |
| Explicit Trust Boundary: agent publishes what it defends AND does NOT defend | SPEC_DOCTRINE-HARVEST-1 D1 |
| Untrusted-content-as-data quarantine | SPEC_DOCTRINE-HARVEST-1 D2 |
| OAuth/social-login = hosted chokepoint = the class BNR replaces | standing (zBuZz-class) |
| Progressive custody ladder (already ruled): OAuth day-1 → passkey → seedphrase → hardware | founder ruling |
| Tier ladder VISIBLE at every step, never faked | founder ruling (Trezor stock→advanced pattern) |
| Server is a shed-able crutch; build for 10B/1000yr | standing law |
| htmx wherever possible | frontend ruling |

---

## 1. Hardware inventory

| Device | Role | Rail | Custody tier |
|---|---|---|---|
| Solo 2 (USB-A/NFC) | FIDO2 authenticator (primary) | Passkey | T-F |
| Solo 2 (USB-C) | FIDO2 authenticator (backup) | Passkey | T-F |
| Trezor Safe 7 | Wallet/custody | Crypto / bStore | T-H |

**Design principle: separation by device class.** Solo 2 = identity/passkey rail. Trezor = wallet/custody rail. Both technically support FIDO2, but the primary design separates them so that compromise of one device class does not cascade to the other. The Trezor's FIDO2 capability is a SECONDARY backup, not the primary authenticator.

---

## 2. Layer 1: Passkey / FIDO2 (sovereign)

This IS the bzDiD verification-method layer. Passkey = authority.

### Architecture

```
Browser (WebAuthn API)
    ↕ CTAP2 (USB / NFC)
Solo 2 (FIDO2 authenticator)
    ↕ stores per-RP keypairs (never exports private keys)
Relying Parties: Google, Apple, Microsoft, GitHub, Bitwarden, ProtonMail
```

The browser uses its built-in WebAuthn API — no client-side library needed. The Solo 2 registers as the platform authenticator for each relying party. Private keys are generated on-device and NEVER leave it (FIDO2/CTAP2 design).

### Verification flow

1. User navigates to a relying party (e.g., github.com).
2. Relying party initiates WebAuthn registration/authentication.
3. Browser prompts → user taps Solo 2 (USB or NFC).
4. Solo 2 signs the challenge with the per-RP private key.
5. Relying party verifies the assertion against the stored public key.

### Server-side verification (for bzDiD-bound services)

The BNR relay/server verifies WebAuthn assertions using `webauthn-rs`:
- **L-VERIFY**: webauthn-rs = **MPL-2.0** (Firstyear/webauthn-rs, kanidm/webauthn-rs — GitHub API verified).
- This is the ONLY library dependency for Layer 1 server-side.
- Browser-side: no library (native WebAuthn API).

### Solo 2 specifics

- Open-source firmware (SoloKeys). Stock firmware = standard FIDO2 CTAP2.
- NFC capability enables mobile passkey auth without a USB connection.
- Two devices (USB-A + USB-C) provide redundant authenticators — if one is lost, the other maintains access to all relying parties.

### What Layer 1 IS

- Hardware-rooted identity verification
- bzDiD verification method (the passkey proves "you are you" to the bzDiD)
- No third-party token custody (Solo 2 holds the keys, not a cloud service)
- Multi-platform (works with any WebAuthn-compatible browser/OS)

### What Layer 1 is NOT

- A wallet (cannot sign blockchain transactions — that's the Trezor's T-H rail)
- A key-escrow service (keys are non-exportable by FIDO2 design)
- A recovery mechanism (lost Solo 2 = lost keys; backup Solo 2 + recovery codes are the redundancy)

---

## 3. Layer 2: OAuth social-login (ramp, never root)

OAuth social-login is a **ramp ONTO the sovereign bzDiD**, not the root identity. It is the class BNR replaces.

### Architecture

```
User arrives
    ↓ sign-in-with-Google (or Apple/MS/GitHub)
OAuth provider authenticates the user
    ↓ issues OAuth token (hosted, revocable, third-party-custodied)
BNR onboarding receives the OAuth identity
    ↓ prompts: "Upgrade to hardware-rooted identity"
Solo 2 passkey registration
    ↓ bzDiD binds to the passkey (verification-method succession)
OAuth token becomes SECONDARY (still works, not root authority)
```

### Progressive custody ladder (VISIBLE, never faked)

| Step | Custody tier | Method | Display |
|---|---|---|---|
| Day 1 | T-P (platform) | OAuth sign-in | badge: "T-P / social login (ramp)" |
| Upgrade 1 | T-F (FIDO2) | Solo 2 passkey registered | badge: "T-F / passkey (sovereign)" |
| Upgrade 2 | T-H (hardware) | Trezor wallet bound | badge: "T-H / hardware wallet" |

The dashboard/onboarding surface shows the user's CURRENT tier and the NEXT available upgrade — the same tier-ladder-visible pattern as the Trezor stock→advanced rail display.

### What Layer 2 IS

- A **ramp** — lowers the barrier to entry (users don't need hardware on day 1)
- A **recovery channel** — if the Solo 2 is lost, OAuth + recovery codes can re-bind a new authenticator
- **Progressive** — each upgrade is optional and non-destructive (old methods degrade to recovery, not root)

### What Layer 2 is NOT

- The root identity (OAuth tokens are hosted, revocable, third-party-custodied — zBuZz-class)
- Permanent (the goal is for every user to graduate to T-F or higher)
- A signing authority (OAuth tokens never sign blockchain transactions)

---

## 4. bzDiD integration

Per SPEC_KEYRING-1 §3 (bzDiD binding layer):

1. **Initial binding (T-P)**: User arrives via OAuth. bzDiD creates a placeholder identity keyed to the OAuth subject. Tier badge: T-P.
2. **Passkey binding (T-F)**: User registers Solo 2 passkey. bzDiD adds the passkey public key as a verification method. The OAuth method degrades to recovery. Tier badge: T-F.
3. **Hardware binding (T-H)**: User binds Trezor wallet address. bzDiD adds the hardware address as a verification method. Tier badge: T-H.

**Verification-method succession**: each upgrade ADDS a method. Old methods are never deleted (they become recovery paths). The bzDiD document records the full succession chain — a user can always see their custody history.

### Trust boundary (per SPEC_DOCTRINE-HARVEST-1 D1)

The bzDiD publishes what it defends against:
- **Defends**: impersonation without the registered hardware authenticator (T-F/T-H).
- **Does NOT defend**: loss of ALL authenticators (user must maintain backup Solo 2 + recovery codes). Social-engineering of the OAuth provider (provider can still reset OAuth access — which is why OAuth is never root).

---

## 5. Onboarding funnel

The onboarding funnel is one of the FOUR AXES (community inflow). It must be frictionless at the entry point and progressively deepen custody.

### Funnel stages

```
Stage 0: Discovery
  → User finds BNR via content/community
  → No account, no hardware, no commitment

Stage 1: Entry (T-P)
  → User signs in with Google/GitHub/Apple (OAuth)
  → bzDiD placeholder created
  → Dashboard shows: "Your identity is platform-custodied. Upgrade to passkey."
  → All read-only features available (view balances, explore)

Stage 2: Sovereign (T-F)
  → User clicks "Upgrade to Passkey"
  → Browser prompts → user taps Solo 2
  → Passkey registered, bzDiD upgraded
  → Dashboard badge changes: T-P → T-F
  → Write features unlock (upload, sign, transact with approval)

Stage 3: Hardware custody (T-H)
  → User connects Trezor (already implemented in dashboard)
  → Wallet address bound to bzDiD
  → Dashboard badge: T-H
  → Full sovereign capability

Stage 4: Advanced (future)
  → Custom firmware, multi-signature, social recovery
  → Tier ladder continues
```

### Quality-of-life north star

Every surface decision measured by: "does this maximally improve the user's quality of life using the BNR stack?" The onboarding funnel's quality-of-life metric is **time-to-sovereign**: how many clicks from discovery to T-F passkey registration. Target: under 5 minutes for a user with a Solo 2 in hand.

---

## 6. Ramps

| Ramp | Purpose | Type | Notes |
|---|---|---|---|
| Google | OAuth entry point | T-P ramp | Largest reach; Android passkey ecosystem |
| Apple | OAuth entry point | T-P ramp | iOS passkey ecosystem; Safari WebAuthn |
| Microsoft | OAuth entry point | T-P ramp | Windows Hello WebAuthn; enterprise |
| GitHub | OAuth entry point + dev identity | T-P ramp | Developer funnel; passkey support |
| Bitwarden | Passkey provider (backup) | T-F provider | Cloud-synced passkey backup; open-source |
| ProtonMail | Privacy ramp | T-P ramp | Encrypted email; privacy-conscious users |

### Ramp design rules

1. Each ramp is a **plug-in entry point**, not a hard dependency. The BNR stack works without any of them.
2. Ramps are **replaceable** — if Google changes their OAuth API, the BNR onboarding still works via any other ramp.
3. Each ramp maps to a **progressive custody upgrade path** — the user sees exactly how to move from T-P to T-F to T-H.
4. Ramp providers NEVER see the Solo 2 private keys or the Trezor seed (FIDO2/CTAP2 design ensures this).

---

## 7. WebAuthn server-side verification

For BNR services that need to verify WebAuthn assertions (e.g., the relay authenticating a user's passkey):

- **Library**: `webauthn-rs` (MPL-2.0, L-VERIFIED)
- **Flow**: browser sends assertion → relay verifies via webauthn-rs → bzDiD records the verification
- **The relay never holds a private key** — it verifies public-key assertions only
- **State**: the relay stores credential public keys (not private keys) for verification

### L-VERIFY register (this spec)

| Dependency | License | Source | Status |
|---|---|---|---|
| webauthn-rs | MPL-2.0 | Firstyear/webauthn-rs (GitHub API) | ✅ VERIFIED |
| trezord-go | LGPL-3.0 | trezor/trezord-go (GitHub API) | ✅ VERIFIED |
| trezor/connect | NOASSERTION | trezor/connect (GitHub API) | ⚠️ Multi-license, CDN-loaded, not bundled. Package-level license not cleanly SPDX-readable. Flagged. |
| Solo 2 firmware | TBD | solokeys/solo2 | NOT YET VERIFIED — verify before firmware-level integration |
| Browser WebAuthn API | N/A | Built-in | No library dependency |

---

## 8. Acceptance criteria

1. Layer 1 (Passkey/FIDO2): a user with a Solo 2 can register passkeys for each ramp relying party. Private keys never leave the device.
2. Layer 2 (OAuth ramp): a user can sign in with Google/GitHub/Apple/MS and be guided to upgrade to passkey within 5 minutes.
3. Progressive custody ladder: the dashboard shows the user's current custody tier and next upgrade at every step. Tier badges are accurate, never faked.
4. bzDiD integration: each custody upgrade adds a verification method without removing old ones. The succession chain is recorded.
5. Server-side verification: the relay can verify WebAuthn assertions using webauthn-rs without holding any private keys.
6. Ramps: each ramp is independently replaceable. The BNR stack works without any specific ramp.
7. Solo 2 backup: two Solo 2 devices provide redundant authenticators. Loss of one does not lock the user out.

---

## 9. UNVERIFIED register

- trezor/connect (Trezor Connect): NOASSERTION at both repo and package level. CDN-loaded (not bundled, not modified). Deeper license audit needed before bundling locally. Current usage (browser-side CDN load) is low-risk.
- Solo 2 firmware: license not yet verified. SoloKeys uses various licenses across hardware/firmware/software components. Verify before custom firmware integration.
- Bitwarden passkey provider: Bitwarden's passkey implementation details need verification for the backup authenticator use case.

---

*Goose, primary executor. Cites: SPEC_KEYRING-1 (custody tiers, bzDiD binding), SPEC_DOCTRINE-HARVEST-1 D1 (trust boundary), FOUR AXES (community inflow funnel), progressive custody ladder (founder ruling), zBuZz-class hosted chokepoint rule (standing).*
