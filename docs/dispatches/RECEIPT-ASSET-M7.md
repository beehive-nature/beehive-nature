# RECEIPT-ASSET-M7 — per-asset conservation landed (founder-ruled)

2026-09-04, the z4 seat (wt-z4). Reproducible from `contracts/privacy/`
(payment.circom, m7prep.js, m7run.sh + the M6 verifier stack). SOUND BY
CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## The claim, stated exactly

- A note binds (secret, amount, asset): commitment =
  Poseidon(secret, Poseidon(amount, asset)) — single-asset by
  construction; deposits record amount AND asset openly at the on-ramp;
  payment notes keep both private (row 0/0, labeled).
- `assetIn === assetOut` in-circuit — a cross-asset spend has NO
  satisfying witness (refused at generation; receipted below).
- Value balances within the asset: amountIn = amountOut + feeFromNote,
  feeFromNote = fee·[feeAsset == assetIn]. The fee leg is PUBLIC
  (fee + feeAsset, transcript-bound): in the note's asset it comes out of
  the note; in a DIFFERENT asset (the meter's A vs a note earned in b) it
  leaves the note intact and settles outside the shielded balance.
- Range checks (64-bit) and the contract-computed root carry over
  unchanged — still no root setter anywhere in the ABI.

## Chain receipts (`paynote3333`, code hash `efcff94454c52df1b1094e788c722d5748301d6b8527d1d9ac97999301215ae8` TESTNET-ONLY)

- two-asset deposits into ONE tree: blk 51772 (19,182 µs) + blk 51778
  (18,290 µs); tree next_index 2, commitments record (1000, asset 1) and
  (500, asset 2) openly.
- **PAYMENT 1 — asset-1 note, same-asset fee: blk 51823, 37,831 µs,
  EXECUTED.**
- **PAYMENT 2 — asset-2 (b) note with the meter's leg: fee 3 in ASSET 1
  (a different asset — the note's 500 stays intact in-circuit):
  blk 51873, 41,336 µs, EXECUTED.** The off-chain verify ran OK first
  (snarkjs), then the chain's own pairing accepted.
- **CROSS-ASSET attempt (asset-1 in → asset-2 out): REFUSED AT WITNESS
  GENERATION** — "Assert Failed" at the circuit's assetIn === assetOut
  line. No proof can exist; nothing reaches the chain.
- FORGED (eval_zw +1): REJECTED by the pairing. REPLAY: REJECTED by
  nullifier uniqueness.
- Final: 4 commitments (two open deposits, two private payment notes),
  2 nullifiers (alg 2), tree next_index=4 — every leaf contract-appended.

## The M7 law (found live, the lane's discovery)

Shifting a uint64 by ≥ 64 is undefined behavior; wasm's `i64.shr_u`
applies the shift MOD 64. The fee-word serializer
`(fee >> (8 * (31 - b)))` shifted by up to 248 — the compiled result was
a REPEATED-BYTE word (`0a` at every 8th byte), which entered the publics
and silently desynced the Fiat-Shamir transcript: the on-chain pairing
refused a proof snarkjs accepts, while every scalar matched the oracle
and every constant matched snarkjs's own Solidity export. The hunt:
vk diffed byte-for-byte against `snarkjs zkey export solidityverifier`
(all 13 entries OK) · scalars diffed against snarkjs's OWN internals via
its logger hook (β/γ/ξ/v/u/L — all match) · the intrinsics re-proven on
known vectors (mul/add/pairing incl. a 2-pair identity e(−g1,g2)·e(g1,g2)
= 1 → 0 on a clean probe) — and the kill shot: dumping the contract's
ASSEMBLED PUBLICS and word-diffing them against the proof — word 4 (the
fee) was garbage. `u64_to_be32_word()` writes only shifts ≤ 56, with the
law cited at the site. M6's build had lucked into correct codegen for
the same UB — UB that worked until it didn't.

## Gates (M7 stack, all green)

field256 3,217/3,217 · poseidon2 68/68 vs circomlibjs · keccak vectors ·
scalar phases **26/26** (L5 joins; z2.1 F1's compile-time bound covers
the 5th public) · oracle regenerates byte-identically from the REFRESHED
fixtures (z2.1 F3's set now carries the M7 vk/proof/forged/publics — the
prior set would fail the N_PUBLIC=5 size check).

## Billing

Deposits 18–19 ms; payments 37.8 / 41.3 ms = verify (~12 ms) + the
20-Poseidon insert (unchanged M6 shape; no native Poseidon intrinsic —
named lane). Pure-verify reference: the M6 withdraw at 11,971 µs;
tripwire < 15 ms holds for the verify. Contention labels per the M4/M5
law. Ceremony: pot14, ONE honest participant, rehearsal-labeled until a
witnessed multi-party sealing is ruled for mainnet (founder order
standing).

## Labeled bounds

Asset ids are unbounded field elements this pass (a range-check lane is
named hardening if ids ever carry semantics). The cross-asset fee's
actual settlement in its asset is Lane M's off-chain meter lane — here
it is publicly declared and transcript-bound only. z2.1's remaining
labeled surfaces unchanged (init/deposit auth shape, ceremony label,
WASM insert cost, 64-bit width). Findings land in wt-z4.
