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

---

## §m2-ruled — the fork (2026-09-03, Seat-1 under delegation, founder veto stands)

**OPTION 2 — PLONK over BN254. Universal updatable setup, ONE ceremony ever.**
Groth16's per-circuit ritual is retired for this lane. BLS12-381 stays the
future lane, not this one (algorithm ids below make that swap a table row).

## §m2.5-receipt — PLONK measured BEFORE building (threshold < 15 ms)

`plonkbench` deployed on the rehearsal chain (same Spring v1.2.2 producer,
CRYPTO_PRIMITIVES active): the PLONK verification at PRODUCTION op count —
6 transcript keccaks, 2 modexp field inversions, 12 G1 scalar-muls, 12 G1
adds, one pairing product over 4 pairs — toy instance, labeled exactly
(generator-derived keys; a circuit-backed proof rides the same ops).

**Billed cpu_usage_us: 7,263 / 5,173 / 5,209 / 7,953 — median ≈ 6.2 ms.**
Negative control (broken pairing product): executed at 3,733 µs = rejected.
vs the Groth16 baseline 6.1 ms: **PLONK costs the same on-chain** (the
spec's earlier ~4–5 ms estimate was low; the measured number stands).
**THRESHOLD PASSED (< 15 ms) → M3 built.** Ops notes: the WASM memory
checker refuses aliased pointers (same-array operands AND shared
exponent/modulus buffers both trip it — separate buffers everywhere).

## §m3-receipt — the private note, LIVE on the rehearsal chain

`contracts/privacy/note.cpp` (deployed as `noteacct4`; runner `m3final.sh`,
witness values `m3.js`):

- **[deposit]** executed, 140 µs — commitment row (bounded set, view tag,
  algorithm id).
- **[private transfer]** executed, **billed 4,293 µs** — the spend gate ran
  the PLONK-shpe pairing product + transcript keccak + G1 mul, the nullifier
  was inserted (double-spend gate armed), the new commitment landed.
- **[forged transfer]** — replay of the spent nullifier: **REJECTED** by the
  nullifier uniqueness constraint (the DB-level refusal fired; the explicit
  DOUBLE-SPEND assert is the belt to that braces — the gate held either way).
- **[withdraw]** executed, billed 5,400 µs — second note spent to a plain
  recipient.
- Final sets: 2 commitments + 2 nullifiers, every row carrying its algorithm
  id (crypto-agility law), both tables hard-capped by the law row (bounded).

**Labeled exactly (the lane law):** the FLOW is real (deposit → transfer →
withdraw, commitment/nullifier sets, view-key tag on every commitment,
owner-held disclosure off-chain — Zano's auditable-wallet pattern). The ZK
STATEMENT inside the spend gate is the labeled toy (production op count,
generator keys). Commitments are keccak256-v1 via the native intrinsic —
Poseidon-bn254 is the named successor for the circuit lane (SNARK circuits
want Poseidon). **The named next step of the ruled fork:** circom+snarkjs
proving (cargo present in the lab; circom installable) + the faithful CDT
port of the snarkjs PLONK verifier (a 256-bit field library + transcript +
equation — hours of careful work, honestly beyond this pass) — then the toy
constants in `spend_gate` become the real verifying key WITHOUT touching
the flow, and the receipt upgrades from op-count-real to circuit-backed.

## §m4-receipt — the port LANDED: circuit-backed PLONK verifies on-chain (2026-09-04)

The ruled fork's last step, executed. `contracts/privacy/` now holds the
full stack: `field256.hpp` (4×64-limb modular arithmetic — Montgomery
reduction + shift-subtract oracle), `plonk_verify.hpp` (the nine phases
ported verbatim from snarkjs `templates/verifier_plonk.sol.ejs`, line-cited),
`vk_constants.hpp` (generated from the ceremony vk), `spend.circom` (the
note statement: Poseidon(secret,amount), Poseidon(secret,tag), both public
commitment+nullifier), and the proving/receipt scripts. `note.cpp`'s
`spend_gate` runs the REAL verifier — the FLOW is unchanged from M3.

**The test ladder every layer passed BEFORE the one above it:**
- field256 vs python big-int known vectors: **3,217/3,217** (both BN254
  fields, edges 0/1/m−1, exponentiation, batch inversion, BE round-trip).
- keccak (test rig) vs standard vectors: OK.
- the scalar phases (challenges β..u, Lagrange, PI, R₀, D-scalars, E-scalar)
  vs an independent BigInt oracle (`oracle_scalars.js`) over the REAL vk +
  REAL proof: **23/23**.
- on-chain probe (bare verify action): executed — then the full flow.

**On-chain acceptance (account `plonknote11`, code hash
`1ed34e44…356343`, CRYPTO_PRIMITIVES chain):**
- deposit → executed (M3 flow unchanged, keccak commitment, alg 1);
- **private transfer, REAL circuit proof → executed, billed 9,132 µs**
  (blk 12672);
- **forged proof (eval_zw tampered +1) → REJECTED**: "spend proof REJECTED
  — plonk pairing false";
- **replay (same proof + nullifier) → REJECTED** by the nullifier
  uniqueness constraint (tx failed; the M3 belt-and-braces shape — the
  table's unique index is the enforcer that fired);
- withdraw with a second real proof (same secret, tag=2 → different
  nullifier) → executed;
- law row: `alg_proof = 2 = ALG_PROOF_PLONK_V1` (crypto-agility bump; old
  rows keep 1 — toy and real distinguishable forever).

**Billing, honestly measured:** 15 executed verifies across the lane:
low-load cluster **6,911–10,429 µs** (min 6.9, median ≈ 9.1 ms) — in the
6–9 ms band, tripwire < 15 ms PASSED uncontended. A concurrent seat
sharing the WSL host inflated samples to 12.6–18.4 ms (identical wasm —
the noinline rebuild was byte-identical, the linker had already folded the
call sites; the variance tracks host load, not the verifier). The 15 ms
tripwire is honored on uncontended numbers; contended samples are labeled
as such, not averaged away.

**Bugs the ladder caught (the process story, for z2):** (1) the batch
inversion built the Fermat exponent as q−1 instead of q−2 — every
"inversion" returned 1 by Fermat — caught by python vectors; (2)
`f256_to_be` round-tripped limb-reversed against `f256_from_be` — every
BE serialization incl. `alt_bn128_mul` scalars would have been wrong
on-chain — caught by the oracle (the mismatch had a limb-swap signature)
and a BE round-trip gate was added to the standing test; (3) `pl_g1_neg`
computed y−qf instead of qf−y — an invalid point that the chain's own
`alt_bn128_add` refused ("plonk: D+d3") — caught by the on-chain probe
after the native gates passed, exactly why the probe exists: point phases
have no native oracle, the chain is their test.

**Labeled exactly:** the statement BINDS nullifier↔commitment↔secret; it
does NOT prove membership of the commitment in the chain's set (merkle
root public input = named future lane) nor value conservation (amounts
still rehearsed openly). The ceremony is pot12 bn128 with ONE honest
participant (this rehearsal seat) — dev-rehearsal labeled; a production
ceremony needs more participants (the ptau chain lives in the WSL lab,
burned with its /tmp-class lifecycle; `pot12_final` sha
`fe12ac40…a75ad` TESTNET-ONLY rehearsal artifact). Deposit commitments
stay keccak256-v1 (flow law); the Poseidon deposit hash is a named future
lane. Inversions run as pure-WASM Fermat `a^(q−2)` (one batched call,
no mod_exp intrinsic — one fewer aliasing surface); on a non-invertible
value the EVM verifier reverts early while the port computes 0 and the
FINAL PAIRING still refuses — same verdict, different path.

**Handoff corrections (verified, not trusted):** circom was NOT staged
(built now, 2.2.3); the bnrzk wallet did NOT exist (created);
`calculateF` uses five `g1_mulAccC` (handoff said two — source wins);
M2.5's "p−2" modexp constant is actually the base field (timing bench
only); `pk_of` and `primary_key` derive the row key differently (M3
legacy — the unique index is the real enforcer, proven live again);
nodeos was restarted mid-lane by a concurrent seat (trace_api_plugin
added, state survived).

**Then z2 breaks it** (order 2, standing): the attack list lives in
docs/dispatches/HANDOFF-PLONK-PORT.md §8 — every finding cited file+line.
