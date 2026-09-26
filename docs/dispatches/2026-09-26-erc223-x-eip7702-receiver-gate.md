# ERC-223 × EIP-7702 — the receiver-gate collision, and the eight-point compatibility gate

date 2026-09-26 · seat zCode (GLM) · scope: desk research only — docs, no code, no surfaces; every external claim checked against a first-party source on this date (spec texts, MetaMask's repo, Dex223's repos, cited paths read in-tree). Companion dispatch: [2026-09-26-buzz-x0x-venice-x402-synergy.md](2026-09-26-buzz-x0x-venice-x402-synergy.md). Home for this work: beside [ops/x402-door/README.md](../../ops/x402-door/README.md) and [crates/bsigner/src/x402.rs](../../crates/bsigner/src/x402.rs).

## THE COLLISION

Two standards read the same address in incompatible ways once EIP-7702 is live.

**ERC-223 decides "contract or EOA" by code presence.** The ERC-223 spec ([eips.ethereum.org/EIPS/eip-223](https://eips.ethereum.org/EIPS/eip-223)) makes the receiver hook conditional on the recipient having code: a "possible way to check whether the `_to` is a contract or an address is to assemble the code of `_to`" — the reference library's `isContract` is literally `size := extcodesize(account)`. If the recipient is an EOA, "the transaction must be sent without executing tokenReceived in `_to`"; if `_to` is a contract, the token "must call the tokenReceived(address, uint256, bytes calldata) function of `_to`". And the spec is normative that a contract without the hook rejects the money: **"If the tokenReceived function is not implemented in `_to` (recipient contract), then the transaction must fail and the transfer of tokens must be reverted."**

**EIP-7702 makes a delegated EOA look like a contract.** The EIP-7702 spec ([eips.ethereum.org/EIPS/eip-7702](https://eips.ethereum.org/EIPS/eip-7702)) sets the delegated account's code to the delegation indicator — "Set the code of authority to be `0xef0100 || address`" — three bytes plus the 20-byte designator, 23 bytes total. Code-reading opcodes see the indicator, not the designator's code: "when executing a delegated account EXTCODESIZE returns 23 (the size of `0xef0100 || address`)", while code-**executing** opcodes (CALL/DELEGATECALL/…) follow the pointer and run the designator's code in the EOA's context.

**So the two halves compose into a trap.** A delegated EOA has extcodesize 23 → every ERC-223 token classifies it as a contract → the token calls `tokenReceived` on the delegation designator. If the designator does not implement `tokenReceived` — and MetaMask's does not (below) — the transfer reverts. Nothing is lost (ERC-223's revert-on-missing-hook is its anti-burn feature), but the account is silently **unable to receive ERC-223 value** for as long as it is delegated: no direct transfers, no ERC-223 DEX legs, nothing that ends in an ERC-223 `transfer` to the account. Un-delegate and the same address receives again. The failure is invisible at the wallet layer — the wallet shows a normal EOA.

The sharper edge is the designator that *does* implement `tokenReceived` for convenience: it then accepts a callback whose `_from` is an attacker-choosable argument and whose `_data` is attacker bytes. That is the exact class DEX223's public record documents (below). Accepting the hook without authenticating is how a receiver becomes the exploit.

## WHAT METAMASK'S 7702 DELEGATOR IMPLEMENTS (checked, first-party)

Source: [`src/EIP7702/EIP7702DeleGatorCore.sol`](https://github.com/MetaMask/delegation-framework/blob/main/src/EIP7702/EIP7702DeleGatorCore.sol) in MetaMask/delegation-framework, at commit `1f91637e7f61d03e012b7c9d7fc5ee4dc86ce3f3` (2025-03-08, "Audit - Feb 2025 - 7.1.1 - Add Entry Point to the UserOp Hash (#66)" — the newest commit touching that path at check time; repo pushed_at 2026-09-25).

- `abstract contract EIP7702DeleGatorCore is ExecutionHelper, IERC165, IERC7821, IDeleGatorCore, IERC721Receiver, IERC1155Receiver, EIP712` — ERC-721 and ERC-1155 receivers are implemented, so safe-transfer standards that use receiver hooks work into delegated accounts.
- `supportsInterface` advertises exactly: `IDeleGatorCore`, `IERC721Receiver`, `IERC1155Receiver`, `IERC165`, `IERC1271`, `IERC7821`. No ERC-223 receiver interface ID exists to advertise.
- **`tokenReceived` appears zero times in the file**, and a repo-wide GitHub code search for `tokenReceived` in MetaMask/delegation-framework returned **0 hits** on the check date.

**Verdict:** the flagship MetaMask 7702 designator does not implement ERC-223's receiver. Today, an EOA delegated to it rejects every ERC-223 transfer with a revert (per the ERC-223 normative text above). The asymmetry is the finding: ERC-721/1155 receivers yes, ERC-223 receiver no — because ERC-223's receiver interface never entered the smart-account toolchain.

## THE DEX223 RECORD — AND WHAT WE COULD NOT VERIFY

**The claim in the lane order** — "DEX223 router exploit (Feb 13, 2026), cite their post-mortem" — **could not be verified.** As of this date: Dex223's blog sitemap (blog.dex223.io, ~40 posts listed) contains no exploit post-mortem; web search finds none; GitHub shows no such report dated 2026-02-13. Per the house publication-claim evidence law, an invented citation weighs zero — **the post-mortem is not cited, and the date is not asserted.**

What **is** first-party verifiable in Dex223's own repos is a sustained record of exactly the callback-trust failure class this dispatch is about:

- **EthereumCommonwealth/Dex223-contracts** (Dexaran's org): a one-day security-audit fix wave on **2026-02-17** (issues #34–#47, including "fix: Security Audit — CallbackValidation.sol", `b17fb6629c`), followed by commit **`ea41c72fd6` (2026-02-20): "Fixed call_sender assignment via the tokenReceived function"** — the receiver hook mis-assigning authority from callback-supplied data, patched four months ago.
- **rroland10/dex223-bug-bounty** ("Dex223 Bug Bounty Program — Enterprise-grade security program with ERC-223 focus"):
  - **#8, 2026-06-06, [CRITICAL]** — "Arbitrary delegatecall via tokenReceived() Enables Swap Context Hijacking and Fund Drain" (Dex223Pool.sol / Dex223PoolLib.sol).
  - **#11, 2026-08-23, [BUG]** — the cleanest statement of the invariant, in the reporter's words: a malicious ERC-223 token "can **spoof the `_from` argument**, making the router treat an arbitrary address (the victim) as the payer of a swap" — router `tokenReceived` → unvalidated `delegatecall(_data)`, `call_sender = _from` → drain of any user's unspent ERC-20 allowance who ever approved the legacy mainnet router (`0xbeBAB9Ab58f8099fbFEb15E14b663615D19304Fa`), "with zero victim interaction." PoC on a mainnet fork reported passing. The newer router's fix is the lesson distilled: `require(params.tokenIn == msg.sender, "Wrong token swap requested")` — **authenticate the token contract independently**. (Report is open and unadjudicated; we cite the report's claim and its PoC, not a settlement.)
  - **#13, 2026-09-15** — free unbacked converter-wrapper minting via public `tokenReceived()`; **#10, 2026-08-18** — drain via sweep/unwrap ("incomplete ERC-223 fix").

**The invariant, carried as house law regardless of the unverified citation:**

> **Never derive authority from callback-supplied identity.** In `tokenReceived(_from, _value, _data)` the receiver's only trustworthy facts are its own state and `msg.sender` (the token contract). `_from` is a value the *token* chose to pass; `_data` is bytes the token chose to pass. A receiver that spends on `_from`'s behalf, delegatecalls into `_data`, or mints on callback strength has handed the token contract — which may be attacker-deployed — its pen.

## THE EIGHT-POINT COMPATIBILITY GATE (proposed, not implemented)

For any estate surface that may touch ERC-223 tokens while accounts are 7702-delegated:

1. **Detect the indicator.** Before any ERC-223-style `isContract` probe, check for the delegation indicator: extcodesize 23 and the `0xef0100` prefix. An address carrying it is a *delegated EOA*, not a plain contract and not a plain EOA — classify it as its own thing.
2. **Test an ERC-223 transfer into a delegated account.** A live harness call, expected result today: revert from the missing hook. The test is the canary — when a designator gains a receiver, the transfer behavior changes underneath you.
3. **Require `tokenReceived`.** Any designator the estate adopts or forks must implement ERC-223's receiver (and advertise it), or estate surfaces must refuse to treat the delegated account as ERC-223-receivable. Never let "sometimes it reverts" be the documented behavior.
4. **Authenticate the token contract independently.** The receiver accepts callbacks only from pinned, allowlisted token contracts — the same shape as `crates/bsigner/src/x402.rs`, where a destination is pinned together with the seller key that must sign its offers. An unpinned token gets a refusal, not a callback.
5. **Never accept `_from` as authority.** The payer is whoever the receiver's own state says the invoice/authorization belongs to; the callback's `_from` is untrusted input. (DEX223 #11 is the worked example.)
6. **Bind `_data` to the invoice/authorization commitment.** `_data` may carry a reference, never an instruction: compare its hash against a commitment recorded *before* the transfer, the way bsigner gates offers that arrive inside a signed envelope. `delegatecall(_data)` from a receiver is banned outright (DEX223 #8).
7. **Test delegation replacement and revocation without stranding assets.** The key holder can re-delegate to a different designator (or none) at any time, mid-life of any token balance. The gate: balances remain receivable/spendable across a delegation swap, and flows that assumed the old designator's receiver fail loudly, not silently.
8. **Keep it an adapter, never a wallet-core requirement.** The ERC-223 receiver lives in an optional adapter beside the designator — the same fence ops/x402-door draws for 7702 ("no dependency either way") and the estate's adapter doctrine everywhere else. A wallet core that must know ERC-223 to be correct is the wrong shape.

## PLACEMENT, AND WHAT THE NEIGHBORS ALREADY SAY

- **[ops/x402-door/README.md](../../ops/x402-door/README.md)** — the door's charter already holds 7702 as a parallel route: "EIP-7702/LN stay parallel first-line routes (7702-delegated payers compose at the payer side via upstream's ERC-6492 validation — no dependency either way)." That line covers *who may act* (payment authority); it says nothing about *how value arrives* — this dispatch is the receiver-side complement to it. Honest state note: the door is charter-and-tests stage, explicitly "No production deployment. Local/testnet first," and its live-wiring composition is not yet compiled green by its own README's standard.
- **[crates/bsigner/src/x402.rs](../../crates/bsigner/src/x402.rs)** — the pre-signature offer gate: policy in the member's hand (per-signature cap, budget, allowlist with pinned seller keys), offers gateable only inside a signed envelope verified offline against the pinned key. Its shapes map one-to-one onto gate points 4–6: pinning, independent authentication, commitment-before-execution. The receiver gate should read its law, not reinvent it.

## SEPARATION OF CONCERNS (the five questions, kept separate)

| concern | lane | question it answers |
|---|---|---|
| EIP-7702 | delegation | **who may act** for the account |
| ERC-223 | token delivery | **how value arrives** |
| Silent Pay | disclosure | **what is disclosed** about it |
| bMeter | metering | **what was consumed** |
| receipt | settlement | **what settled** |

The 7702/223 collision is what happens when two lanes that never meet — delegation and token delivery — are forced to share one opcode (`EXTCODESIZE`). Keep the lanes separate in code as in law: the receiver gate is token-delivery machinery; it must not grow opinions about delegation beyond detecting the indicator, and the delegation layer must not grow opinions about tokens beyond implementing the receiver profile.

## THE STANDARD GAP (named, not claimed)

**There is no EIP-7702 account receiver profile for ERC-223.** ERC-223 predates account abstraction's EOA-delegation era and assumes a binary contract/EOA world; EIP-7702 turned the boundary continuous. What the ecosystem is missing is a short profile that says: (a) how an ERC-223 token should treat an address carrying the `0xef0100` delegation indicator (its own classification, not "contract by codesize accident"), and (b) the minimal receiver surface a 7702 designator should implement and advertise so delegated accounts are first-class ERC-223 recipients. Until such a profile exists, the interoperable default is the revert — and every wallet UX above it will read that revert as "the token is broken" rather than "the delegation designator lacks a receiver." Naming the gap here is an observation; drafting the profile is future work nobody has claimed.

## NOT CLAIMED / BOUNDARY

- Nothing was run, signed, deployed, or bought. No testnet transfer, no delegation transaction, no ERC-223 transfer was executed — the "test an ERC-223 transfer into a delegated account" gate is specified, not exercised.
- No claim about any DEX223 incident on 2026-02-13 or about any post-mortem: **could not be located; not cited.** The verifiable DEX223 record above stands on its own links and commits.
- MetaMask's delegator is cited at one commit on one date; the repo is live and may gain a receiver after this check. The claim carries its commit hash precisely so it can be re-verified or retired.
- The eight-point gate is a proposal. Zero lines of it exist in the tree. The standard gap is an observation, not a draft and not a commitment that anyone is drafting one.

## SOURCES (first-party, checked 2026-09-26)

- ERC-223 — <https://eips.ethereum.org/EIPS/eip-223> (isContract via extcodesize; tokenReceived required for contracts; revert when unimplemented)
- EIP-7702 — <https://eips.ethereum.org/EIPS/eip-7702> (delegation indicator `0xef0100 || addr`, 23 bytes; EXTCODESIZE semantics)
- MetaMask/delegation-framework — `src/EIP7702/EIP7702DeleGatorCore.sol` @ `1f91637e7f61d03e012b7c9d7fc5ee4dc86ce3f3`; repo code search `tokenReceived` = 0 hits (<https://github.com/MetaMask/delegation-framework>)
- Dex223 bug bounty — <https://github.com/rroland10/dex223-bug-bounty> issues #8, #10, #11, #13
- Dex223 contracts — <https://github.com/EthereumCommonwealth/Dex223-contracts> commits `ea41c72fd6`, `b17fb6629c`; issues #34–#47 (2026-02-17 audit-fix wave)
