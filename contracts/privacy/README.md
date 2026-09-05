# contracts/privacy — the estate-run privacy layer (Lane: SPEC-PRIVACY-1)

The M9 state: THE X402 ANCHORING SUBSYSTEM — two-tier anchoring +
admit-before-quote lifted from X402-SORT-2026-09-01.md's z2.1 rows (pinout's
mechanisms, estate rails). TIER 1: every settlement (transfer, withdraw)
folds a CHECKPOINT inline (`checkpoint_step` in `note.cpp`) — head' =
keccak(head ‖ keccak(seq ‖ nullifier ‖ fee ‖ feeAsset)), two native
keccaks, atomic with the settlement; nothing ever waits on an anchor (no
action reads the anchors table but `anchor()` itself; there is no deferred
path in the contract). TIER 2: `anchor()` commits ONE bounded row per
anchor — (seq, head), the CHAIN HEAD, never a receipt list — and is
permissionless; it fires only on the batch path (pend ≥ anchor_batch) or
the priority path (accrued ≥ anchor_cost — "priority only when revenue ≥
anchor cost"), else REFUSED. ADMIT-BEFORE-QUOTE: `admit(expected_fee,
expected_asset)` — the seller-solvency gate in front of the quote; pure,
the transaction trace is the receipt; a seller that quoted while admit()
would throw is provably insolvent-at-quote from the public record. The
nullifier rows carry seq + fee legs, so `m9audit.js` recomputes the whole
chain from the nullifiers table alone and checks every anchor commits the
recomputed head. Receipt: SPEC-PRIVACY-1 §m9-receipt; runner `m9run.sh`
(law: anchor_cost=20, anchor_batch=3, anchor_asset=1).

**THE M9 DISPLAY LAW (measured live):** the table hex for a row's
nullifier and the checkpoint head is ALREADY the byte form that flows
through the fold — the stranger's audit uses it RAW (genesis = 32 zero
bytes). The M6 T-compensation lives on the extract()-of-memcpy'd-storage
path INSIDE the contract, not in the table display.

**THE M9 RUNNER TRAP (caught by the ladder):** out-notes are saved in
m7-prev SCHEMA (secretOut/commitmentOut); m7prep spends note SCHEMA —
spending an out-note silently proved against STALE inputs (pairing-false
on a valid chain). The runner now converts schemas before spending and
inserts an out-note into tree.js ONLY when the chain accepted the payment.
(Also: EOSIO account names take a-z1-5 only — an invalid name turns every
later cleos call into "invalid http request", a red herring.)

The M7 state: PER-ASSET CONSERVATION — a note binds (secret, amount,
asset) as Poseidon(secret, Poseidon(amount, asset)); spends are same-asset
only (a cross-asset spend has NO witness — refused at generation); value
balances within the asset; the fee leg (fee + feeAsset, public,
transcript-bound) may be a DIFFERENT asset — the meter's A against a note
earned in b — in which case it does not touch the note's value and settles
outside the shielded balance. One proof per spend: membership (root
contract-computed, no setter) + per-asset conservation + 64-bit range
checks + the index-bound nullifier. Receipts: SPEC-PRIVACY-1 §m7-receipt +
docs/dispatches/RECEIPT-ASSET-M7.md (M6/M5/M4 receipts behind them).

**THE M7 LAW (found live, receipted):** shifting a uint64 by ≥64 is UB —
wasm's i64.shr_u takes the shift MOD 64, which compiled a repeated-byte
fee word that silently desynced the transcript (the pairing refused a
snarkjs-valid proof). Found by dumping the contract's assembled publics
and word-diffing against the proof. `u64_to_be32_word` writes only
shifts ≤ 56. M6's build had lucked into correct codegen — UB that worked
until it didn't.

## The M7 stack

- `payment.circom` — 5 publics (root, nullifier, commitmentOut, fee,
  feeAsset); assetIn === assetOut (the cross-asset refusal); feeFromNote
  = fee·[feeAsset == assetIn] (one product — the circom rule); range
  checks carried over. 13,204 constraints; pot14 reused (universal).
- `m7prep.js` — the witness builder (note <amount> <asset>; payment
  <amountOut> <fee> <feeAsset>; crossasset = the refusal fixture).
- `m7run.sh` — the acceptance pass (two assets, one set; same-asset
  payment each; the meter's cross-asset fee; cross-asset refused at
  witness; forged/replay).
- `note.cpp` — deposit records amount AND asset openly; payment rows keep
  both private (0, labeled); transfer/withdraw carry fee_asset; the
  M6 tree/root machinery unchanged.

## The M6 soundness stack

- `poseidon2.hpp` — circomlib's t=3 Poseidon in C++ over field256
  (constants PARSED from circomlib by `gen_poseidon_cpp.js`, Montgomery
  domain; static-scratch context — the WASM stack rejects 12KB locals).
  Gate: `test_poseidon.cpp` = 68/68 vs circomlibjs before any chain use.
  `tree_zeros.hpp` — the generated depth-20 zero chain.
- `payment.circom` + range checks (Num2Bits(64) on in/out/fee — an
  overflow spend has NO satisfying witness; receipted).
- `note.cpp` — `tree_insert` (Tornado's incremental algorithm) on deposit
  AND transfer (payment notes are spendable leaves); NO root setter in
  the ABI; `t256()` compensates the checksum256 T-law at every storage
  write (extract_as_byte_array returns T(memory) — params survive the
  double-T, stored bytes need pre-compensation; the M1 gotcha mapped
  exactly).
- `m6run.sh` — the acceptance pass (contract-computed root → payment →
  forged/replay/fee-tamper → overflow witness refusal → phantom-leaf
  rejection → withdraw).

## Billing (honest split)

Pure verify (withdraw, no insert): 11,971 µs — tripwire < 15 ms PASSED.
Deposit 29.8 ms / payment 55.8 ms carry the 20-Poseidon insert in WASM
(no native Poseidon intrinsic — precomputed-Montgomery/native lane
named). Contention labels per the M4/M5 law.

## The payment stack (M5)

- `payment.circom` — the statement: membership path + nullifier =
  Poseidon(secret, leaf_index) (index derived in-circuit — one spend per
  leaf) + out-commitment + conservation amountIn = amountOut + fee.
  4 publics (root, nullifier, commitmentOut, fee). Circom rule learned:
  ONE product term per constraint (`a + s·(b−a)`, not `a·(1−s)+b·s`).
- `tree.js` — the off-chain append-only depth-20 Poseidon tree (insert,
  prove, root; zero chain zeros[l]=H(zeros[l-1],zeros[l-1]); bit=1=right
  child; folds exactly LEVELS times — a 1-leaf tree folds with zero
  siblings). Root rolled on-chain by owner `setroot` (rehearsal-labeled).
- `m5prep.js` — witness builder (note creation; payment assembly with the
  conservation pre-check that refuses unbalanced inputs early).
- `m5run.sh` — the acceptance pass (deposit → setroot → PAYMENT →
  forged/replay/fee-tamper refusals → withdraw).
- Ceremony: pot14 bn128, ONE honest participant (universal — per-circuit
  work is only `plonk setup`), rehearsal-labeled until a witnessed
  multi-party sealing is ruled for mainnet.

## The verifier stack (M4, still the engine)

- `field256.hpp` — 4×64-limb modular arithmetic for BN254's two 254-bit
  fields (Montgomery reduction; shift-subtract oracle; Fermat inversion +
  Montgomery-trick batch inversion). Gate: `test_field256.cpp` +
  `gen_field_vectors.py` (python big-int known vectors, 3,217 checks incl.
  a BE round-trip gate). RUN THIS BEFORE TOUCHING ANYTHING ABOVE IT.
- `plonk_verify.hpp` — the nine phases (checkProofData, calculateChallenges,
  calculateLagrange, calculatePI, calculateR0, calculateD, calculateF,
  calculateE, checkPairing), ported verbatim from snarkjs 0.7.6
  `templates/verifier_plonk.sol.ejs` with line cites. Scalar phases run
  natively under `-DPLONK_NATIVE_TEST`; point phases are chain-only (every
  intrinsic call aliasing-proof by construction + call-site labeled).
  Gate: `test_plonk_native.cpp` vs `oracle_scalars.js` (independent BigInt
  oracle) over the REAL vk + proof — 23/23.
- `vk_constants.hpp` — GENERATED by `gen_vk_cpp.js` from the ceremony's
  `vk.json` (projective→affine; G2 EIP-197 word order). Decimal bytes by
  the repo's hex-run law.
- `note.cpp` — the private note contract. FLOW unchanged since M3;
  `spend_gate` = the port. Law row: alg_proof = 2 = ALG_PROOF_PLONK_V1.

## The proving side

- `spend.circom` — the note statement: commitment = Poseidon(secret,amount),
  nullifier = Poseidon(secret,tag), public (commitment, nullifier). Binds
  nullifier↔commitment↔secret; membership (merkle root) + conservation are
  named future lanes, labeled in the circuit header.
- `prove.sh` — compile → pot12 ceremony (ONE honest participant — rehearsal
  labeled) → plonk setup → vk export → witness → prove → off-chain verify →
  flatten. `m4prep.js` computes the Poseidon values (circomlibjs);
  `flatten.js` emits the 24-word calldata (affine asserted).
- `m4run.sh` — the on-chain acceptance pass (deploy → init → deposit →
  transfer(real proof) → forged → replay → withdraw → tables).
- `artifacts-m4/` — vk.json, proof.json, public.json, input.json (decimal
  strings; regenerable hex derivatives stay out by the hex-run law).

## Measured (rehearsal chain, CRYPTO_PRIMITIVES)

Real verify billed 6.9–10.4 ms uncontended (median ≈ 9.1 ms; tripwire
15 ms passed); contended samples up to 18.4 ms are host contention,
labeled in the receipt. Forged proof: rejected by the pairing. Replay:
rejected by nullifier uniqueness.

## M1–M3 history

- `verify_min.cpp` — GENERATED by `gen_verifier.js`: the minimal
  Groth16-shape verifier (M1, billed ≈ 5.0–6.4 ms). `plonk_verify_min.cpp`
  lives in zkbench (M2.5, PLONK op count, median ≈ 6.2 ms). M3's toy
  spend gate is superseded by the port (alg ids keep them distinguishable).
- Toolchain: CDT 4.1.1 (`cdt-cpp -O3 -I. -o note.wasm -abigen note.cpp`),
  Spring v1.2.2 rehearsal chain, bootstrap in SPEC-PRIVACY-1 + zkbench.
