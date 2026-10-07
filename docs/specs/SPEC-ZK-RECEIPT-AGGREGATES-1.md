# SPEC-ZK-RECEIPT-AGGREGATES-1 — aggregate claims over private receipt sets (Vaulta/ZK lane)

Status: GENESIS 2026-10-06 (zCode seat, branch zcode/vaulta-zk-2026-10-06).
Founder split, binding: this lane is SEPARATE from the Autonomi upstream
evidence lane and may not couple with it until it earns its own tungsten
result (RAID-VAULTA-ZK-1 §tungsten). Source study: docs/raids/RAID-VAULTA-ZK-1.md.

## THE LAW THIS LANE SERVES

Receipt-derived observability made cryptographic: a party who holds private
receipts may publish an AGGREGATE CLAIM about them, verifiable by anyone,
without publishing the receipts:

```
receipts[] (private) → commit → circuit → proof π + claim C → verify
```

An aggregate claim may state ONLY:
- counts (e.g. count(kind = SETTLED) ≥ N),
- sums/bounds over numeric fields (e.g. sum(amount) ≤ CAP),
- set membership commitments (a Merkle/accumulator root),

and NEVER: contents, identities, raw addresses, or per-receipt payloads.
This is bMeter's receipts-never-carry-contents law and the ant-reach
fingerprint discipline (aggregate published, raw discarded) promoted from
procedure to proof. The claim C and the commitment root are the ONLY new
information a proof may introduce.

## §shape — v1 circuit (smallest true aggregate)

- Private witness: n receipts; each {kind, ts, amount} hashed into a
  Merkle tree; the root M is public.
- Public claim C: "≥ N receipts in M have kind = K."
- Circuit: Merkle inclusion per receipt + kind predicate + counter fold.
- Amounts/sums are the SECOND circuit — count-first is the genesis scope.
- Venue CONFIRMED 2026-10-06 on BOTH chains: the estate's own native
  Antelope C++ nine-phase PLONK port (contracts/privacy/
  plonk_verify.hpp → plonk_verify_count.hpp) over Spring's alt_bn128
  host functions — two real proofs verified and four forgeries refused
  on the Spring v1.2.2 rehearsal chain AND on Vaulta public testnet
  (jungle4, code hash `eb4d61c9…` byte-identical across both;
  dispatch 2026-10-06-vaulta-zk-count-v1.md). Vaulta MAINNET stays
  UNVERIFIED and out of scope until a witnessed ceremony ruling.

## §privacy

- Receipts stay holder-local; the prover never uploads them anywhere.
- Endpoint-style identities, if receipts carry them, enter the circuit as
  fingerprints (ant-reach precedent) — the proof can aggregate over them
  without revealing them.
- No global collector (the ant-reach ruling generalizes): a proof is a
  local artifact until a collector + privacy ruling exists.
- Wording cap: "sound by construction against the pinned test set" until
  an independent review earns more (crypto language law).

## §tungsten (the gate before ANY coupling with upstream lanes)

1. FORGERY — mutated aggregates (wrong count, wrong root, skipped
   receipt) must produce proofs the verifier rejects; mutation receipts
   in-tree (the bmesh-meter discipline).
2. LEAK — a bounded distinguisher test: proof transcripts over simulated
   vs real witnesses are indistinguishable to the pinned test set.
3. COST — on-chain verify measured on Vaulta EVM testnet (gas per verify;
   batch amortization stated). Ethereum-side planning figure: Groth16
   verify ≈ 100k+ gas floor due to bn254 pairings — a Vaulta figure, not
   an Ethereum one, is the receipt this lane needs.
4. SCALE — proof-time receipts at n = 1k and n = 10k.

Until all four: this lane publishes nothing upstream and couples with
nothing (founder ruling 2026-10-06).

## §sequence (this lane)

1. ✓ GENESIS — raid + this spec (research receipts in the raid).
2. ✓ CLOSED 2026-10-06 — all four RAID §checks receipted (see the raid):
   the verifier venue is the estate's OWN native Antelope PLONK port
   (Spring crypto.cpp alt_bn128 host functions — ZK_BENCH receipts; the
   EVM hypothesis retired to fallback); jungle4 RPC live but estate
   accounts CPU-dry (faucet gesture named); circom+snarkjs confirmed;
   the circuit built.
3. ✓ EXECUTED 2026-10-06 — count.circom (101,278 constraints, 3 publics,
   pot17 one-honest-seat rehearsal ceremony) proven over the ant-reach
   40-member cohort (root 0x2e6bc682…, claims 20 dead-baseline kept /
   20 live-baseline kept); off-chain verifies PASS; tungsten-1 forgery
   set ALL refused off-chain AND on-chain (zkrcount, Spring rehearsal
   chain, code hash eb4d61c9…). Receipt: dispatch
   2026-10-06-vaulta-zk-count-v1.md; contracts/zkreceipts/.
4. ✓ TESTNET VERIFY DONE 2026-10-06 (same night — the founder powered the
   accounts mid-lane): the full acceptance pass green on jungle4, code
   hash byte-identical, §tungsten 3 earned (verify bills ≈10.6–12.1 ms
   CPU; dispatch addendum).
5. ✓ SELECTOR REPAIR DONE 2026-10-06 (founder-ruled review + dispatch): the
   v1 `picked` mux selected the OPPOSITE baseline's counter (`IsEqual`
   output is 1 at kind=0 → every claim counted the other side; hidden by
   the cohort's 20/20 symmetry). Fix: `picked = dOut + kind·(lOut−dOut)`
   (K picks its OWN counter; the IsEqual component removed, 101,275
   constraints). Asymmetric regression PINNED (fixtures/asym-cohort.json,
   deadKept 20 / liveKept 19): correct claims prove+verify; reversed
   claims REFUSED at witness generation (`picked === count`, no witness);
   tampered kind/count on a real proof fails verification. All artifacts
   re-derived together (r1cs→zkey→vk→vk_count_constants.hpp→WASM→proofs —
   never a corrected circuit on an old vk); ceremony split into tiers —
   rehearsal pot17 (one seat) vs RELEASE from the verified public Hermez
   `powersOfTau28_hez_final_17.ptau` (54 contributions + beacon; blake2b
   pinned to the iden3/snarkjs README, dual-source byte-identical,
   transcript re-verified locally). On-chain re-acceptance on the
   rehearsal chain AND jungle4 with the release-class artifacts. The M3
   "named next step" of SPEC-PRIVACY-1 ruled superseded by its §m4; the
   PLONK/BN254 engine closed.
6. ← CURRENT REMAINDER: §tungsten 2 (leak distinguisher) + §tungsten 4
   (scale 1k/10k proof-time receipts) + the witnessed multi-party BNR
   sealing kit (human participants on separate machines — preparation
   only; multiple agents on one host are NOT independent trust domains).
7. Only after a full tungsten pass: revisit coupling with the Autonomi
   upstream lane and the bMESHasi/x0x step-4 contract work.

## §kin

- SPEC-RECEIPT-OBSERVABILITY-1 — the non-ZK law this extends; the
  ant-reach two-network receipt is the procedural aggregate this lane
  aims to make cryptographic.
- crates/bmesh-meter — mutation-proof discipline; crates/bpay-rail —
  the workspace precedent if the prover becomes Rust.
- zano HF6 raid — Groth16 ≈2.44 ms mainnet measurement (curve-class
  kin, different chain).
