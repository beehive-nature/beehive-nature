# LEAK DISTINGUISHER, STARK, v2 — pre-registered experiment (tungsten-2, SPEC-BTUNGSTEN-PQ-1 §PQ10)

Written and committed BEFORE any proof for this experiment was generated.
v1 (PREREGISTERED-STARK.md) ran once on 2026-10-08 and its result stands as
recorded: hiding config FAIL (F2 smallest p 1.228e-5 against a Bonferroni
threshold of 1.677e-5; F3b p 0.0002; F4 4 of 20 correct, interval
[0.057, 0.437]); F0 passed (0 shared commitments or opened values); the
non-hiding control failed every family, as its teeth require. v2 is a new
experiment on new proofs. It does not re-analyse v1's data.

## Why a v2

v1's families F1 to F4 treated quantities as independent that are not:

- F3 pooled every number of ten proofs per class into one chi-square, so its
  sample size was millions of numbers, while the independent unit is the
  proof (twenty of them). Numbers inside one proof are correlated (shared
  authentication paths, repeated structure), which a chi-square cannot see.
- F4's leave-one-out nearest centroid is biased below chance on
  exchangeable data: leaving a proof out pulls its own class's centroid
  away from it. v1 scored 4 of 20, which that bias, not a leak, explains.
- F1 and F2 compared each position against a parametric t distribution with
  ten proofs per class.

v2 judges every family by permutation over the proof labels: the statistic
is recomputed under random reassignments of the twenty proofs into two
classes of ten, and the p-value is the share of reassignments at least as
extreme. That is valid whatever the dependence inside a proof.

## Adversary model, observations, classes

Unchanged from v1 (PREREGISTERED-STARK.md): the proof and the claim, root
withheld; 10 REAL proofs of docs/receipts/ant-reach-cohort-2026-10-06.json
(claims alternating (0, 20), (1, 20)), 10 SIM 20/20 cohorts, one proof each;
a fresh hiding config (fresh OS randomness) per proof; PARAMS log_blowup 3,
104 queries, 16 query-PoW bits; n = 64, 40 members. The fixed-shape part and
the multi-opening proofs are as v1 defines them.

## Families

G0 linkability: v1's F0, unchanged: shared main-trace commitments, shared
   quotient commitments, shared opened trace values, over all pairs.
G1 positional values: the smallest Welch-t p-value over the fixed-shape
   positions (value mod 2^31), as a STATISTIC, then permuted.
G2 positional popcounts: the same on popcounts of the low 32 bits.
G3 low bytes: the sum of the two v1 chi-square statistics (opened trace
   values; multi-opening proofs), as a statistic, then permuted.
G4 nearest centroid: the leave-one-out accuracy as a statistic; its
   distance from 0.5, then permuted (two-sided).

Permutations: 2,000 random reassignments, drawn from OS entropy, the
observed labelling counted among them. p = (1 + number at least as extreme)
/ (1 + 2,000).

## Pass criterion (fixed)

ALL of:
  (a) G0 counts zero;
  (b) each of the permutation p-values of G1, G2, G3 and G4 exceeds
      0.0125 (0.05 across four families, Bonferroni).

## Teeth (fixed)

The same twenty witnesses proved with the non-hiding control config must
fail (a). If they pass, the harness is broken and the hiding result is
void.

## Execution integrity

The registration is committed, then the proofs are generated: REAL, SIM,
then the non-hiding control. The harness prints every proof's class, set
and claim and every family's statistic and permutation p. One run. PASS
means: to these families, the proofs separated REAL from SIM no better than
chance, and nothing stronger.
