# ADVERSARIAL FINDING — multi-leaf root divergence (z2 seat, the founder-ordered attack)

**SEVERITY: HIGH (correctness/soundness-of-state). First divergence at index 3
— the first doubly-right insert path. Every root from leaf 4 onward is wrong
on-chain.** Evidence below is reproducible with `zkbench/treediff2.sh` (fresh
account, calibrated extraction, decimal-vs-decimal).

## The attack (per the founder's addendum)

Fresh account `z2treeacct3` on the rehearsal chain, 10 deposits of random
field-element leaves; after EVERY insert the contract's `law.root` compared
against tree.js's canonical fold (`rootOf`: 20 folds, odd tails padded with
`zeros[level]`). Empty-root calibration first: **contract init root ==
tree.js zeros[20]** (decimal value in the run log; both sides byte-equal)
(direct extraction; the t256 store transform and table readback compose to
identity — the earlier "0 match" run was this seat's own harness comparing
hex to decimal, fixed before any verdict).

## The result

| idx | binary | path at L0/L1/L2 | verdict |
|---|---|---|---|
| 0 | 0 | L | MATCH |
| 1 | 1 | R | MATCH |
| 2 | 10 | L then R | MATCH |
| **3** | **11** | **R then R — first doubly-right** | **DIVERGE** |
| 4–9 | — | (state corrupted onward) | DIVERGE ×6 |

One-right and left-then-right are correct; the moment an insert takes TWO
right branches, the root departs from the canonical fold and never returns.

## The line (cited, per order)

`contracts/privacy/note.cpp`, `tree_insert`, **lines 253-257**:

```cpp
} else {
   // going RIGHT: sibling is filled[i]; the parent becomes the new filled[i]
   poseidon2( pc, filled[i], cur, h );
   f256_copy( filled[i], h );   // ← line 256: THE BUG
   f256_copy( cur, h );
}
```

**Line 256** overwrites `filled[i]` with the MERGED parent `h` (a
level-(i+1)-sized value) on a right pass. The invariant `filled[i]` must
carry is "the last COMPLETE level-i subtree" — which on a right merge is
UNCHANGED (the classic Tornado algorithm's right branch only advances
`cur`). The overwrite destroys the level-i subtree a LATER right-branch
insert will need: at idx 3, level 1 goes right and consumes `filled[1]`,
which idx 2's level-1 right pass already poisoned with its merged parent.
The comment on line 254 states the wrong invariant outright ("the parent
becomes the new filled[i]") — the error is documented as if it were the
design.

**Fix (one line): delete line 256.** `cur` alone must advance. This is the
exact class z4.1's re-measure named — the evidence here confirms it bites
at the first doubly-right path, not just in theory.

## Blast-radius honesty

- The wrong root is the contract's OWN tree constant — the ZK soundness
  (root ↔ membership binding) is untouched; this is a state-correctness
  bug, not a forging vector. BUT: any prover building witnesses from the
  canonical tree (tree.js — which the repo ships as the prover side) will
  produce proofs that FAIL against the on-chain root once ≥4 notes exist.
  Conversely the deployed rehearsal accounts' roots are all non-canonical.
- The M6 receipt's "contract-computed root" acceptance passes must have
  used ≤3-leaf trees or both sides running this same algorithm — the
  68/68 vector gate and the on-chain proofs did not exercise a fourth
  insert. (Cross-check of M6's receipt tree depth: pending tranche 2.)
- Note: z2treeacct1 carries 20 poisoned-leaf inserts from the harness's
  first (mis-compared) run — kept on-chain as evidence; the roots it
  produced are non-canonical from leaf 3 onward.
