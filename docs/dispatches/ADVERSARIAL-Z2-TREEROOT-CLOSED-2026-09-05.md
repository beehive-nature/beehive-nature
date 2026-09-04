# ADVERSARIAL VERDICT — the line-256 class is CLOSED (z2 seat, re-run on the fixed build)

Founder order: rebase wt-z2 onto main tip, rebuild, re-run the 10-leaf
differential on a fresh account, report MATCH or DIVERGE. **Verdict:
MATCH — 10 of 10, every step.**

## The re-run (z2treefix3, fresh account, fresh leaves, fixed build)

Rebased past `40ec6e0` (the fix), rebuilt `note.wasm` from the worktree
(99,577 B; one rebuild-permission trap cleared as root), fresh account
`z2treefix3`, ten NEW random field-element leaves, empty-root calibration
first (contract init root == tree.js `zeros[20]`, byte-equal, direct
extraction — unchanged from the pre-fix run, as expected: the empty root
never touched the buggy branch). Then the differential after every insert:

**idx 0–9: MATCH × 10 — including idx 3 (the first doubly-right path that
exposed the bug) and idx 7 (triply-right). Zero divergence.**

## The fixed line (cited, per order)

`contracts/privacy/note.cpp`, `tree_insert`, **lines 257–263**:

```cpp
} else {
   // going RIGHT: sibling is filled[i] — and filled[i] does NOT
   // change (Tornado's law, found live at insert #4: updating it
   // here poisons the next right-turn with an incomplete subtree —
   // root(4+) silently diverged from the canonical fold while
   // roots 1..3 matched; tree.js was RIGHT all along)
   poseidon2( pc, filled[i], cur, h );
   f256_copy( cur, h );          // ← ONLY cur advances; filled[i] untouched
}
```

The offending `f256_copy( filled[i], h )` is gone; the comment now states
the correct invariant and carries the finding's history inline — exactly
the one-line deletion the founder's `40ec6e0` described. The class (filled[]
on the right branch) is **CLOSED**: same attack, opposite verdict, on the
fixed build.

## The witness-builder question — CONFIRMED from the fixed build

The founder's statement was: z4.1's acceptance runs were all ≤3 leaves and
the fix was checked against canonical tree.js. Confirmed from the tree:

- **m5prep.js:37** — the witness builder calls `tree.js insert` and
  `prove`, i.e. it builds from the CANONICAL fold (tree.js), never from
  the contract's incremental state. Under the pre-fix build this means
  every M5/M6 on-chain payment proof was generated against a canonical
  root while the contract computed a divergent one from insert #4 — the
  two could only have agreed at ≤3 leaves, and the acceptance runs
  (notepay2222, blk 21354 et al.) did exactly that: the receipts show
  single-deposit flows (deposit → setroot → payment), never a fourth
  insert. **The acceptance runs were all ≤3 leaves — CONFIRMED.**
- **SPEC-PRIVACY-1 §m8** receipts the "six-leaf canonical battery 6/6" as
  a standing gate — the fix's own verification against tree.js, now
  independently reproduced by this seat at 10 leaves. **Fix checked
  against canonical tree.js — CONFIRMED.**

One sharpened note for the record: because m5prep builds canonically, the
pre-fix bug's blast radius was exactly as the original finding stated —
proofs FAIL against the on-chain root once ≥4 notes exist (an availability
break, not a forge vector). No evidence of a same-wrongness prover exists
in the tree; the question is closed with the honest answer.

## Tranche 2 continues

Poseidon2 (1248 lines), ceremony provenance (pot12/pot14 chains), and
fresh on-chain forged/replay probes against the fixed build — queued as
ordered. Harness: `zkbench/treediff2.sh` (account `z2treefix3`), ABI note:
deposit now carries the M5 `asset` field (4 args).
