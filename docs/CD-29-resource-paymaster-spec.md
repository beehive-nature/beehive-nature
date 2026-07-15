<!--
STATUS: DRAFT v0.3 — specification only. No implementation exists. No Solidity
is authored here and none is authorised by this document.
v0.3 (revision of record): §7.2 closes the **rate** hole v0.2 left open — v0.2
  deleted `currentEpoch` as an unauthorised pool-refill primitive (§6.3) and then
  left the same primitive standing under the name `epochLength`: a Feature-tier
  vote shortening the epoch multiplied the pool's burn per unit time while
  `epochBudgetWei` — a per-*epoch* bucket, not a rate — sat untouched and no
  predicate objected. The budget is now **derived from a rate**
  (`epochBudgetWei := budgetRateWeiPerSecond × epochLength`) and `epochGenesis` is
  **frozen at deploy**, so the calendar knobs are granularity, not throttle (§7.2,
  §7.4). §6.2.2 specifies the `context` payload, without which §6.2.1's
  reservation could not be released by §6.7 — v0.2 added the reservation and never
  gave `postOp` the state to release it. §6.4 pins the **voucher body** encoding
  and the exact byte length per version — the one leg "read it from the deployed
  source" cannot reach, because the body is our format, not the EntryPoint's.
  §0/§2 reconciled on the companion (the claim now matches the mechanism); §5.2,
  §5.6, §11 and U-11 trued up against their own citations and greps.
v0.2: §9's basis re-checked against the tree and corrected —
  crates/chain-exsat-evm EXISTS and the v0.1 register said it did not (§9's
  correction of record; §1's placement table). §6.2.1 adds the validation-phase
  reservation the caps were asserted to have and did not (§7.2 named the failure
  it then committed). §6.3 removes `currentEpoch` — undefined, unimplementable,
  and an unauthorised pool-refill primitive — in favour of an epoch binding by
  arithmetic over signed fields. §5.6 adds the credit-direction fail-closed rule
  (indeterminate ⇒ WITHHOLD), which the sixteen §8 rows never gave. §6.4 gives the
  paymasterAndData layout P-1 pointed at and §6.4 lacked. §10 Q-7 raises the
  pause principal, which article-vi-s3.md:78 destroys with no named successor.
Scope: the CD-29 Resource Paymaster, exSat / ERC-4337 leg.
Owner: KERNEL repo (this tree). BNRi is the first consumer, never the owner (§1).
Every external dependency in this document is UNVERIFIED — browser/testnet check
pending. The register is §9. Nothing here may be treated as a kernel assumption
until it clears CONSTITUTION.md Article IV.
Step-zero sources read (this tree, at draft time):
  ORDERS-1.md (v0.7 — seat law, doctrine 3/5/9)
  docs/CONSTITUTION.md (Art. III adapters; Art. IV verification; Art. V.1
    "the paymaster abstracts user-funded payment; it must never absorb cost";
    Art. VI.4 reference implementations)
  docs/article-vi-s3.md (§3.3 tier ladder; §3.4 quorums; GOV-1 — b confers zero
    governance weight, in any form, at every tier, forever)
  docs/feature-backlog.md (CD-13 Resource Paymaster capture; the two-loop law;
    the bSAFE exclusion; CD-27 population anchor; CD-29 quarantine)
  docs/risk-register.md (R-004 — independent view before any signature)
License: CC-BY-4.0, consistent with docs/architecture/did-autonomi-spec.md.
-->

# CD-29 Resource Paymaster — exSat / ERC-4337 leg (SPEC, DRAFT v0.3)

A kernel-signed, voucher-gated gas sponsorship path for exSat. The paymaster
fronts **BTC** for gas. The kernel debits **b** on its own ledger. The two facts
meet at a seam that is drawn in §3 and never crossed anywhere else in this
document.

This is a specification. It is implementable-from, and it is not implemented.

---

## §0 — The security model, stated once, at the top

This section exists because this model has already been inverted once in this
project's history. Read it before any other section.

> **ENFORCEMENT IS THE VOUCHER GATE, ON-CHAIN.**
> `validatePaymasterUserOp` sponsors an operation **only** if that operation
> carries a valid kernel-signed voucher binding it to this exact account, this
> exact nonce, this exact calldata, an allowlisted target, and a cost ceiling.
> The kernel will not sign a voucher for a call outside the allowlist or beyond
> the user's b balance.
>
> **Sponsorship is voucher-gated by construction.**

> **bLOVErAi's simulation and quote are UX FOR HONEST USERS. THEY ARE NOT THE
> DEFENCE.**
> An attacker never opens the companion. An attacker hands UserOps to a bundler
> directly, and the bundler has never heard of bLOVErAi. The companion is not on
> the attacker's path and therefore cannot be on the defence's path.
>
> Any sentence anywhere — in this repo, in a comment, in a review, however
> hedged — claiming that simulation, quoting, or the companion prevents
> gas-drain griefing is a **defect**, and is to be deleted rather than softened.
> The griefing counter is §6 (the acceptance predicate) and §7 (the caps).
> Nothing else.

Corollary, load-bearing: **the contracts never depend on the companion.** If
bLOVErAi is offline, wrong, or absent forever, §6 is unchanged and the
permissionless path (§2) is unchanged. bLOVErAi never blocks the human; on
anomaly it warns and declines to sponsor, and the human's own key on the
standard path remains open.

**The companion is never a chokepoint on the human, and that is the claim — no
larger one.** T0 and T1 are always open, neither requires the companion, and §2
rule 2 is the mechanism that keeps T1 open rather than merely asserted. What this
document does **not** establish is a route to a *voucher* that does not run
through the companion: §5.2 step 6 says only "hand the voucher to the caller", and
nowhere is a wallet shown to be that caller independently — **§2:T3 states this as
an open dependency of the T2 rung.** So a companion outage costs **T2**, which §2
rule 4 calls a UX regression, and costs the human nothing.

That gap is a **dependency, not an inversion**, and the distinction is the whole
of this section: the companion is nowhere a *defence* — it holds no keys, signs
nothing, and §6 never consults it — and an attacker who skips it gains nothing,
because the gate he must pass is on-chain and unmoved. A chokepoint on the
sponsored *convenience* path is survivable by construction; a chokepoint on the
human would not be, and is what "never a chokepoint" is here to forbid. Writing
the sentence unqualified would have asserted a wallet→signer route the mechanism
does not build — a claim the mechanism does not have, which is a defect by this
document's own rule.

Ceiling on claims about this design, per LANGUAGE LAW: **sound by construction /
isolated by design.** Not more. An audit is not a proof.

---

## §1 — Placement: whose organ this is

**This belongs to the KERNEL repo.** It is the CD-29 Resource Paymaster.

`docs/feature-backlog.md` captures the Resource Paymaster at **CD-13** ("the
Resource primitive's first organ") and captures **CD-29** as the emergent
eternal-runtime observation whose first named unbuilt floor *is* the paymaster.
This dispatch names the artifact CD-29. That numbering divergence is flagged for
founder ruling in §10 (Q-1); it changes no content here.

**BNRi is the first consumer, not the owner.** BNRi contracts and the EVM gas
layer are **b-blind** (§3). A consumer that could change the sponsorship policy
would be the owner; §7 puts that power in Respect-weighted governance instead.

Layering, per `CONSTITUTION.md` Article III (chains are capability adapters, not
platform; downward-only dependencies; traits separated from implementations):

| Layer | Owns | Must not know |
|---|---|---|
| **Kernel core** (chain-agnostic) | the b ledger; the signing policy (§5); caps and allowlist as *policy data* (§7); the debit-before-signature ordering | EIP-712, EntryPoint, `paymasterAndData`, BTC, wei, exSat |
| **exSat log adapter** (`crates/chain-exsat-evm` — **already exists**; workspace member in `Cargo.toml`, sibling of `crates/chain-eos` and `crates/chain-zano`) | the pinned chainId (`EXSAT_MAINNET_CHAIN_ID`); the chainId **comparison** (`IndexerConfig::verify_observed_chain_id`); EVM log decoding | what b is; any b balance; any b amount. **Also: keys** — it holds none and signs nothing. **Also: the endpoint** — it ships no RPC `LogSource`, so it cannot *make* the `eth_chainId` call it can check the answer of (see below) |
| **exSat signing component** (the EIP-712 half — **does not exist**; see the separation note below) | EIP-712 domain and encoding (§4); the EntryPoint version binding; **the RPC, and therefore the `eth_chainId` pre-flight of §4.2**; the voucher signature | what a b *amount* is. It signs the receipt of a debit, never the amount (§3.4) |
| **Paymaster contract** (Solidity, on exSat — **not authored here**) | the acceptance predicate (§6); the on-chain caps (§7); the BTC deposit | b, in every form. It has no b field, no b storage, no b event, and no b import |
| **bLOVErAi** (companion, off-path) | disclosure, comprehension confirmation, decline-to-sponsor | keys. It never holds one and never signs |

**Citations into `chain-exsat-evm` name symbols, never line numbers.** That crate
is under active development and its line numbers moved *during this revision* —
`EXSAT_MAINNET_CHAIN_ID` shifted while §9's correction was being written. A
line-number citation into a moving file is a citation with an expiry date, which
is the defect §9 exists to correct, not to repeat. This follows the crate's own
convention: `Verification::Verified { source }` cites "contract file + event
declaration, **at a pinned commit**" (`signatures.rs`) — a symbol plus a commit,
never a bare line.

**Do not create a second exSat adapter.** An earlier draft of this line called for
a new `chain-exsat` crate. That was wrong when written or has been overtaken: the
adapter landed as `crates/chain-exsat-evm` (C-1) and occupies exactly that slot.
The chainId is pinned **once**, as `EXSAT_MAINNET_CHAIN_ID`, and asserted by its
own test (`mainnet_chain_id_is_7200`). §4.2 calls chainId discipline
non-negotiable; two pins of one founder-declared constant are two things free to
drift, so this spec adds **no second pin** and any implementation that introduces
one is a defect.

**The keyless-indexer / signing-component separation is deliberate, not
incidental.** `chain-exsat-evm` is a read-only indexer that "holds no keys and
signs nothing, which is also why it pulls in no signing stack" (`src/lib.rs`; it
deliberately avoids `alloy`/`ethers` to keep a signing surface out of a read-only
crate — `README.md`, "Dependencies"). The voucher signer of §5 is the opposite
kind of object: it holds the kernel's signing key. **The EIP-712 signing half
therefore does not go inside `chain-exsat-evm`**, and this spec does not settle
where it does go — that is an implementing dispatch's call, constrained only by:
it imports the chainId pin rather than restating it, and it never gives the
indexer a key. Stating the separation is the point; arriving at it by accident is
how the read-only crate acquires a signing stack nobody asked for.

**The adapter cannot perform §4.2's `eth_chainId` pre-flight, and §4.2 must not
be read as saying it does.** The crate ships **no RPC `LogSource`** — `LogSource`
is a trait seam with no in-tree implementation, and it pulls in no HTTP client.
Its README states the consequence as a **caller obligation** it "cannot enforce":
blocks arrive already "stripped of endpoint identity," `chain_id` is "inert config
after construction," and **"a mismatch is fail-closed *when checked*, and
unnoticed when not."** What the crate owns is the **comparison**
(`IndexerConfig::verify_observed_chain_id`); what it cannot own is **obtaining the
observed id**, because it never talks to an endpoint.

So the pre-flight belongs to **whoever holds the RPC** — the signing component,
which must call `eth_chainId` itself and hand the answer to the comparison, and
refuse on mismatch **or on error** (§8 F-3). This is a real seam, not a
formality: an unchecked pin is silent, and a silent unchecked pin is exactly the
"transport error becomes a green light" shape §8 forbids. **A component that
holds a key and an endpoint may not delegate the pre-flight to a component that
has neither.**

**The core does not change when a chain is added.** Adding a second 4337 chain
adds a second adapter and a second deployed paymaster. §5's signing policy is
untouched. If a proposed change to this spec would require editing kernel core to
add a chain, the change is wrong.

`b` is never bridged, never gas, never an ERC-20 on exSat. There is no b contract
on exSat. There is no b token address to hardcode, because there is no b token
there. See §3.

---

## §2 — Degradation law: gasless is progressive enhancement

**The standard wallet path MUST work on day one with no paymaster, no bundler,
and no companion.**

| Tier | Requires | Day-one status | If it dies |
|---|---|---|---|
| **T0 — standard wallet** | user's key, an RPC, BTC for gas | **MUST ship working.** The reference path. | nothing above T0 can save the system; T0 *is* the system |
| **T1 — bundled (4337, self-paid)** | EntryPoint + a bundler | optional | fall back to T0 — **conditional on rule 2** |
| **T2 — sponsored (this spec)** | T1 + paymaster + kernel signer | optional | fall back to T1, then T0 |
| **T3 — companion UX (bLOVErAi)** | T2 + companion online | optional | fall back to **T1, then T0** |

**Why T3's fallback is T1 and not T2.** An earlier draft said a wallet could fall
back to T2 by "carrying a voucher without the companion." This document does not
support that. A voucher's window is a single block-inclusion horizon (§5.5), so
there is nothing to carry — an issued voucher is worth seconds, not the length of
a companion outage. And obtaining a *fresh* voucher means reaching the kernel
signer, whose only specified output step is §5.2 step 6, "hand the voucher to the
caller"; nowhere does this spec establish that a wallet can be that caller
independently of the companion. F-11 is the honest version and lists T0/T1 only.
The degradation **law** is not at stake either way — T0/T1 stay open, which is all
it requires — but the table must not assert a rung the mechanism does not build.

**Open dependency (the T2 rung): the wallet→signer route.** Stated plainly here
so that no section may be read as having built it. §5.2 step 6 names a "caller"
and this document never says who may be one; the only caller it describes anywhere
is the companion. Two consequences, and an implementing dispatch must not paper
over either:

- **What is open:** whether a wallet can obtain a fresh voucher with the companion
  offline. Closing it means specifying the signer's request interface and its
  authentication — which is an implementing dispatch's design, constrained by §5
  (the signer signs on policy, never on a caller's say-so: §5.4's last-but-one row
  bars a caller-proposed ceiling, and §5.3 is unchanged by *who* asks). **This is
  not a founder gate**; it invents no role and settles no tier. It is unbuilt work,
  named.
- **What is NOT open, and does not become open by leaving it so:** the companion is
  still nowhere a defence (§0), the human is still never blocked (T0/T1, rules 1
  and 2), and a companion outage is still a T2 UX regression under rule 4. A
  dependency of the *sponsored* rung on an off-path component costs convenience.
  It would be an inversion only if §6 consulted the companion, and §6 cannot.

Rules that follow, and that a reviewer should test this document against:

1. **No contract may require a voucher.** BNRi contracts accept an ordinary
   EOA transaction from an ordinary wallet. A contract that reverts unless
   sponsored has made T2 mandatory and broken this law.
2. **No account may require the EntryPoint.** The BNature 4337 smart account
   (§4.4 `account`, §5.3.5) MUST accept a direct call from its owner key, without
   passing through the EntryPoint. Rule 1 secures the T2 rung; this rule is what
   secures T1, and without it the T1 row above is an assertion rather than a
   mechanism: many account designs accept calls **only** from the EntryPoint, and
   if BNature's does, a bundler outage is an *outage*, not the "UX regression"
   rule 4 promises. The rule is also what makes the fallback *the same user*:
   §5.3.5 binds soul-attestation to the smart account, so a T0 path that meant
   "transact from the owner EOA as a different address" would drop the state and
   the attestation that live behind the account. The owner-direct path keeps the
   account address, and therefore the attestation, intact. **If the account design
   cannot honour this rule, T1's fallback is not secured and that is a defect in
   the account, to be fixed there and not absorbed here.**
3. **No feature is T2-only.** If a capability can be reached *only* while
   sponsored, the paymaster is now infrastructure, not enhancement.
4. **A T2 outage is a UX regression, never an outage.** Users pay their own BTC
   and continue. This is the correct behaviour, not a degraded one.
5. **Deleting the paymaster is a supported operation.** The system must remain
   whole. If it does not, this spec has grown a dependency it was written to
   forbid.
6. The permissionless path is always open — this is the same law as §0's
   corollary, seen from the user's side rather than the attacker's.

---

## §3 — THE b-ACCOUNTING SEAM

The single most misreadable thing in this design. It is drawn here, once, in
full, and every other section defers to this one.

### 3.1 The seam, as a diagram

```
        KERNEL SIDE                    ║            EVM SIDE (exSat)
        (b lives here, only here)      ║            (BTC only. b does not exist here.)
                                       ║
  ┌─────────────────────────────┐      ║      ┌──────────────────────────────┐
  │ b ledger                    │      ║      │ Paymaster contract           │
  │  · earned-only              │      ║      │  · holds a BTC deposit       │
  │  · 420 per soul, lifetime   │      ║      │  · pays gas in BTC           │
  │  · 18 decimals              │      ║      │  · verifies the voucher      │
  │  · new supply ONLY when a   │      ║      │  · knows NOTHING about b     │
  │    new unique human joins   │      ║      └──────────────┬───────────────┘
  └─────────────┬───────────────┘      ║                     │
                │                      ║                     │ BTC
    (1) DEBIT b ▼  ← happens FIRST     ║                     ▼
  ┌─────────────────────────────┐      ║      ┌──────────────────────────────┐
  │ debit record (kernel-local) │      ║      │ EntryPoint  (BTC gas market) │
  │  · quoteRef: bytes32        │      ║      └──────────────┬───────────────┘
  └─────────────┬───────────────┘      ║                     │
                │                      ║                     ▼
    (2) SIGN    ▼                      ║      ┌──────────────────────────────┐
  ┌─────────────────────────────┐      ║      │ BNRi contracts (b-blind)     │
  │ GasSponsorshipVoucher       │      ║      └──────────────────────────────┘
  │  fields: account, nonce,    │      ║
  │  callDataHash, target,      │══════╬═════▶  crosses the seam as bytes
  │  maxCostWei, window,        │      ║        (BTC ceiling + binding + an
  │  voucherId, epoch,          │      ║         opaque quoteRef — NO b field)
  │  policyVersion, quoteRef    │      ║
  └─────────────────────────────┘      ║
                                       ║
    (4) RECONCILE ◀════════════════════╬══════ (3) actual BTC cost, quoteRef
        (kernel-side only; a b         ║           emitted in a paymaster event
         re-debit or refund never      ║
         touches the EVM)              ║
                                       ║
                            THE SEAM ══╝  b never crosses. Not once. Not encoded.
                                          Not wrapped. Not as a number in calldata.
```

### 3.2 The seam, as a table

| Question | Kernel side | EVM side |
|---|---|---|
| What is the unit? | **b** (18 decimals, earned-only, metabolic energy) | **BTC** (18 decimals, exSat gas) |
| Who moves it? | the kernel's own ledger, internally | the paymaster's BTC deposit, via EntryPoint |
| Is it a token contract? | no — a kernel ledger | b: **there is none.** BTC: chain-native gas |
| Does the other side see it? | the kernel sees BTC costs (it reconciles them) | **the EVM never sees b** |
| Can it be bridged? | **no** | there is nothing there to bridge |
| Rate / price between them? | see §10 Q-3 — **founder-gated, not settled here** | — |

### 3.3 The seam, as prohibitions S-1 … S-6 (each one is testable)

- **S-1.** No field of any struct that crosses the seam is denominated in b.
  The voucher (§4) has **twelve fields and none of them is a b amount.**
- **S-2.** The paymaster contract contains no b balance, no b mapping, no b
  event parameter, no b-denominated constant, and no b in an identifier.
  Grep-verifiable at review: a hit is a defect.
- **S-3.** `b` is **never bridged, never gas, never an ERC-20 on exSat.** No
  wrapper. No mirror. No "representation for accounting convenience."
- **S-4.** Users see b as a UX denomination via **kernel-side accounting only**.
  A number in a UI is not a token on a chain, and the UI reads the kernel, never
  the chain, for it.
- **S-5.** `b != A != BTC`. These are three different things with three different
  laws. Never write "A/b-token" or any construction that treats them as
  interchangeable — that slash is how the seam erodes. Reject the phrasing in
  review even when the surrounding claim is correct.
- **S-6.** `quoteRef` is **opaque**. It is a correlation handle for the kernel's
  own reconciliation. No contract interprets it, branches on it, or derives
  anything from it. It is not a b amount in disguise, and if a future change
  makes it one, that change violates S-1.

### 3.4 Why the voucher is *called* a b-debit voucher and *carries* no b

The name records **what the kernel did before it signed**: it debited b. The
signature is the receipt of that debit. The bytes record only **what the EVM
needs**: a BTC ceiling bound to one exact operation.

That gap between the name and the payload **is the seam.** An implementer who
"fixes the inconsistency" by adding a `bDebit` field to the struct has not
tidied the spec — they have put b on the EVM and broken the invariant this whole
document exists to hold.

### 3.5 The two-loop tension (NOT resolved here)

`docs/feature-backlog.md` (CD-13, "Two-loop law", founder direction 2026-07-06)
states that the money loop and the metabolic loop **never touch**, that b is
"neither a coin slot, nor a dispensed product, nor a redemption ticket in the
paymaster", and that b's utility extends to "the **service layer** of all
platform functions … never the commodity layer."

Debiting b in exchange for the treasury fronting BTC gas is, on its face, b
buying a chain commodity out of a treasury-funded pool. `CONSTITUTION.md`
Article V.1 sharpens the same edge: "The paymaster *abstracts* user-funded
payment; it must never *absorb* cost."

This spec **does not rule on that tension and must not be read as having ruled
on it.** It is escalated as **Q-2** in §10, founder-class. Everything in §4–§8 is
mechanism, and mechanism is written so that whichever way Q-2 lands, the seam in
§3.1 is the same seam.

---

## §4 — Voucher schema

### 4.1 Name

On the wire the type is **`GasSponsorshipVoucher`**. Colloquially, and in the
dispatch that ordered this spec, it is "the b-debit voucher" — see §3.4 for why
both names are correct and why the struct carries no b.

### 4.2 EIP-712 domain (domain separation)

```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)

name              = "BNature Resource Paymaster"
version           = "1"                     // bumped on any struct change; see §4.6
chainId           = <PINNED IN CONFIG>      // exSat mainnet: 7200
verifyingContract = <the deployed paymaster address on that chainId>
```

Why each field earns its place:

- **`chainId`** — a voucher signed for one chain must not verify on another.
  Cross-chain replay is closed by the domain, not by convention.
- **`verifyingContract`** — a voucher for paymaster A must not verify at
  paymaster B on the same chain (e.g. a v2 deployment running alongside v1).
- **`name` + `version`** — closes cross-protocol and cross-schema replay: a
  signature over a different struct under a different name cannot collide into a
  valid voucher.

**chainId discipline (non-negotiable):**

- exSat **mainnet chainId = 7200**; gas = **BTC** (18 decimals); EVM level
  **Shanghai** (see U-6).
- exSat **testnet may be 839999 or 840000** — **UNVERIFIED (U-2)**. Do not guess.
- **Never trust an RPC URL.** `eth_chainId` MUST be called and compared to the
  pinned config value **before signing anything**, refusing on mismatch **or on
  error** (§8, F-3). A URL is a string; a chainId is an answer.
- **Whose duty that is, precisely** (§1): **not the log adapter's.**
  `chain-exsat-evm` ships no RPC `LogSource` and cannot obtain an observed chain
  id — its README carries this as a caller obligation it "cannot enforce," noting
  that a mismatch is "fail-closed *when checked*, and unnoticed when not." The
  adapter owns the **pin** (`EXSAT_MAINNET_CHAIN_ID`) and the **comparison**
  (`IndexerConfig::verify_observed_chain_id`). **The signing component holds the
  RPC and therefore owns the call**, and §5.2 step 1 is its obligation. An earlier
  draft of this line assigned the call to "the adapter" — a component structurally
  incapable of making it, which is how a non-negotiable check becomes nobody's job.
- The pinned chainId lives in config, not in code, and not inferred from an
  endpoint name. This mirrors `docs/risk-register.md` R-004: never let the thing
  you are about to trust be the thing that tells you to trust it.
- **Contract-side:** if the paymaster caches its domain separator at deploy time,
  it MUST re-derive on `block.chainid` mismatch (the standard fork-safety
  pattern). A cached separator from a pre-fork chainId is a live cross-chain
  replay surface.

### 4.3 The struct

```
GasSponsorshipVoucher(
    address account,          // MUST equal userOp.sender
    uint256 accountNonce,     // MUST equal userOp.nonce  — the primary replay key (§4.5)
    bytes32 callDataHash,     // keccak256(userOp.callData) — binds the exact call
    bytes32 accountInitHash,  // deployment binding; bytes32(0) = deployment forbidden (§4.4)
    address target,           // the single allowlisted callee this op may reach
    uint256 maxCostWei,       // BTC ceiling, in wei. The ONLY money in this struct.
    uint48  validAfter,       // unix seconds, inclusive
    uint48  validUntil,       // unix seconds, inclusive; 0 is NOT "forever" (§4.5)
    bytes32 voucherId,        // unique per issuance; secondary replay key (§4.5)
    uint32  epoch,            // sponsorship epoch this draws against (§7)
    uint16  policyVersion,    // the policy the kernel signed under (§7.4)
    bytes32 quoteRef          // OPAQUE kernel ledger handle. Not interpreted on-chain. (§3.3 S-6)
)
```

Type hash:

```
keccak256("GasSponsorshipVoucher(address account,uint256 accountNonce,bytes32 callDataHash,bytes32 accountInitHash,address target,uint256 maxCostWei,uint48 validAfter,uint48 validUntil,bytes32 voucherId,uint32 epoch,uint16 policyVersion,bytes32 quoteRef)")
```

Digest: the standard EIP-712 construction — `keccak256(0x1901 ‖ domainSeparator ‖ hashStruct(voucher))`.

Signature: 65-byte `(r, s, v)` ECDSA over that digest. Malleability: reject
`s > secp256k1n/2` and reject `v ∉ {27, 28}` (the OpenZeppelin ECDSA
tryRecover discipline). `ecrecover` returning `address(0)` is a **failure**, not
a match — see §8 F-2. Signer-set membership is §5.4.

**Note the deliberate absence.** There is no b amount, no b balance, no b
reference, and no rate. The kernel's b debit is a **precondition of the
signature existing at all** (§5.2), not a parameter of it. §3.4.

### 4.4 Field notes an implementer will need

| Field | Notes |
|---|---|
| `account` | The 4337 smart account. Bound in §6 P-5. |
| `accountNonce` | The EntryPoint's 2D nonce (`key ‖ seq`), read as `userOp.nonce`. Bound in §6 P-6. Carries the replay defence — §4.5. |
| `callDataHash` | `keccak256(userOp.callData)` over the **whole** field. Binds the op to one exact call, arguments included. A voucher for `transfer(alice, 1)` does not authorise `transfer(mallory, 1)`. |
| `accountInitHash` | Binds first-deployment ops. v0.6: `keccak256(userOp.initCode)`. v0.7: `keccak256(abi.encodePacked(factory, factoryData))`. **`bytes32(0)` means: this voucher does not authorise a deployment**, and §6 P-8 then requires the deploy field be empty. Deployment is the expensive path and must be authorised explicitly, never by omission. |
| `target` | Redundant with `callDataHash` by construction, and kept anyway: it makes the allowlist check (§6 P-9) a direct comparison against paymaster storage rather than an inference, and it makes the authorisation legible in an event. Redundancy on the deny path is a feature. |
| `maxCostWei` | The BTC ceiling. Bound against the EntryPoint-supplied `maxCost` in §6 P-10. This is what actually caps a drain per-op. |
| `validAfter` / `validUntil` | Enforced by the **EntryPoint**, not by the paymaster reading the clock — §6.3. |
| `voucherId` | Kernel-unique, unpredictable (§5.5). Secondary replay key. |
| `epoch` | Which budget window this draws against (§7.2). Bound in §6 P-13. |
| `policyVersion` | Bound in §6 P-2. Lets governance retire a policy without waiting for outstanding vouchers to expire. |
| `quoteRef` | Opaque. Echoed in the paymaster's event so the kernel's watcher can reconcile the actual BTC cost against the ledger row (§3.1 step 4). §3.3 S-6 governs it. |

### 4.5 Replay protection — two layers, and why it is not `userOpHash`

**Why the voucher does not sign `userOpHash`.** `userOpHash` is computed over the
UserOperation *including* `paymasterAndData` — and the voucher lives *inside*
`paymasterAndData`. Signing the hash that contains the signature is circular. So
the voucher signs the **operative fields directly** (`account`, `accountNonce`,
`callDataHash`, `accountInitHash`), which is the same structural resolution the
canonical `VerifyingPaymaster` sample reaches. **UNVERIFIED (U-4)**: that both
EntryPoint v0.6 and v0.7 include `paymasterAndData` in the userOpHash preimage as
described, on exSat's actual deployment — verify against the deployed bytecode's
source, not against this sentence.

**Layer 1 — the EntryPoint nonce (primary).** The voucher binds `accountNonce`
(§6 P-6). The EntryPoint consumes `(sender, nonce)` exactly once. A voucher
therefore cannot be replayed: its op's nonce is spent, and any re-submission
fails at the EntryPoint before the paymaster is consulted. **UNVERIFIED (U-5)**:
that exSat's EntryPoint is unmodified stock with stock nonce semantics. If it is
not, Layer 1 is void and Layer 2 becomes primary — which is precisely why Layer 2
exists.

**Layer 2 — the `voucherId` ledger (defence in depth).** The paymaster records
`voucherId` as spent in `postOp` and refuses a seen `voucherId`. It is **not** the
primary defence, because a validation-phase storage write is subject to the 4337
validation rules (**U-7**) and because it does not fire on ops that never reach
`postOp`. It is carried because a defence that rests on one assumption about
someone else's deployed contract rests on one assumption too many.

**Expiry.** `validUntil` is **mandatory and finite**. `validUntil == 0` MUST be
rejected (§6 P-12); the 4337 convention that zero means "no expiry" is exactly
the fail-open reading this spec forbids. The kernel signs short windows (§5.5) —
an expired voucher is a denied voucher, and a voucher with no expiry is a
standing grant to whoever holds the bytes.

### 4.6 Versioning

`version` in the domain is bumped for **any** change to the struct or the type
hash. Vouchers under an old domain simply do not verify. `policyVersion` inside
the struct is bumped for changes to caps/allowlist **without** a struct change
(§7.4). Two knobs because they retire at different speeds, per
`CONSTITUTION.md` Article VI.1 (additive evolution; canonical objects carry
versions).

---

## §5 — Kernel-side signing policy

### 5.1 The one-sentence policy

The kernel signs a voucher **only** as the receipt of a b debit it has already
committed, for a call it has already checked against the allowlist and the caps,
on a chain whose id it has already confirmed by `eth_chainId`.

### 5.2 Ordering (this order is the policy)

```
1. verify chainId via eth_chainId against pinned config   → mismatch/error ⇒ REFUSE (§8 F-3)
2. check the call against the allowlist                    → miss ⇒ REFUSE
3. check the user's b balance and caps                     → short ⇒ REFUSE
4. COMMIT the b debit to the kernel ledger (durable)       → failure ⇒ REFUSE
5. THEN sign the voucher
6. hand the voucher to the caller
```

**Step 4 precedes step 5, always.** If the debit is not committed, there is no
signature. If the process dies between 4 and 5, the user has been debited for a
voucher that does not exist — that is a **reconcilable overcharge**, refundable
kernel-side (**§8 F-6**, and the row matters: F-6 is the *determinate* one — no
voucher was returned and none can land, so the refund fires under §5.6 R-3/R-4
without waiting on evidence. **Not F-8**, "voucher issued, op never lands," whose
whole point is that it is **not** determinate: R-1 requires positive evidence the
op did not land, and expiry alone is not it. An implementer who follows this
sentence to the wrong row applies the wrong credit rule in the direction that
mints). If the order were reversed, a crash between signing and
debiting produces a **valid voucher that nobody paid for** — an unbounded,
unreconcilable hole in the pool. Fail-closed means preferring the recoverable
failure. The asymmetry is the whole reason for the ordering, and a "harmless"
reorder in review is a defect.

### 5.3 What the kernel WILL sign

All of these must hold, or the kernel does not sign:

1. The target is on the **current** allowlist (§7.3) — our contracts only.
2. The decoded call is a permitted selector on that target (§7.3).
3. `maxCostWei` ≤ the per-op ceiling **and** ≤ the user's remaining per-epoch cap
   **and** ≤ the pool's remaining epoch budget (§7.2).
4. The user's b balance covers the debit at the current policy — and the debit
   has committed (§5.2 step 4).
5. The account is a known/derivable BNature smart account for an attested soul.
6. `validUntil` is finite and short (§5.5).
7. The pinned chainId matched a live `eth_chainId`.
8. The policy in force is not paused (§7.5).
9. **The whole window lies inside one epoch:** `epochOf(validAfter) ==
   epochOf(validUntil) == voucher.epoch`, under the calendar of the policy being
   signed under (§7.2). This is the kernel-side mirror of P-13 — the kernel
   refuses to *waste* a signature the paymaster would deny, exactly as it does for
   the allowlist (§7.3). **Near an epoch boundary,** the kernel issues against
   whichever epoch fully contains the window; if neither does, it **refuses**, and
   the user takes T1/T0 for at most one block-inclusion horizon (§2). A kernel
   that "helpfully" stretched the window across the boundary would be signing a
   voucher that cannot verify — and one that stretched the *epoch* to fit the
   window would be reaching for the pool-refill primitive §6.3 deleted.

### 5.4 What the kernel WON'T sign — and why

| Won't sign | Why |
|---|---|
| A call to any target not on the allowlist | The allowlist is the drain boundary. An arbitrary target is an arbitrary gas bill payable by our pool. |
| A call beyond the user's b balance | b is earned-only. Sponsoring past the balance mints a claim nobody earned. |
| A blanket, long-lived, or open-ended voucher | A standing grant is a bearer instrument for gas. Windows are short (§5.5). |
| A voucher with `validUntil == 0` | §4.5. Zero is not "forever" here; zero is refused. |
| A voucher whose `maxCostWei` the caller supplied unchecked | The kernel computes the ceiling from policy. A caller-proposed ceiling is a caller-proposed budget. |
| A voucher for a chainId it did not confirm live | §4.2. |
| Anything, on transport error or indeterminate state | Fail-closed (§8). A timeout is not a yes. |
| A voucher for an account whose soul-attestation it cannot verify | Sybil exposure is CD-13's named open question; unverifiable ⇒ refuse. |
| **A voucher because bLOVErAi said the op looked fine** | The companion is not an authority. It holds no keys and signs nothing. Its opinion is UX. §0. |
| A second voucher for a `(account, nonce)` it has already signed | Two vouchers, one nonce: at most one lands, but both debited. Refuse and reuse the outstanding voucher. |

**The kernel signer is not an oracle of intent.** It does not ask "does this look
like something the user wants?" It asks "is this within a policy someone with
authority set?" Those are different questions, and only the second one is
answerable by a machine holding a key.

### 5.5 Signer hygiene

- **The signing key is a kernel secret and never leaves the signer boundary.**
  The spend-secret-never-in-RAM invariant of this tree applies to it. No private
  key material appears in this document, in config committed to this repo, or in
  any log.
- **The signer set is plural and rotatable on-chain** (§6 P-3). A single signer is
  a single point of total sponsorship compromise — the same shape
  `docs/risk-register.md` R-001 names for the DRO, and it takes the same answer:
  threshold-held, never one secret on one box.
- **`voucherId` is unpredictable** (CSPRNG, ≥128 bits of entropy, or a keyed
  derivation over the ledger row). A guessable id is a grinding surface against
  Layer 2 (§4.5).
- **Windows are short.** Order of a single block-inclusion horizon, not hours.
  The exact value is an operational parameter under §7.4, not a constant here.
- **The signer is rate-limited independently of the caps.** A cap says how much;
  a rate limit says how fast. A compromised signer within cap but at machine
  speed is still a drain.
- **Every signature is logged with its `quoteRef` and its debit row before it is
  returned.** An unlogged signature is an unreconcilable one.

### 5.6 Reconciliation — the credit direction, and its fail-closed rule

Everything above governs **refusing to sign**. This subsection governs the other
direction: **crediting b back**. It exists because the safe default here points
the opposite way, and a spec that states fail-closed only once states it for only
half its surface.

> **For a signature, indeterminate means REFUSE. For a refund, indeterminate
> means WITHHOLD.** Both are the same law — *never let a transport error create
> value nobody earned* — and they are opposite motions. A rule that says only
> "when in doubt, don't sign" leaves the refund path to improvise, and the refund
> path is the one that can put b on the ledger.

**Five rows of §8 govern the credit direction: F-6, F-8, F-15, F-17, F-18** — the
same five §8:"Blocked in which direction?" and §11 enumerate, and this subsection
claims authority over all five. **Two of them govern it by *declining* to credit**
(F-17 **withholds**; F-18 is a **no-op**), and that is not a different regime: a
withhold is a decision about a credit, taken under R-1, and a no-op is R-4's
terminal state answering. Counting only the rows that end in a *credit* would
leave §5.6 claiming three-fifths of its own surface — and the two it dropped are
the two added *for* this subsection, which is to say the two where the rule does
the most work. b is **earned-only**: new
supply exists only when a new unique human joins. A refund that fires when the op
actually landed hands the user the sponsored gas *and* the b back — a balance
above what was earned. That is not an accounting error; it is minting, by
transport failure. The rules:

- **R-1 — Indeterminate ⇒ withhold.** A refund requires **positive evidence that
  the op did not land**. An expired `validUntil` is **necessary and not
  sufficient**. If the watcher was partitioned, degraded, or otherwise unable to
  observe the chain across any part of `[validAfter, validUntil]`, the state is
  indeterminate and **no credit is issued** — F-4's RPC rule extends here and is
  not confined to quote time.
- **R-2 — Withheld is not denied.** A withheld refund stays on the ledger as an
  **open liability** against its debit row, and is retried when observation is
  restored; it is escalated if it cannot be closed, and it is never silently
  dropped. Fail-closed on a credit means the user is made whole **late**, never
  **never**. This is the asymmetry that makes R-1 affordable: withholding costs a
  delay, and refunding wrongly costs the ledger's central invariant.
- **R-3 — Bounded to the originating debit row.** A credit is bounded to the row
  its `quoteRef` names: never more than that row's debit, never against another
  row, never aggregated. There is no credit without a debit row to name.
- **R-4 — Idempotent, terminally.** Each debit row carries a terminal
  reconciliation state (settled / refunded / open). A row already in a terminal
  state is a **no-op**, and a second reconciliation attempt against it credits
  nothing. This is what F-15 needs: two vouchers for one `(account, nonce)` are
  two debit rows naming two `quoteRef`s; at most one op lands; each row reconciles
  exactly once, and a row that both expired (F-8) and was superseded (F-15) is
  still refunded at most once.
- **R-5 — The credit never touches the EVM.** A refund is a kernel ledger
  operation (§3.1 step 4). No on-chain compensation, no b transfer, no b of any
  kind on the chain (§3.3 S-3). The seam holds in this direction too.

**The ordering rhyme.** §5.2 puts the debit before the signature because the
recoverable failure is the one to prefer. §5.6 puts the *evidence* before the
credit for the same reason: an un-refunded debit is reconcilable (R-2), and an
un-earned credit is not.

---

## §6 — `validatePaymasterUserOp` — the acceptance predicate

### 6.1 The rule

**DEFAULT-DENY.** The paymaster sponsors an operation **if and only if every
predicate P-1 … P-16 below holds.** Any predicate that fails, any predicate that
cannot be evaluated, any input that does not parse, any path not enumerated here
— **denies**. There is no `else { sponsor }` anywhere in this design, and a code
path that reaches sponsorship without traversing all of P-1 … P-16 is a defect
regardless of what it returns.

### 6.2 The predicates (ALL must hold)

| # | Predicate | Denies when |
|---|---|---|
| **P-1** | `paymasterAndData` parses to **exactly** the expected layout and length for the pinned EntryPoint version — the frame per §6.4, the voucher body and the exact total per **§6.4.1** (469 bytes v0.6 / 501 bytes v0.7) | any length/layout deviation, including trailing bytes |
| **P-2** | `voucher.policyVersion == currentPolicyVersion` | a retired policy |
| **P-3** | the recovered signer ∈ the **active** signer set | unknown, revoked, or `address(0)` recovery |
| **P-4** | the EIP-712 digest is built over a domain whose `chainId == block.chainid` and `verifyingContract == address(this)` | a cached separator from another chainId (fork safety); a voucher for another deployment |
| **P-5** | `voucher.account == userOp.sender` | a voucher lifted from another account's op |
| **P-6** | `voucher.accountNonce == userOp.nonce` | replay; re-binding to a different op |
| **P-7** | `keccak256(userOp.callData) == voucher.callDataHash` | any calldata substitution, including argument-only |
| **P-8** | deployment binding: if `voucher.accountInitHash == 0` then the op's deploy field is **empty**; else it equals the op's deploy hash (§4.4) | an unauthorised deployment riding a voucher |
| **P-9** | `voucher.target ∈ allowlist` **and** the target decoded from `userOp.callData` `== voucher.target` **and** the selector ∈ that target's permitted set | any call reaching outside our contracts |
| **P-10** | `maxCost` (supplied by the EntryPoint) `<= voucher.maxCostWei` | the op costs more than the kernel authorised |
| **P-11** | `voucherId` not already spent (Layer 2, §4.5) | replay, belt-and-braces |
| **P-12** | `voucher.validUntil != 0` **and** `validUntil > validAfter` | an open-ended or degenerate window (§4.5) |
| **P-13** | **epoch binding, by arithmetic over signed fields — no clock read.** `epochOf(voucher.validAfter) == voucher.epoch` **and** `epochOf(voucher.validUntil) == voucher.epoch`, where `epochOf(t) = (t - epochGenesis) / epochLength` over the pinned parameters of §7.2 | a voucher drawing on an epoch its own window does not lie inside; a window straddling an epoch boundary |
| **P-14** | **pool reserve (§6.2.1):** `epochReservedWei[voucher.epoch] + epochSettledWei[voucher.epoch] + maxCost <= epochBudgetWei`, where `epochBudgetWei = budgetRateWeiPerSecond × epochLength` — **derived, never set** (§7.2) — **and** validation **writes** the reservation | an exhausted **or over-committed** pool — including by ops already in flight, in this same bundle |
| **P-15** | **per-account reserve (§6.2.1):** `accountReservedWei[voucher.epoch][account] + accountSettledWei[voucher.epoch][account] + maxCost <= perAccountEpochCapWei` (§7.1), **and** validation **writes** the reservation | one account eating the pool — across nonces, and across a bundle |
| **P-16** | `!paused` (§7.5) | the pause switch is the last brake |

### 6.2.1 The reservation — why a read is not a cap

**A pure read is not a cap, and this is where the drain lives.** P-14 and P-15
are **reserve-then-settle**, not check-then-hope. Stating this in §7.2 while the
predicates only *read* would leave the caps advisory, which §7.2 itself names as
the failure mode.

**The concrete drain a read-only cap does not stop.** A bundler includes N
sponsored ops in **one bundle**. No `postOp` has run for any of them, so if the
counters only moved at `postOp`, every op would validate against the *same*
untouched counter. All N independently pass. Total BTC fronted is N × the per-op
ceiling — bounded by **neither** cap. The same account with N different nonces
defeats a per-account read identically. Nothing about this requires a hostile
bundler; it is the ordinary batching the EntryPoint exists to do.

The mechanism, stated as state rather than code:

1. **Validation reserves.** Passing P-14/P-15 **increments**
   `epochReservedWei[epoch]` and `accountReservedWei[epoch][account]` by
   `maxCost` — the ceiling, not a guess. The very next op in the same bundle
   therefore validates against a counter that already includes its predecessor.
   This is what makes the caps bind intra-bundle, and it is the whole reason
   validation writes at all.
2. **`postOp` settles** (§6.7): it releases the `maxCost` reservation and adds
   the **actual** cost to the settled counters. Reserved falls, settled rises,
   and the difference — the ceiling the op did not spend — returns to the pool.
3. **The invariant:** at any instant, `epochReservedWei[e] + epochSettledWei[e]`
   is an **upper bound** on BTC the pool has committed for epoch `e`, and P-14
   holds it under `epochBudgetWei`. Reserved-and-never-settled is the safe
   direction: it under-sponsors, and §2 says an under-sponsoring pool is a UX
   regression.
4. **An op that validates and never reaches `postOp`** leaves a reservation
   outstanding. It expires with its epoch — the counters are per-epoch keys
   (§7.2), so a stranded reservation cannot leak past the epoch that made it.
   **It is never released by a poke, a sweep, or a caller-supplied hint**: every
   such release is a "give the pool more room" primitive, and that is precisely
   the primitive an attacker wants.

**This predicate is the exposed one.** The reservation is a **validation-phase
storage write**, and validation-phase writes are restricted under ERC-7562 —
**UNVERIFIED (U-7)**, along with P-15's account-keyed storage. If exSat's
bundlers bar it, the caps **cannot** be made to bind intra-bundle this way, and
the answer is a redesign that is **not written here and must not be improvised at
implementation time** — not a fallback to reconcile-only, which is the advisory
cap this section exists to refuse. Fail-closed applies to the spec as much as to
the contract: **if U-7 does not clear, the sponsored path does not deploy.**

### 6.2.2 The `context` payload — what validation hands `postOp`

**A reservation that cannot be released is not a reservation.** §6.2.1 adds state
at validation and §6.7 releases and settles it — but `postOp`'s inputs are only
`(mode, context, actualGasCost[, actualUserOpFeePerGas])`. It receives **none** of
`maxCost`, `epoch`, `account`, `voucherId`, `quoteRef`, or `target`. Every field
§6.7 names reaches it through exactly one channel: the `context` bytes that
`validatePaymasterUserOp` returns. An earlier draft specified the reservation and
never specified that channel, which left §6.7 operating on state it does not have
and §6.2.1's counters permanently reserved. This subsection is that channel.

`validatePaymasterUserOp` returns `(context, validationData)`. §6.3 governs
`validationData`; `context` is here.

**The payload — exactly these six fields, in this order:**

| Field | Source at validation | Consumed by |
|---|---|---|
| `account` | `userOp.sender` (== `voucher.account`, P-5) | §6.7 steps 2, 3 — the account-counter key; step 4 — the event |
| `epoch` | `voucher.epoch` (window-bound, P-13) | §6.7 steps 2, 3 — the epoch-counter key; step 4 — the event |
| `reservedWei` | **the `maxCost` the EntryPoint supplied**, i.e. the exact amount P-14/P-15 reserved | §6.7 step 2 — the amount released |
| `voucherId` | `voucher.voucherId` | §6.7 step 1 — the Layer 2 mark (§4.5) |
| `quoteRef` | `voucher.quoteRef` — **opaque, uninterpreted** (§3.3 S-6) | §6.7 step 4 — the event the kernel reconciles against |
| `target` | `voucher.target` (allowlist-checked, P-9) | §6.7 step 4 — the event |

Encoding: `abi.encode` of those six as `(address, uint32, uint256, bytes32,
bytes32, address)` — six static fields, **192 bytes**, fixed. The rules that make
it load-bearing:

- **Release exactly what was reserved — carry it, never recompute it.**
  `reservedWei` is the reservation verbatim. `postOp` learns `actualGasCost`, and
  the actual is what it *settles* (step 3), never what it *releases* (step 2). A
  `postOp` that released the actual instead of the ceiling would leave the
  difference reserved forever; one that recomputed a ceiling from its own inputs
  would release a number no predicate ever reserved — and if that number came out
  high, the release is a **free refill**, which is §6.7's named failure reached by
  a different road. The reserve and the release are the same number because they
  are literally the same bytes.
- **`context` is paymaster-authored, not user-supplied.** It is constructed inside
  validation from values P-5 … P-15 have already bound. Nothing in it is read from
  `paymasterAndData` and trusted; every field is one the predicates already
  compared against the op itself (§6.6). This matters because `context` is the one
  input to `postOp` that is not the EntryPoint's own measurement.
- **That it comes back unmodified is a claim on someone else's deployed code, and
  is registered, not assumed — UNVERIFIED (U-3).** The EntryPoint relays `context`
  from validation to `postOp`; that both v0.6 and v0.7 relay it verbatim, that the
  deployed one does, and that `paymasterPostOpGasLimit` (v0.7) accommodates a
  192-byte payload, are read from the deployed source, not from this sentence.
  **The length is fixed at 192 for exactly this reason:** a variable-length context
  is a `postOp` gas surface, and a `postOp` that runs out of gas is §6.7's
  "counters that lie" with a cheaper trigger.
- **No b, in any form.** Six fields, none denominated in b (§3.3 S-1); `quoteRef`
  crosses as an opaque handle and no contract interprets it (S-6). `context`
  crosses no seam that §3.1 does not already draw — it is EVM-side state moving
  between two EVM-side calls.

### 6.3 Time is enforced by the EntryPoint, not by the paymaster

The paymaster does **not** read `block.timestamp` in validation. It returns the
window in `validationData`:

```
validationData = packValidationData(sigFailed, validUntil, validAfter)
```

and the **EntryPoint** enforces it. This is the 4337 idiom and it exists because
validation-phase timestamp reads are exactly the kind of environment dependence
that makes a bundler's simulation diverge from execution. **UNVERIFIED (U-7)**:
the precise validation-rule set (ERC-7562 / ERC-4337 storage-and-opcode rules) as
enforced by whatever bundlers exist on exSat.

**The EntryPoint's clock is the only clock, and P-13 leans on it.** There is no
`currentEpoch` storage variable in this design, and no actor who advances one.
An earlier draft had P-13 compare `voucher.epoch` against a `currentEpoch` that
the document never defined — unimplementable three ways over: §7.2 calls an epoch
a wall-clock window (a clock read), this section bars the paymaster from reading
the clock in validation, and ERC-7562 restricts validation-phase `TIMESTAMP`
besides. The alternative it implied — an externally-poked `currentEpoch` — is
worse than undefined: **a variable that rolls the epoch is a variable that resets
`epochSpent`**, so whoever may roll it may refill the pool at will, and no actor
in §7.4 or §7.5 is authorised to hold that (§7.5's authority is bounded to the
deny direction). Naming one here would be inventing a governance role.

**Deleting the name is not deleting the primitive, and v0.2 learned this the
expensive way.** Having removed `currentEpoch`, the draft left the *calendar*
governable at the Feature tier — and a calendar knob is a refill actuator wearing
a parameter's clothes: shorten `epochLength` and the epochs arrive faster, each at
a fresh key with a full `epochBudgetWei`, no predicate objecting, because the
budget was a bucket **per epoch** and never a rate **per unit time**. Same
primitive, quieter name. **§7.2 closes it by making the rate the governed object
and the calendar mere granularity**, and this section's claim — that no actor holds
a pool-refill primitive — is only true *because* of that fix. The two sections
stand or fall together.

So the cap is restructured to need no validation-time clock at all:

- **`epochGenesis` is frozen at deploy; `epochLength` is governable** (§7.2, §7.4).
  `epochOf(t)` is pure arithmetic — **`validAfter` and `validUntil` are voucher
  fields, not environment reads.** P-13 evaluates over signed data plus pinned
  parameters, and **never over the environment. That is the property, and it is
  intact.**
- **What those parameters are, precisely** — because "pinned" is not a Solidity
  storage class and the difference is load-bearing. `epochGenesis` is a genuine
  `immutable`: read from bytecode, no `SLOAD`, and it is immutable **because §7.4
  removed it from the governable set**, not by assertion. `epochLength` is
  **storage** — a governance-changeable parameter cannot be an `immutable`, and
  calling it one would be claiming a property the mechanism does not have. So
  **P-13 performs a validation-phase storage read**, as does P-14 for
  `budgetRateWeiPerSecond` and `epochLength` (§7.2). That is ERC-7562 territory and
  is registered as **U-7 leg (d)** — a *read* of the paymaster's own non-account-
  keyed slots, which is a materially weaker ask than leg (a)'s writes, and is not
  covered by leg (c). **This opens no drain** — the paymaster is already in U-7's
  territory via P-2/P-3/P-9/P-14/P-15/P-16, and leg (a) already gates deployment —
  but the wording must match the mechanism, and an SLOAD is not an immutable.
- **A storage read is not a clock read.** Leg (c) is still answered "not at all":
  the restructure's point was to remove `TIMESTAMP` from validation, and reading a
  pinned parameter from a slot does not put it back. What P-13 never does is ask
  the chain *what time it is*.
- **The counters are keyed by epoch number** (`epochSettledWei[e]`), never reset
  and never rolled. There is no rollover event, so there is no rollover actuator,
  so there is no authority to name. Unspent budget does not carry forward because
  epoch `e+1` reads a different key — §7.2's no-carry-over rule becomes structural
  rather than procedural.
- **The EntryPoint enforces `validAfter <= now <= validUntil`.** P-13 forces both
  ends of the window inside `voucher.epoch`. Composing the two: **a sponsored op
  executes only while the wall clock is inside the epoch it draws against** —
  enforced by the EntryPoint's clock, not the paymaster's.
- **This is what bounds a compromised signer** (F-10). Without the `validAfter`
  leg, a compromised signer could mint vouchers for epochs `e+1, e+2, …`, each
  against a fresh untouched budget — an unbounded drain across epochs, not the
  one-epoch bound F-10 claims. With it, a future-epoch voucher is rejected by the
  EntryPoint until that epoch actually arrives, by which time pause (§7.5) and
  rotation have had an epoch to land.

**The cost, stated rather than hidden:** a voucher window may not straddle an
epoch boundary. Near a boundary the kernel issues against whichever epoch fully
contains the window, and if neither does, it **refuses** (fail-closed) — a UX
regression of at most one block-inclusion horizon per boundary, falling to T1/T0
(§2). That is the price of deleting the clock read, and it is the correct trade:
the alternative was an actuator nobody is authorised to hold.

**UNVERIFIED (U-13):** that the deployed EntryPoint enforces `validAfter` /
`validUntil` from `packValidationData` as described. This was already assumed for
expiry; P-13 makes it load-bearing for the **epoch binding** too, which is a
larger claim on someone else's deployed code and is registered as such in §9.

### 6.4 The `paymasterAndData` layout, per version — UNVERIFIED (U-3)

**P-1 is the head of the default-deny chain and it must point at something.** An
earlier draft had P-1 require a parse "to exactly the expected layout and length
… (§6.4)" while this section specified only the return convention — the first
denial gate pointed at nothing, and U-3 claimed a layout was given here that was
not. An implementer who trusted that pointer (reasonably: §4.4 *does* give the
deploy-field binding per version) would improvise offsets.

The shape below is **UNVERIFIED (U-3)** and is written as a *sketch to be pinned
against the deployed EntryPoint's verified source*, never as a fact to be copied:

```
v0.6 — paymasterAndData:
  [0  : 20]  paymaster address
  [20 :   ]  paymaster data  ← the voucher body (§6.4.1) ‖ 65-byte signature

v0.7 — paymasterAndData:
  [0  : 20]  paymaster address
  [20 : 36]  paymasterVerificationGasLimit   ← packed HERE, unlike v0.6
  [36 : 52]  paymasterPostOpGasLimit         ← packed HERE, unlike v0.6
  [52 :   ]  paymaster data  ← the voucher body (§6.4.1) ‖ 65-byte signature
```

**Why this is the materially risky one.** v0.7 packs the paymaster gas limits into
bytes `[20:52]` and v0.6 does not. An improvised offset does one of two things:
mis-parse the voucher outright (loud, survivable), or **silently swallow the
gas-limit bytes as voucher data** (quiet, and the voucher it recovers is not the
voucher the kernel signed). Both deny under P-1 if the length check is exact —
which is why the length check is exact.

Binding rules, which hold regardless of how the offsets land:

- **Pin one version.** The implementation parses the **deployed** version's layout
  and no other. "Supports both" is a branch nobody tested (U-3).
- **Exact length equality.** Not a minimum. Trailing bytes deny (P-1, F-1). A
  parser that ignores extra bytes has agreed to be told what to think.
- **The offsets above are not authority.** Read them from the deployed contract's
  verified source and pin them in config with the version. If they disagree with
  this sketch, **the source wins and this section is the defect.**

### 6.4.1 The voucher body — our format, and the one leg the source cannot arbitrate

**"The source wins" is the right remedy for the frame and no remedy at all for the
body.** The bytes at `[20:]` (v0.6) or `[52:]` (v0.7) are **ours**. The EntryPoint
neither defines nor inspects them; reading its deployed source will never tell an
implementer how our twelve fields are laid out, because it does not know. An
earlier draft leaned P-1's entire silent-mis-parse defence on an **exact** length
check while specifying no encoding for the body — and `abi.encode` and
`abi.encodePacked` yield **different lengths** (384 vs 250 bytes here), so "exactly
the expected length" was not a computable quantity. The one part of the parse that
§6.4's remedy cannot reach is the part §6.4 left unspecified. It is pinned here.

**The body is `abi.encode` of the §4.3 struct's twelve fields, in §4.3 order:**

```
voucher body = abi.encode(
    address account, uint256 accountNonce, bytes32 callDataHash,
    bytes32 accountInitHash, address target, uint256 maxCostWei,
    uint48  validAfter, uint48  validUntil, bytes32 voucherId,
    uint32  epoch, uint16  policyVersion, bytes32 quoteRef
)
                                  = 12 × 32 =  384 bytes, always
signature (§4.3, 65-byte r‖s‖v)   =             65 bytes, always
                                                ---------
voucher body ‖ signature          =            449 bytes  ← OURS. Pinned here.
```

**All twelve fields are fixed-width static types**, so the encoding is a static
tuple: twelve 32-byte words, left-padded, **no head/tail offsets, no length
prefix, no dynamic tail.** 384 is not a typical case of a variable quantity; it is
the only value the encoding can take.

**Exact `paymasterAndData` length, per version** — the arithmetic P-1 needs:

| Version | Frame | Body ‖ sig | **Exact total** | Frame verified by |
|---|---|---|---|---|
| **v0.6** | 20 (paymaster) | 449 | **469 bytes** | deployed source (U-3) |
| **v0.7** | 52 (paymaster ‖ 2 × gas limit) | 449 | **501 bytes** | deployed source (U-3) |

**Why `abi.encode` and not `abi.encodePacked`,** since packed would save 134 bytes
of calldata per op: packed encodes each field at its natural width, so a parser
must walk hand-written offsets (20, +32, +32, +32, +20, +32, +6, +6, …) — **the
exact improvisation this section exists to prevent**, reintroduced one layer down
and this time with no deployed source to check it against. `abi.encode` decodes in
one call against the field list above, and its length is a constant a reviewer can
verify by counting fields. The 134 bytes are not worth a second offset table.
(Both are injective here — every field is fixed-width, so packed carries no
ambiguity — which is why this is a legibility argument and not a soundness one.
Legibility is what P-1 is defending.)

**The wire encoding is not the EIP-712 encoding, and conflating them is a defect.**
This is the transport layout only. The digest is built per §4.3 — `hashStruct` over
the **decoded** fields under the §4.2 domain, with the §4.3 type hash — and is
never taken over these 384 bytes. They coincide in neither construction nor value.

**What is UNVERIFIED here, and what is not.** The **frame** (20 / 52, and the
v0.7 gas-limit packing) is the EntryPoint's and is **U-3**: read it from the
deployed source, and if it disagrees with §6.4's sketch the source wins and the
totals above move with it. The **body** (384 ‖ 65 = 449) is **ours and is settled
here**: no external check can confirm or refute it, and an implementation that
encodes the body differently has not found a discrepancy with exSat — it has
diverged from this spec. Both legs must be pinned in config with the version;
**only one of them has a source to be pinned against.**

### 6.5 Return convention, and what "deny" means concretely

- **Signature mismatch (P-3, P-4)** → return `validationData` with `sigFailed = 1`.
  The EntryPoint rejects. This is the 4337-idiomatic signal for "the signature is
  not ours."
- **Every other failed predicate** → **`revert` with a named custom error**
  (`Denied_TargetNotAllowed`, `Denied_CostExceedsVoucher`,
  `Denied_EpochBudgetExhausted`, …). One error per predicate. A reviewer should
  be able to read the revert and name the predicate.
- **Both outcomes are denials.** Neither sponsors. The distinction is diagnostic,
  not semantic.
- **There is no "proceed anyway."** No default branch sponsors. No catch
  sponsors. An unhandled state reverts.

### 6.6 What the predicate deliberately does NOT do

- It does **not** consult bLOVErAi. It cannot; the companion is off-chain and off
  the attacker's path (§0).
- It does **not** check whether the op is "reasonable", "expected", or "safe for
  the user." That is not knowable in validation and pretending otherwise is how
  simulation gets promoted to a defence.
- It does **not** trust `paymasterAndData` for anything it can derive from the
  op itself. Every binding predicate (P-5 … P-8) compares voucher claims against
  the actual op.
- It does **not** interpret `quoteRef` (§3.3 S-6).
- It does **not** know what b is (§3.3 S-2).

### 6.7 `postOp`

**Everything `postOp` knows about the op, it learns from `context` (§6.2.2).** Its
inputs are `(mode, context, actualGasCost[, actualUserOpFeePerGas])` and nothing
else: no `maxCost`, no `epoch`, no `account`, no `voucherId`, no `quoteRef`, no
`target`. Each of the four steps below names a value, and **every one of those
values but `actualGasCost` arrives in the `context` §6.2.2 specifies.** Read that
subsection before this one; without it these four steps operate on state that does
not reach them, and §6.2.1's reservation is unreleasable.

`postOp` runs after execution and does **four** things — the first two are one
atomic settlement, and splitting them is a defect:

1. mark `voucherId` spent (Layer 2, §4.5) — `voucherId` from `context`;
2. **release the reservation** (§6.2.1): subtract **`context.reservedWei`** — the
   `maxCost` validation actually reserved, carried verbatim and **never
   recomputed** (§6.2.2) — from `epochReservedWei[epoch]` and
   `accountReservedWei[epoch][account]`, both keyed from `context`;
3. **add the actual BTC cost** (`actualGasCost`, the EntryPoint's own measurement —
   the one input that is *not* from `context`) to `epochSettledWei[epoch]` and
   `accountSettledWei[epoch][account]` — the ceiling reserved at validation is
   settled to the truth, and the unspent difference returns to the pool;
4. emit `Sponsored(account, target, actualCostWei, quoteRef, epoch)` — every field
   but `actualCostWei` from `context`. The kernel's watcher reads this to reconcile
   the b debit (§3.1 step 4, §5.6). **No b in the event** (§3.3 S-2).

**Steps 2 and 3 are one motion.** A release without the matching settle hands the
pool back its ceiling and forgets the spend — a free refill, once per op. If only
one of the two can be made to fail, the counters do not merely lie; they lie in
the loosening direction. Settle before release, or write both or neither.

**`postOp` reverting must not fail-open**, and §6.2.1 raises the stakes: a
`postOp` that can be made to fail cheaply is a reservation that never releases
(safe — it under-sponsors) *or* a settle that never lands (unsafe — the pool
forgets what it spent). The v0.6 and v0.7 `postOp` signatures
and `PostOpMode` semantics **differ** — see U-3. The behaviour of a reverting
`postOp` (and whether the EntryPoint retries, charges, or reverts the whole op)
is version-specific and **UNVERIFIED (U-3)**; the implementation MUST be written
against the deployed version's actual source, and MUST NOT assume that a failed
accounting update is a harmless one. If the accounting can be made to fail
cheaply and repeatedly, the counters lie and the caps stop capping.

---

## §7 — Sponsorship policy

### 7.1 Per-account caps

| Cap | Enforced where | Why there |
|---|---|---|
| per-op ceiling (`maxCostWei`) | **kernel** sets it; **on-chain** P-10 binds it | the kernel knows policy; the chain must not take the kernel's word for the outcome |
| per-account, per-epoch spend cap | **kernel** at signing (§5.3.3) **and** **on-chain** P-15, as a **reservation** (§6.2.1) | the on-chain copy is what survives a compromised signer — and only a reserving copy survives a bundle |
| per-account rate limit | **kernel** only | rate is a signing-side concept; the chain sees ops, not intent |
| lifetime b balance | **kernel** only | b does not exist on the EVM (§3). The chain cannot enforce this and must not try. |

**Both layers, deliberately.** The kernel caps are the policy; the on-chain caps
are the blast radius when the policy's signer is wrong. CD-13 already names this
shape: "Session-key budgets are the blast radius (per-user hard resource budgets;
root-policy burn-rate caps on the pool)."

### 7.2 Per-epoch caps (the pool)

- An **epoch** is a fixed wall-clock window, defined by two pinned parameters:
  **`epochGenesis`** (a unix second, **frozen at deploy — not governable**, see
  below) and **`epochLength`** (§7.4). `epochOf(t) = (t - epochGenesis) /
  epochLength`. `voucher.epoch` binds an op to one, and P-13 checks that binding
  **by arithmetic over the voucher's own signed window** — there is no
  `currentEpoch` variable, no rollover event, and no actor who advances one. §6.3
  gives the full reasoning; the short version is that a rollover actuator is a
  pool-refill primitive and nobody is authorised to hold one.

- **The budget is a RATE. `epochBudgetWei` is derived, never set:**

  ```
  epochBudgetWei := budgetRateWeiPerSecond × epochLength
  ```

  **`budgetRateWeiPerSecond` is the governed object** (§7.4); `epochLength` sets
  bucket *granularity* and `epochBudgetWei` follows it. `epochBudgetWei` remains
  exactly what §7.2 has always called it — a **hard ceiling on total BTC the pool
  fronts in an epoch**, enforced by P-14 — and it is now also the thing that
  sentence needed to be true: the ceiling **per unit time** is invariant under any
  change to the calendar. When an epoch's budget is exhausted, **sponsorship
  stops** and every user falls back to T1/T0 (§2). A drained epoch is a UX
  regression, not an outage — that is the degradation law doing its job.

- **Why a rate, and why this is not optional.** §6.3 deleted `currentEpoch` because
  *a variable that rolls the epoch is a variable that resets `epochSpent`*, and no
  actor is authorised to refill the pool. A **per-epoch bucket with a governable
  calendar is that same actuator, spelled differently.** Under the v0.2 text,
  `epochBudgetWei` was set directly and `epochLength` was a Feature-tier parameter
  (K=2, an 8% `YES` floor — the *lowest* bar in §7.4): a single Feature vote taking
  `epochLength` from 30 days to 1 hour left `epochBudgetWei` untouched, tripped no
  predicate, violated no stated invariant, and multiplied the BTC the pool fronts
  per month by **~720×**. Nothing detected it because nothing was watching a rate —
  §7.2 asserted a ceiling *per epoch* and the vote changed what an epoch *was*.
  §7.4's mitigation did not reach it either: that text addresses **re-keying** ("it
  takes effect only at a boundary…"), which is a different failure. Re-keying moves
  where the counters live; this moves **how fast they refill**, and a boundary-only
  change moves it just as far. Binding the budget to a rate is what makes §6.3's
  no-authorised-refill claim and this section's ceiling **the same claim**.

- **Why `epochGenesis` is frozen and not merely coupled.** The rate coupling closes
  `epochLength`; it cannot close `epochGenesis`, and leaving that governable would
  reopen the identical hole at the identical tier. Boundaries fall at `epochGenesis
  + k × epochLength`, so **shifting the genesis shifts every boundary**: at a
  boundary `T`, a genesis moved to `T − epochLength + 1h` puts the next boundary an
  hour out — one short epoch carrying a full budget, and the ~720× is back without
  anyone touching `epochLength`. It is not fixable by coupling: the budget can only
  track a *truncated* epoch if the contract knows that epoch was truncated, which
  means a per-epoch length table — a calendar **history** in storage, read during
  validation, to compute a number that a frozen genesis makes a constant. **The
  cheap cut is the correct one:** `epochGenesis` is set once at deploy and there is
  no path that changes it. §6.3 can then call it a genuine `immutable` and be
  telling the truth (§7.4 removes it from the governable set; the wording and the
  mechanism agree because the mechanism moved, not the wording).

- **Why not the other two candidate fixes.** *Rate-limiting the pool directly* — a
  running burn-rate cap, "no more than X wei per hour" — requires knowing how much
  of the current window has elapsed, i.e. a **`block.timestamp` read in
  validation**. That is precisely what §6.3 restructured the design to eliminate,
  and it is U-7 leg (c). It buys the same property at the cost of the property.
  *Raising `epochLength` to a higher tier* prices the primitive without removing
  it: a Safety-tier vote can compress the calendar exactly as far as a Feature-tier
  one, so §6.3's "no actor is authorised to hold a pool-refill primitive" would
  still be false — merely more expensively false. **Deriving the budget from a rate
  removes the primitive rather than repricing it**, needs no clock, needs no new
  tier, and needs no principal to hold anything.

- **The cost, stated rather than hidden** (§6.3's convention). Rate invariance does
  not make `epochLength` inert, and two effects remain, both stated so no reader
  infers a property this does not have:
  1. **F-10's blast radius scales with `epochLength`.** A compromised signer is
     bounded to *one epoch budget* = `budgetRateWeiPerSecond × epochLength`, so
     **lengthening** the epoch widens that bound proportionally (30 days → 60 days
     doubles it) even though the long-run burn rate is unchanged. This is a real
     Feature-tier effect on a Safety-tier concern. It is **not** the deleted
     primitive — it is linear, not a step change, and it widens the *compromise*
     bound while leaving the *pool* rate fixed — but a vote that lengthens the epoch
     is a vote that lengthens F-10's exposure window, and should be read that way.
     **Shortening** `epochLength` tightens F-10's bound: the safe direction.
  2. **`epochLength` bounds the maximum voucher window.** P-13 forces a window
     inside one epoch, so a shorter epoch means shorter vouchers and more boundary
     refusals (§5.3.9, §6.3's stated cost) — a UX regression of at most one
     block-inclusion horizon per boundary, falling to T1/T0.
- **Reserve-then-settle, never reconcile-only** — and the *mechanism* for that is
  §6.2.1 and §6.7, not this bullet. Validation **reserves** `maxCost`; `postOp`
  **releases** the reservation and **settles** the actual cost. An in-flight op
  that has not yet posted must still count against the budget, or the budget is
  advisory. **A cap that only reads is not a cap:** N ops in one bundle all
  validate before any `postOp` runs, so a read-only check passes all N against
  the same untouched counter and the pool fronts N × the per-op ceiling. That is
  the drain, and the reservation is the whole of the counter to it.
- Unspent budget does **not** carry forward. This is structural, not procedural:
  the counters are keyed by epoch number (`epochSettledWei[e]`), so epoch `e+1`
  reads a different key and there is nothing to carry. Carry-over would turn an
  idle month into a drainable month; here it is not a rule that could be relaxed
  by an implementation, it is an absence of the state that would express it.
- **Article V.1 is the binding constraint on all of this**: "The paymaster
  *abstracts* user-funded payment; it must never *absorb* cost." A pool whose burn
  rate is structurally faster than what users fund is an operator subsidy and is
  barred by the constitution regardless of what governance votes. **Stating that
  constraint against a rate rather than a bucket is the point:** "the budget is no
  larger than what users fund" was a claim about a quantity whose denominator
  governance could change, and a subsidy test that a calendar vote could pass is
  not a test. `budgetRateWeiPerSecond` is comparable against a funding rate
  directly, in the same units, without asking what an epoch currently means. See
  §10 Q-2 and Q-4 — **what the pool is funded by is not settled here, and this
  bullet constrains the ceiling, not the source.**

### 7.3 The allowlist

- **Our contracts only.** Targets are BNature/BNRi contracts, named and pinned by
  address per chainId.
- Allowlisting is **per (target, selector)**, not per target. A target with one
  cheap entry point and one unbounded-loop entry point is not one risk.
- **Nothing is allowlisted by default.** An empty allowlist sponsors nothing, and
  that is the correct behaviour of a fresh deployment.
- No wildcard target. No wildcard selector. No "allow all on our own contracts" —
  our own contracts are where the loops are.
- The kernel checks the allowlist at signing (§5.3.1); the paymaster checks it
  again at validation (P-9). The on-chain copy is authoritative for enforcement;
  the kernel copy is authoritative for refusing to waste a signature.
- A target that can `CALL` an arbitrary address is **not allowlistable**. It makes
  the allowlist a suggestion.

### 7.4 Who may change them

Per `docs/article-vi-s3.md` §3.3 (tier ladder) and §3.4 (quorums):

| Change | Tier | K | Quorum |
|---|---|---|---|
| **`budgetRateWeiPerSecond`** (the pool's burn rate — the object that *was* "epoch budget"), per-account caps, **`epochLength`** (granularity only — the budget follows it, §7.2), voucher window length (`policyVersion` bump) | **Feature** | 2 | 8% `YES` floor |
| adding a target/selector to the allowlist | **Feature** | 2 | 8% `YES` floor |
| **`epochGenesis`** | **— not governable at any tier.** Frozen at deploy (§7.2). There is no path that changes it, so there is no tier to name; a shiftable genesis is a pool-refill primitive (§7.2, §6.3) and this table's job is to not hand one out. | — | — |
| **`epochBudgetWei` directly** | **— not a knob.** Derived: `budgetRateWeiPerSecond × epochLength` (§7.2). A governance action that set it directly would be re-creating the per-epoch bucket whose decoupling from time *was* the hole. | — | — |
| removing a target, tightening a cap, pausing | see §7.5 — immediate, no vote. **The principal is NOT named in this document and cannot be — §10 Q-7.** | — | — |
| changing the signer set; changing the acceptance predicate (§6); anything that weakens an invariant in §0, §2, or §3 | **Safety** | 4 | **13% affirmative** |
| anything that would let the paymaster feed the reputation engine, or that touches evidence flows feeding Respect | **Meta** | 8 | **21% affirmative** |

**The epoch calendar is not an ordinary parameter, and it fails in TWO ways that
need TWO answers.** `epochGenesis` is now out of reach entirely (frozen at deploy,
§7.2), so what follows concerns `epochLength` alone:

1. **The re-key.** Changing `epochLength` **re-keys** the per-epoch counters
   (§7.2): every `epochOf(t)` answer moves, and budgets already spent under the old
   calendar sit at keys the new calendar never reads — a change that looks like a
   parameter tweak and lands like a pool refill. It therefore takes effect **only
   at a boundary of the calendar in force**, never against a live epoch, and it
   rides a `policyVersion` bump so outstanding vouchers under the old calendar stop
   verifying (P-2). Retiring the old policy is what keeps the re-key from being a
   second budget.
2. **The rate.** Re-keying is *where the counters live*; the rate is *how fast they
   refill*, and **the boundary rule above does nothing about it** — a calendar
   compressed at a boundary front-runs the pool just as hard as one compressed
   mid-epoch. This is the hole v0.2 shipped: the paragraph above was read as
   covering the calendar, and it covered half of it. The answer is **§7.2's rate
   derivation**, not this rule. Both are required; neither substitutes for the
   other. **If a future revision restores a directly-set `epochBudgetWei`, this
   mitigation silently reverts to covering half the surface again** — and the half
   it drops is the ~720× one.

**Weight is Respect. Only.** Per **GOV-1** (`docs/article-vi-s3.md` §3.2): *b
confers zero governance weight in any form — held, staked, locked, delegated,
lent, or wrapped — at every tier, forever.* This is not incidental here: this is
the one **place** in the system where users spend b, and "spends the most b gets
the most say" is exactly the capture GOV-1 forecloses. The heaviest sponsored
user has the same governance weight from that spending as the lightest: **zero**.

*(That word is load-bearing: **place**, not **contract**. Users spend b on the
**kernel side** of the seam — the debit is a kernel ledger row (§3.1 step 1) and
the paymaster contract "has no b field, no b storage, no b event, and no b
import" (§1), knows nothing about b (§3.3 S-2), and could not meter a b spend if
it wanted to, because b does not exist on the EVM (§7.1). This document uses
"contract" to mean a Solidity contract everywhere else, so calling the paymaster
the place where b is spent would send an implementer reading §7.4 alone to add b
balance accounting to the paymaster — the exact S-2 violation this document
exists to prevent. §3.4: the gap between the voucher's name and its payload **is**
the seam.)*

**The seam appears in governance too.** A vote to raise the pool's BTC burn rate
(`budgetRateWeiPerSecond`) is a treasury question. A vote to change what a b debit
is worth is a §10 Q-2/Q-3 question and is **not** in scope for the Feature tier —
see §10. Note that the rate derivation keeps these two apart where a bucket did
not: `epochLength` is now unable to move the BTC the pool fronts per unit time,
so a calendar vote cannot become a treasury vote by arithmetic.

### 7.5 The pause switch (the ratchet)

- **Tightening is always fast; loosening is always slow.** The pause principal may
  pause, remove a target, or lower a cap **immediately, without a vote**. Loosening
  any of them requires the tier in §7.4.
- This asymmetry is the point. Making "stop paying" as slow as "start paying"
  means a live drain runs for the length of a voting period.
- A pause is safe by construction with respect to users: paused ⇒ T2 unavailable
  ⇒ T1/T0 (§2). Nobody is locked out of anything; they pay their own BTC.
- The authority is bounded to the **deny direction** and cannot be used to sponsor
  anything. **The direction is settled here. The principal is not.**

**WHO holds it is an open founder gate (§10 Q-7), and this section must not be
read as having answered it.** Every other row of §7.4 binds to a tier, a K, and a
quorum in `docs/article-vi-s3.md`. This row — the only unilateral, no-vote
authority in the document — rested on an undefined "guardian". The repo's only
guardian is the **Epoch-1 founder/guardian meta-tier co-signer**
(`docs/article-vi-s3.md:70`), and `article-vi-s3.md:78` is explicit that on
release **"the guardian keys are destroyed, publicly, and the destruction is
ledgered as an Event"** — with no named successor anywhere in this tree.

Two consequences an implementer must not paper over:

1. **The access control on `pause()`, `removeTarget()`, and `lowerCap()` cannot be
   written today.** There is no principal to encode. Improvising one here would be
   inventing a governance role, which is barred; improvising one at implementation
   time is barred by the same rule and is worse for being quieter.
2. **F-10's answer to a compromised kernel signer is held by a key the
   constitution destroys.** "Guardian pause stops it without a vote" is true only
   while the guardian exists. Post-release, on the text as it stands, **nobody**
   can pause, and the fast half of the ratchet is gone precisely when the slow
   half is all that remains. The caps (P-13/P-14/P-15) still bound the loss to one
   epoch budget — that part survives — but the immediate brake does not.

The ratchet's *shape* is sound and is not what is open. What is open is a name.

---

## §8 — Failure modes and fail-closed behaviour

**The law:** indeterminate state = **blocked**, never "proceed anyway." **A
transport error must NEVER collapse into a green light.** A timeout is not a yes.
An unparseable response is not a yes. A retry budget exhausted is not a yes.

**Blocked in which direction?** Every row below governs one of two motions, and
the safe default points **opposite ways** for the two:

- **Refusing to sign / denying sponsorship** (F-1 … F-5, F-7, F-9 … F-14, F-16):
  indeterminate ⇒ **REFUSE**.
- **Crediting b back** (F-6, F-8, F-15, F-17, F-18): indeterminate ⇒ **WITHHOLD**,
  per **§5.6**. A refund is not a denial with the sign flipped; it is the one
  motion in this document that can *create* b, and b is earned-only. §5.6 is the
  governing policy for every row whose behaviour column ends in a credit.

| # | Failure | Fail-closed behaviour | Never |
|---|---|---|---|
| **F-1** | `paymasterAndData` malformed / wrong length / trailing bytes | revert `Denied_MalformedVoucher` (P-1) | lenient parsing; ignoring extra bytes |
| **F-2** | `ecrecover` returns `address(0)`; malleable `s`; bad `v` | treat as signature failure (P-3) | treating `address(0)` as a match — the classic |
| **F-3** | `eth_chainId` errors, times out, or mismatches the pin | **kernel refuses to sign.** No signature is produced. | inferring the chain from the URL; retrying onto a different endpoint and accepting whatever answers |
| **F-4** | RPC unreachable **at quote time** | kernel refuses to sign; the user is told the sponsored path is unavailable and the standard path (T0) is open | signing on stale state |
| **F-5** | Kernel b-ledger write fails at §5.2 step 4 | no debit ⇒ **no signature** | signing and "debiting later" |
| **F-6** | Signer process dies between debit and signature | user is debited, no voucher exists. **Credit direction — §5.6:** no voucher was returned and none can land, so the row is determinate; refund it kernel-side, once (R-4), bounded to that row (R-3). | the reverse order, which leaks free vouchers |
| **F-7** | Epoch budget exhausted mid-epoch | P-14 denies (reserved + settled would exceed `epochBudgetWei`); all users fall to T1/T0 (§2) | borrowing next epoch's budget; a "grace" overdraft; releasing reservations to make room |
| **F-8** | Voucher issued, op never lands (expired, dropped, out-bid) | voucher expires (`validUntil`); **kernel-side b refund on reconciliation, under §5.6.** Expiry alone does **not** authorise the credit — R-1 requires positive evidence the op did not land. The refund is a kernel ledger operation and touches no chain (§3.1 step 4). | on-chain compensation; a b transfer of any kind; **treating an expired voucher as proof of a missed op** |
| **F-9** | `postOp` reverts / accounting update fails | **U-3** — version-specific; MUST be specified against the deployed EntryPoint's source before implementation. Counters that can be made to fail cheaply are counters that lie (§6.7). A failed **release** under-sponsors (safe); a failed **settle** makes the pool forget a spend (unsafe) — §6.2.1. | assuming a failed accounting update is harmless; splitting release from settle |
| **F-10** | Kernel signer key compromised | on-chain caps bound the loss to **one epoch budget = `budgetRateWeiPerSecond × epochLength`** (§7.2) — and that bound holds only because P-14/P-15 **reserve** at validation (§6.2.1; a read-only cap does not bound a bundle) and because P-13 forces a voucher's window inside its own epoch, so future-epoch vouchers cannot execute early (§6.3). **Note what the bound is made of:** `epochLength` is Feature-tier, so **a vote lengthening the epoch widens this bound proportionally** (§7.2's stated cost) — it does not change the pool's long-run burn rate, but F-10's exposure window is not rate-invariant and must not be read as though it were. Signer rotation is Safety-tier. **The immediate brake (pause, §7.5) has no named principal — §10 Q-7.** | relying on the kernel's own caps — the compromised component's opinion of its own limits is worthless; **claiming a read-only cap bounds anything**; reading "one epoch budget" as a fixed quantity when `epochLength` is governable |
| **F-11** | bLOVErAi offline / wrong / hostile | **nothing changes.** §6 is unaffected. T0/T1 open. On anomaly it warns and declines to sponsor; it never blocks the human. | the companion becoming a chokepoint; contracts depending on it |
| **F-12** | Bundler censors, drops, or reorders our ops | T0 remains open (§2). Censorship-resistance of the sponsored path is a **bundler** property — **U-8** | claiming the sponsored path is censorship-resistant |
| **F-13** | EntryPoint on exSat turns out to be non-stock (modified nonce/validation semantics) | **U-5** — Layer 1 replay defence is void; Layer 2 (§4.5) carries it; **the deployment does not proceed** until the EntryPoint's actual source is read | assuming stock semantics because the address or the docs look familiar |
| **F-14** | exSat testnet chainId is neither 839999 nor 840000 | **U-2** — pin refuses; nothing signs (F-3) | trusting the endpoint's name or the docs over `eth_chainId` |
| **F-15** | Two vouchers exist for one `(account, nonce)` | at most one lands (P-6 + EntryPoint nonce). Two vouchers are **two debit rows** naming two `quoteRef`s; each reconciles **exactly once** and terminally (§5.6 R-4), so the row for the op that landed settles and the other refunds — **the second refund attempt against an already-terminal row credits nothing** | the kernel issuing the second one at all (§5.4); a refund that is not bounded to its own row (R-3) |
| **F-16** | Allowlisted target is upgraded and its selector now means something else | address+selector pins go stale; treat any upgrade of an allowlisted target as an **automatic de-allowlist** pending re-review | trusting an address across an upgrade |
| **F-17** | **Watcher loses its RPC across the voucher window**, cannot observe the `Sponsored` event, and sees an expired voucher | **WITHHOLD the credit (§5.6 R-1).** The op may have landed; an unobserved window is indeterminate, not empty. The debit row stays **open** (R-2), is retried when observation is restored, and is escalated if it cannot be closed. **This is the one place a transport error could still have collapsed into a green light** — the light it would have turned green is a b credit. | refunding on expiry alone; treating "I could not see it" as "it did not happen"; F-4's rule stopping at quote time |
| **F-18** | A reconciliation is attempted twice against one debit row (retry, replay, two watchers, a crash mid-credit) | **no-op (§5.6 R-4).** Terminal state is terminal; the second attempt credits nothing. Without this, a retry loop is a b faucet on an earned-only ledger. | non-idempotent credits; a refund keyed by voucher rather than by debit row |

**The shape of every denial row above:** the denial is cheap and the user's
fallback is one tier down (§2). That is what makes fail-closed affordable here. A
system where denial locks the user out cannot afford to fail closed, and would
start looking for reasons to fail open. This one has no such pressure — by design.

**The shape of every credit row** (F-6, F-8, F-15, F-17, F-18) is the same
argument in the other direction: withholding is cheap **because it is not
permanent.** The debit row stays open and the user is made whole once the state is
determinate (§5.6 R-2). Delay is the price; an un-earned b balance would be the
alternative, and on an earned-only ledger — new supply **only** when a new unique
human joins — that is not a rounding error, it is the invariant.

---

## §9 — UNVERIFIED register

**Every external dependency below is UNVERIFIED. Browser/testnet check pending.
None of it has been checked. Nothing here was browsed; nothing here may be
treated as a kernel assumption until it clears `CONSTITUTION.md` Article IV
(testnet behaviour, source code, and passing vectors are facts; documentation and
whitepapers are provisional).**

**Correction of record (this section's basis was re-checked against the tree, and
three of its factual claims did not reproduce).** The v0.1 draft asserted that
"this tree contains no reference to exSat at all" and that "there is no
`chain-exsat` crate," and U-11/U-12 below rested on greps "returning nothing."
**All three were false as of this revision.** The exSat adapter (C-1) landed in
parallel with the draft; the register's contract is to be an accurate inventory of
what this tree does and does not know, so the basis is restated here from greps
re-run against the tree, not from the draft's memory of them.

What is actually on disk (`grep -ril exsat`, excluding `node_modules`, `.git`,
`target`) — **cited by symbol, not by line: this crate is actively moving, and
its line numbers shifted during this very revision** (see §1):

- **`crates/chain-exsat-evm/` EXISTS** — 9 files; a workspace member in
  `Cargo.toml` adjacent to `chain-eos` and `chain-zano`; present in `Cargo.lock`.
  It is a **keyless, read-only log indexer** (`src/lib.rs`, "No keys"), not a
  signer.
- **The chainId is already pinned in-tree**, once: `EXSAT_MAINNET_CHAIN_ID`,
  asserted by `mainnet_chain_id_is_7200` and documented in `README.md`'s VERIFIED
  table ("exSat mainnet chainId is 7200; gas is BTC"). §1 forbids a second pin.
- **The crate cannot perform the `eth_chainId` pre-flight** — it ships no RPC
  `LogSource`. `README.md`'s "Caller obligations" table states it plainly: the
  check is the caller's, and "a mismatch is fail-closed *when checked*, and
  unnoticed when not." **§4.2 and §1 are corrected accordingly** — the draft
  assigned the call to "the adapter."
- **The 839999-vs-840000 testnet ambiguity is already carried in-tree**
  (`README.md`'s UNVERIFIED table: "Reported variously as 839999 and 840000. This
  crate deliberately ships **neither** as a constant"). U-2 below is therefore an
  *existing* in-tree open item, not a new discovery by this spec.
- **This spec's own file** is an exSat hit, as is
  `crates/shared-types/src/events.rs`.

So this is **not** a greenfield adapter with zero prior verification in-repo. It
is a spec for a **signing** component alongside an **existing, verified-where-it-
can-be, deliberately keyless** indexer. What remains greenfield is the paymaster
contract, the EIP-712 signing half, and every external fact below.

**The in-code verification convention is `chain-exsat-evm`'s, and this register
defers to it rather than inventing a parallel prose-only scheme.** That crate
already models exactly this distinction in the type system:
`Verification::Verified { source }` / `Verification::Unverified { pending }`
(`src/signatures.rs`), where `source` is a citation ("contract file + event
declaration, at a pinned commit") and `pending` is what must happen to promote the
entry. `SignatureTable::new` **refuses** unverified entries unless a caller
explicitly opts in, so production config cannot load them
(`src/signatures.rs`). Every "How to verify" cell below is a `pending`
string in prose; when an item clears, it should land as a `Verified { source }`
citation in code, not as a sentence here. **A register that outlives its own
accuracy is worse than no register** — this section is the precedent for why.

| # | Claim / dependency | Status | How to verify (do this before any implementation) |
|---|---|---|---|
| **U-1** | **The EntryPoint address on exSat.** | **UNVERIFIED. No address appears in this document, deliberately.** | Read it from exSat's own published deployment record **and** confirm by reading the code at that address on-chain. Pin in config per chainId. **Do not hardcode an address from memory, from another chain, or from this document — there is none here to copy.** |
| **U-2** | exSat **testnet** chainId — **may be 839999 or 840000**. **Already carried in-tree**, not discovered here: `chain-exsat-evm`'s README records the same ambiguity and ships **neither** as a constant. | **UNVERIFIED — which one is unknown.** Mainnet **7200** is the pinned constant (`EXSAT_MAINNET_CHAIN_ID`) and is itself to be confirmed live. | `eth_chainId` against the endpoint, every time, before signing (§4.2, F-14) — **by the component that holds the RPC; the adapter cannot make the call** (§1). Never trust the RPC URL. Settle the constant **once**, in the existing crate — §1 forbids a second pin. |
| **U-3** | **Which EntryPoint version exSat carries — v0.6 or v0.7.** They have **different paymaster interfaces.** v0.6 takes `UserOperation` and `postOp(mode, context, actualGasCost)`; v0.7 takes `PackedUserOperation`, splits paymaster gas limits into the `paymasterAndData` layout, and `postOp` additionally takes `actualUserOpFeePerGas`. `PostOpMode` semantics differ. **This spec does not assume one.** §6.5's return convention and §4.5's hash reasoning are written to hold across both; §4.4's deploy-field binding and **§6.4's `paymasterAndData` layout sketch** are given per version and must be pinned to the deployed one. **The v0.7 gas-limit packing (bytes `[20:52]`, absent in v0.6) is the materially risky leg** — an improvised offset either mis-parses the voucher or silently swallows the gas-limit bytes as voucher data, and P-1 is the head of the default-deny chain. **The `context` leg (§6.2.2):** both versions pass `context` from validation to `postOp`, but that the **deployed** EntryPoint relays it **verbatim and unmodified**, and that v0.7's `paymasterPostOpGasLimit` accommodates §6.2.2's fixed 192-byte payload, are claims on someone else's code — registered here, asserted nowhere. §6.2.1's reservation is released using bytes that make this round trip; if the round trip is not what §6.2.2 assumes, the release is wrong and §6.7's counters lie. | **UNVERIFIED — both versions, the offsets themselves, the `context` round trip, and the possibility of a modified fork, are open.** §6.4's sketch is a *sketch*: it is written to be pinned against source, and if it disagrees with the deployed source, the source wins and §6.4 is the defect. **Scope note — U-3 covers the FRAME, not the body:** §6.4.1's voucher body (`abi.encode`, 384 ‖ 65 = 449 bytes) is **our** format. No deployed source can confirm or refute it, so it is settled in §6.4.1 rather than registered here; only the 20/52-byte frame around it is U-3. | Read the deployed contract's verified source on exSat. Pin the version **and the byte offsets** in config. Compile the paymaster against **that** interface only. Any code that "supports both" is carrying a branch nobody tested. For `context`: read the EntryPoint's validation→`postOp` handoff, then confirm on testnet that the bytes `postOp` receives are byte-identical to those validation returned. |
| **U-4** | That `userOpHash` includes `paymasterAndData` in its preimage (the circularity that drives §4.5's design) on the deployed version. | **UNVERIFIED** | Read the deployed EntryPoint's hash function source. |
| **U-5** | That exSat's EntryPoint is **unmodified stock**, with stock 2D-nonce uniqueness semantics (the Layer-1 replay defence, §4.5). | **UNVERIFIED** | Diff the deployed source against the canonical release for the pinned version. If it diverges, §4.5 Layer 1 is void — see F-13. |
| **U-6** | **exSat's EVM level is Shanghai**, and what that costs us. Concretely: Shanghai has `PUSH0` but **not** Cancun's `TSTORE`/`TLOAD`/`MCOPY`. Two live consequences: (a) our own compiler target must be pinned `evm_version = "shanghai"` — a modern `solc` defaulting to Cancun emits opcodes a Shanghai chain rejects, and the failure surfaces at deploy or, worse, at an untaken branch; (b) whether the deployed EntryPoint version itself requires post-Shanghai opcodes. | **UNVERIFIED — both legs.** | (a) is verifiable in **our** repo the day the contract package exists: pin the target, and assert it in CI. (b) requires reading the deployed EntryPoint. |
| **U-7** | **The validation-rule set enforced by exSat bundlers** (ERC-7562 / ERC-4337 storage and opcode restrictions). **Four** legs, and the **first is load-bearing for the entire drain defence**: (a) whether **validation-phase storage writes** are permitted — required by **P-14/P-15's reservation** (§6.2.1) and by **Layer 2** (§4.5); (b) whether a paymaster may read/write storage **keyed by `sender`** (needed by **P-15**), and whether a stake is required to do so; (c) whether validation-phase `TIMESTAMP` is restricted — §6.3 bars the paymaster from reading the clock, so P-13 depends on this **not at all** by construction, which is the point of the restructure; **(d)** whether a paymaster may **read its own non-account-keyed storage slots** in validation, and at what stake. **Leg (d) is new in v0.3 and is a correction, not a discovery:** §6.3 called `epochGenesis`/`epochLength` "immutables," and a governance-changeable parameter **cannot** be a Solidity `immutable` — it is storage, read by `SLOAD`. `epochGenesis` is now frozen at deploy (§7.2) and **is** a genuine immutable; `epochLength` is governable (§7.4) and so **P-13's `epochOf()` performs a validation-phase storage read**, as does **P-14** for `budgetRateWeiPerSecond` and `epochLength`. Leg (c) does not cover this: a slot read is not a clock read. | **UNVERIFIED — and leg (a) is the one that decides whether §7's caps can bind at all.** §0 says the griefing counter is §6 and §7 and nothing else; §6.2.1 says a read-only cap does not bound a bundle. If validation writes are barred, the caps are advisory and the drain in §6.2.1 is open. **Leg (d) is the mildest of the four** — reading a paymaster's own slots is the ordinary case ERC-7562 contemplates for a staked paymaster, and leg (a) already gates deployment on a strictly stronger permission — so it **opens no drain that P-2/P-3/P-9/P-14/P-15/P-16 have not already put in this territory.** It is registered because the claim must match the mechanism, not because it is the risk. | Test against a real exSat bundler with a real op — a **bundle** of them, since a single op cannot exhibit the failure. If validation-phase writes or account-keyed storage are rejected, P-14/P-15 must move behind a redesign (e.g. the cap enters the signed voucher and the counter moves to `postOp` — which trades the intra-bundle bound for a signer-trust assumption, and F-10 exists because the signer may be compromised) — **that redesign is not written here and must not be improvised at implementation time. Fail-closed: if this item does not clear, the sponsored path does not deploy.** For (d): confirm the stake tier that permits own-slot reads, and note that **making `epochLength` immutable too would remove leg (d) at the cost of the knob** — a trade for the founder, not for the implementer. |
| **U-8** | **Bundler availability and policy on exSat**: whether any public bundler exists, its stake/reputation requirements for paymasters, its throttling and banning rules, its mempool policy, and whether it is a single operator. | **UNVERIFIED** | Enumerate live bundlers; read their policy; test. **Note the CD-13 gate**: "operator decentralization — single-operator barred (CD-7 class)." A single-bundler dependency for T2 is a named, pre-existing gate, not a new discovery. F-12 covers the runtime consequence. |
| **U-9** | That exSat gas is **BTC at 18 decimals** in the EVM's native-token position, and that nothing chain-specific (a gas oracle, an XSAT/BTC interaction, a non-standard fee market) intervenes between `maxCost` and what the deposit is actually charged. **P-10 binds `maxCost` — if exSat's fee mechanics make `maxCost` not the real ceiling, P-10 does not cap what it claims to cap.** | **UNVERIFIED** | Read exSat's gas/fee documentation **and** confirm on testnet with a real sponsored op: compare `maxCost` at validation against the deposit delta at `postOp`. |
| **U-10** | Whether exSat's EntryPoint deposit/stake mechanics (`depositTo`, `addStake`, unstake delay) are stock. The funding model in §7.2 assumes they are. | **UNVERIFIED** | Read the deployed source; test a deposit and a withdrawal on testnet. |
| **U-11** | Whether `SPIRIT-1` (420 per soul, lifetime unlock, 18 decimals, new supply only on a new unique human) exists as a **definitional artifact** in this tree. **Basis, stated as an exactly reproducible command** (v0.2 said "returns three hits" without saying what was run, and the obvious reading of it returns four — §11 tells a reviewer to re-run every grep this register cites, so the cell must survive being taken literally): <br>  `grep -rn "SPIRIT-1" crates/ --exclude-dir=target` <br> → **exactly three hits**, all under `crates/`: `chain-exsat-evm/README.md` (its "`b` boundary" section), `chain-exsat-evm/src/lib.rs` (the "`b`-blind" standing property), `shared-types/src/events.rs` (the BNRi genesis comment). <br> **Run tree-wide instead** — `grep -rn "SPIRIT-1" . --exclude-dir=target --exclude-dir=.git` — and the count is **four**: those three plus **this row, U-11 itself**. That fourth hit is the register's own self-reference and is **not** a definition either, so the conclusion is unchanged in both scopings; the count is spelled out here so a reviewer who gets 4 can tell "the register does not count itself" from "the register drifted again," which is the exact v0.1 failure §9 exists to prevent and which a bare number would have made indistinguishable. **The conclusion survives, and narrowly:** all three are *citations* — each says b is "accounted kernel-side (SPIRIT-1)" while drawing a boundary — and **not one of them defines** the 420, the lifetime unlock, the decimals, or the supply rule. Three references to a document that does not exist are still zero definitions of it. | **UNVERIFIED as an in-repo definition.** The b law in §3 is carried here on dispatch authority. It is now *also* cited by three in-tree artifacts that carry it the same way — which raises the cost of the gap rather than closing it. | Land SPIRIT-1 in the tree, or cite the artifact that supersedes it, and point the three existing citations at it. §3's seam does not depend on the number; §5.3.4's balance check does. |
| **U-12** | Whether `BNRi` exists as a named artifact in this tree. **Basis corrected, and the draft's conclusion does NOT survive:** the draft said "grep returns nothing" — false. BNRi **is** a named artifact here. `crates/shared-types/src/events.rs` defines **ten `Bnri*` variants of `EventType`** (`BnriInscriptionMinted` … `BnriDrawRevealed`) whose names its own comment records as founder-settled, and `chain-exsat-evm/src/signatures.rs` carries the `BNRI_GENESIS_V0_UNVERIFIED` table mapping them. §1's "first consumer, not owner" is a placement ruling about a consumer this repo **has** now met — by name. | **What is UNVERIFIED is narrower and sharper than the draft claimed: the BNRi *contract*.** Per `chain-exsat-evm`'s README, "**No BNRi contract exists** — no Solidity source, no ABI JSON, no deployment record anywhere in this tree." The event *names* are settled; the *signature strings* are not, so every table entry is `Verification::Unverified` and a production config refuses to load them (`SignatureTable::new`). §7.3's allowlist pins BNRi targets **by address per chainId** — and there is no address, because there is no contract. | Land the BNRi ABI. Then: replace each `signature` in `BNRI_GENESIS_V0_UNVERIFIED` and flip its mark to `Verification::Verified { source }` citing contract file + event declaration at a pinned commit (the crate's own stated procedure); and only then can §7.3's allowlist name a target. **Until the contract exists, this spec's allowlist has nothing to point at** — which is the correct behaviour of a fresh deployment (§7.3, "nothing is allowlisted by default"), not a gap. |
| **U-13** | **That the deployed EntryPoint enforces `validAfter` / `validUntil` from `packValidationData` as §6.3 describes** — rejecting an op **before** `validAfter` as well as after `validUntil`. This was already assumed for **expiry** (§4.5). **P-13 now makes it load-bearing for the epoch binding** (§6.3): the EntryPoint's clock is the *only* clock in this design, and the `validAfter` leg is what stops a compromised signer minting vouchers against future epochs' untouched budgets. A larger claim on someone else's deployed code than the draft made, and registered rather than assumed. | **UNVERIFIED** | Read the deployed EntryPoint's validation-data handling for the pinned version and confirm **both** bounds are enforced, not just expiry. Then test on testnet: submit an op whose `validAfter` is in the future and confirm the EntryPoint rejects it. **If only `validUntil` is enforced, F-10's one-epoch bound does not hold** and P-13 must be redesigned — not improvised. |

---

## §10 — Open questions / founder gates

Raised, not answered. Per ORDERS-1 §3 Seat 3 ("escalate: acceptance criteria
unmeetable as written → back to Seat 1 with the failing case") and doctrine 6
("digests prove integrity, never authority").

**Q-1 — The docket number.** This dispatch names the artifact **CD-29**;
`docs/feature-backlog.md` places the Resource Paymaster at **CD-13** and places
**CD-29** as the eternal-runtime *observation* — explicitly "NOT a build target,
NOT a positioning claim", to be revisited "only when the floors exist (paymaster
built…)". Writing the paymaster spec *as CD-29* files the floor under the number
of the thing that was quarantined pending the floor. The file is at the dispatched
path regardless. **Ruling wanted:** is this CD-13's spec (and the filename is
wrong), or has CD-29 been promoted from quarantine to build target (and the
backlog needs an amendment)? A spec that answers to two numbers gets audited under
neither.

**Q-2 — The two-loop law vs. b-for-BTC-gas. FOUNDER-CLASS. The largest open
question in this document.** §3.5 states it in full. In short: CD-13's two-loop
law says b never touches the money loop, is "never a redemption ticket in the
paymaster", and reaches "the service layer … never the commodity layer"; gas is
about as commodity as a commodity gets. `CONSTITUTION.md` Article V.1 adds that
the paymaster "must never *absorb* cost." A b debit that causes the treasury to
front BTC is either (a) a service fee that happens to be denominated in the
service's cost — allowed, if the pool is funded by the money loop and the b debit
is metering rather than paying; or (b) b redeeming for a treasury-held commodity
— barred. **This spec's mechanism is compatible with both readings and rules on
neither.** §3.1's seam holds either way; what changes is what §7.2's pool is
funded *by* and what §5.3.4's balance check *means*. **This is a ruling the
mechanism cannot make for itself, and implementation should not begin before it
lands** — the difference is not a parameter, it is what the debit *is*.

**Q-3 — The b↔BTC rate.** If Q-2 lands on (a), something must map "this op costs
N wei of BTC" to "debit M attos of b." **That mapping is a price, and a price is
the exact object §3 exists to keep off the seam.** Naming it here would be
designing the thing this spec was told not to design. Note the shape of the trap:
a public, mechanical b↔BTC rate gives b a de-facto external price — which
CD-13's bSAFE exclusion names as "de facto purchasability via secondary pricing"
and bars. **Founder-class. Not settled here. §7.4 deliberately does not put this
knob at the Feature tier.**

**Q-4 — Who funds the pool.** Article V.1 forbids operator subsidy; CD-13's gate
list includes "(3) treasury funding under TE lens, earned-service framing
(CD-4-gated)" and "(2) cost-per-onboarded-user measurement across all five
resources before belief." §7.2 specifies the *ceiling* mechanism and is silent on
the *source* — deliberately, because the source is CD-4-gated and not this spec's
to invent.

**Q-5 — Sybil, restated for this leg.** CD-13's gate (1): "drain/Sybil red-team —
a resource pool is a faucet and faucets get farmed." §5.3.5 requires a soul-
attested account, which pushes the problem into personhood (CD-22) rather than
solving it. If the b balance check (§5.3.4) is the binding cap, then Sybil
resistance *is* the drain defence, and it is not in this document. **Named, not
closed.**

**Q-6 — Multi-chain, later.** §1 asserts the core does not change when a chain is
added. That assertion is cheap with one chain. The first honest test is the second
4337 chain, and the seam claim in §3 should be re-audited then rather than assumed
to have held.

**Q-7 — WHO holds the pause. FOUNDER-CLASS, and unanswerable inside this
document.** §7.4's third row grants **unilateral, no-vote** authority — pause,
remove a target, lower a cap — and is the only row in that table with no tier, no
`K`, and no quorum. Every other row binds to `docs/article-vi-s3.md` (§3.3's
ladder at :36-38, §3.4's quorums at :50-52). This one rested on an undefined
"guardian."

**Why this spec cannot answer it.** The repo's only guardian is the **Epoch-1
founder/guardian meta-tier co-signer** (`docs/article-vi-s3.md:70`, "Through
Epoch 1 at minimum, every meta-tier amendment additionally requires a
founder/guardian co-sign"). That role has a **named exit**: on release,
`article-vi-s3.md:78` — **"the guardian keys are destroyed, publicly, and the
destruction is ledgered as an Event."** The constitution destroys the only key
this spec's fast brake could be held by, and **names no successor anywhere in this
tree**. Naming one here would be inventing a governance role, which ORDERS-1 bars
this seat from doing; the alternative — leaving "guardian" undefined — means an
implementer cannot write the access control on `pause()`, `removeTarget()`, or
`lowerCap()` and will improvise one, which is the same defect with a quieter
author.

**What is NOT open:** the *direction*. §7.5 bounds this authority to the **deny**
direction and that is settled — the holder can stop sponsorship, never start or
widen it. A compromised pause principal costs the system T2 (a UX regression, §2),
never the pool. That is what makes this gate safe to leave open in a spec and
unsafe to leave open at deployment.

**Ruling wanted, in two parts:**
1. **Who holds pause during Epoch 1** — the founder/guardian co-signer, or a
   separate principal with a separate key? (The paymaster's brake and the
   constitution's meta-tier brake are different objects with different lifetimes;
   binding the first to the second is what makes :78 destroy it.)
2. **Who holds it after the guardian keys are destroyed.** The honest options
   visible from here are: a Safety-tier standing committee; a fully permissionless
   pause (anyone may stop sponsorship — the deny direction makes this less absurd
   than it sounds, though it hands anyone a T2 denial-of-service); or an accepted
   ruling that **post-release there is no fast brake** and the caps alone carry
   F-10. **This spec does not choose, and lists these to show the gate is real,
   not to propose one.**

**Consequence if unruled: the contract cannot be written.** F-10's stated answer
to a compromised kernel signer — "guardian pause stops it without a vote" — is
held by a key with a scheduled destruction date and no successor. Implementation
of §7.5 is gated on this.

---

## §11 — Acceptance criteria (this document)

- [ ] No Solidity is authored here. **Holds** — this document contains none, and
      authorises none.
- [ ] Every external dependency is marked **UNVERIFIED** and registered in §9.
- [ ] No address is invented. **Holds** — §9 U-1 carries no address, by design.
- [ ] No sentence anywhere claims simulation, quoting, or bLOVErAi prevents
      griefing. Grep the words "simulat", "quote", "companion" and read every hit
      against §0. **This is the review's first check, not its last.**
- [ ] The four LANGUAGE-LAW words are never **used** to describe this design —
      mentioning a banned word inside the rule that bans it is not using it.
      **Check:** `grep -in "proven\|unhackable\|impossible\|rock-solid"`.
      **Pass condition: exactly one matching line — the grep pattern on this
      criterion's own line, immediately above. Any second hit is a defect.**
      (Verified at draft: one hit.) The ceiling is "sound by construction /
      isolated by design"; §0 states it, and states it without using any of the
      four. *(Worded the long way on purpose: a criterion reading "appears
      nowhere" would fail its own grep, and a criterion that fails its own check
      is the precedent at the bottom of this list.)*
- [ ] The `A`+slash+`b` construction is never used. **Check:** grep for capital-A,
      forward-slash, lower-b — written here in words, not as a pattern, because a
      criterion that spells out the string it forbids becomes a hit for its own
      check. (That is not hypothetical: the first draft of this line embedded the
      pattern and failed itself.) **Pass condition: exactly one matching line —
      §3.3 S-5, which quotes the construction in order to forbid it. Any second
      hit is a defect.** (Verified at draft: one hit.) `b != A != BTC` (§3.3 S-5).
- [ ] The voucher struct (§4.3) has **no b field**. §3.3 S-1. Grep the struct for
      `b` as a denomination: zero hits is the pass condition, and this one has no
      exception.
- [ ] The acceptance predicate (§6.2) is default-deny and enumerates every
      sponsoring path.
- [ ] **Every cap that §7 calls a cap is enforced by a WRITE, not a read.**
      **Check:** for each of P-14 and P-15, name the state it mutates at
      validation (§6.2.1) and the `postOp` step that settles it (§6.7). A
      predicate that only compares is advisory, and §7.2 names advisory caps as
      the failure. **The failing case to test against: N sponsored ops in one
      bundle, no `postOp` yet run.** If the Nth op validates against the same
      counter the 1st did, the caps bound nothing.
- [ ] **Every claim that leans on the caps names the reservation.** F-10 and §7.2
      both assert a one-epoch bound; neither may assert it without §6.2.1 and
      P-13's window-inside-its-own-epoch binding, and both dependencies are
      UNVERIFIED (U-7 leg (a), U-13).
- [ ] **No validation-time clock read, and no `currentEpoch` actuator.**
      **Check:** grep `currentEpoch`. **Pass condition: every hit is a statement
      that it does not exist** (the header, §6.3, §7.2, and this line). **A hit
      that *reads* it — a predicate comparing against it, a section defining it,
      an actor advancing it — is the defect.** `epochOf()` takes voucher fields
      and pinned parameters, never `block.timestamp` (§6.3). A rollover actuator
      would be a pool-refill primitive and no actor is authorised to hold one
      (§7.5, §10 Q-7).
- [ ] **NO POOL-REFILL PRIMITIVE SURVIVES UNDER ANY NAME — the check that
      `currentEpoch`'s deletion alone did not pass.** Deleting the variable was
      necessary and was mistaken for sufficient: v0.2 removed `currentEpoch` and
      left the *calendar* Feature-tier, and a Feature vote shortening `epochLength`
      refilled the pool ~720×/month while `epochBudgetWei` — a bucket per *epoch* —
      sat untouched and no predicate objected. **Check, and do not check for the
      name:** for **every** parameter any tier in §7.4 can move, ask *"does a vote
      to change this raise the BTC the pool fronts per unit time?"* **Pass
      condition: no. For all of them.** Today that holds because
      `budgetRateWeiPerSecond` **is** a rate (moving it is the honest treasury
      vote §7.4 intends), `epochLength` cannot move the rate (the budget is
      **derived**, §7.2), and `epochGenesis` cannot move at all (frozen at deploy —
      a shiftable genesis compresses the next boundary and is the same ~720×
      without touching `epochLength`). **The failing case to test against: take
      `epochLength` from 30 days to 1 hour by Feature vote and compute the pool's
      monthly burn. If it moved, this criterion has failed and §6.3's
      no-authorised-refill claim is false.** A future revision that restores a
      directly-set `epochBudgetWei`, or that makes `epochGenesis` governable at any
      tier, re-opens this and must be rejected on this line.
- [ ] **Every value `postOp` uses, validation actually gives it.** §6.7's four steps
      name `account`, `epoch`, `reservedWei`, `voucherId`, `quoteRef`, `target` —
      and `postOp`'s inputs are only `(mode, context, actualGasCost[,
      actualUserOpFeePerGas])`. **Check:** each of those six is in §6.2.2's
      `context`, and the release in §6.7 step 2 uses **`context.reservedWei`** —
      the reservation carried verbatim — never a recomputed ceiling. A release that
      does not equal its reservation is a stuck counter in one direction and a free
      refill in the other. (Precedent: v0.2 specified the reservation (§6.2.1) and
      never specified `context`, which appeared in the whole document exactly once
      — inside a U-3 row describing someone else's function signature. The
      reservation was unreleasable and the spec did not notice.)
- [ ] **P-1's "exact length" is a number a reviewer can compute.** **Check:** §6.4.1
      gives the voucher body's encoding (`abi.encode`, twelve static fields, 384
      bytes) and the exact totals (469 v0.6 / 501 v0.7). **`abi.encode` and
      `abi.encodePacked` differ (384 vs 250), so an unspecified encoding makes
      "exact length" uncomputable and P-1 — the head of the default-deny chain —
      unimplementable.** Note which leg is verifiable against what: the **frame**
      is the EntryPoint's (U-3, read the deployed source); the **body** is ours and
      no source can arbitrate it. "Read it from the deployed source" is not a
      remedy for a format the deployed source has never heard of.
- [ ] **The credit direction has a fail-closed rule, and it points the other
      way.** §5.6: indeterminate ⇒ **withhold**; refunds bounded to their
      originating debit row; idempotent and terminal. **Check:** every §8 row that
      **governs the credit direction** — F-6, F-8, F-15, F-17, F-18, **five** —
      cites §5.6, *and* §5.6 claims authority over the same five. **Count the same
      way in both places:** the phrase "ends in a credit" undercounts, because F-17
      ends in a **withhold** and F-18 in a **no-op** — a withhold is a decision
      about a credit and a no-op is R-4 answering, so both are §5.6's and neither
      is a separate regime. (Precedent: §5.6 was written enumerating three of its
      five, having dropped the two added in the same revision *for* it.)
      A spec that states fail-closed only for signatures has stated it for half
      its surface, and the unstated half is the half that can mint b.
- [ ] **Every pointer resolves.** **Check:** each `(§x.y)` cross-reference names a
      section that contains what the citation claims it contains. (Precedent: P-1
      pointed at §6.4 for a byte layout §6.4 did not have, and U-3 asserted §6.4
      gave one — the head of the default-deny chain pointing at nothing, twice
      attested.)
- [ ] The degradation law (§2) is stated such that deleting the paymaster leaves
      a whole system, **and every rung's fallback is a mechanism this document
      builds, not a rung it merely names** (§2's T3 note; rule 2 securing T1).
- [ ] Comments match content: no claim here asserts a property the mechanism does
      not have. Where a property depends on someone else's deployed code, §9 says
      so instead of asserting it. (Precedent this guards against: a `computeSeed`
      comment claiming "frozen at mint" while the code recomputed from
      `block.timestamp` — a comment claiming a property the code lacks is a
      defect, not a nit.)
- [ ] **§9 is an accurate inventory of this tree, re-checked and not remembered.**
      **Check:** re-run every grep §9 cites, against the tree as it is now. A
      register whose factual basis has gone stale instructs the founder to act on
      an inventory that does not exist. (Precedent: v0.1 asserted "this tree
      contains no reference to exSat at all" while `crates/chain-exsat-evm/` was
      on disk with the chainId already pinned — see §9's correction of record.
      This is now the most expensive line in this list to leave unticked.)
- [ ] Founder gates §10 Q-1 … Q-7 are raised, not silently resolved.

**Status: DRAFT v0.2 — specification only. Not ratified. Not scheduled. Not
implemented. Ratification = founder commit (ORDERS-1 §5). Implementation is gated
on §10 Q-1, Q-2, **Q-7** (§7.5 has no principal and its access control cannot be
written without one), and on §9 U-1, U-3, U-5, **U-7**, U-13 clearing Article IV —
at minimum. U-7 leg (a) is the sharpest of these: if exSat's bundlers bar
validation-phase writes, §7's caps cannot bind intra-bundle as specified, and §0
says the caps are the whole griefing counter.**
