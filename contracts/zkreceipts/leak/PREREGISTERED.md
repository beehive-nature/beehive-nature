# LEAK DISTINGUISHER — pre-registered experiment (bTunGsTeN 2 / tungsten-2)

Written BEFORE any proof for this experiment was generated. The
criterion below is fixed at commit time; results land in
`receipt-leak.json` and the dispatch. Any post-hoc family change
invalidates the run and must be re-registered.

## Adversary model and observations

The adversary observes the PUBLIC artifacts of one count-claim
execution only: the proof π (24 wire words: 9 G1 points x‖y, then 6
field scalars — flatten.js order) and the public claim C = (kind,
count). The root M is WITHHELD from the distinguisher: M is a
commitment to the private set and differs between classes BY DESIGN
(with M, separation is trivial and is not a leak of the proof system).
The statement under test is what π ADDS beyond C.

Scoping, stated plainly: this tests the PROOF transcript's leakage
against the pinned families below. It does not test the commitment
(M is public by design), does not test side channels of the prover
process (timing, memory), and is NOT a proof of zero-knowledge — it is
an empirical bound over the pinned distinguisher families, per the
crypto-language law (wording capped at "sound by construction against
the pinned test set").

## Classes

- REAL: the actual ant-reach cohort witness (canonical 40-member set,
  the receipt's own fingerprints and verdicts; claims (0,20) and
  (1,20) as two sub-samples pooled per family).
- SIM: synthetic 40-member witnesses — fresh random 64-bit
  fingerprints, verdict patterns engineered to deadKept=20 /
  liveKept=20 — generated in `leak-gen.mjs` by the same leaf encoding
  as zkrprep (Poseidon(fp, Poseidon(pheno, packed)); same zero pads;
  same full-tree fold).

n = 10 REAL proofs (fixed witness, fresh proving randomness each) and
n = 10 SIM proofs (4 distinct synthetic sets × 2-3 randomness draws).
All proofs use the SAME zkey/vk as the lane's canonical artifacts.

## Pinned distinguisher families

F1 per-word mean: for each of the 24 words (256-bit BE integer), the
   two-sample difference of means (REAL vs SIM), z-scored.
F2 per-word Hamming weight: two-sample t-test on popcount(word).
F3 byte-position chi-square: over word positions 10..15 (the six
   scalars), byte-value distribution chi-square, REAL vs SIM pooled.
F4 low-bits KS: two-sample Kolmogorov–Smirnov on word[15] mod 2^64.
F5 weak learner (pinned): logistic regression on the 192 bytes of
   words 10..15, 10-fold stratified CV, reported accuracy with exact
   binomial 95% CI.

## Pass criterion (fixed)

ALL of:
  (a) every p-value in F1–F4 exceeds 0.001 after Bonferroni
      correction for the number of tests in its family
      (family-wise threshold 0.05 overall);
  (b) F5's 95% CI includes 0.50.

PASS means: to the pinned families, π distinguishes REAL from SIM no
better than chance — reported as exactly that, nothing stronger.
FAIL means: the separating family, the statistic, and the effect size
are reported; no repair follows within this experiment without a new
pre-registration.

## Execution integrity

Generation order: REAL then SIM, both after this file is committed.
Every proof's (class, set-id, randomness-note, public claim) tuple is
recorded in the receipt. snarkjs 0.7.6 wasm prover, zkey =
count.zkey (canonical lane artifact).
