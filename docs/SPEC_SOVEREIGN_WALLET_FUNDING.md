# SOVEREIGN WALLET-FUNDING SPEC v2 — SELF-FUNDED, NO ENDOWMENT
### Seat: Goose, Seat 1
### Date: 2026-08-10
### Status: SUPERSEDES v1 (74d9d4f) — endowment model was wrong
### Correction: Founder directive — "we are not going to ever supplement/fund anyone's accounts. Everything is self-funded. Users pay their own way."

---

## THE CORRECTION

v1 proposed an "endowment JWK" that pays outer bundle fees for users. That is a **centralized subsidy** — a treasury paying for users is the opposite of decentralized. **Deleted entirely.**

## THE PRINCIPLE (founder's words, not paraphrased)

- **Everything is self-funded.** No subsidy, no endowment, no treasury paying for users. Ever.
- **Users pay their own way.** That is what makes it decentralized.
- **"Free" means no Vaulta account** — not "BNR pays." Tier 1 users get a basic account that exists without needing a paid Vaulta account.
- **Tier 2 users create and fund their own Vaulta account.** Themselves. With their own resources.
- **Fully autonomous, self-learning/healing, scaling to 10B.** No human in the loop, no central funder.

## THE ARCHITECTURE (self-funded)

### How a new user starts with zero balance

1. **bDiD creation (free):** Passkey + BIP-39 seed → derive keypair → did:webvh identifier derived from the key. Pure local computation. Zero cost. No chain interaction needed.

2. **Tier 1 = no Vaulta account.** The user exists on the cheapest/free rail. HIVE custom_json costs RC (resource credits) which regenerate over time — effectively free for basic operations. The bDiD is anchored to HIVE first (the free rail), not Arweave (the paid rail).

3. **User earns b through participation.** b is metabolic energy — earned by contributing to the network (compute, storage, validation, uniqueness proofs, resource provision, social participation). The user starts at zero and earns their way.

4. **User spends b on operations.** When the user has earned enough b, they can:
   - Anchor identity to Arweave for permanence (b → AR conversion at the draw facility)
   - Upgrade to Tier 2: create their own Vaulta account (they acquire A tokens themselves)
   - Upload data, run operations, participate in escrow

5. **The draw facility converts b to native tokens.** The b↔rate is confined to the draw facility (KISS ruling, D-14). But the native tokens come from the NETWORK'S OWN EARNINGS (Autonomi farming earns ANT, HIVE operations earn HIVE, etc.) and from USERS BRINGING THEIR OWN — never from a subsidy fund.

### Tier model (corrected)

| Tier | What "free" means | Who pays | Chains |
|---|---|---|---|
| **Tier 1 (Beginner)** | No Vaulta account needed. HIVE rail is effectively free (RC regenerates). | User earns b through participation. Zero external funding. | HIVE (free rail), local identity |
| **Tier 2 (Intermediate)** | Not free — user creates and funds their OWN Vaulta account. | User self-funds. Acquires A tokens through earning b, trading, or external purchase. | + Vaulta, Arweave (user-funded AR) |
| **Tier 3 (Advanced)** | User has Trezor, funds everything themselves. | User self-funds all chains. | All chains, node operations |

### What this means for the bundler

**There is no endowment signing outer bundles.** The ANS-104 bundling pattern still works, but:
- Each user signs their own DataItem with their own key
- The outer bundle transaction is paid by whoever has the AR — the user themselves
- Multiple users can cooperatively self-bundle (one user pays, others sign inner items), but there is no BNR treasury doing it for them
- The user acquires AR through the draw facility (converting earned b) or externally

### What this means for the wallet MVP

DESIGN-BRIEF-03 corrections needed:
- **Onboarding wizard step 4:** "Your wallet is ready" shows **ZERO balance** (or b earned through initial participation), NOT a "funded starter balance." The wallet is ready; it's empty; the user earns their way.
- **Tier 1 wallet:** exists on HIVE rail. No AR needed. No Vaulta needed. The user participates, earns b, and upgrades when ready.
- **Tier 2 upgrade:** the wallet UI guides the user through creating and funding their own Vaulta account. BNR provides the TOOLS (account creation flow, RAM purchase interface) but NOT the FUNDS.

### What this means for Code

Code's next planned item ("endowment bundler: aggregate DataItems, sign the outer bundle with the endowment") is **CANCELLED.** There is no endowment.

Instead:
- **Ed25519 sig-type-2 support (0515e06):** EXCELLENT work. This is the 3.3× cost lever and it's conformance-proven. Keep it — it's the foundation for user-signed DataItems.
- **Next build:** the self-funding draw facility (b ↔ native token conversion) and the user-signed DataItem pipeline (user signs, user pays, no intermediary).

## ANTI-CAPTURE CHECKLIST (revised)

- [x] **No subsidy** — users fund themselves, always
- [x] **No endowment** — no treasury paying for users
- [x] **No custodial intermediary** — users sign their own data, pay their own fees
- [x] **Self-scaling** — 10B users each earning and spending their own b
- [x] **Autonomous** — no human deciding who gets funded
- [x] **Decentralized** — because users pay their own way

## OPEN ITEMS (revised)

1. **HIVE as the free rail** — verify: can a new user with zero HIVE create an account and post custom_json without any external funding? (HIVE account creation costs; RC delegation needed initially. Who delegates? If no one — the user can't start. RESOLVE THIS.)
2. **b earning mechanism** — what exactly does a new Tier 1 user DO to earn their first b? (The answer to this IS the answer to "how is it free.")
3. **Draw facility reserve** — where do native tokens come from for b conversion? (Network earnings? User-provided? Both?)
4. **Ed25519 DataItem pipeline** — user signs, user pays AR. Code's 0515e06 is the foundation. Next: the user-facing flow.

---

**Goose, Seat 1. Corrected. The endowment model was a centralized error. Self-funded is the only sovereign path.**