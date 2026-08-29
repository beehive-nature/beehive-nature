# LAW-BOOK AMENDMENT — STRIKE EIP-2255 AS THE NAMED ATTENUATION PRIMITIVE (2026-08-07)
**Authority:** Seat 0, on goose/Fable research finding. **Filed by:** Cowork (document seat).
**Applies to:** every doc naming EIP-2255 as the delegation/attenuation primitive.
**Method:** append-only correction per `RULING_REPO_IS_THE_RECORD` — ruled text is NOT
rewritten; this file is the correction of record and the cited docs carry pointers to it.

> **⚠ SUPERSESSION POINTER (autonomy ruling, 2026-08-29):** §3's succession discussion
> assumes a SUPERVISED act class needing an approver — that axis is retired (agents run
> fully autonomous). ERC-7710-style scoping survives ONLY as the owner's optional
> spend-cap tool, never an approval gate.

## THE STRIKE

**EIP-2255 is NOT a delegation or attenuation standard.** Verified findings:
- No caveat semantics.
- **No fork exists** — the "FORK EIP-2255" primitive named in prior rulings does not
  refer to a real artifact.
- `wallet_grantPermissions` was **renamed**; the name in our docs is stale.

**Therefore: strike EIP-2255 as the named primitive. Do not write spec text against it.**

## THE REPLACEMENT (correct primitive)

**Real attenuation = ERC-7710 redemption + Delegation Manager enforcer set.**

The load-bearing correction for anyone about to write spec text: **a caveat is a
contract address + calldata, NOT a JSON string.** Any design that models caveats as
serialized JSON policy blobs is modelling the wrong thing and will not enforce.

**ERC-7715 is human-gated by specification — DO NOT USE IT** for autonomous paths.
**ERC-7710 grants CAN be signed programmatically**, which is why it survives the standing
self-heal test: the trust root at grant time is **key custody, not a human**. That
distinction is what makes the 10^10-users × 1000-year bar reachable.

## DOCS CARRYING THE STALE NAME (pointer notes appended, text preserved)

| Doc | Location of stale claim |
|---|---|
| `RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md` | §4.2 — "caveat-based delegation, the EIP-2255 fork" |
| `RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md` | §4 — "caveat-based delegation, FORK EIP-2255, per the Zano companion-permissions ruling" |

Both are Seat 0 ruled text and are **left verbatim**; each now carries a pointer to this
amendment. The rulings' *substance* (scoped delegation is the shape) survives intact —
only the named mechanism was wrong.

> **⛔ SECTION REFUTED 2026-08-08 — the finite-allowance claim below is DEAD.**
> goose's source read (`ant-client` pinned `81a0a24`) refutes it: **ant-core's only public
> wrapper, `approve_token_spend()`, hardcodes `U256::MAX`** (`payment.rs:141`; the doc
> comment at `:130` reads *"Approves U256::MAX (unlimited) spending"*). **Both paths are
> unlimited** — the finite-vs-merkle distinction this section rests on **does not exist as
> shipped.** Confirmed independently by Code's self-attack: an agent holding the wallet's
> signing authority can simply call `approve_token_spend()` again and re-approve to MAX, so
> a binding ceiling needs **both** custom finite-amount code **and** a re-approval guard —
> **neither ships.**
> **SURVIVES:** the **external-signer seam is real** (`mod.rs:453`, *"private key lives
> outside Rust"*; `alloy = "1"` in `ant-protocol`). Keys **can** live outside the process.
> That is the piece to build on — and it is the only piece.
> **Consequence:** the Stage-2 `pay` verb has **no verified custody mechanism.** That is now
> a receipt, not a caution. Text below is preserved unedited as the record of a refuted
> recommendation (promote-don't-erase); **do not build against it.**
>
> ### ⭐ RECONCILED 2026-08-08 — THE CONVERGENCE (build Stage 2 on this)
>
> The two source reads were **both true, at different layers** — not a conflict:
>
> | Read | Crate + ref | Finding |
> |---|---|---|
> | goose | `ant-core` @ `ant-client 81a0a24` | `approve_token_spend()` hardcodes `U256::MAX` (`payment.rs:141`; doc `:130`) |
> | Code | `evmlib` @ `main` | `Wallet::approve_to_spend_tokens` accepts an **arbitrary** amount |
>
> **What settles it:** **BOTH payment paths AUTO-TOP-UP to `U256::MAX` when the allowance is
> insufficient** — `wallet.rs:430-441` (regular) and `wallet.rs:201-204` (merkle). **A finite
> approval is therefore erased on first payment.** Code's arbitrary-amount setter is real but
> cannot hold a ceiling against the top-up.
>
> **THE ONE PATH THAT PRODUCES A FINITE APPROVAL IS THE EXTERNAL-SIGNER PATH** — it sets
> `approve_amount` to exactly the total owed.
>
> **The architectural point, and it is the good news of the night:** the seam that keeps keys
> **outside the process** and the seam that **bounds the approval** are **THE SAME SEAM.** One
> mechanism, two properties — not two problems to solve. **A finite approval is achievable
> precisely when the client does NOT hold the signing key.** External-signer is load-bearing
> on both axes, so the custody half of Stage 2 now has a **named path with a citation under
> it**, where an hour ago it had none.
>
> **Still blocked:** the **gas** blocker (Arbitrum gas is ETH; the agent earns ANT; no
> sponsorship path). Stage-2 `pay`-verb text stays blocked on that alone.
>
> **ERC RECHECK CLOSED 2026-08-08 — this amendment STANDS, no second correction.**
> **ERC-7710 and ERC-7715 both EXIST** at `github.com/ethereum/ERCs` (`ERCS/erc-7710.md`,
> `ERCS/erc-7715.md`). The earlier 404 was the repo split, not non-existence — goose checked
> `ethereum/EIPs` and owned the error. **Naming ERC-7710 as the real primitive is correct.**
>
> **Two qualifications that must travel with every citation of it:**
> 1. **Both are DRAFT, not Final.** Spec text must say so; a Draft ERC can change under us.
> 2. **Sharpened, replacing this amendment's looser wording:** *"caveats are absent from
>    ERC-7710's **normative Specification** entirely and exist only in MetaMask's
>    **non-normative Reference Implementation**."* The earlier phrasing implied caveats were
>    normative-but-misdescribed; they are **not in the normative text at all.** Anyone
>    writing spec against "ERC-7710 caveats" is writing against a reference implementation,
>    not a standard.

## AUTONOMI CUSTODY — the way through is NOT the framework

Recorded here because it resolves the `pay`-verb blocker the same day the primitive was
struck:

- `approve_to_spend_tokens(spender, finite_amount)` sets a **finite ERC-20 allowance that
  the TOKEN CONTRACT enforces as a hard ceiling.** That is the attenuation, at the asset
  layer, without any delegation framework.
- **NEVER engage the merkle path (≥64 chunks) — it grants INFINITE allowance.** This is a
  hard fence, not a preference.
- Autonomi accepts a **remote KMS/HSM signer** (`alloy Arc<dyn TxSigner>`); **AwsSigner is
  the shipped precedent.** This is an **EOA-signing seam, not ERC-4337 account
  abstraction** — earlier framing assumed AA and was wrong about the seam.

## THREE BLOCKERS — none resolved, all recorded

1. **`maidsafe/autonomi` ARCHIVED 2026-05-22** (successor: "WithAutonomi"). Whether the
   external-signer flow survives into the successor is **UNVERIFIED and BLOCKING**. No
   `pay`-verb spec text may be written past this.
2. **Gas unsolved.** Arbitrum gas is **ETH**; the agent earns **ANT**; no sponsorship path
   identified. An agent that cannot pay gas cannot self-fund regardless of allowance.
3. **Succession.** SUPERVISED resolves to **one named human** — a single point of failure
   against the 1000-year bar. **Escalated to founder**, unresolved.

## EARNING-LOOP AMENDMENT CANDIDATE (founder should see before it hardens)

The "agents self-fund from earned resources" ruling rests on rails that are **not
uniformly real**:

| Rail | Contribute-to-earn status |
|---|---|
| **Autonomi / ANT** | ✅ **The only verified permissionless contribute-to-earn rail.** And its **rewards-address is decoupled from its spending signer** — precisely the separation the architecture needs |
| **Arweave / `x-paid-by`** | ⚠️ **One level deep** — "Shared Credits cannot be re-shared." **Collides with a multi-level bDiD hierarchy** |
| **Vaulta / A** | ❌ **No contribute-to-earn path.** "Earn b by running nodes" is **beehive-internal issuance, not a chain rail** — an important distinction that the hierarchy ruling's §1 currently blurs |

**Consequence for the record:** the self-funding architecture is verified on exactly one
rail today. That does not invalidate the ruling; it bounds where the ruling is currently
executable. Founder input owed before this hardens into spec.

## SCOPE
Records the strike, the correct primitive, the custody seam, the blockers, and the
earning-loop bound. **Writes no spec text and rules nothing.** Tiering, attenuation
mechanism, and the earning loop remain research + options per the standing fence.
