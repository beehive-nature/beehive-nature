# bDroP 0001 — RB benchmark evidence attached, commit-pinned

**Date:** 2026-10-09 · **Seat:** zCode (GLM), the bDroP lane
**Order:** founder relay of the RB-milestone review — "Attach the accepted,
commit-pinned benchmark evidence to bDroP 0001 without silently replacing
the earlier findings record."

## What is attached, every piece pinned to its commit

- **The RB report** `docs/receipts/btungsten-rb/REPORT.md`, reconciled to
  the review at `4a257bdef` and carried into main by the PR #372 merge
  (merge SHA below). Where a receipt row and the report disagree, the row
  wins.
- **The committed receipts**: full-plan run `37923430005`
  (`workflow_dispatch`, `plan=full`) at BNR `073697abb`, all three lanes
  PASS — RB01 (PSI benchmark), RB02 (AES-256 software-backend equivalence),
  RB03 (ten gas-budget properties, cvc5 int-blast; bitwuzla cross-check
  6 proved / 4 INCONCLUSIVE / 3 TEETH convicted).
- **The original full-plan execution**: run `37906620036` at BNR
  `f43ffdcd3f756b983289a692fdf1576240510d78`, all three lanes PASS,
  receipts not committed — preserved as lineage, not cited as evidence.
- **The later Swanky re-check**: `docs/upstream/2026-10-09-swanky-popsicle-rb01/`
  at main `0d88ec248`, dispatch `docs/dispatches/2026-10-09-rb01-swanky-evidence.md`,
  executed by Seat 3 (the RB01 reporting lane) — separate history, separate
  sample counts, reported side by side with the benchmark runs, never
  merged into them.

## Boundaries this attachment does not cross

- A green PR or post-merge badge is the **fast plan only** (`changes` +
  `fast` jobs); the three lanes execute only on `workflow_dispatch` with
  `plan=full`. No fast-plan green is cited as a lane execution.
- The RB01 disclaimer and the RNG two-statements rule stay verbatim
  wherever the adapter or the finding appears; item 6's security
  consequences remain **UNVERIFIED**.
- The genesis packet (9,735-byte post + zip, reported SHA-256
  `9fa6998d548e8f4afd0a7e17fa2a11ea50a0db18b1808d74f985931ff6d825e9` PUBLIC-CONSTANT)
  is still REPORTED-not-received: the preparing session's sandbox was never
  delivered to `wt-zcode-bdrop\inbox\`. This attachment ADDS the
  commit-pinned benchmark record; it does not replace or rewrite the
  earlier findings record, and the bDroP 0001 genesis dispatch
  (`docs/dispatches/2026-10-09-bdrop.md`) stands as written.
- Nothing here is a promise of production safety. The publication, when it
  happens, records what was observed and authorized.

## Merge receipt

- PR #372 ("btungsten RB: measured Rust execution and assurance with pinned
  Galois tools") merged at `16f44fb8fc32b6e06140878a501592408ad3ee2d` after
  39 checks pass / 3 skipping — the three skipping jobs are the RB lanes on
  the PR's fast plan, skipped by design and cited as no execution.
- Post-merge runs on main at that SHA, named at rider-commit time (states
  as then observed, not claimed as final): secret-scan `37933931284`
  success; tests `37933931375`, WB001 SAW `37933931366`, WB002 SAW
  `37933931322`, WB002 WASM corpus `37933931380`, bTunGsTeN PQ `37933931357`,
  bTunGsTeN PQ SAW `37933931617`, bTunGsTeN RB `37933931314` in flight —
  the RB run is the push-triggered fast plan (lane jobs skip); the lane
  evidence remains the full-plan dispatch runs pinned above.
