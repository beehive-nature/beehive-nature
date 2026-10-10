# 2026-10-10 — zCode: PQ batch review closed clean; PQ10 Plonky3 receipt-count statement reviewed clean; CI finals recorded

zCode seat, fourth assignment (founder order 2026-10-10: verify both CI
finals, close the batch review, continue PQ10 in-session; hkdf32 only when
an independently scoped candidate exists). Read-only in
`../wt-zcode-pq-review`; no author tree touched; no duplicate agent; no
approval gate.

## 1 · CI finals, exact SHAs, and what each red is

**`3aef3820a`** (= `3aef3820ad8395969001de1c39372799aed3b98f`, my batch
review dispatch): 8 workflows `success` — bTunGsTeN PQ, bTunGsTeN PQ SAW,
bTunGsTeN RB, WB001 SAW proofs, WB002 WASM corpus, WB002 SAW equivalence,
secret-scan, and `tests`… no: `tests` FAILED (run 37999841248, job
`eternal` 114054959379), and `pages-build-deployment` = `cancelled`.
- The pages cancellation is supersession, not failure: main moved to
  `d46a26c21` mid-run and the replacement pages build on that commit
  completed `success`.
- The `tests` failure is inherited, not mine and not new: the failing job
  prints `WORSE bdrop.html [cypherpunk] SMALL 0 → 2 / ratchet: 1 worse · 0
  better than footer-audit.baseline.json`, exit 1. The same signature is on
  `e5a2cd767` (the bDroP lane's "CI red healed" commit) and on `759390609`,
  both ancestors of mine; `e2e/footer-audit.baseline.json` has no `bdrop`
  key at all, i.e. the surface landed on main without its baseline row.
  Owner: the bDroP seat. The fs seat's dispatch `3a008248e` already carries
  this red by name. Nothing in the failing path touches any file any
  zCode dispatch ever changed (my commits add one markdown file each); the
  classification here is by log evidence, not by that observation.

**`d46a26c21`** (= `d46a26c215a583e26f0f3bdf7631faeebc3d695a`, the
PQ-migration merge that superseded mine): 8 `success` including
pages-build-deployment; `tests` FAILED with the same inherited
bdrop-ratchet signature. Successor main (`a28eb56d5`, PR #385) was still
running its battery at review time; the fs dispatch's receipts and the
unchanged baseline indicate the same inherited red.

## 2 · PQ batch review — CLOSED

Finding of record: **zero reproducible defects** (dispatch
`2026-10-09-zcode-pq-proof-batch-review.md`, main `3aef3820a`). ZB-1 (the
debug-build Barrett overflow assertion) remains OPEN exactly as disclosed —
my hand re-derivation of the no-wrap arithmetic confirmed the argued step's
magnitudes but is arithmetic reasoning, not a proof, and is recorded as
such; no ASSUMED result and no argued step is promoted to a machine proof
by anything this seat has written. ZB-2 resolved by the integration
landing (`b4da4cd9d`'s corrected comments reached main through the
successor merges). ZB-3 and ZB-4 stand as recorded wording notes.

## 3 · PQ10 — one hiding Plonky3 proof of the receipt count statement

Reviewed at the landing `11d25f4bd`
(`11d25f4bd164ef53610dfb5f9f6cd12b3e23c370`, unchanged in
`crates/btungsten-p3count` and the leak registrations at current main —
the only workflow delta since is another seat's PQ11 lane). Scope: the
statement, the AIR, the hiding config, the forgery battery, the leak
preregistrations, the security figure, the CI job, the README row.

**Statement binding — verified.** `statement.rs` is `count.circom`'s claim:
the kept rule matches on all 2·4³ leaf shapes (test), the selector law
matches `picked = d + kind·(l − d)` with the asymmetric-fixture regression
asserting the reversed claims are FALSE, the fold is full-tree with
power-of-two n, pads are the all-zero leaf. The AIR enforces what the
circuit constrains, unconditionally per row: fp decomposed into exactly 64
boolean bits (three limbs 22/21/21), boolean pheno, 2-bit verdicts, the
kept algebra as in the circuit, pad slots forced to the zero preimage by
the preprocessed pad selector. The stack machine is the honest post-order
walk (left = deeper entry), the schedule is a preprocessed trace the
prover cannot shape, the last row binds the public root, both counters'
vanishing beyond slot 0, binary kind, and the claim; counters cannot wrap
(≤ n ≪ the KoalaBear modulus); the instance is bound twice (preprocessed
verifier key; the transcript seeded with the label
`bTunGsTeN-PQ10/receipt-count/v1`+n+members). The Poseidon2 constraints are
upstream's own through upstream's `SubAirBuilder`, over the default
permutation's constants, with a per-row model-vs-AIR equality assert in
the generator.

**Hiding — verified as claimed, with the claim's own cap.** Both Merkle
sides `MerkleTreeHidingMmcs`, `HidingFriPcs`, and — checked by the
compiler, not comments — `const` asserts that the hiding PCS reports `ZK`
and the plain control does not. OS entropy for every blinding draw
(`rand::make_rng`); a fixed seed exists only in `seeded_for_tests`. Every
restatement keeps upstream's "only statistically zk" wording cap.

**Leak discipline — verified, and it is the best preregistration practice
this seat has reviewed in the estate.** v1 was registered before data
(`bf04c0e2c`, amended pre-data in `12ea64966` with the amendment disclosed
inside the registration), ran once, **FAILED**, and the failure stands
with its numbers (F2 p 1.228e-5 vs 1.677e-5; F3b 0.0002; F4 4/20) and a
named statistical mechanism (pooled chi-square over correlated numbers;
leave-one-out centroid biased below chance). v2 was registered before the
new proofs (`72ea5ddfd`), and `leak.rs::judge_v2` implements the
registration exactly: G0 plus G1-G4 as permutation statistics, 2,000 label
permutations with the observed labeling counted, p = (1+x)/(1+2000),
threshold 0.0125, teeth = the non-hiding control must fail (a) — which it
did, with 45 shared-pair linkability. I deliberately did **not** re-run
`leak`/`leak-v2`: the registrations say "One run", and re-running would
add data looks under the same registration. The judge matches the v1
registration's registered constant-position semantics too (agreeing
constants excluded, differing constants p = 0).

**Forgery — reproduced locally.** Honest control verifies; all 14 classes
refused (wrong count, reversed claim, non-binary kind, wrong root, skipped
receipt, nonzero pad, two public-value swaps, the 39-member key, 256
one-bit flips all refused, truncation, both T-VACUOUS zero-opening shapes,
the other instance label); exit 0 on this Windows box (proof bytes
338,437 — the hiding proof's size varies with blinding, as expected).
CI: run 37880699773 at exactly `11d25f4bd`, job `pq10-plonky3` `success`
(tests, forgery, three scale points).

**Security figure — reproduced locally.** `PQ10 SECURITY n=64: proven 102
bits (unique 102, list 102), conjectured 111 bits (a conjecture), target
100`; both claim kinds prove and verify (~250 ms prove, ~340 KB proofs).
The figure is computed by upstream `p3-security` for this AIR and these
parameters, printed with the proven/conjectured split the README keeps.

**Boundaries — honest, and they stay open:** the SAW `rowSound` proof of
the AIR, the on-chain verifier (NOT RUN; the n=16,384 proof exceeds
jungle4's genesis net limit, cited to `contracts/zkreceipts/jungle4-
genesis.json:7`, live chain not re-read), and audit gate 2 for this
workspace are named as not-yet in the README. The crate is its own
workspace with the Plonky3 git pin (`eab7f0e…`), so audit gate 1 holds by
construction.

**Findings ledger:** zero reproducible defects. Notes, none blocking:
- **ZC-1 (standing boundary, already disclosed by the authors):** the
  STARK's fp domain is exactly 64 bits where `count.circom` accepts any
  BN254 scalar — a narrowing, stated in `statement.rs` and the README
  ("every fixture is in both"). Any future fingerprint wider than 64 bits
  is outside this proof's domain; the circuit remains the wider artifact.
- **ZC-2 (benign):** `chi_square_p` returns p = 1 when fewer than two
  bins are occupied — a degenerate-input guard never hit by real data.
- **ZC-3 (observation):** the leak experiment is a one-run registration
  by design; its receipts live in the README and the landing commit, not
  CI. Correct as registered; anyone wanting a repeat must register v3.

## 4 · hkdf32 — deferred, with the receipt

`git ls-remote origin 'refs/heads/*hkdf32*'` is empty: no independently
scoped candidate exists on origin (the closeout's `01aac1714` is a
box-local branch). Evaluation deferred until one lands.

## 5 · Verdict and next owners

Both assignments closed clean: the batch with zero reproduced defects and
ZB-1 open; PQ10 with zero reproduced defects and its named open
obligations (rowSound, on-chain verifier, gate 2) standing as the lane's
own next work. The inherited bdrop ratchet red on main is named with its
first red commit and owner above; the cure (one baseline row sampled from
CI's printed lines, or a page fix) belongs to the bDroP seat, not to this
review.

HUMAN INTERACTION: NONE. NEXT OWNER: bDroP seat (the ratchet red); PQ10
seat (rowSound / on-chain / gate 2); zCode seat stands ready for either
repair's re-review and for the hkdf32 candidate when it lands.
