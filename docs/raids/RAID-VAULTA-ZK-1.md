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

- [x] PRECOMPILES — CLOSED 2026-10-06, by the estate's own receipts, not
      by search: ZK_BENCH_2026-09-01 documents Spring's `crypto.cpp`
      implementing the alt_bn128 host functions, and mainnet + jungle4 API
      endpoints run Spring v1.2.1 — the same client family as the lab.
      Today: CRYPTO_PRIMITIVES activated on the rehearsal chain (minibios
      ladder), `zkrcount` deployed (code hash eb4d61c9…f576e5), and the
      nine-phase gate ACCEPTED two real proofs and REFUSED four forgeries
      ON-CHAIN (dispatch 2026-10-06-vaulta-zk-count-v1). The EVM-side
      hypothesis above is RETIRED to fallback — the native Antelope path
      is the estate's own proven engine.
- [x] TESTNET ACCOUNT — reach PROVEN 2026-10-06: jungle4 RPC live
      (chain_id 73e4385a…, head 290,725,568 at 01:05Z). Estate accounts
      DRY: notelab11111 CPU 171 µs, bnrapolltest 0 µs, bzcodejungle 2 µs
      (the 2026-09-03 powerup expired). FOUNDER GESTURE (asked for and
      answered mid-lane): faucet `monitor.jungletestnet.io/#faucet` →
      `bnrapolltest` (the proven sponsor payer). One drip covers the
      whole pass (≈0.2 s CPU).
- [x] TOOLING — circom + snarkjs 0.7.6, the estate standard, confirmed:
      count.circom compiled (101,278 constraints, 3 publics), pot17
      ceremony (ONE honest participant — rehearsal-labeled; contribution
      response 2bfb5bd6…, next challenge 2bb7b357…).
- [x] THE CIRCUIT — built and exercised end to end (the v1 lane below).

## §tungsten — this lane's own gate (design now, earn before any coupling)

The lane may not couple with the Autonomi upstream lane until ALL of:
1. FORGERY — EARNED 2026-10-06 (rehearsal chain + off-chain): real
   dead/live proofs verify; tampered proof word (eval_zw+1), mutated
   count, mutated root, mutated kind ALL refused by the pairing;
   re-verify and bad-kind refused by the contract's own bounds. Receipts
   in docs/dispatches/2026-10-06-vaulta-zk-count-v1.md. (Vaulta-testnet
   repetition pending the faucet gesture.)
2. LEAK — OPEN: the bounded distinguisher test is NOT run; wording
   remains "sound by construction against the pinned test set".
3. COST — PARTIAL: rehearsal-chain verify billed (probe in the dispatch);
   a Vaulta-testnet figure is still the receipt this gate needs.
4. SCALE — OPEN: proof-time receipts at n = 1k and n = 10k not yet run
   (design note: a full-tree fold at n leaves costs (2n−1) Poseidons —
   pot choice per scale, measured when run).

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
