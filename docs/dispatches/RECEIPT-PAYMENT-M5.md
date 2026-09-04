# RECEIPT-PAYMENT-M5 — the private PAYMENT landed (membership + conservation)

2026-09-04, the port seat, founder-ordered lanes 1+2+3. Everything below
executed on the WSL rehearsal chain and is reproducible from
`contracts/privacy/` (payment.circom, tree.js, m5prep.js, m5run.sh + the
M4 verifier stack). SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never
stronger language.

## The claim, stated exactly

One PLONK proof per spend now carries BOTH new properties:

- **MEMBERSHIP** — the spent note's Poseidon commitment is a leaf of the
  depth-20 Poseidon merkle tree whose root lives in the contract's LAW
  ROW (`setroot`, owner-auth, rehearsal-labeled); which leaf stays hidden.
- **CONSERVATION** — amountIn = amountOut + fee with amounts PRIVATE and
  the FEE PUBLIC (Lane M's meter bills the public leg). A withdraw is the
  same proof with the value riding the fee leg (amountOut = 0).
- **NULLIFIER BOUND TO THE LEAF INDEX** — Poseidon(secret, index) with the
  index derived IN-CIRCUIT from the membership path: one spendable
  nullifier per leaf. (The M4 free-tag shape would have allowed one spend
  per tag = inflation; fixed before deployment, before z2 could file it.)
- Ceremony still ONE honest participant (pot14 bn128, universal; only
  `plonk setup` re-runs per circuit) — rehearsal-labeled until a witnessed
  multi-party sealing is ruled for mainnet, per the founder's order.

## Chain receipts (rehearsal chain, notepay2222)

- code hash `af41a5d96764af45b391c54d9daaef1e480d8965eda099a9f9a9bbbf5f0649be` TESTNET-ONLY rehearsal deployment
- deposit tx `8e3c6eb49f88efe16d16db4d0c18a4cdfabfc42a39ef4c7022c735ff3d16c909` TESTNET-ONLY — Poseidon leaf, open on-ramp amount 1000
- setroot executed (owner rolls the tree forward — rehearsal-labeled)
- **THE PRIVATE PAYMENT: blk 21354, executed — membership + conservation in one proof** (sample billed 18,277 µs = the documented host-contention pattern; see billing below)
- FORGED (eval_zw +1): **REJECTED — "payment proof REJECTED — plonk pairing false"**
- REPLAY (same proof + nullifier): **REJECTED — nullifier uniqueness constraint**
- FEE-TAMPER (action claims fee 11, proof proves 10): **REJECTED — the pairing** (publics are transcript-bound; an unbalanced claim cannot verify)
- UNBALANCED INPUT (amountIn 1000 vs 991+10): **no witness exists** — the circuit's conservation constraint refuses at witness generation ("Assert Failed"), receipted in the lane log
- WITHDRAW of the payment's output note (amountOut=0, fee=990): blk 21415, executed, 9,743 µs
- final law row: alg_commit=2 (poseidon-bn254-v1), alg_proof=2, root present; commitments carry amounts 1000 (deposit, open) / 0 (payment note, PRIVATE)

## Billing, honestly measured

Executed payment verifies: **8,769 / 9,743 (withdraw) / 11,620 / 12,139 µs
— clean cluster, median ≈ 10.7 ms, tripwire < 15 ms PASSED uncontended**
(the honest rise over M4's ≈ 9.1 ms: 4 publics + the deeper Lagrange
batch). One contended sample at 18,277 µs carries the documented
host-contention label (a concurrent founder-ordered seat shares the WSL
box; identical gate code billed 8.8–18.3 µs-band across the lane —
labeled, not averaged).

## The gates this lane ran (and what they caught)

- field256: 3,217/3,217 (unchanged), payment scalar phases vs the BigInt
  oracle: **25/25** over the real payment proof.
- tree.js fold bug: a 1-leaf tree returned the LEAF as its root (loops
  stopped at one node instead of folding all 20 levels with zero
  siblings) — caught by inspection before any witness burned; fixed with
  an invariant check (nodes.length===1 after exactly LEVELS folds).
- circom 2.2.3 quadratic rule: ONE product term per constraint — the
  classic sibling mux `a·(1−s) + b·s` is rejected; `a + s·(b−a)` is the
  legal equivalent (verified by minimal repro before rewriting).
- EOSIO `law.get()` vs `law.find()`: modify-on-a-reference threw "object
  passed to modify is not in multi_index" LIVE on setroot — fixed,
  redeployed, re-run clean.
- cdt-cpp derives the expected contract class from the OUTPUT wasm
  filename (note5.wasm vs [[eosio::contract("note")]] → codegen warning).

## Reproduction

```
# proving side (WSL ~/plonkport, NODE_PATH=…/node_modules):
circom payment.circom --r1cs --wasm -l node_modules -o .
snarkjs powersoftau new bn128 14 pot14_0000.ptau
echo <entropy> | snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau
snarkjs plonk setup payment.r1cs pot14_final.ptau payment.zkey
snarkjs zkey export verificationkey payment.zkey vk5.json
node gen_vk_cpp.js vk5.json vk_constants.hpp
node m5prep.js note 1000 && node tree.js insert <c1> && node m5prep.js payment 990 10
node payment_js/generate_witness.js … && snarkjs plonk prove … && snarkjs plonk verify …
node flatten.js proof5.json public5.json > calldata5.json
# native gates: g++ -DPLONK_NATIVE_TEST test_plonk_native.cpp (25/25 vs oracle_scalars.js)
# chain: cdt-cpp -O3 -I. -o note.wasm -abigen note.cpp && A=notepayNNNN bash m5run.sh
```

## Labeled bounds + named future lanes

Root maintenance is owner `setroot` (rehearsal; a sequencer or on-chain
incremental tree is the named lane) — a governance surface z2 should
probe. Amounts are unbounded field elements (no range-check circuit —
named hardening). Deposit amounts stay open (the on-ramp). The ceremony
stays one-participant until a witnessed multi-party sealing is ruled.
z2.1's hold now includes: membership-path forgery shapes, the
index/nullifier binding, root rollback, fee-leg claims, plus the M4 list
(HANDOFF-PLONK-PORT §8). Findings land in this tree.
