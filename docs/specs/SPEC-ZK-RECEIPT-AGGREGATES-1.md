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
- UNVERIFIED until §checks close: on-chain verification venue. No Vaulta
  native ZK precompile was found; the working hypothesis is Vaulta EVM +
  a standard snarkjs Groth16 verifier over the alt_bn128 precompiles
  (0x06–0x08) — confirmed against VaultaFoundation/evm-contract source or
  by a testnet verify before any claim of "verifiable on Vaulta."

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
2. ← CURRENT — close RAID §checks: precompile confirmation (evm-contract
   source or testnet deploy), testnet account/faucet (EVM-side; the
   Jungle4 EOS-side identities do not automatically carry), tooling pick
   (circom+snarkjs first proof, arkworks if it graduates into crates/).
3. Build the count-only circuit; run §tungsten 1–2 locally.
4. Testnet verify; §tungsten 3–4 receipts.
5. Only after a full tungsten pass: revisit coupling with the Autonomi
   upstream lane and the bMESHasi/x0x step-4 contract work.

## §kin

- SPEC-RECEIPT-OBSERVABILITY-1 — the non-ZK law this extends; the
  ant-reach two-network receipt is the procedural aggregate this lane
  aims to make cryptographic.
- crates/bmesh-meter — mutation-proof discipline; crates/bpay-rail —
  the workspace precedent if the prover becomes Rust.
- zano HF6 raid — Groth16 ≈2.44 ms mainnet measurement (curve-class
  kin, different chain).
