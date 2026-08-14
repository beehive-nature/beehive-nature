# S7-BUILD-0814 — BNRiV3PermaLock built to SPEC-S7 v1.0, T-1..T-6 green

**Order:** "spec landed 39d81a3, fetch and build S-7 as dispatched" (founder, chat,
2026-08-14). **Spec:** `docs/specs/SPEC-S7-BNRIV3PERMALOCK.md` @ `39d81a3` (Seat-1,
landed verbatim, register row A55). **Seat:** 3.
**§2 constants cross-check before any code: NO conflict** — 100% ARTIST FINAL matches
the tithe ruling; no-burn matches BNRi-INV-1; the 80/20 and 80/18/2 histories are
disposed inside the spec itself (§2 row 1); no-generalization matches. No stop-report.

## Deliverable

`bnri-contracts` (local workspace, first commit `d609ef0`):

- **`src/BNRiV3PermaLock.sol`** — one file, one contract, `AGPL-3.0-only` SPDX,
  `pragma solidity 0.8.25`, workspace pinned `solc = "0.8.25"` /
  `evm_version = "shanghai"`. Surface is exactly §3: constructor
  (manager/tokenId/artist, immutable), `onERC721Received` (recorded manager +
  recorded tokenId only, exactly once), permissionless `collect()` with
  `recipient = ARTIST` hardcoded, `amount0Max = amount1Max = type(uint128).max`,
  `Collected(caller, amount0, amount1)` emitted. No owner, no withdraw, no
  decreaseLiquidity, no transfer, no unlock, no migrator, no upgrade hook, no
  receive/fallback — absent, not disabled. All recorded values are `private` so
  T-1 can bound the ABI to §3 exactly (immutables remain verifiable in the deploy
  transaction). Inline minimal reentrancy guard + CEI; no `unchecked{}`; no
  dependency beyond the position-manager interface (declared in-file). 97 lines
  with docs (§6 target ≈60 lines of logic — met on logic lines).
- **`test/BNRiV3PermaLock.t.sol`** — §5 suite, self-contained mocks:
  - T-1: artifact-ABI enumeration via cheatcodes (exactly 2 external functions,
    non-payable everything, no receive/fallback) + runtime-bytecode opcode walk
    asserting no DELEGATECALL/CALLCODE/SELFDESTRUCT — CBOR metadata stripped and
    PUSH immediates skipped so data bytes cannot false-positive.
  - T-2: two fuzz proofs × 256 runs — raw adversarial calldata against the whole
    surface, and adversarial `onERC721Received` args; NFT custody and liquidity
    invariant throughout.
  - T-3: three unrelated callers collect after accrual; 100% of BOTH tokens land
    at ARTIST every time; callers and lock end at zero balance.
  - T-4: wrong-sender / wrong-tokenId / second-receipt all revert by named error.
  - T-5: malicious manager re-entering `collect()` mid-collect reverts
    (`Reentered`), custody unchanged.
  - T-6: source scan — no `extcodesize`, no `code.length` EOA guards.

## Receipt (verbatim forge output)

```
$ forge test --match-contract BNRiV3PermaLockTest -vv
Ran 9 tests for test/BNRiV3PermaLock.t.sol:BNRiV3PermaLockTest
[PASS] testFuzz_T2_NoExitAdversarialReceive(address,address,uint256,bytes) (runs: 256, μ: 20321, ~: 20318)
[PASS] testFuzz_T2_NoExitRawCalls(bytes4,bytes) (runs: 256, μ: 16852, ~: 16850)
[PASS] test_T1_AbiSurfaceExactlySpec3() (gas: 1070957)
[PASS] test_T3_ThreeCallersAllFeesToArtist() (gas: 317622)
[PASS] test_T4_SecondReceiptReverts() (gas: 13803)
[PASS] test_T4_WrongSenderReverts() (gas: 10942)
[PASS] test_T4_WrongTokenReverts() (gas: 11289)
[PASS] test_T5_ReentrantCollectReverts() (gas: 687731)
[PASS] test_T6_NoEoaCodeGuards() (gas: 3527859)
Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 24.77ms (78.28ms CPU time)
```

Toolchain: forge 1.6.0-nightly (Windows binary, runs under the current partial thaw),
solc 0.8.25 via svm, shanghai target, optimizer 200 + via_ir (workspace profile).

## Posture and open ends

- **No deploy.** Testnet-only posture held; no key material touched, no RPC signed
  against. The spec's chain-id verification law (§0 header: verify `eth_chainId`
  against the RPC, never trust a URL) binds the future deploy lap, founder present.
- The commit is scoped to the S-7 deliverable + the atticked pre-ruling drafts
  (per the 2026-08-14 disposition). The workspace's other drafts (Bnri.sol,
  BnriArt.sol, script/, lib/ vendoring) remain untracked — repo shape and any
  remote are founder calls.
- Tests run against local mocks. A fork test against the real V3 fork's
  NonfungiblePositionManager belongs to the deploy lap (§7 keeps the fork
  deployment itself out of this scope).

*Seat 3, 2026-08-14.*
