# SPEC-AUTHENTICATOR-LADDER-1 — Four-Level Authenticator Ladder

Status: FOUNDER-NAMED (2026-08-12). Build to it; render the SEAM honestly.
Companion: SPEC-VAULTA-IDENTITY-1 v0.2 (Layer-0/Layer-2 split),
SPEC-ONBOARDING-IDENTITY-1 (progressive custody), SPEC-PAY-ONCE-NOW-1.

---

## The ladder

| Rung | Name | Hardware | Tier | Role | Routes to |
|------|------|----------|------|------|-----------|
| 1 | Larva | Passkey (browser/OS) | T-F | Verification | bni.id enrollment |
| 2 | Pupa | Solo 2 / FIDO2 physical | T-F | Verification | bni.id enrollment |
| 3 | Bee | Trezor stock firmware | T-H | Custody | Ceremony step 6 (T-H sign) |
| 4 | Royal Guard | bCode custom firmware | T-H | Custody | Ceremony step 6 (PLANNED) |

## The seam (made VISIBLE, not smoothed)

**T-F rungs (Larva + Pupa)** = VERIFICATION METHODS. They prove/authorize the
identity, enroll PUBLIC keys into bni.id (additive per §3), hold NO spendable
keys. A Larva user has a real sovereign identity they can authenticate.

**T-H rungs (Bee + Royal Guard)** = KEY CUSTODY. They sign ceremonies and hold
wallet keys. T-H signing arrives at Bee.

Every rung yields ONLY a public key in a versioned envelope — never a private
key, never signing exposure.

## Enrollment path

1. **Larva (passkey):** browser WebAuthn creates a passkey. The public key is
   wrapped in a PQ-ready envelope and enrolled into bni.id (additive).
2. **Pupa (Solo 2):** FIDO2 authenticator registers. Public key appended
   alongside the passkey in bni.id (additive, never replaces).
3. **Bee (Trezor):** device-read public addresses (EVM/BTC/ZEC — granted set).
   Signs the ceremony. Wallet keys live on-device.
4. **Royal Guard (bCode):** PLANNED. Native §2 envelopes when bCode ships.

## Routing

- Larva/Pupa enrollments → bni.id permission (T-F verification layer)
- Bee/Royal Guard → ceremony step 6 (T-H signing layer)

This ladder is the MASS-USER (Layer-0 keypair) climb. The hub-tier full-account
mint (SPEC-VAULTA-IDENTITY-1 §5) stays the separate heavyweight ceremony.

## Grant set (Bee tier, from device)

Stock Trezor firmware grants read-address for: EVM (secp256k1), BTC, Zcash.
NO XLM/SOL/VAULTA/HIVE grants at this tier — those unlock at Royal Guard or
advanced firmware.

---

*Goose. Cites: SPEC-VAULTA-IDENTITY-1 v0.2 (Layer-0 mass identity = keypair),
SPEC-ONBOARDING-IDENTITY-1 (progressive custody), FABLE 8i (custom permissions).*
