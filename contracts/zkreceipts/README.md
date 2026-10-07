# contracts/zkreceipts — count-only aggregate claims over private receipt sets

Lane: SPEC-ZK-RECEIPT-AGGREGATES-1 (zCode seat, 2026-10-06). The Vaulta/ZK
lane's v1: a prover who HOLDS a private receipt set publishes a COUNT —
not the set — and anyone verifies it against the committed root, on-chain,
with the estate's own nine-phase PLONK verifier.

```
cohort receipt (docs/receipts/ant-reach-cohort-2026-10-06.json)
   40 members, fingerprints only, raw addresses discarded (ant-reach law)
        │ zkrprep.cjs  — encode leaves, cross-check every aggregate
        ▼
count.circom — FULL-TREE fold: root derives from exactly this leaf set;
   per-leaf kind logic: kept = (≥1 settled run) ∧ (zero flips)
        │ prove (snarkjs plonk, pot17 one-honest-seat rehearsal ceremony)
        ▼
proof π + public claim (root, kind K, count N)
        │
        ▼
zkrcount.cpp — anchor(root,K,N) [M9-bounded: the head, never the set]
   → verify(seq, π): nine-phase PLONK over publics FROM THE ANCHOR ROW
```

SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## The claim shape (the spec's law)

An aggregate claim may state counts, sums-bounds, and commitment roots —
never contents, identities, or raw addresses. v1 is COUNT-ONLY: two live
claims over the 2026-10-06 cohort are "20 dead-baseline members kept their
phenotype" (kind=0) and "20 live-baseline members kept it" (kind=1), both
under one root committing all 40 fingerprints + verdicts. The receipt's
43/50 settled-observation figures are SUMS — the SECOND circuit, not this
one (the spec's count-first law).

## Files

- `count.circom` — the circuit. 101,278 constraints, 3 publics, measured
  at compile (receipt in the dispatch). Full-tree fold, not per-member
  paths: the root provably derives from EXACTLY the 64-leaf witness (40
  members + 24 constrained zero pads).
- `zkrprep.cjs` — witness builder; every aggregate cross-checked against
  the receipt's own numbers (fails loud on any disagreement).
- `gen_vk_count_cpp.js` — vk → `vk_count_constants.hpp` (decimal bytes;
  copy of the M4 generator, provenance lines only).
- `plonk_verify_count.hpp` — VERBATIM copy of `../privacy/plonk_verify.hpp`
  with exactly three cited divergent lines (includes + N_PUBLIC assert).
- `zkrcount.cpp` — the on-chain gate: `anchor` + `verify`, root as RAW
  BYTES (the fixed_bytes T-laws never touch the transcript), one proof
  per anchor, alg id 2 shared with note.cpp's law row.
- `prove_count.sh` — pipeline: compile → pot17 (ONE honest participant —
  REHEARSAL-labeled, the estate law) → setup → vk → witnesses → TWO
  proofs (kind 0/1) → off-chain verifies → calldata → the FORGERY set.
- `zkrrun.sh` — the acceptance pass (the m4run discipline): rehearsal
  chain boot + activation ladder → deploy → both real proofs verify →
  every refusal: forged / mutated count / mutated root / mutated kind /
  re-verify / bad kind at anchor time.

## Labeled boundaries (what this does NOT prove)

- Measurement ORIGIN: the circuit proves the claim about the witness set;
  it cannot prove a browser really dialed anything. The origin question
  needs seat-signed receipts feeding the commitment (the founder split's
  named boundary; second circuit lane).
- Vantage independence: out of proof scope without cryptographic vantage
  identities (the ant-reach precision stands).
- The ceremony is one honest participant — rehearsal-labeled until a
  witnessed multi-party sealing is ruled (the M5 law carries).
- On-chain verification is MEASURED on BOTH the local Spring v1.2.2
  rehearsal chain (9,629 / 12,427 µs billed) and VAULTA PUBLIC TESTNET
  (jungle4, `zkrtst222222`, code hash identical: 12,071 / 10,647 µs
  billed) — `zkrrun-jungle4.sh` is the sponsored testnet runner (the
  spladder recipe). Vaulta mainnet: out of scope until a witnessed
  ceremony ruling.

## Kin

- `../privacy/` — the verifier engine (M4–M10), the anchor law (M9), the
  UB/aliasing/T laws this lane inherits verbatim.
- `docs/raids/RAID-VAULTA-ZK-1.md` — the source study + §tungsten gate.
- `docs/receipts/ant-reach-cohort-2026-10-06.json` — the evidence set
  whose published summary this circuit makes cryptographic.
