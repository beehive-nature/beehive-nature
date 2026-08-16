# RECEIPT — PEPi seed units + art-change gate (goose, 2026-08-15 18:45)
**Purpose:** closes Seat 3's flagged-unconfirmed item ("whether seed is the raw balance or
balance / 10^9 — worth reading out of Pepi.sol rather than assuming") ahead of the founder's
BNRi patterning work, plus one Trezor-side gate detail for the bSAFE heART WALLet UX split.

## 1) PEPi seed = WHOLE TOKENS — confirmed at source, not assumed

Source artifact: full `Pepi.sol` (founder-owned, MIT) recovered from the probe session's
scratchpad (`contracts/token/Pepi.sol`, 165,958-byte JSON at
`%TEMP%/claude/C--Users-travi/c12f969c.../scratchpad/pepi.json`).

- **L75:** `uint seed = amount / (10 ** decimals());` — the seed is the decimal-normalized
  (whole-token) amount. L100-102 apply the same normalization to balances for spore
  accounting. **The founder's tier reading (">56 PEPi = level 6") is correct** against the
  Generator thresholds 11/22/33/44/56 (Seat 3's read).
- Bytecode caveat worth recording: grepping the runtime bytecode for the literal
  `3b9aca00` (10^9) finds **zero** hits — the division uses dynamic `decimals()`, so
  bytecode-pattern checks would have missed this. Source was necessary.
- **Three determinism classes, all already in the contract** (for BNRi art design):
  - `seed` — balance-keyed: whole-token snapshot carried by the spore; zero when the
    balance drops below 1 whole token (L142-170 region: `if (seed == 0) return;` /
    `_spores[account].seed = 0;`), restored when it rises again.
  - `seed2` — random roll: `RandLib.random_value(++_random_nonce)` (L146-147) —
    independent nonce stream, changes per inscription event, not per balance.
  - `extra` — address-keyed: `keccak256(abi.encodePacked(account, extraSeed))` with the
    shared nonce counter (L149, L162, L171, L182).
- Transfer semantics (L77-96): a "growing mushroom" moves only when
  `_spores[from].seed == seed` (transfer amount in whole tokens equals the held spore's
  seed) and the recipient doesn't own that seed; "collected mushrooms" move via ownership
  enumeration (L88-96). Spore counts reconcile via whole-token balance deltas (L100-104).
- Minor note, UNVERIFIED origin: `_startTotalSupply = 13370 * (10 ** _decimals)` (L273)
  vs the 13,377 observed on-chain — 7 whole tokens exist beyond the start mint (L279).

**BNRi implication:** tiers get set against WHOLE tokens (post-division), exactly as the
founder's level table assumed; and the art has three separable input streams to pattern
with — balance, event-randomness, and address identity.

## 2) Trezor homescreen change gate (bSAFE heART WALLet UX split)

- Routing: `fw:core/src/apps/workflow_handlers.py` L47-48 routes ApplySettings to
  `apps.management.apply_settings` with no gate at routing level.
- Handler `fw:core/src/apps/management/apply_settings.py`: homescreen path validates
  format + size (`check_homescreen_format`, `HOMESCREEN_MAXSIZE`), then requires the
  on-device `confirm_homescreen` approval (L98-101). No `unlocked` reference in the handler — the visible gate is the on-device confirm only; whether a PIN-locked device accepts ApplySettings is UNVERIFIED from the handler alone (the wire/session layer may enforce it).
- Contrast (already receipted, `76a2f95`): AuthenticateDevice needs bootloader-locked +
  one Allow press, no PIN. So "prove who you are" and "change your art" sit at different
  trust levels — keep them separate in the ceremony UX.

## Device lane
Safe 7 absent all session (0 `VID_1209` at every check 16:0x-18:45) —
`thp_pair_receipt.py` remains staged for the plug-in moment.
