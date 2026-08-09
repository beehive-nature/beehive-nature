# SPEC — LEADER-ROTATION + WITHHOLDING-RECOVERY TEST VECTORS (2026-08-08)
**From:** goose (instrument-reading) · **To:** Code
**Authority:** Seat 0 global-tree ruling + two binding fences (2026-08-08)
**Law:** crate+ref (8a), provenance (8c), both-sides boundary, post-op register

## DESIGN CONTEXT
The anchor contract stores epoch Merkle roots in a 144-row ring (single global tree per :137). Each root carries prev_root (chain-linked). A per-epoch leader submits the root. prev_root prevents forgery, reordering, skipping, and forking — a captured leader can only WITHHOLD. Two binding fences close the remainder:

1. Leader selection is ROTATING or PERMISSIONLESS. Never a fixed party.
2. Withholding must be RECOVERABLE BY THE NEXT LEADER, and that recovery path is TESTED.

The contract is permissionless at the chain level (anyone can call commit()). Rotation is DAO governance, not a contract check. The contract enforces: forward-only derived slot, prev_root chain-linking, write-once per slot.

## CONTRACT INVARIANTS (what the contract enforces)
- **I1:** Forward-only derived slot — no overwrite, no backfill.
- **I2:** prev_root must equal the root in the immediately preceding written slot.
- **I3:** Each slot written once — double-submit rejected.

These mean a captured leader cannot forge (I2), reorder (I1+I2), skip within the chain (I2), or fork (I1+I2). They can only withhold.

## TEST VECTORS

Legend: `root_N` = Merkle root for epoch N. `prev` = prev_root field. `genesis` = zero hash.

### Normal operation + leader rotation

| # | Scenario | Sequence | Expected |
|---|---|---|---|
| TV-L1 | Normal same-leader | genesis -> {ep0, root_0, prev=genesis} -> {ep1, root_1, prev=root_0} | **ACCEPT** both; chain: genesis -> root_0 -> root_1 |
| TV-L2 | Leader rotation | {ep0, root_0, leader A} -> {ep1, root_1, leader B, prev=root_0} | **ACCEPT** both; rotation transparent to chain |
| TV-L11 | Permissionless (3 leaders) | {ep0, A} -> {ep1, B} -> {ep2, C} | **ACCEPT** all; any leader may submit |

### Withholding + recovery (both sides)

| # | Scenario | Sequence | Expected |
|---|---|---|---|
| TV-L3 | Single withholding | {ep0, root_0} -> [ep1 WITHHELD] | chain STALLS at root_0; no root for ep1 |
| TV-L4 | Recovery (positive side) | {ep0, root_0} -> [ep1 withheld] -> {ep2, root_2, prev=root_0} | **ACCEPT** root_2; ep1 gap visible; chain continues |
| TV-L5 | No recovery (negative side) | {ep0, root_0} -> [ep1 withheld] -> [ep2 withheld] | chain STALLS at root_0; two gaps |
| TV-L9 | Long-gap recovery | {ep0, root_0} -> [1,2,3 withheld] -> {ep4, root_4, prev=root_0} | **ACCEPT** root_4; multi-epoch gap recoverable |
| TV-L12 | Late backfill after recovery | {ep0} -> [ep1 withheld] -> {ep2, root_2, prev=root_0} -> {ep1, root_1, prev=root_0} (late) | **REJECT** (forward-only; gap permanent once chain advances) |

### prev_root verification (both sides)

| # | Scenario | Sequence | Expected |
|---|---|---|---|
| TV-L6 | Forgery (wrong prev) | {ep0, root_0} -> {ep1, root_1, prev=WRONG_HASH} | **REJECT** (I2: prev mismatch) |
| TV-L8 | Forking (branch from non-latest) | {ep0, root_0} -> {ep1, root_1} -> {ep2, root_2', prev=root_0} | **REJECT** (I2: prev != latest committed) |

### Slot invariants (both sides)

| # | Scenario | Sequence | Expected |
|---|---|---|---|
| TV-L7 | Double submission (same slot) | {ep0, root_0} -> {ep0, root_0', prev=genesis} | **REJECT** (I3: slot already written) |
| TV-L10 | Genesis (first root) | {ep0, root_0, prev=genesis} | **ACCEPT** (first entry) |

### Both-sides boundary summary

| Boundary | Positive (passes) | Negative (fails/stalls) |
|---|---|---|
| Withholding recovery | TV-L4 (1-gap: ACCEPT), TV-L9 (3-gap: ACCEPT) | TV-L5 (no recovery: stall), TV-L12 (backfill: REJECT) |
| prev_root correctness | TV-L1 (correct: ACCEPT) | TV-L6 (forgery: REJECT), TV-L8 (fork: REJECT) |
| Slot write-once | TV-L1 (fresh: ACCEPT), TV-L10 (genesis: ACCEPT) | TV-L7 (occupied: REJECT) |
| Leader identity | TV-L2 (rotation: ACCEPT), TV-L11 (3 leaders: ACCEPT) | (no negative — contract is permissionless) |

## NOTES FOR CODE

- **The sequencer MUST SERIALIZE anchors** — wait for inclusion before pushing next. Pushing faster than block production breaks the link check even when every payload is correct. (Cowork's E5 race.) Build the wait into the sequencer; do not leave it to the caller.
- **The contract must accept non-consecutive epoch numbers** to enable withholding recovery. If consecutive epochs were required, recovery would be impossible — violating fence 2. The epoch-number gap (e.g., ep0 -> ep2, skipping ep1) is the proof that withholding happened and was recovered.
- **TV-L12 is the forward-only proof:** once the chain advances past a withheld epoch, the gap is permanent. A late submission by the withholding leader (or anyone) cannot backfill — the derived slot has moved forward.
- **The contract does NOT enforce who the leader is.** Permissionless. Rotation is DAO governance.
- **is_canonical (Antelope ECDSA):** checks BOTH leading bytes of r and s. The earlier updateauth passed on luck. Any seat signing needs the strict check. (Technical record for all seats.)

## SCOPE FENCE
Leader-rotation + withholding-recovery test vectors for the anchor contract ONLY. Resolver validity rules (TV1-TV15), signing pipeline, and DAO governance are separate. File under kernel docs. **Anything beyond is out of scope. Execute the prompt as written.**
