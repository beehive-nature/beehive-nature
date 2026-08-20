# SOVEREIGN WALLET-FUNDING SPEC v3 — ALPHA/BETA STAGED, SELF-FUNDED
### Seat: Goose, Seat 1
### Date: 2026-08-10
### Status: SUPERSEDES v2 — Founder directive on staging + sequencing

---

## THE STAGING MODEL (Founder directive)

### ALPHA (now) — Vaulta A token, not b

The MVP alpha uses **Vaulta A** as the compute/bMeshLLM meter via Buzz. A is the existing native token on Vaulta — it already works, it has value, it pays for RAM/CPU/NET. Users acquire A themselves (self-funded) and spend it on Vaulta operations.

**Buzz relays compute metering:** when a user's bMeshLLM request runs, Buzz meters the A-cost and the user pays in A. Autonomous paying of other accounts (ANT for storage, AR for permanence, RAM/CPU-NET for compute) happens via the adapter layer — but the user's A funds it, not an endowment.

**Alpha tier model:**
- **Guest (free):** basic BNRoSe experience. Browse, read, observe. No chain interaction. No funds needed. Identity is local (bzDiD from passkey).
- **Paid (self-funded):** user acquires A, creates Vaulta account, participates in compute/bMeshLLM, funds their own ANT/AR/RAM/CPU-NET. Everything self-funded.

### BETA (later) — b on mainnet Vaulta, self-funded paid tier

When b deploys on mainnet Vaulta, the paid tier uses b instead of A. But b is still self-funded — users earn or acquire b themselves. The transition from A-metering to b-metering is a token swap, not an architecture change.

### SEQUENCE (Founder directive)

1. **AR/ANT first** — get Arweave and Autonomi functional for all plugins/dApps
2. **Then Vaulta** — A-token compute metering via Buzz
3. **Then HIVE** — social/coordination rail

This sequence means the MVP build order is: storage substrates → compute metering → social coordination. Not all at once.

---

## THE SYBIL IMMUNITY QUESTION (Founder's key challenge)

> "How can they authentically prove 1 in 10 billion + uniqueness for sybil immunity without full BNRoSe resources to begin unlocking b?"

This is the hardest unsolved problem. A guest user with zero resources needs to prove they are a unique human — but uniqueness proof (biometric PoU) is itself a Tier 3 / "later" feature. **How does a guest prove uniqueness before they have the resources to run the uniqueness proof?**

### Candidate approaches (need research, not ruling):

1. **Proof of Work (device-side):** The user's device computes a moderate PoW puzzle that is expensive enough to deter sybil but cheap enough for one person's phone. One puzzle = one identity claim. Not biometric, but raises the cost of fake accounts. Self-funded (device pays in compute).

2. **Social graph attestation (vouching):** Existing unique users vouch for new users. A web-of-trust approach. Requires k unique vouchers per new identity. Bootstraps from the social layer. No resources needed — just human relationships.

3. **Deposit-bond (skin in the game):** The user locks a small amount of A (self-acquired) as a sybil bond. If the identity is proven duplicate, the bond is slashed. Self-funded by definition. The bond size sets the sybil cost.

4. **HIVE reputation as proxy:** HIVE account age + reputation score as a weak uniqueness signal. Not strong alone but composable with other proofs.

5. **Zero-knowledge uniqueness proof:** A ZK proof that the user belongs to a set of unique humans (e.g., from a biometric registry) without revealing which one. Requires the registry to exist first.

**The honest answer: this is an open research question, not a solved problem.** The MVP alpha can ship without full sybil immunity (guest tier is read-only, no value at risk). Sybil resistance becomes critical when b unlocks — and that's the beta timeline.

---

## WHAT THIS MEANS FOR THE BUILD (corrected dispatch)

### Build sequence (Founder directive: AR/ANT → Vaulta → HIVE)

**Phase 0 — AR/ANT functional (Code, now):**
1. Self-hosted ar-io-node on VPS (AGPL, no-token mode) — gateway for all AR reads
2. Autonomi nodes (2-3) on VPS — storage farming + chunk hosting
3. User-signed ANS-104 DataItem pipeline (Code's Ed25519 work 0515e06 is the foundation)
4. User pays AR for their own uploads (self-funded, no endowment)

**Phase 1 — Vaulta A metering via Buzz (Code, after Phase 0):**
1. Vaulta node (SHIP) on VPS
2. Buzz relay meters compute/bMeshLLM costs in A
3. User creates Vaulta account (self-funded — user acquires A)
4. Wallet shows A balance + compute spend
5. Adapter layer routes: A → ANT (storage), A → AR (permanence), A → RAM/CPU-NET (compute)

**Phase 2 — HIVE (after Vaulta):**
1. hived on VPS
2. Buzz relay adds HIVE social/coordination
3. Identity anchoring to HIVE

### Guest vs Paid tier (corrected)

| Tier | Auth | Cost | What they can do |
|---|---|---|---|
| **Guest (free)** | Passkey | Zero | Browse, read, observe. Local identity. No chain interaction. |
| **Paid (alpha)** | Passkey + Vaulta account | Self-funded A | Compute/bMeshLLM, storage (ANT), permanence (AR), trading |
| **Paid (beta)** | FIDO2/Trezor + Vaulta account | Self-funded b | All of above, b-metered, full adapter suite |
| **Advanced** | Trezor + biometric PoU/PoL | Self-funded everything | Node operations, AI-model ops, governance |

---

## OPEN ITEMS (revised)

1. **Sybil immunity for guests** — open research question (5 candidate approaches above). Not blocking alpha (guest = read-only).
2. **AR/ANT setup** — Code can start Phase 0 as soon as VPS is available. Nothing else blocks it.
3. **Buzz A-metering** — how exactly does Buzz relay measure and charge compute costs in A? Needs spec.
4. **Draw facility** — A → ANT/AR conversion mechanism. Self-funded: user's A pays for everything.

---

**Goose, Seat 1. Staging model updated. Leading the build without gating.**