# LEAK DISTINGUISHER, STARK — pre-registered experiment (tungsten-2 for SPEC-BTUNGSTEN-PQ-1 §PQ10)

Written and committed BEFORE any proof for this experiment was generated.
The criterion below is fixed at commit time. Results land in the PQ10
receipts (scripts/btungsten/README.md) and CI's own run. Any post-hoc change
to a family, a threshold or the classes invalidates the run and needs a new
registration. The PLONK registration (PREREGISTERED.md, same directory) is
the model; what differs is stated where it differs.

## Adversary model and observations

The adversary sees the PUBLIC artifacts of count-claim executions: each
proof π (Plonky3 uni-stark at eab7f0e, the hiding config of
crates/btungsten-p3count, PARAMS log_blowup 3, 104 queries, 16 query-PoW
bits) and its public claim C = (kind, count). The root M is WITHHELD, as in
the PLONK registration: M commits to the private set and differs between
classes by design. The question is what π adds beyond C.

π is read as the numbers in its JSON serialization (serde_json of
`p3_uni_stark::Proof`): field elements, Merkle digest words, proof-of-work
witnesses and lengths. Its FIXED-SHAPE part is everything except the FRI
multi-opening proofs: the commitments, the opened values, degree_bits, the
out-of-domain PoW witness, and inside the FRI proof the commit-phase
commitments, the final polynomial and the PoW witnesses. Two proofs of one
AIR and one parameter set give that part the same shape, so its positions
align. The multi-opening proofs (`input_openings`, `commit_phase_openings`)
share authentication paths between queries, so their length varies with
query overlap and their positions do not align; they are covered by F0
(equality) and F3b (distribution).

(Amended 2026-10-08 before any proof for this experiment was generated: the
first version said every position aligns, which the multi-opening layout
contradicts. No data existed when this was corrected.)

Scope, plainly: this tests the proof transcript against the pinned families
below. It does not test the commitment (M is public by design), the
prover's timing or memory, or anything about zero knowledge in general.
Upstream's own word for the construction is "only statistically zk"
(uni-stark/src/prover.rs:351); the result is capped at "no pinned family
separated the classes".

## Classes (n = 64 leaves, 40 members)

- REAL: the canonical ant-reach cohort, docs/receipts/ant-reach-cohort-2026-10-06.json
  (40 members, 20 dead-kept, 20 live-kept). 10 proofs, claims (0, 20) and
  (1, 20) alternating, fresh OS randomness for each proof.
- SIM: 10 synthetic 40-member cohorts, each with random 64-bit fingerprints
  and verdict patterns engineered to 20 dead-kept and 20 live-kept, one
  proof each, claims alternating the same way, fresh OS randomness.

## Pinned families

F0 linkability (the decisive family): over all 20 proofs, the number of
   proof PAIRS that share an identical main-trace commitment, an identical
   quotient commitment, or an identical vector of opened trace values.
F1 per-position mean: for every position of the fixed-shape part, Welch's two-sample t
   statistic (REAL vs SIM) of the number's value modulo 2^31, its p-value
   from the t distribution with Welch-Satterthwaite degrees of freedom. A
   position constant within both classes is excluded when the two constants
   agree and counts as a separation (p = 0) when they differ.
F2 per-position Hamming weight: the same, on the popcount of the number's
   low 32 bits.
F3 low-byte chi-square, two tests: (a) the low byte of every opened trace
   value (trace_local), (b) the low byte of every number in the
   multi-opening proofs; each REAL pooled vs SIM pooled, 256 bins.
F4 nearest centroid: leave-one-out nearest-centroid classification of the
   20 proofs on their opened trace values (trace_local, value mod 2^31),
   reported as accuracy with its exact binomial 95% interval.

## Pass criterion (fixed)

ALL of:
  (a) F0 counts zero shared commitments and zero shared opened-value
      vectors across the 20 proofs;
  (b) every F1 and F2 p-value exceeds 0.05 / (number of positions) (Bonferroni,
      family-wise 0.05), and each of F3's two p-values exceeds 0.025;
  (c) F4's 95% interval includes 0.50.

## Teeth (fixed with the criterion)

The same 20 witnesses, proved with the NON-hiding control config
(config::plain: TwoAdicFriPcs, plain Merkle), must FAIL criterion (a): ten
proofs of one witness without blinding commit to the same trace. If the
harness passes the non-hiding control, the harness is broken and the
hiding result is void.

## Execution integrity

Generation order: the registration is committed, then REAL, then SIM, then
the non-hiding control. The harness prints every proof's (class, set id,
claim) and every family's statistic. PASS means: to the pinned families, π
separated REAL from SIM no better than chance. FAIL means the separating
family, its statistic and its effect size are reported, and no repair
follows inside this experiment without a new registration.
