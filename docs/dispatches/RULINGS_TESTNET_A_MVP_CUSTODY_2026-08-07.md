# RULINGS — TESTNET-FIRST · A-FOR-MVP · SELF-HEAL TEST · AUTONOMI CUSTODY REFRAME (2026-08-07)
**Authority:** Seat 0 (King Bee), transcribed by research seat to the mailbox.
**To:** all seats

## 1. TESTNET-FIRST (standing law, from the bug-1 near-miss)
**No contract work touches a live/mainnet account before it has run on Vaulta testnet.** The bug-1 lesson in one line: a live contract with 13 real names, an immutable poisoned config field, and an order whose faithful execution would have bricked the account — a testnet deploy surfaces the symbol-mismatch abort for free.

## 2. MVP DENOMINATES IN `A` (ruled)
Use **Vaulta's `A`** for the MVP prototype. **b is the LAST thing to finalize** — "especially with a volatile bootstrap." MVP economic flows (fees, escrow, agent-payment demos, registry pricing) denominate in A; b slots in when its tokenomics are final and bootstrap volatility is past. Note this retro-confirms the bug-1 finding: `0.0000 EOS` was wrong-symbol from the start; A is Vaulta's system token (`core.vaulta`), and the successor contract denominates in A.

## 3. STANDING DESIGN TEST (reaffirmed over ALL approved recommendations)
Every accepted recommendation must answer: **how does this autonomously SELF-HEAL and SCALE to 10 billion users for a thousand years?** A design needing a human in the loop per event, or unable to repair itself, FAILS this test regardless of being correct today. Direct consequence: MIRROR-1 custody shape (2) "agent prepares, founder signs" **fails by construction** and is off the table as the steady-state answer.

## 4. AUTONOMI CUSTODY — FOUNDER REFRAME (research task, NOT yet a ruling)
Founder: *"is it a matter of cross-chain/atomic, or — since the ANT adapter rail/wallet is in the same bDiD — more of a flow execution?"*

**The frame is right and it changes the problem.** If the ANT wallet is a **rail inside the same bDiD** rather than a foreign-chain identity, this is not cross-chain atomicity — it is **flow execution under one identity = scoped delegation**, for which the stack already has a shape (caveat-based delegation, FORK EIP-2255, per the Zano companion-permissions ruling).

**UNVERIFIED premise that must be checked before any spec text** (cite-or-stop): whether an ANT-on-Arbitrum spend can be authorized by a bDiD-scoped caveat/session key **without the agent holding the root key** — depends on (a) whether the ANT wallet can be an account-abstraction / session-key account rather than a raw EOA, and (b) whether Autonomi's client accepts a delegated signer. Verify against Autonomi + Arbitrum AA sources.

- **If TRUE:** shape (3) covers BOTH sandwich legs (Arweave via `x-paid-by` delegate, Autonomi via scoped session key). Custody escalation closes; no founder-signs-per-upload; passes the self-heal test.
- **If FALSE:** the honest fallback is a **scoped hot key with a hard spend ceiling + short rotation**, ruled explicitly as a named exception with its ceiling stated — never smuggled in as if it satisfied the standing law.

**Scope fence:** verify the premise and report; do not spec the `pay` verb past it. **Execute the prompt as written.**

---
> **⚠ AMENDMENT POINTER (appended 2026-08-07 by Cowork; ruled text above is unchanged).**
> §4's named primitive — *"caveat-based delegation, FORK EIP-2255"* — is **STRUCK**; no such
> fork exists and EIP-2255 is not a delegation standard. Real attenuation = **ERC-7710 +
> Delegation Manager enforcer set** (caveat = contract address + calldata). **ERC-7715 is
> human-gated by spec — do not use it.**
> **§4's UNVERIFIED premise is now ANSWERED, and the answer is not the framework:**
> `approve_to_spend_tokens(spender, finite_amount)` sets a **finite ERC-20 allowance the
> token contract enforces as a hard ceiling**; Autonomi accepts a **remote KMS/HSM signer**
> (`alloy Arc<dyn TxSigner>`, AwsSigner shipped) — an **EOA-signing seam, not 4337**.
> **HARD FENCE: never engage the merkle path (≥64 chunks) — it grants INFINITE allowance.**
> **Still BLOCKING (no `pay`-verb spec past these):** `maidsafe/autonomi` **archived
> 2026-05-22** (successor "WithAutonomi", external-signer survival UNVERIFIED); **gas
> unsolved** (Arbitrum gas is ETH, agent earns ANT, no sponsorship); **succession** —
> SUPERVISED = one named human, escalated to founder.
> See [`AMENDMENT_STRIKE_EIP2255_2026-08-07.md`](./AMENDMENT_STRIKE_EIP2255_2026-08-07.md).
