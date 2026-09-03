# HANDOFF — the PLONK verifier port (SPEC-PRIVACY-1, the ruled fork's last step)

For the fresh seat. Everything here was executed and receipted; verify, don't
trust. After this lands, z2 holds as ADVERSARIAL REVIEWER (order 2, standing):
the job is to BREAK the port — forged proofs, malformed transcripts,
wrong-field edge cases, replay. File+function cited in every finding.

## 1 · LAB STATE (Windows laptop → WSL)

- Toolchain (installed, survives WSL restarts): Spring `v1.2.2` (`nodeos`,
  `cleos`, `keosd`) + CDT `4.1.1` (`cdt-cpp`), installed from the .debs in
  `C:\Users\travi\zkbench\`. Node + snarkjs at `/tmp/zk/node_modules` (npm;
  `/tmp` does NOT survive a WSL restart — reinstall snarkjs if gone:
  `npm i snarkjs` in /tmp/zk). `cargo` present (`~/.cargo/bin`).
- Chain state (does NOT survive WSL restart): nodeos producing on
  `127.0.0.1:8888`, data/config at `/tmp/nd/{data,config}`. If dead, boot:

  ```
  nodeos -e -p eosio --plugin eosio::chain_api_plugin --plugin eosio::producer_plugin \
    --plugin eosio::producer_api_plugin --plugin eosio::http_plugin \
    --access-control-allow-origin='*' --http-validate-host=false \
    --http-server-address=127.0.0.1:8888 \
    --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 \
    --data-dir /tmp/nd/data --config-dir /tmp/nd/config
  ```
  (Spring dev WIF derives EOS6MRyAjQ… — NOT the old EOS6MRy39 doc key.)
- Accounts on-chain: `bench` (M1 verifymin, hash 95b5741c…), `plonkbench`
  (M2.5, hash 65c26c20…), `noteacct4` (M3 note.cpp, live flow). Key pair at
  `/tmp/nd/bench.key` (priv pub). Wallet: `bnrzk`, password at
  `/tmp/nd/bnrzk.pw` (root-owned dir; import dev WIF + bench.key).

## 2 · THE BOOTSTRAP LADDER (if the chain is fresh)

`C:\Users\travi\zkbench\bootstrap.sh` runs it all. Manual order:
1. `POST /v1/producer/schedule_protocol_feature_activations` with the
   PREACTIVATE_FEATURE digest `0ec7e080…4053bd` → expect `{"result":"ok"}`.
2. Deploy minibios (`/tmp/zk/minibios.{wasm,abi}`, source in zkbench) to
   `eosio`.
3. Activate CRYPTO_PRIMITIVES — **GOTCHA (an hour of M1's life):** the CDT
   checksum256 action param reaches the intrinsic transformed — reverse the
   bytes, then swap the two 16-byte halves. Send
   `5185eb6a…e464d2` (PUBLIC-CONSTANT: T-of the CRYPTO_PRIMITIVES digest)
   (T-of `6bcb40a2…7cedc`) or fix the reinterpret_cast in minibios.
4. `create account eosio <name> <bench.pub>` — accounts need no staking on
   this chain.
Also: jungle4 is DEAD by founder ruling — do not retry it.

## 3 · WASM-MEMORY LAWS (learned live, twice)

The node's memory preconditions REJECT aliased pointers, throwing
`wasm_exception: pointers not allowed to alias` (`preconditions.hpp:140`):
- both operands of `alt_bn128_add` must be DISTINCT arrays (even if equal);
- `mod_exp` base/exp/mod must be three distinct buffers;
- rule of thumb: every intrinsic call gets its own input and output buffers.

## 4 · WHERE THE TOY CONSTANTS LIVE (the port's swap point)

`contracts/privacy/note.cpp`, in `spend_gate()` (private section), three
`static constexpr` arrays: `G1PT_[64]` (= (1,2)), `NEGPT_[64]` (= (1, p−2)),
`G2PT_[128]` (BN254 G2 generator, EVM word order: x_im‖x_re‖y_im‖y_re).
The pairing product over 4 pairs + one mul + one keccak IS the current spend
gate. **The port replaces exactly these constants and the fixed tuple with
the real vk + the real equation — the FLOW (deposit/transfer/withdraw,
nullifier set, bounds, alg ids) does not change.** Algorithm id law: when
the real proof lands, bump `ALG_PROOF_PLONK_TOY_V1` → `ALG_PROOF_PLONK_V1`
in the law row (crypto-agility — old and new proofs distinguishable).

## 5 · THE EXACT PORT TARGET — snarkjs's PLONK verifier

Source of truth: `node_modules/snarkjs/templates/verifier_plonk.sol.ejs`
(755 lines; identical shape ships as the generated `verifier_plonk.sol`).
Structure — port these phases, names verbatim:

1. `checkProofData()` — field-range checks + curve-membership of proof
   points (`checkPointBelongsToBN128Curve` via ecMul square-root trick).
2. `calculateChallenges()` — Fiat-Shamir: 5 keccaks producing β, γ, ξ
   (line ~302), v, u (line ~360) — transcript buffer 704+32·nPublic bytes.
3. `calculateLagrange()` — L_i evaluation at ξ via an inversion chain.
4. `calculatePI()` — public-input linear combination Σ pubᵢ·Lᵢ.
5. `calculateR0()` — the R₀ residue check term.
6. `calculateD()` — D = C + x·S₂ + c·[S_σ2]₁ + x²·[S_σ3]₁-class assembly
   (multiple `g1_mulAccC`).
7. `calculateF()` — F via two `g1_mulAcc`.
8. `calculateE()` — E = A′ + π_K + x·π_H-class assembly.
9. `checkPairing()` — the FINAL CHECK, a 2-pair product:
   `e( −(u·W_xiw + W_xi)₁ , [X]₂ ) · e( (ξ·W_xi + u·ξ·ω₁·W_xiw + F − E)₁ , [1]₂ ) = 1`
   → ONE `alt_bn128_pair` call over 2 pairs (384-byte buffer).

Intrinsic mapping (all live on the chain, M2.5-measured):
`ecMul→alt_bn128_mul · ecAdd→alt_bn128_add · precompile 8→alt_bn128_pair ·
keccak256→keccak() · expmod/inverse→mod_exp` (a⁻¹ = a^(p−2), distinct buffers).

**The real work is the 256-bit field library.** Solidity gets `mulmod/addmod`
free; CDT has no uint256 — implement 4×64-limb add/sub/mul/mod (schoolbook
mul + Barrett or shift-sub mod; ~150 lines + edge tests against known
vectors). The WASM cost of that arithmetic is bounded by M2.5's measured
overhead factor (~1.65× native) — expect the full port to bill in the
6–9 ms band; if it exceeds 15 ms something is wrong.

## 6 · THE PROVING SIDE (also staged)

`cargo install --git https://github.com/iden3/circom.git circom` (compile
~10 min), `npm i circomjs snarkjs`. Circuit: the note statement — private
(secret, amount) with commitment = H(secret, amount) and nullifier =
H(secret, tag), public (commitment, nullifier); Poseidon from `circomlib`
(circom's poseidon, NOT keccak — in-circuit keccak is enormous). Setup:
`snarkjs powersoftau new bn128 12 pot12_0.ptau` → `contribute` (1 honest
participant = the ceremony, transcript burnable) → `prepare phase2` →
`snarkjs plonk setup circuit.r1cs pot12_final.ptau circuit.zkey` →
`zkey export verificationkey` (THE vk that replaces the toy constants) →
`plonk prove` / `plonk verify`. Wire format: proof = 24 uint256s
(uint256[24] in the Solidity ABI — the C++ action takes them as a bytes
array or 24-field struct).

## 7 · ACCEPTANCE BAR (what "done" means, per the lane's receipt law)

- a real circuit-backed proof verified ON-CHAIN by the ported verifier
  inside note.cpp's spend_gate (billed cpu_usage_us reported, toy→real
  comparison in the spec);
- one FORGED proof rejected (tamper a proof field; the pairing must refuse);
- one REPLAY rejected (nullifier — already proven live, re-prove after port);
- toy-vs-real labeling retired for the proof alg (law row bumped);
- language law: sound by construction / isolated by design — never stronger.

## 8 · THEN z2 BREAKS IT (order 2, standing)

Attack list for the review hold: forged proofs (every field tampered
singly), malformed transcripts (challenge-order inversions, length games),
wrong-field edge cases (values ≥ p, degenerate 0/1 points, infinity
encodings), replay (nullifier + proof reuse), and the port-specific:
aliasing-law violations reintroduced, transcript buffer boundary errors,
Lagrange inversion division-by-zero shapes. Every finding cited file+line.
