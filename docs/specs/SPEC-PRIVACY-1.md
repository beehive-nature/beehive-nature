# SPEC-PRIVACY-1 — the estate-run privacy layer on Vaulta

Status: M1 EXECUTED (receipt below) · M2 = a numbered ask awaiting the founder's
fork ruling · M3 designed, NOT BUILT (opens on the ruling).
Seat: z2 (privacy lane). Owns `contracts/privacy/`.

Premise (from the Zano raid + ZK bench, both at source): Vaulta runs
CRYPTO_PRIMITIVES (mainnet ordinal 16, block 269,183,454) AND BLS_PRIMITIVES2
(mainnet ordinal 21) — both host-function sets live for any contract, no
foundation ask. The sovereign privacy layer is buildable today.

## §m1-receipt — the chain number (EXECUTED 2026-09-01)

A minimal Groth16-shape verifier (`contracts/privacy/verify_min.cpp`) — one
`alt_bn128_pair` call over 4 pairs, the exact operation count of a production
Groth16 verification — deployed and executed on **Spring v1.2.2** (the same
software line as Vaulta mainnet's v1.2.1 nodes):

- **verify (valid equation): status executed · billed cpu_usage_us = 5,718 /
  6,414 / 5,043 / 11,186 (one outlier under parallel lab load) — median
  ≈ 6.1 ms.** ≈ 4.1% of a 150 ms transaction ceiling.
- **verifybad (broken tuple): executed at 6,397 µs — its assert DEMANDS the
  pairing check return false**, so this run is the receipt that invalid
  proofs REJECT (a forged-resurrection-class failure fails the pairing).
- Against the native figure: the 4-pair native equivalent ≈ 3.7 ms (measured
  on the same machine with Spring's own bn256 library) → **on-chain overhead
  factor ≈ 1.65×** (WASM boundary + transaction machinery).
- What the toy instance is, stated exactly: keys and "proof" are generator
  points chosen so the full Groth16 pairing equation holds by construction.
  The PAIRING COUNT is the production count — the billed CPU is what a
  real-circuit verification costs. A meaningful circuit rides the same
  action after the M2 fork is ruled (that is when a proving stack exists).
- **Jungle4 attempt — receipts of failure, kept honestly:** accounts created
  (bnrvrfy2/3.gm via @wharfkit/cli), faucet paid 100 EOS (browser ceremony),
  but the testnet's resource market is degenerate TODAY: stake-derived CPU
  is ~270 µs (rent regime) and the POWERUP market rejects every request
  ("calculated fee is below minimum" at full fraction) — setcode cannot fit.
  The measurement ran on a local Spring v1.2.2 producer instead; same node
  software, unlimited lab resources, receipt above. Jungle4 retry is free
  whenever its market recovers.
- Lab bootstrap (for the next seat): producer-API
  `schedule_protocol_feature_activations` → PREACTIVATE_FEATURE → a
  one-action `activate` contract (minibios) → activate CRYPTO_PRIMITIVES
  digest `6bcb40a2…`. GOTCHA (cost an hour): the CDT checksum256 param
  arrives at the intrinsic with its two 16-byte halves swapped after byte
  reversal — send `5185eb6a…e464d2` (T of the digest) or fix the
  reinterpret_cast. Jungle4 powerup ABI gotcha: fractions are int64; 2^31-1
  ≈ 100%.

## §m2-the-fork — numbered ask for the founder (the founder rules; the seat does not pick)

Every option verified live for its curve/availability; verification costs are
MEASURED where measured, ESTIMATED where estimated, UNVERIFIED where honest.

1. **Groth16 over BN254 — per-circuit trusted setup.**
   Verify cost: **≈ 6.1 ms billed (MEASURED, §m1).** The fastest, best-tooled
   path (CDT wraps the intrinsics; the Ethereum-verifier heritage).
   The cost that is not in milliseconds: each circuit needs a setup ceremony,
   and **a compromised setup permits undetectable proof forgery** — in a
   private-note system that means silently minting value (hidden inflation)
   with no on-chain trace. Mitigation: a public multi-party ceremony where
   ONE honest participant suffices; the estate can run one (open
   contributions, burned transcript).
2. **PLONK over BN254 — universal setup.**
   One ceremony EVER (updatable for all future circuits up to a size bound) —
   kills the per-circuit ceremony, keeps a trusted one-time event. Verify
   cost: 2 pairings + 2 G1 scalar-muls + hashing ≈ **≈ 4–5 ms billed
   (ESTIMATE from the measured components)**. Slightly larger proofs, less
   circuit-tooling maturity than Groth16 on our stack.
3. **Transparent (no setup): Halo2-IPA class over Pasta curves.**
   No ceremony at all — but Pasta curves have NO Vaulta host functions, so
   the pairing-free verification (inner-product arguments = many big MSMs)
   runs in pure WASM: **likely tens to hundreds of ms (UNVERIFIED — must be
   benchmarked before believing)**; honest risk that it busts the per-tx
   budget. Cheapest trust, dearest compute.
4. **BLS12-381 lane (PLONKish/KZG, e.g. halo2-kzg): universal setup + the
   modern-curve ecosystem.**
   BLS_PRIMITIVES2 is LIVE on mainnet (ordinal 21; `env.bls_pairing` already
   imported by Antelope's own reference contracts). BLS12-381 pairings are
   bigger-field (≈ 2–3× BN254 per pairing) → **≈ 8–15 ms billed (ESTIMATE,
   UNVERIFIED)**; no CDT wrapper yet (raw extern import). Heaviest per-tx
   cost, strongest long-term ecosystem gravity.

The measured budget for scale: at ~6 ms/verify, a 150 ms transaction ceiling
fits ~24 verifications per transaction and a 200 ms block ~33 — settlement
scale, not L1-scale; that is the design constraint either way.

## §m3-design — the private note (built only after the fork is ruled)

Note = commitment pair (amount ‖ owner ‖ view-tag) in a Merkle-accumulated
commitment set; spend = nullifier insert + proof (the M2 system) that
(a) the note exists in the set, (b) the spender owns it, (c) amounts balance,
(d) the nullifier is correctly derived — double-spend = nullifier collision,
isolated by design.

Flows: **deposit** (public token in → new commitment) → **private transfer**
(nullifier + new commitment + proof) → **withdraw** (nullifier + proof →
public token out).

**SELECTIVE DISCLOSURE FROM DAY ONE** (ruled; not bolted on): every note
carries a **view-key tag**; the owner-held view key derives the note's
opening for a chosen auditor — an owner can PROVE their own history (Zano's
auditable-wallet pattern). This is what makes the private tier compatible
with the estate's gov stack: the Treasury/tithe remittance can be audited by
disclosure, not by de-privacy. The chain NEVER sees the disclosure — it
stays owner→auditor.

**BOUNDED ROWS (standing law):** the chain holds the LAW (rate/tithe table),
the commitment set, and the nullifier set — never bulk history. History and
private state live under the member's own key on Autonomi (SPEC-VENDING-1
layer 2); the AR recipe (layer 1) already rules the re-stand.

## §order-of-work

1. M1 — DONE (receipt §m1).
2. M2 — the founder rules the numbered fork; the proving stack is chosen by
   the ruling.
3. M3 — build in `contracts/privacy/`: commitment/nullifier contract + the
   prover integration + the view-key disclosure kit + Treasury remittance
   hook.
