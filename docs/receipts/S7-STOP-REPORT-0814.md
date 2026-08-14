# S-7 STOP-REPORT 0814 — build order halted: spec absent + the 80/20 tripwire fires

**Dispatch:** CCODE — S-7 BUILD UNBLOCKED (chat relay, 2026-08-14): build BNRiV3PermaLock
in bnri-contracts exactly to SPEC-S7-BNRIV3PERMALOCK.md §3 surface + §5 tests T-1..T-6;
AGPL-3.0-only SPDX; 0.8.25/shanghai; stop-and-report on any conflict with §2 constants.
**Seat:** 3 (Claude Code). **Status: STOPPED on two independent grounds. No code written.**

## Ground 1 — the spec is not on this tree after pull

`git fetch origin` executed (local main level with `origin/main` at `cee0f17`).
`docs/specs/SPEC-S7-BNRIV3PERMALOCK.md` does not exist:

- not in the `origin/main` tree (`git ls-tree -r origin/main` — no match for
  `s7|s-7|permalock|bnriv3` outside this seat's own LVERIFY-0813 stop-report);
- not on either side branch (`origin/seat4/c2-combined`, `origin/ci/bump-checkout-v5`
  carry no `docs/specs/` entries at all);
- not untracked in the working tree; `docs/inbox/` does not exist;
- not anywhere on this box by file name (16 roots swept, repos + Documents +
  Downloads + Desktop).

Without §2 there are no constants to check conflicts against; without §3/§5 there is no
surface or test list to build "exactly to." Per the INBOX convention (ruled 2026-08-13,
[[DISPATCH_COWORK_BLICENSE_GAPS_R1]]): source documents land in the tree BEFORE any
dispatch cites them. The build resumes the moment the file exists at the named path —
provided Ground 2 is also cleared.

## Ground 2 — a prior artifact DOES state 80/20 (and a third split besides)

The 2026-08-13 dispatch armed: "Stop-and-report if any prior doc states 80/20."
It fires. **`C:\Users\travi\Downloads\bnri-contracts\`** is a Foundry repo
(git-initialized, **zero commits** — nothing on any record), untouched since
2026-07-29/30, containing among others:

**`src/BNRiV3PermaLock.sol`** (2026-07-29, already compiled once — `out/` artifact
present):

```solidity
/// @dev Fee split: 80% SKAISTS LOVERnment DAO Treasury / 20% founder. No burning.
///      The V3 position NFT is held FOREVER. Per LP_420_YEAR_LOCK + user directive.
...
    uint16 public constant DAO_BPS = 8000;     // 80%
    uint16 public constant FOUNDER_BPS = 2000; // 20%
```

**`src/BNRiProvisionalLock.sol`** (same day) narrates a THIRD split in its header:

```solidity
///      -> escalateToPermaLock -> eternal lock + 80/18/2 fee distribution.
```

So the record now holds three mutually inconsistent routing claims for the same
position's fees:

| Source | Date | Split |
|---|---|---|
| BNRiV3PermaLock.sol (code, hardcoded) | 2026-07-29 | 80% DAO / 20% founder |
| BNRiProvisionalLock.sol (comment) | 2026-07-29 | 80/18/2 |
| Seat-0 confirmation (dispatch 2026-08-13) | 2026-08-13 | 100% ARTIST, both tokens, no burn, collect() permissionless |

The PermaLock comment cites "LP_420_YEAR_LOCK + user directive" — evidence of an earlier
founder directive whose text this seat has not located on this box. Whether the 08-13
confirmation supersedes it (dates say yes; only founder word settles it), and what
happens to the two pre-existing contracts (deleted, archived, or rewritten — they also
carry `// SPDX-License-Identifier: MIT`, `pragma ^0.8.21`, solc pinned 0.8.24 with
`via_ir` and no `evm_version`, all contrary to the current order), is a founder ruling,
not a seat inference.

**Correction to LVERIFY-0813 (false-signal law — corrected, not prettied):** that
receipt's S-7 section stated "no document on this tree states an 80/20 (or any other)
collect() split." That claim was too broad: the sweep behind it did not cover
`Downloads\`. The true statement is that no *governed tree* (beehive-nature,
LOVErnment-DAO, bnri-cosmic, or sibling repos) states a split; the uncommitted
Downloads workspace did, and does.

## To unblock, in order

1. SPEC-S7-BNRIV3PERMALOCK.md lands at `docs/specs/` in beehive-nature (INBOX
   convention) — authored/pushed by the seat that holds it.
2. Founder word on the split conflict: does the 08-13 "100% ARTIST" confirmation
   supersede LP_420_YEAR_LOCK's 80/20, and what is the disposition of the two
   pre-existing lock contracts in `Downloads\bnri-contracts`?
3. Then the build is mechanical: one file, one contract, AGPL-3.0-only, 0.8.25/shanghai,
   §3 surface, T-1..T-6, testnet only, no mainnet key anywhere near this seat.

---

*Seat 3, 2026-08-14. Tree head at write time: `cee0f17` (origin/main, level). The
Downloads workspace was read only — nothing in it was modified, compiled, or committed.*
