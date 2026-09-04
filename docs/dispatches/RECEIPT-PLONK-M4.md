# RECEIPT-PLONK-M4 — the PLONK verifier port LANDED (SPEC-PRIVACY-1's last step)

2026-09-04, the port seat. Everything below executed and is reproducible
from `contracts/privacy/` (scripts + circuit + tests) on the WSL rehearsal
chain. SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## The claim, stated exactly

`contracts/privacy/note.cpp`'s `spend_gate` now runs the full nine-phase
PLONK verification (plonk_verify.hpp — ported verbatim, line-cited, from
snarkjs 0.7.6 `templates/verifier_plonk.sol.ejs`) over REAL circuit proofs
(circom 2.2.3 + circomlib Poseidon, snarkjs prover, pot12 one-honest-seat
ceremony — rehearsal labeled). The FLOW is unchanged from M3: deposit →
private transfer → withdraw, bounded sets, nullifier uniqueness, alg ids.
Law row: `alg_proof = 2 = ALG_PROOF_PLONK_V1` (was toy=1; agility preserved).

## Chain receipts (rehearsal chain, CRYPTO_PRIMITIVES active)

- contract `plonknote11`, code hash `1ed34e444bb181dc8ee32c7389ef42c68f41893ac3ee8a49c456dcf4ad356343` TESTNET-ONLY rehearsal deployment
- bare-verify probe `plonkdbg11`: tx `9a2e827cdf788248c834ba2bf80dae3c423310e9364f06abdf6a7921f0b45357` TESTNET-ONLY, blk 12563, billed 9,305 µs, executed
- deposit: tx `f235e310c2ae95534b5176aeea8f340c9e9a4a29bd7216c5bec7778dc8bcec7c` TESTNET-ONLY, executed
- **private transfer, REAL circuit proof: blk 12672, billed 9,132 µs, executed**
- **forged (eval_zw +1): REJECTED — "spend proof REJECTED — plonk pairing false"**
- **replay (same proof + nullifier): tx `fefa5480e57d4c332c423b06d5f51631f9db58fc3a5c92d5adc9e2f7155afb65` TESTNET-ONLY FAILED — nullifier uniqueness constraint (double-spend refused)**
- withdraw, second real proof (tag=2): blk 12676, executed
- tables: nullifiers 2 rows (alg 2), commitments 2 rows (alg 1), law alg_proof=2

## Billing, honestly measured (15 executed verifies)

Low-load cluster: **6,911 / 8,425 / 8,891 / 9,132 / 9,305 / 9,873 / 10,429 µs**
(min 6.9 ms, median ≈ 9.1 ms — in the expected 6–9 ms band at its edge,
tripwire < 15 ms PASSED uncontended). High samples 12,575–18,410 µs are
HOST CONTENTION: a concurrent seat shares this WSL box (jungle4/Vaulta
cleos bursts observed live during the high readings); the identical wasm
billed 6.9–18.4 ms depending on load (the noinline rebuild compiled
byte-identical — the linker had already folded the call sites, so
action-dependence and codegen were ruled out). Contended samples are
labeled, not averaged.

## The test ladder (each layer gated the next; three real bugs caught)

1. `field256.hpp` vs python big-int vectors (`gen_field_vectors.py`):
   **3,217/3,217** — both BN254 fields, edges (0, 1, m−1, m−2, m>>1),
   mul512, oracle mod, Montgomery ctx, f_pow, batch inversion, BE
   round-trip gate. Caught: the batch inversion built q−1 instead of q−2
   (every "inverse" was 1 by Fermat — the BINV vectors refused it).
2. test-rig keccak vs standard vectors: OK (after fixing the ρ-table order
   and a χ row-clobber — test-only code).
3. Scalar phases vs the independent BigInt oracle (`oracle_scalars.js`,
   js-sha3 keccak) over the REAL vk + REAL proof: **23/23** (β, γ, α, α²,
   ξ, βξ, ξⁿ, Zh, v1–v5, u, L1, L2, PI, R₀, d2, d3, E-scalar). Caught:
   `f256_to_be` was the limb-reversed mirror of `f256_from_be` — every
   BE serialization (including every `alt_bn128_mul` scalar) would have
   been wrong on-chain; the limb-swap signature in the first β mismatch
   identified it, and a BE round-trip gate joined the standing tests.
4. On-chain probe (bare `vproof` action, `plonkdbg11`): the point phases
   have no native oracle — the chain is their test. Caught: `pl_g1_neg`
   computed y−qf instead of qf−y (invalid point; the chain's add intrinsic
   refused at "plonk: D+d3"). Fixed; every intrinsic call now carries its
   call-site label for exactly this kind of diagnosis.
5. Full flow acceptance (above).

## Provenance + reproduction

- Circuit `spend.circom`: Poseidon(secret,amount), Poseidon(secret,tag),
  public (commitment, nullifier) — BINDS nullifier↔commitment↔secret;
  membership (merkle root) and conservation remain named future lanes.
- Ceremony: pot12 bn128, ONE honest participant (this seat) — rehearsal
  labeled; `pot12_final` sha256 `fe12ac401eb509f605ad70bfbba186319962a0339c7c1e6984cf959a63ca75ad` TESTNET-ONLY (lives in the WSL lab, burns with its lifecycle).
- vk: `artifacts-m4/vk.json` (decimal; `gen_vk_cpp.js` → `vk_constants.hpp`,
  projective→affine normalized, G2 in EIP-197 word order x_im‖x_re‖y_im‖y_re).
- Prove: `prove.sh` (compile → ceremony → setup → prove → off-chain verify
  → flatten). Acceptance: `m4run.sh`. Native gates: `test_field256.cpp`,
  `test_plonk_native.cpp` (g++ -DPLONK_NATIVE_TEST).
- Divergences from the EVM original, deliberate and labeled in
  `plonk_verify.hpp`: Fermat inversion (batched, one f_pow) instead of
  extended-Euclid — on a non-invertible value EVM reverts early, the port
  computes 0 and the final pairing still refuses (same verdict); no
  mod_exp intrinsic (one fewer aliasing surface).

## Handoff corrections (verified, trust none)

circom was NOT staged (built now, 2.2.3) · the bnrzk wallet did NOT exist
(created) · `calculateF` has FIVE `g1_mulAccC` (handoff said two) · M2.5's
"p−2" modexp constant is actually the base field (timing bench only) ·
`pk_of` vs `primary_key` key-derivation mismatch is M3 legacy (the table's
unique index is the enforcer — proven live by this lane's replay rejection;
left byte-identical per the flow law) · nodeos was restarted mid-lane by a
concurrent seat (trace_api_plugin added; state survived).

## Standing after this

z2.1 holds as ADVERSARIAL REVIEWER (order 2): forged proofs field-by-field,
malformed transcripts, wrong-field edges, replay, aliasing reintroduction,
transcript boundary errors, Lagrange division-by-zero shapes — the attack
list in HANDOFF-PLONK-PORT.md §8. Every finding cited file+line.
