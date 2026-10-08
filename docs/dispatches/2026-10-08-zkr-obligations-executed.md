# 2026-10-08 — the three obligations EXECUTED: leak distinguisher PASSED to its pre-registered criterion; follower boot GREEN (all four receipts, cause of the zero-handshake RED found and corrected); PQ inventory classified; scale 1k in flight with its compile receipt banked

Founder order 2026-10-08 (English throughout crypto/PQ work; "waiting is
not the next step"). Branch zcode/vaulta-zk-2026-10-06 through 9ba22a7d4.

## 1 — bTunGsTeN 2, leak distinguisher: EXECUTED, PASSED to the
pre-registered criterion (commits 46ccc3eee → 9ba22a7d4)

Pre-registration committed BEFORE any experiment proof existed
(PREREGISTERED.md): adversary sees (π, C) only — root M withheld (M
separates classes BY DESIGN as the public commitment; the test is what
π ADDS). 10 REAL (canonical cohort witness, 5 dead-claim + 5 live-claim,
fresh proving randomness) vs 10 SIM (4 engineered synthetic 40-member
sets, same 20/20 claims).

- F1 per-word means (24 tests): min Bonferroni p = 0.330 (threshold
  0.0125) — ok
- F2 per-word Hamming weight (24): min p = 0.666 — ok
- F3 byte chi-square (words 10–15 pooled): p = 0.528 — ok
- F4 KS on word[15] low 64 bits: p = 0.751 — ok
- F5 pinned weak learner: accuracy 0.70, 95% CI [0.481, 0.855] —
  INCLUDES 0.50; the point estimate is REPORTED, not buried: at n=20
  the CI cannot separate 0.70 from a coin flip.

VERDICT (wording capped per the crypto-language law): to the pinned
families, at n=10/10, π distinguishes REAL from SIM no better than
chance — an EMPIRICAL BOUND over the pinned test set, not a
zero-knowledge proof, not a claim about untested families or prover
side channels. Deviations recorded in the commit (5-REAL bug →
regenerated to spec; dataset rebuilt from proof artifacts after a
normalization error; analyzer key bug fixed before any result was
read). §tungsten-2 of RAID-VAULTA-ZK-1: EARNED at this scope.

## 2 — follower first boot: ALL FOUR RECEIPTS GREEN (concurrent
session, commits 0e7a8c7d2 + 326b8c859; this session's earlier RED run
was the isolating observation)

- The zero-handshake RED this seat receipted (19:2x UTC; cryptolions
  read-error loop, eosphere 'wrong chain' anomaly, −5.5 s clock) had a
  CAUSE, found by the concurrent session's run: **Spring's
  `allowed-connection = none` rejects ALL handshakes — outbound
  included** — the pinned posture was self-blocking.
- Corrected posture (in-tree @326b8c859): `allowed-connection = any`
  WITH the loopback p2p bind retained (the socket never leaves the
  machine); the official Jungle4 genesis now IN-TREE (the second
  defect this seat found — no operative chain selection in the pinned
  config — closed with it).
- All four receipts GREEN (docs/receipts/zkr-jungle4-follower-boot-
  2026-10-08.txt): EXPOSURE (listeners match intended posture),
  IDENTITY (chain 73e4385a… corroborated), PEER (completed Jungle4
  handshakes), AGREEMENT (exact height + block ID vs an independent
  public API). The follower is now ADMISSIBLE as a Jungle4
  verification source under the scope-corrected law — nothing more.

## 3 — PQ inventory: CLASSIFIED (PQ-INVENTORY.md @f391a3762)

Signatures: secp256k1 chain auth — UNRESOLVED (chain-level; the safe7
lane builds the estate's PQ-signature asset, not a Vaulta integration).
Transport: classical TLS endpoints + plaintext P2P — UNRESOLVED
(endpoint/protocol). Proof system: BN254 PLONK — UNRESOLVED and THE
deep item (STARK-class rewrite; the ceremony dependency dissolves with
it). Hashes/digests: RETAINED (Grover margin). Historical
verification: RETAINED with the systemic chain-signature caveat.
**PQ signatures alone ≠ a PQ stack** — the proof system is the lane's
own PQ frontier when ordered.

## 4 — bTunGsTeN 4, scale: 1k IN FLIGHT (compile receipt banked), 10k
blocked-then-queued

- count_scale.circom parametrizes the exact workload (same leaf logic,
  selector law, fold law). n=1024/members=1000 COMPILED: **1,629,595
  constraints, 5,120 private inputs, 3 publics** (16.1× the 64-leaf
  circuit). pot20 rehearsal ceremony in progress (contribute done;
  prepare-phase2 running under multi-job load) — witness/prove/verify
  timings + peak RSS + the interrupt-recovery leg land in the
  follow-up commit when the run completes.
- 10k: hosted infrastructure BLOCKED — the oracle box REFUSES ssh
  (kex_exchange_identification: Connection reset by peer — the
  standing bnr-SSH blocker; named, not worked around). Local 10k
  (pot24-class) queued behind the 1k run on this laptop; if it hits a
  resource ceiling, the ceiling itself is the receipt with measured
  numbers.

## Open after this dispatch

tungsten-4 (scale) remains the one open measurement; its receipts land
next. The Autonomi coupling ban stands until the full tungsten pass.
