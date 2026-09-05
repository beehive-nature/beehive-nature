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

## §m3.5-receipt — M3 LIVE ON JUNGLE4 (2026-09-04, the 24h window)

Account `notelab11111` (created from bnrapolltest per founder order; RAM via
bnrvrfy3.gm; every transaction paid by the first-authorizer sponsor pattern —
see HANDOFF §2). Explorer links in the FOUNDER-RULED format, each rendered
headlessly with the action row READ BACK before issuing (the monitor's router
answers its search box; a cold deep-load needs the search entered once):

- init — monitor.jungletestnet.io/#accountActions:b31a1efddd4b660392971bbe8faf63868576b60439634b5cf39bea2d55051fc7 <!-- PUBLIC-CONSTANT: jungle4 tx id --> · 540 µs
- deposit — monitor.jungletestnet.io/#accountActions:6a7ed2ba0137aa1a84d3fad3b7064aa558b1c2712a793ed2abed73986ecbee29 <!-- PUBLIC-CONSTANT: jungle4 tx id --> · 533 µs
- **private transfer — monitor.jungletestnet.io/#accountActions:3cd367ffe35bd2d902213afe9d18686c9365ee2bb77113b41451543b2cdedcd6 <!-- PUBLIC-CONSTANT: jungle4 tx id --> · 5,654 µs**
- withdraw — monitor.jungletestnet.io/#accountActions:fb9e615541a771ac3be931cbfdfc2d27d63f207c446729ada4fd75a41b1c7876 <!-- PUBLIC-CONSTANT: jungle4 tx id --> · 4,523 µs

The forged replay (reuse of the transfer's nullifier) was REJECTED — and the
5.6 ms pairing path ran FIRST, so the double-spend gate refused a fully
proof-shaped spend. (eosq links from the earlier receipt are RETIRED with the
explorer; the 8326cbb7 "init" was a phantom of a mislabeled status parse —
the monitor's refusal to render it exposed the mislabel; b31a1efd is the one
true init, and the law table's single row now agrees with it.)

## §m5-receipt — the private PAYMENT (membership + conservation, 2026-09-04, founder-ordered)

The two M5 lanes landed as ONE proof per spend (`payment.circom`): the spend
now proves MEMBERSHIP of the spent note in the law row's depth-20 Poseidon
merkle tree AND CONSERVATION (amountIn = amountOut + fee, amounts private,
fee public — the meter's leg). A withdraw is the same proof with the value
riding the public fee leg. The nine-phase verifier is unchanged except
N_PUBLIC 2→4 (transcript, PI loop, and the Lagrange batch generalized;
scalar phases re-verified **25/25** against the BigInt oracle over the real
payment proof; field gates unchanged at 3,217/3,217).

**Soundness fix made BEFORE z2 could file it:** the M4 nullifier was
Poseidon(secret, tag) with tag a FREE input — one spendable nullifier per
tag = inflation once membership became real. The nullifier is now
Poseidon(secret, leaf_index) with the index DERIVED IN-CIRCUIT from the
membership path (Σ pathIndices[i]·2^i) — exactly one spendable nullifier
per leaf, cryptographically enforced (payment.circom, NULLIFIER section).

**On-chain acceptance (`notepay2222`, code hash `af41a5d9…0649be`,
runner `m5run.sh`):**
- deposit (Poseidon leaf, open on-ramp amount) → executed;
- setroot (owner rolls the tree forward — REHEARSAL-labeled) → executed;
- **THE PRIVATE PAYMENT: one proof carrying membership + conservation →
  executed** (blk 21354);
- FORGED (eval_zw +1) → REJECTED by the pairing;
- REPLAY (same proof + nullifier) → REJECTED by nullifier uniqueness;
- FEE-TAMPER (action claims fee 11, proof proves 10) → REJECTED by the
  pairing — the publics are transcript-bound, so an unbalanced CLAIM
  cannot verify; and a genuinely unbalanced input cannot even produce a
  witness (circuit Assert Failed off-chain, receipted in the dispatch);
- WITHDRAW of the payment's output note (amountOut=0, fee=990) → executed
  (blk 21415, 9,743 µs);
- law row: alg_commit = 2 = poseidon-bn254-v1 (the tree is defined over
  circuit commitments; keccak deposits retired for new rows, old rows
  distinguishable), alg_proof = 2, root present; commitment rows carry
  amounts 1000 (deposit, open) and 0 (payment note, PRIVATE — the value
  lives only in the note).

**Billing:** clean samples **8,769 / 9,743 / 11,620 / 12,139 µs** (median
≈ 10.7 ms — slightly above M4's ≈ 9.1, the honest cost of 4 publics and
the deeper Lagrange batch; tripwire < 15 ms PASSED uncontended). The
headline payment's 18,277 µs sample is the documented host-contention
pattern (concurrent seat on the shared WSL box; identical gate code billed
both 8.8 and 18.3 ms across the lane — labeled, not averaged).

**Ceremony:** pot14 bn128 (universal — the pot12→pot14 growth carries
13,872 constraints; the powersoftau itself is circuit-independent, only
`plonk setup` re-ran after the nullifier fix), still ONE honest
participant, rehearsal-labeled per the founder's order until a witnessed
multi-party sealing is ruled for mainnet; `pot14_final` sha
`537e9188550ee0864cb94fa3a182b360a866fc391e257908aeb7c0346b9d39bb` TESTNET-ONLY
(WSL lab lifecycle). Circuit: 5,649 non-linear constraints; 4 publics
(root, nullifier, commitmentOut, fee); depth 20 (≤ the bounded-rows law,
max_notes checked ≤ 2^20 at init).

**Labeled bounds (unchanged honesty):** the tree is maintained off-chain
(tree.js), the root rolled by owner `setroot` — a sequencer/on-chain
derivation is a named future lane; amounts are unbounded field elements
(no range-check circuit — named hardening); deposit amounts stay open
(the on-ramp).

**This lane's caught bugs (the ladder again):** tree.js returned the LEAF
as the root of a 1-leaf tree (fold loops stopped at one node instead of
folding through all 20 levels with zero siblings — caught before it burned
a witness); circom 2.2.3 allows ONE product term per constraint (the
classic two-bilinear mux must be rewritten as `a + s·(b−a)`); EOSIO
`law.get()` returns a reference, `modify` needs `find()` (setroot failed
live, fixed, redeployed); and the output wasm filename must match the
contract class name (cdt-cpp codegen).

**Standing:** z2.1's adversarial hold now covers the payment statement —
membership-path forgery shapes, index/nullifier binding, root-rollback
(setroot is owner-auth — a governance surface, labeled), fee-leg claims,
and the M4 list (HANDOFF-PLONK-PORT §8). Its findings land in this tree.

## §m6-receipt — SOUNDNESS: on-chain root + range checks (2026-09-04, founder-ordered)

The two labels promoted from hardening to soundness landed:

**1 · RANGE CHECKS.** Every amount (in, out, fee) is decomposed to 64 bits
in-circuit (`Num2Bits(64)` ×3, +192 constraints; 12,166 total, pot14
reused — the ceremony is universal). Conservation can no longer wrap mod p:
the receipt is an "overflow" spend (amountIn = 2^64, out = 2^64−10, fee =
10 — integers that BALANCE exactly) **refused at witness generation**
(circuit Assert Failed: the range check has no satisfying witness for
2^64).

**2 · ON-CHAIN INCREMENTAL MERKLE — setroot DELETED.** The contract appends
leaves and computes the root itself: `tree_insert` runs Tornado's
incremental algorithm over `poseidon2.hpp` — the circomlib t=3 Poseidon in
C++ over field256, constants PARSED from circomlib's own
poseidon_constants.circom (never retyped) and kept in Montgomery form; a
fixed-address static scratch carries the 12KB context (the WASM stack
rejects it), re-initialized per action. Deposit inserts its leaf; transfer
inserts the payment's out-note (a note created by payment is spendable);
**the ABI has no root setter** — root-rollback is structurally impossible.

**The T law, mapped exactly (this lane's discovery):** CDT's
`checksum256::extract_as_byte_array()` returns T(memory bytes) where T =
reverse-then-swap-16-byte-halves (an involution). Action params survive
(decode writes T, extract applies T again → identity), but bytes written
by `memcpy` come back transformed — the M4/M5 gates worked because they
assembled publics from PARAMS; M6's gate reads the root from STORAGE and
initially fed the pairing T(root). The evidence chain that pinned it: the
bare probe accepted (params), the payment rejected (stored root),
T(display) == proof root (involution), and after storing roots
pre-transformed the payment EXECUTED. The M1-era gotcha now has its exact
mechanism; `t256()` compensates at every storage write.

**On-chain acceptance (`paynote1111`, code hash `99aba03e…006136`,
runner `m6run.sh`):**
- init: the law row displays the RAW empty root (2134e7… — the T
  compensation visible in the display itself);
- **deposit: the CONTRACT computed the root** — and the payment proven
  against it EXECUTED (the three-way agreement chain — contract root ==
  tree.js root == proof root — is proven by execution, the strongest
  cross-check; the display-level comparison also passes post-fix);
- **THE PAYMENT executed** (blk 40553) — membership + conservation +
  range checks + the index-bound nullifier in one proof;
- FORGED / REPLAY / FEE-TAMPER: all REJECTED (pairing / uniqueness /
  transcript-bound publics);
- **OVERFLOW: refused at witness generation**;
- **PHANTOM-LEAF: rejected with nowhere to land** — a REAL note commitment
  (P(777, 1000)), inserted only into the off-chain tree, proven honestly
  for that root (off-chain verify OK!), and refused on-chain because the
  contract's tree never contained it (its root was never the chain's);
- WITHDRAW of the payment's out-note (leaf 1 of the CONTRACT's tree)
  executed — proving the out-note-insert design end to end.

**Billing, honestly split:** the pure VERIFY bill = **11,971 µs** (the
withdraw carries no insert — in band with M5's ≈ 10.7 ms; tripwire
< 15 ms PASSED). Deposit = 29,837 µs and the payment action = 55,835 µs
because they now carry the 20-Poseidon insert (~12k Montgomery muls in
WASM — no native Poseidon intrinsic exists; a precomputed-Montgomery /
native lane is named). Contention on the shared WSL box still inflates
samples (the documented M4/M5 pattern; labeled, not averaged).

**Gates this lane added:** poseidon2 vs circomlibjs on 66 vectors + 2
structural zero-chain checks = **68/68 BEFORE any chain use**; the M5
oracle suite re-ran 25/25 against the range-check circuit's vk.

**z2.1 coordination (per the founder's order):** root-rollback and
index-binding were on its list — both are now closed BY CONSTRUCTION:
there is no setter (deleted from the ABI; the root only advances via
deposit/transfer inserts), and the nullifier is bound to the path-derived
leaf index (M5). Its review should say so; the remaining honest surfaces
it may still probe are labeled: the owner-auth on init/deposit flow
(governance), the one-participant ceremony label, and the WASM insert
cost. Findings land in this tree.

## §m7-receipt — PER-ASSET CONSERVATION (2026-09-04, founder-ruled: the pool holds many assets and b is never gas)

**The statement (payment.circom, 5 publics: root, nullifier,
commitmentOut, fee, feeAsset):** a note binds (secret, amount, asset) as
commitment = Poseidon(secret, Poseidon(amount, asset)) — single-asset by
construction, and the tree hashing stays on the proven t=3 Poseidon
everywhere. `assetIn === assetOut` in-circuit: **a cross-asset spend has
NO satisfying witness** (receipted: Assert Failed at the asset line).
Value balances within the asset: amountIn = amountOut + feeFromNote where
feeFromNote = fee·[feeAsset == assetIn] — the fee counts against the note
only in its own asset; a fee in a DIFFERENT asset (the meter's A against
a note earned in b) leaves the note intact and settles publicly, outside
the shielded balance. Range checks and the contract-computed root carry
over unchanged (still no setter; every leaf contract-appended).

**On-chain acceptance (`paynote3333`, code hash `efcff944…15ae8`,
runner `m7run.sh`):**
- TWO ASSETS, ONE SET: deposits 1000/asset-1 and 500/asset-2 into the
  same tree (18–19 ms each, assets recorded openly at the on-ramp);
- **payment 1 (asset-1 note, same-asset fee 10): EXECUTED, 37,831 µs**
  (blk 51823);
- **payment 2 (asset-2 b-note, fee 3 in asset 1 — the meter's
  cross-asset leg, note value intact at 500): EXECUTED, 41,336 µs**
  (blk 51873);
- **cross-asset attempt (asset-1 in → asset-2 out): REFUSED AT WITNESS
  GENERATION** (the circuit's asset assert — no witness exists);
- FORGED (eval_zw +1) REJECTED by the pairing; REPLAY REJECTED by
  nullifier uniqueness;
- final tables: 4 commitments (deposits open: 1000/1, 500/2; payment
  notes private: 0/0 labeled), nullifiers 2 (alg 2), tree next_index=4 —
  every leaf appended by the contract itself.

**The M7 law, found live (the lane's discovery):** shifting a uint64 by
≥64 is undefined behavior — wasm's `i64.shr_u` takes the shift MOD 64,
which compiled a REPEATED-BYTE fee word (0a at every 8th byte) into the
publics, silently desyncing the whole Fiat-Shamir transcript: the pairing
refused a snarkjs-valid proof while every scalar matched the oracle (the
oracle fed the same UB-free values) and every constant verified against
snarkjs's own exports. Found by DUMPING the contract's assembled publics
and word-diffing them against the proof — the mismatched word was the
fee. `u64_to_be32_word()` now writes only shifts ≤ 56. M6's build had
lucked into correct codegen for the same UB — UB that worked until it
didn't; the fix is law, the comment cites it at the site.

**Gates (all re-run on the M7 stack):** field 3,217/3,217 · poseidon2
68/68 vs circomlibjs · keccak vectors OK · scalar phases 26/26 (L5 joins
the batch; F1's compile-time bound covers the 5th public) · the oracle
regenerates byte-identically from the refreshed fixtures (z2.1 F3's set
now carries the M7 vk/proof/forged — the old set would fail the
N_PUBLIC=5 size check).

**Billing:** deposits 18–19 ms, payments 37.8/41.3 ms (verify ~12 ms +
the 20-Poseidon insert — unchanged shape from M6; the pure-verify
reference stays the M6 withdraw at 11,971 µs; tripwire < 15 ms holds for
the verify). Ceremony unchanged: pot14, one honest participant,
rehearsal-labeled until a witnessed multi-party sealing is ruled.

**Labeled bounds:** asset ids are unbounded field elements (a
range-check lane is named hardening if ids ever carry semantics); the
cross-asset FEE is enforced in-circuit only in its "counts or not" role —
its actual settlement in the fee asset is the meter's off-chain lane
(Lane M), publicly declared and transcript-bound here.

## §m8-receipt — THE INSERT LEVER (2026-09-05, founder-ordered: target clean payment < 20 ms)

**Step 1 · CHEAP FIRST (landed):** `gen_poseidon_cpp.js` now emits the
round constants PRE-CONVERTED to Montgomery form as u256 limb literals —
the per-call conversion loop (384 mont-muls + parses per insert) is gone,
`poseidon2_ctx` is the bare field context, and the WASM shrank
102.2 KB → 99.6 KB. Gates re-run green: poseidon2 68/68 vs circomlibjs
(Montgomery-baked constants), field 3,217/3,217, six-leaf canonical
battery 6/6.
**Measured before → after (quiet box, three each):** deposits
30.0/21.5/29.7 → 38.3/25.9/31.7 ms; payments 35.8/38.1/42.2 →
51.6/36.6/34.9 ms. **Within the contention-noise band — the theoretical
~3% did not survive measurement.** The honest conclusion: the WASM hash
work itself is the floor — 20 hashes × ~600 Montgomery muls ≈ 12k muls
per insert ≈ 21–24 ms at the measured ~1.7 µs/mul WASM cost (consistent
with M2.5's overhead factor). Copy/allocation removal beyond this is
noise; the remaining per-insert bytes are the 20 field writes and the
row read+write, not temporaries.

**Step 2 · the decision, with the numbers.** Clean payment after step 1
is ~35 ms = verify 11.6 + insert ~21–24 + DB writes. The two roads:

- **Batching** (queue N leaves, fold once per N): keeps the tree canonical
  (the batch's subtree is the canonical subtree of those leaves); the
  amortized hash count is (N−1 + 20−log₂N)/N per leaf — N=8 gives ~3
  hashes/leaf ≈ 4–5 ms insert → projected payment ≈ 19–21 ms. That is AT
  the target's edge, INSIDE the contention-noise band, and it costs: a
  queue table + flush path on the hottest soundness-critical surface,
  partial-batch edge cases for z2.1 to attack, and deposits that are not
  spendable until a batch closes (latency by design).
- **Native intrinsic** (host-function Poseidon alongside alt_bn128_*):
  insert cost → microseconds; projected payment ≈ 14–15 ms with ZERO
  semantic change to the tree, the witness, or the proofs. This is a
  protocol-level change (a Spring/Vaulta host function) — outside this
  lane's power to ship, exactly like alt_bn128_* was before Vaulta
  shipped it.

**RULING BY THIS SEAT: the native Poseidon intrinsic is the named future
lane; batching is NOT shipped.** The numbers say batching buys a number
that sits inside the noise band at the cost of a queue's worth of
soundness surface and spendability latency — a bad trade for a rehearsal
chain whose next real step (mainnet) wants the host function anyway. The
verify stays 11.6 ms; the 15 ms tripwire keeps guarding it; payments
stay ~35 ms until the intrinsic lands, labeled exactly.

**The standing battery:** `tree6-check.sh` — six known leaves through the
CONTRACT's own tree, every root asserted against tree.js's canonical
fold. It caught the M7 TREE LAW live; it runs on every future tree change
(founder order: forever). The probe sources (`treedbg.cpp`) are committed
beside it.

## §m9-receipt — THE X402 ANCHORING (2026-09-05, dispatched: two-tier anchoring + admit-before-quote)

The z2.1 rows of X402-SORT-2026-09-01.md, lifted as mechanisms onto the M7
contract (pinout's shapes, the estate's rails; code cited file+function):

**TIER 1 — CHECKPOINTS (pinout session.mjs:doSettle / ledger.mjs).** Every
settlement (transfer AND withdraw — payment_gate → checkpoint_step in
`note.cpp`) folds the checkpoint chain INLINE: link = keccak(seq ‖
nullifier ‖ fee ‖ feeAsset); head' = keccak(head ‖ link); genesis = 32
zero bytes. Two native keccaks — the settlement and its checkpoint land in
ONE action. **Refunds never wait for an anchor:** no action reads the
anchors table but `anchor()` itself, and the contract has no deferred path
anywhere (the refund-shaped leg — withdraw — executes fully in its own
action, receipted below at 9,349 µs).

**TIER 2 — ANCHORS (pinout ledger.mjs: the anchor binds the checkpoint
chain head, sequence_number + running_hash).** `anchor()` appends ONE
bounded row — {id, seq, head, at, alg} — committing the CHAIN HEAD, never
a receipt list; max_anchors bounds the table (bounded-rows law).
PERMISSIONLESS (any stranger may anchor what they paid for); the two
justified paths are the entire anti-spam story, per pinout doSettle:
batch path (pend ≥ anchor_batch — amortized) or priority path (accrued ≥
anchor_cost — "priority only when revenue ≥ anchor cost"). An anchor with
nothing new, or one the revenue cannot justify, is REFUSED. The cost is
deducted from accrued revenue when covered; a batch-path deficit is
forgiven (REHEARSAL label: no token rails — accrued is a counter, the
row-level truth is the receipt).

**ADMIT-BEFORE-QUOTE (pinout guards.mjs:sellerSolvency → z2.1).**
`admit(expected_fee, expected_asset)` — the solvency gate IN FRONT of the
quote: refuses new metered business the seller cannot afford to anchor
(discharge either by projected revenue ≥ anchor_cost or by the session
completing the batch). PURE — no state; the transaction trace IS the
receipt. Honest bound: the quote itself is off-chain (Lane M), so the gate
cannot FORCE the quoter to call it — but a seller that quoted while
admit() would throw is PROVABLY insolvent-at-quote from the public record
alone. The punishment lane is the raid's bonded-dispute row (Tally
anchor.ts:postDispute → "a dispute costs a bond") — NAMED NEXT, not built
here.

**METER-REVENUE LEG:** `accrued` counts only transfer fees in the law's
anchor_asset; a withdraw's fee leg is VALUE-OUT, not a meter cut (M5 law)
— withdrawals checkpoint but never accrue. Nullifier rows now carry seq +
fee + fee_asset, so the audit recomputes the chain from the nullifiers
table alone — no history plugin, the chain's own tables suffice.

**On-chain acceptance (`anchornote2`, code hash 754bf974…dc285af90,
runner `m9run.sh`, law anchor_cost=20 / anchor_batch=3 / anchor_asset=1):**
- ADMIT(5,1) REFUSED — "seller cannot afford its own anchor (revenue <
  cost and the session does not complete a batch)"; ADMIT(25,1) executed
  (251 µs) — the quote gate passes only when solvent;
- deposits — checkpoint UNTOUCHED (seq 0, the on-ramp is not a
  settlement);
- payment 1 (fee 25) → seq 1, pend 1, accrued 25;
- **ANCHOR fires on the PRIORITY path** (accrued 25 ≥ 20, batch 1 < 3) —
  230 µs, accrued → 5 (cost deducted);
- payments 2–3 (fees 3, 4) → accrued 12, pend 2;
- **ANCHOR REFUSED** — "batch not full and revenue below anchor cost
  (deferred)" — no premature anchor the revenue cannot justify;
- WITHDRAW (fee leg 497 = value-out) → seq 4, pend 3, accrued UNCHANGED;
- **ANCHOR fires on the BATCH path** (pend 3 ≥ 3) — 286 µs, deficit 12 <
  20 → 0 (forgiven, labeled);
- **THE STRANGER'S AUDIT (m9audit.js): recomputed the chain from the
  nullifiers table alone — anchor 1 (seq 1), anchor 2 (seq 4), and the
  singleton head all MATCH. AUDIT PASS.**

**Billing:** admit 251 µs · anchors 230–286 µs (two table rows) ·
withdraw 9,349 µs (verify + checkpoint, no insert — in band with the M6
pure-verify 11,971 µs reference) · payments 32,948–45,884 µs (verify +
the 20-Poseidon insert — the M8 shape unchanged; the checkpoint adds two
native keccaks, inside noise). The tree is UNTOUCHED by M9 (no tree
change → tree6-check not re-triggered; contract/tree.js agreement
re-proven live anyway: the 4-leaf chain root equals tree.js's fold,
printed side by side in the run).

**The M9 DISPLAY LAW (found live):** the table hex for a row's nullifier
and the checkpoint head is ALREADY the byte form that flows through the
fold — m9audit.js uses it raw (genesis zeros). The M6 T-compensation
lives on the extract()-of-memcpy'd-storage path INSIDE the contract, not
in the table display; the audit was written T-compensating first and the
mismatch (measured, variant-tested: raw-vs-T × zero-genesis-vs-T-zero →
matchRaw) pinned the law.

**Runner traps caught by the ladder (banked):** (1) out-notes are saved
in m7-prev SCHEMA (secretOut/commitmentOut) while m7prep spends note
SCHEMA — spending an out-note silently proved against STALE inputs
(pairing-false against a healthy chain); m9run.sh converts schemas before
spending and inserts the out-note into tree.js ONLY when the chain
accepted the payment. (2) EOSIO account names take a-z1-5 only — an
invalid name (paynote8888) makes every later cleos call die as "invalid
http request", a red herring. (3) A stale account (paynote5555, an M8-era
measurement deploy) carries old-format table rows that fail unpack —
fresh account per milestone, the lane's standing pattern.

## §m10-receipt — THE BONDED DISPUTE (2026-09-05, dispatched: the third z2.1 raid row)

Tally's row (X402-SORT-2026-09-01: `anchor.ts:postDispute` → z2.1 — "a
dispute costs a bond — spam-resistant by fee, not by moderator"), lifted
onto the M9 anchoring:

**THE MECHANISM (note.cpp, cited per the law).** `postbond(owner,
amount)` — the challenger's escrow row, authed by the challenger only.
`challenge(anchor_id, challenger)` — authed by the challenger; the
CONTRACT adjudicates BY RECOMPUTATION ALONE (`fold_chain_at`): it folds
the checkpoint chain from the nullifiers table up to the anchor's seq
(the same link formula as `checkpoint_step`; a density guard refuses a
gappy table) and compares against the committed head:
- **VALID (recomputed ≠ committed):** the anchorer's accrued revenue is
  SLASHED to the challenger — payouts row += bond + accrued (the bond
  returns; the slash is the punishment), accrued → 0;
- **INVALID (recomputed == committed):** the bond is FORFEITED to the
  anchorer (accrued += bond).
ONE dispute per anchor, ever — the disputes row settles it permanently.
Window: law.dispute_window BLOCKS (converted by law.block_ms — see the
clock note). **NO ADMIN anywhere:** the only auths in the whole dispute
path are the challenger's own on postbond/challenge; nobody moderates —
the recomputation is the judge. Bounded transitively: disputes ≤ anchors,
payouts ≤ distinct challengers, escrow is per-challenger.

**THE CLOCK DEVIATION, receipted:** the dispatch ordered the window in
blocks; this node's eos-vm REJECTS the `get_block_num` host import (the
set-code validation error `{"module":"env","fn":"get_block_num"}` is the
receipt), so the window keeps its ordered BLOCK unit and converts by the
law's declared cadence (block_ms=500 on the rehearsal chain) onto the
block TIMESTAMP — the clock this chain does provide.

**On-chain acceptance (m10run.sh; law 20/3/1/64 + bond 15 / window 40
blocks / 500 ms):**
- INSTANCE A (the DEFAULT build — what ships; `disputenote2`, code hash
  c40e1165…): ladder → anchor 1 (accrued 5); **INVALID challenge inside
  the window → bond FORFEITED: accrued 5+15 = 20**, escrow drained,
  disputes row valid=0; ladder to seq 4; batch anchor (accrued 27 → 7);
  **THE STRANGER'S AUDIT STILL PASS** (the dispute path touches no chain
  data — anchors 1,2 + singleton heads recompute MATCH); double-dispute
  REFUSED ("settled forever"); no-bond REFUSED; post-window challenge
  REFUSED ("dispute window closed — the anchor is final"; 22 s sleep).
- INSTANCE B (the `-DM10_PROBE` build — the ATTACK FIXTURE, treedbg law:
  `badanchor(seq, false_head)` exists ONLY in probe builds; the shipped
  default wasm has no such action and a different code hash, 04c02dee…):
  ladder to seq 2 (accrued 8); badanchor commits a LYING head (abab…);
  **VALID challenge → SLASH: accrued 8 → 0, disputes valid=1 slashed=8,
  payouts challnote111 = 23 (bond 15 + slash 8)**.

**Billing:** postbond 219–287 µs · challenge 256 µs (invalid, 1-nullifier
recompute) / 273 µs (valid, 2-nullifier recompute) · the on-chain fold is
O(n) keccaks over nullifiers ≤ seq — rehearsal scale, the bound labeled
(an invalid challenge at seq n re-folds the whole prefix; a real-scale
lane wants the recomputation inside a claimed-prefix + witness shape —
NAMED, not built).

**Honest bounds:** on the DEFAULT build an anchor row can only carry a
head the contract itself computed (anchor() copies the live singleton),
so the VALID path cannot fire from the honest action set — the probe
build is the exercise of the lying-anchorer state the machinery exists
to punish (the guard is not dead code in the class: any future
attestation-shaped anchor, migration, or bug lands exactly here). The
bond escrow and payouts are rehearsal COUNTERS (no token rails; the
meter's off-chain lane settles real value against them — M5's labeled
pattern).
