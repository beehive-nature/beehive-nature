# SPEC-S7 — BNRiV3PermaLock

**Status:** DRAFT v1.0 — authored fresh by Seat-1 (Fable) 2026-08-14 on founder order ("both — draft fresh"), from the contract-lane ledger. Supersedes the one-paragraph relay ccode correctly refused to execute.
**Repo:** `beehive-nature/bnri-contracts` · **License:** AGPL-3.0-only, SPDX header required · **Solidity:** 0.8.25, `evm_version = "shanghai"` · **Chain:** exSat EVM mainnet 7200 (testnet 839999/840000 — verify before signing; verify `eth_chainId` against the RPC, never trust a URL).

## 1. Purpose (one sentence)
Hold the BNRi/XBTC Uniswap-V3 position NFT forever and expose exactly one capability — permissionless fee collection routed 100% to the artist — with every liquidity-moving path **absent, not disabled**.

## 2. Ruled constants (immutable at deploy; STOP-AND-REPORT if any doc disagrees)
| Constant | Value | Ruling source |
|---|---|---|
| `ARTIST` | artist address, `immutable`, set in constructor | Tithe ruling 2026-08-13: **100% ARTIST — FINAL** (supersedes the earlier 80/20 line in the lane dispatch; the 80/18/2 router applies to PROTOCOL fees only (S-8), never to this contract) |
| Fee routing | `collect()` sends **100% of both tokens** to `ARTIST` | Same ruling |
| Burn | **NONE** — no burn path of any kind | Standing BNRi-INV-1 fence |
| Pair / fee tier | BNRi/XBTC, 1% (fee = 10000) | S-8 LP composition + the founder's "1% tithe" ruling; corroborated by the PEPI precedent position (fee=10000) |
| Generalization | **NONE.** BNRi hardcodes. The launchpad's per-artist selectable split is a SEPARATE future contract — do not parameterize S-7 | Founder ruling 2026-08-13 ("do NOT generalize inside S-7") |

## 3. Complete external surface (exhaustive — anything more is a spec violation)
1. `constructor(address positionManager, uint256 tokenId, address artist)` — records the V3 NonfungiblePositionManager, the position tokenId, and `ARTIST`; all three `immutable`/write-once.
2. `onERC721Received(...) returns (bytes4)` — accepts the position NFT **once** (only from the recorded manager, only the recorded tokenId; anything else reverts). After receipt, the contract can never transfer it: no transfer call exists in this codebase.
3. `collect()` — **permissionless** (any caller, no argument-supplied recipient). Calls `positionManager.collect` with `recipient = ARTIST`, `amount0Max = amount1Max = type(uint128).max`. Emits `Collected(caller, amount0, amount1)`.

That is the whole ABI. **There is no owner. No `withdraw`. No `decreaseLiquidity`. No `transferPosition`. No `unlock`. No migrator. No upgrade hook. No `receive`/`fallback` payable surface. No admin of any kind.** Absent — not disabled, not timelocked, not access-controlled. (Contrast, of record: PEPI's UNCX lock is a finite timer to 2269 with a dormant two-party `migrate` escape — trust *moved*. S-7 is trust *removed*: "the trustless hardening of a trust-based precedent," per the closed S-0 finding.)

## 4. Invariants
- **INV-S7-1:** No reachable call path, direct or nested, moves liquidity or custody of the position NFT out of this contract. Ever.
- **INV-S7-2:** Every token unit leaving this contract exits via `positionManager.collect` to `ARTIST` — no other outbound transfer exists.
- **INV-S7-3:** The contract holds no mutable storage after NFT receipt (state machine: `EMPTY → LOCKED`, one-way, one transition).
- **INV-S7-4:** `collect()` succeeds for any caller and never varies behavior by caller.

## 5. Acceptance tests (the auditor reads this file first — it guards value forever)
- **T-1 ABI ENUMERATION (the ruled test):** programmatically enumerate the compiled ABI; assert the external/public surface equals exactly §3's three entries; assert no `payable` functions; assert bytecode contains no `DELEGATECALL`/`SELFDESTRUCT`/`CALLCODE` opcodes.
- **T-2 NO-EXIT PROOF:** fuzz every external entry with adversarial calldata; assert position NFT `ownerOf` never changes and `positions(tokenId).liquidity` never decreases.
- **T-3 PERMISSIONLESS COLLECT:** three unrelated callers each trigger `collect()` after fee accrual; 100% of both tokens land at `ARTIST`; caller balances unchanged (minus gas).
- **T-4 WRONG-NFT REJECTION:** any tokenId ≠ the recorded one, or any sender ≠ the recorded manager, reverts on `onERC721Received`.
- **T-5 REENTRANCY:** malicious token/manager callback during `collect()` cannot re-enter into any state change (CEI ordering; there is no state to corrupt post-lock — prove it anyway).
- **T-6 EIP-7702 POSTURE:** no `extcodesize`/`code.length == 0` EOA guards anywhere (unsound post-Pectra, per the standing S-0 ruling).

## 6. Size & posture
Target ≈60 lines of Solidity. `ReentrancyGuard` + CEI. **No `unchecked{}` anywhere** (PEPI v1's death class). No oracle, no price logic, no external dependency beyond the position manager interface.

## 7. Out of scope (stop-and-report on drift)
The V3 fork deployment itself (unmodified Uniswap bytecode, deterministic deploy), S-8 presale mechanics, the protocol-fee router, the launchpad template, any change to §2 constants. Silent drift in an immutable contract is the failure mode this project fears most.
