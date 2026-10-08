# RAID-VAULTA-ZK-1 — proving aggregate claims about private receipt sets: the source study

zCode seat, 2026-10-06. Founder split, verbatim: "Vaulta/ZK lane → prove
aggregate claims about private receipt sets … No reason to couple those two
efforts until the ZK lane has its own tungsten result" — i.e. this lane is
DECOPULED from the Autonomi upstream-evidence lane (SPEC-RECEIPT-
OBSERVABILITY-1 §sequence step 3) until it earns its own tungsten pass.

## THE SYNERGY, PRECISELY

The estate already publishes AGGREGATES over private data and discards the
raw: the ant-reach receipt (docs/receipts/ant-reach-2026-10-06.json)
published 365/365 concordance while endpoint identities were reduced to
16-hex fingerprints and raw addresses discarded. Today that honesty is
procedural — a trusted party computes the aggregate. The ZK lane's question:
can the SAME statement become a cryptographic proof — a claim about a
private receipt set that anyone can verify without seeing the set?

```
private receipts r1..rn            (never published; holder-local)
        │ commit (Merkle root / accumulator)
        ▼
circuit: membership + predicate + aggregate fold
        │ prove
        ▼
proof π  +  public claim C          (e.g. count(kind=SETTLED) ≥ N,
        │                              sum(amount) ≤ CAP)
        ▼
verify on Vaulta (EVM path, below) → anyone checks C without the receipts
```

Applications already named by the estate's own laws: bPay/bMeter "prove
the settled total without publishing receipts" (bMeter: receipts never
carry contents); x0x/bMESHasi "prove exercise counts without endpoint
identities" (the ant-reach pattern, made cryptographic).

## WHAT THE SOURCES SAY (research receipts, 2026-10-06)

1. No Vaulta-NATIVE zkSNARK precompile or verifier surfaced in any search.
   Vaulta (formerly EOS, Antelope-based) smart contracts are C++ on
   accounts (vaulta.gitbook.io docs); nothing in the found material
   documents a native pairing-check precompile on the Antelope layer.
2. The credible verifier path is the EVM sidechain: Vaulta EVM is an EVM
   compatibility layer on Vaulta (github.com/VaultaFoundation/evm-contract
   — the authoritative place to confirm precompile wiring; evm-node
   consumes Antelope blocks via SHiP and exposes Ethereum-style RPC).
   snarkjs-generated Groth16 verifiers rely on the standard EVM alt_bn128
   precompiles at 0x06–0x08 (ecAdd, ecMul, ecPairing); general EVM
   compatibility suggests they work, gas pricing and availability must be
   verified against the evm-contract source. UNVERIFIED — see §checks.
3. Cost envelope from the Ethereum side (for planning, not as a Vaulta
   claim): a single Groth16 verification cannot go far under ~100k gas
   because of bn254 pairing costs; batching reduces per-proof cost
   (7blocklabs writeups). Whether Vaulta EVM's gas schedule matches is
   UNVERIFIED.
4. Estate precedent for the proving side: Zano's CRYPTO_PRIMITIVES
   mainnet Groth16 measured ≈2.44 ms (RAID lane 2026 — different chain,
   same curve class) — off-chain proving is not the bottleneck class;
   on-chain verification cost is.

## §checks — the exact first beats (each a receipt when done)

- [ ] PRECOMPILES: grep VaultaFoundation/evm-contract for 0x06/0x07/0x08
      (alt_bn128) wiring, or deploy a snarkjs Groth16 verifier on the
      Vaulta EVM testnet and verify a known-good proof. Until then, every
      "verify on Vaulta" statement above carries UNVERIFIED.
- [ ] TESTNET ACCOUNT: a Vaulta EVM testnet account + faucet (the estate
      holds Jungle4 EOS-side identities — bzcodejungle; the EVM-side
      equivalent is unnamed). Founder gesture may be needed for faucet.
- [ ] TOOLING: circom+snarkjs (JS/EVM-native, fastest to first proof)
      vs arkworks (Rust, fits the estate's crates pattern — bmesh-meter,
      bpay-rail precedents). Genesis recommendation: circom+snarkjs for
      the FIRST proof (the tungsten target), arkworks if the circuit
      graduates into the workspace.
- [ ] THE CIRCUIT ITSELF (smallest true aggregate): a count-only claim —
      "I hold ≥N receipts of kind K whose hashes commit to root M" —
      Merkle inclusion + counter fold, no amounts. Amounts/sums are the
      second circuit, not the first.

## §tungsten — this lane's own gate (design now, earn before any coupling)

The lane may not couple with the Autonomi upstream lane until ALL of:
1. FORGERY: a mutated aggregate (wrong count, wrong root, skipped
   receipt) produces a proof the verifier REJECTS — mutation-proven the
   bmesh-meter way, receipts in-tree.
2. LEAK: the proof + claim reveal nothing beyond C and M — bounded
   distinguisher test on simulated vs real witnesses; wording capped at
   "sound by construction against the pinned test set" (crypto language
   law) until an independent review says more.
3. COST: on-chain verification measured on Vaulta EVM testnet — gas
   receipt per verify, batch amortization stated.
4. SCALE: proof-time receipts at n = 1k and n = 10k receipts.

## Sources

- Vaulta native accounts/contracts docs — vaulta.gitbook.io
- Vaulta EVM repos — github.com/VaultaFoundation/evm-contract ·
  github.com/VaultaFoundation/evm-node
- Groth16-on-EVM practice — chainscorelabs.com guide (deploying Groth16/
  Plonk verifiers, precompile usage) · 7blocklabs.com (verifier gas
  floors ~100k, batching; dual Groth16/Plonk verifiers on BN254)
- ZeroPool verifier reference — zeropool.network docs (alt_bn128_groth16
  via pairing helpers)
- Estate kin: docs/receipts/ant-reach-2026-10-06.json (aggregate-over-
  private precedent) · crates/bmesh-meter (mutation-proof discipline) ·
  zano HF6 raid (Groth16 ≈2.44 ms mainnet measurement)
