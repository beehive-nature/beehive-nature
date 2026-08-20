---
name: renunciation-candidates
description: STANDING LEDGER, founder-ordered 2026-08-19. Every BNR smart contract that is a candidate for eternal renunciation from all humans, including the founder. Indexed by tier — most critical, required, essential. A contract leaves this ledger only by a published burn transaction id or a founder ruling striking it.
sources: [founder directive 2026-08-19 mobile relay]
aliases: ["renounce ledger", "burn list", "eternal renunciation candidates"]
---

# Renunciation candidates — the burn list

Founder, verbatim (2026-08-19): *"please start to keep track of all smart contracts of ours
that are canadots to be eternally renounced from all humans including me. index them most
critical, required and essential"*

**What renunciation means here.** On Antelope/Vaulta: `owner` and `active` authorities set
to `eosio.null`, transaction id published — the pattern already RULED for BEELOG in
`docs/bzdid-architecture-decision.md` §4.4. On EVM: no owner functions in the ABI at all
(the PermaLock shape — unnameable beats renounced) or ownership renounced to the zero
address. **The ceremony spec for the Vaulta burn (msig path, verification, publication) is
owed as research + options — not designed in this ledger.**

**The standing law of this ledger:** renunciation makes every open defect permanent for
the life of the chain — no authority remains that can fix it. Each entry therefore carries
its preconditions; burning early is as irreversible as burning never. Per standing law, no agent executes any burn — every renunciation is founder-hands,
and this ledger only tracks.

---

## TIER 1 — MOST CRITICAL (renunciation is a ruled compliance condition)

### 1. BEELOG `bnames` contract — the bzDiD/.b naming root (future, ruled)
- **Where:** fresh Vaulta account, not yet created (deploys per build order Phase 3-4;
  prototype `banchor.cpp` in `b-domain/anchor/`, rehearsed on Jungle4 as `banchor22222`).
- **Ruled text** (`bzdid-architecture-decision.md` §4.4): *"run Phases 3–4 with a 3-of-5
  msig held by named parties; **burn `owner` and `active` to `eosio.null` at the end of
  Phase 4**, with the transaction id published. Until that transaction exists, this design
  is **not** compliant with Constraint 2 and I will not claim otherwise."*
- **Why most critical:** an unburned `active` key makes every rule of the 10-billion-user
  naming layer rewritable by `setcode` — the largest trusted party in the whole design.
  The burn IS the decentralization event.
- **Preconditions before burn:** Phase 4 complete (permissionless bonded sequencers, fraud
  proofs live, `forced_watermark` validity rule, sha256 challenge CPU benchmarked); the
  independent-third-party-epoch-root test passed with BNR's node off.
- **Status: TRACKED — burn is the ruled Phase-4 exit act.**

## TIER 2 — REQUIRED (live value/identity under a standing human key)

### 2. `kingbeelovis` — the canonical-legacy `.b` registry (LIVE, Vaulta mainnet)
- **What:** bdomain v2 contract, 13 live names, 11 CAIP-2 chainkeys, admin `kingbeelovis`.
  Declared canonical for legacy and FROZEN ("code unchanged", ruled 2026-08-04).
- **Why required:** the admin key is a standing custodian over 13 live identities; every
  day it exists it can `setcode` the registry. The founder holding it is still a human in
  the trust set — exactly what this ledger exists to end.
- **Preconditions before burn — each independently blocking:**
  1. **Bug 1 founder gate resolved** (CLAUDE.md §6.3): the config row holds `0.0000 EOS`
     against a chain whose token is `A`, `registration_fee` is permanently immutable, and
     `registeracc` is ungated — anyone can register any unclaimed name. Burning now makes
     the open namespace and the wrong-symbol row **unfixable by anyone, ever after**.
     Whether that state may become permanent is **unruled**: legacy free-ness is a code
     fact (no token-receipt path exists), but the law book is silent on fee amount, token,
     and payee — and the one ruled fee text that exists points the other way (the decision
     doc §6 sets ~$1–5/yr anti-squatting fees for BEELOG names). So it must be a ruling,
     not a default.
  2. **Renewal mechanics verified against source:** the 13 kingbeelovis names expire
     2027-08-01 (remington.gm's copies 2027-07-28); confirm renewal needs no admin
     authority before the admin ceases to exist. UNVERIFIED — read `bdomain.cpp`'s renewal
     path before any burn word.
  3. BEELOG epoch-0 seeding of the 13 reserved leaves landed (§7.2), so legacy resolution
     is no longer the only home of the names.
- **Status: TRACKED — candidate, blocked on the three preconditions.**

### 3. `remington.gm` — the non-canonical v1 registry (LIVE, Vaulta mainnet)
- **What:** bdomain v1 (no chainkeys), same 13 names, declared non-canonical and frozen;
  a documentation hazard, not a dispute (same human owns both).
- **The honest question:** burn, or simply let it expire 2027-07-28 and never renew? A
  burned wrong registry stays wrong for as long as the chain serves it; an expired one
  dissolves. **Founder's call — this ledger records the fork, not the answer.**
- **Status: TRACKED — candidate, with lapse-instead-of-burn as the live alternative.**

## TIER 3 — ESSENTIAL (permanence is the product itself)

### 4. `BNRiV3PermaLock` — the S-7 lock contract (BUILT, not deployed; exSat lane)
- **What:** Solidity 0.8.25/shanghai to SPEC-S7 v1.0, 9/9 acceptance tests green
  (receipt `docs/receipts/S7-BUILD-0814.md`), target exSat (chain 7200), deploy rehearsal
  owed founder-present (fork-test, verify eth_chainId).
- **Why it leads this tier:** it is already renounced **by construction** — the external
  surface is exactly 2 functions (`onERC721Received`, permissionless `collect()` with the
  recipient hardcoded 100% to ARTIST) plus the constructor; all recorded values private;
  **no owner/withdraw/upgrade surface exists** (T-1 receipt). It is the ledger's own
  standard: *unnameable beats renounced* — a missing admin function cannot be misused by
  anyone, including a future maintainer.
- **Precondition:** none beyond honest deployment (constructor parameters are the last
  human act; after landing there is nothing to burn because nothing grantable exists).
- **Status: TRACKED — the reference shape for every future entry.**

### 5. Horizon entries — named in ruled text, not yet built; listed so the ledger is standing
- **`lovismarket`** (marketplace listing contract — typed in `crates/normalizer` mappings):
  will hold listing state; candidate once built.
- **b-token / paymaster contract** (CD-29, CONSTITUTION `resource.accounting`): value-
  bearing by definition; candidate the day it has an admin key.
- **bInsurance distribution** (SPEC-ORIGINATION-1:414, founder-named): predetermined-
  recipient distribution is only trustworthy renounced; candidate at spec time.
- **Rule for new entries:** any contract this project deploys with any human-held
  authority enters this ledger at write time, tiered at the next founder read.

---

## Not on this ledger, with reasons
- **The MiDi contracts** (May 2024, the fallen anon artist) — not ours to renounce.
- **The kernel's Rust crates** — off-chain; nothing to renounce (the analogous law there is
  the no-custodian doctrine, enforced by type).
- **`banchor22222` (Jungle4)** — testnet rehearsal account; it is the *rehearsal venue* for
  the Tier-1 burn ceremony, not a candidate itself.

**Maintenance:** Seat 3 keeps this current. Initial tiers are seat-proposed per the
founder's indexing order and stand for correction at the first founder read; thereafter
entries change tier or exit only by founder word or a published burn tx id, recorded here
with its receipt.

**Seat 3, opened 2026-08-19.**
