# ADVERSARIAL REVIEW — z2 seat, tranche 1 (field256 + plonk_verify + the payment gate)

Target: the z4.1 PLONK port as landed (@766cce3 → current main @b37f451).
Method: full read of `field256.hpp` (263 lines) and `plonk_verify.hpp` (410
lines) with the standing attack list; `payment_gate` in note.cpp; independent
re-execution of the native gates where fixtures survive. Every finding cites
file + line. Severity honest. **Net: what's deployed HELD. Two latent items
filed, both non-exploitable at the current vk.**

## HELD (attacked, not broken — evidence cited)

- **H1 · wrong-field edge case:** `plonk_verify.hpp` phase 1
  (`plonk_checkProofData`, template l.215-254) checks all 9 proof POINTS on
  the curve (y² = x³+3 over the base field) AND all 24 proof words against
  the SCALAR field q before any `f_mul` consumes them — the `< m` Montgomery
  precondition cannot be violated by a malformed proof. Note: checking point
  words against q rather than qf is template-faithful and merely stricter
  (false-reject probability ≈ 2⁻⁹⁵; no security effect).
- **H2 · aliasing law:** every intrinsic call site inspected. The subtle
  case — `pl_g1_mul(d4, d4, zh)` in `calculateD` with r == p — is safe: the
  intrinsic consumes p into a LOCAL out buffer before the memcpy to r
  (`plonk_verify.hpp:250-257`). `pl_g1_add` copies on pointer equality
  (`:258-265`).
- **H3 · transcript:** all five keccak inputs assembled byte-exact per the
  template's line-cited layouts (`calculateChallenges`, l.69-131); challenges
  reduced via `f_mod` (`pl_kec_sf`, :61-67). Publics bind: root is
  CONTRACT-AUTHORITATIVE (read from the law row in `payment_gate`,
  note.cpp:315-321 — a caller cannot feed a stale root), nullifier +
  out-commitment + fee ride the hashed publics. An attacker controls proof
  and action args but not the transcript.
- **H4 · pairing signs and shape:** A1 = −(u·W_xiw + W_xi) vs [X]₂;
  B1 = ξ·W_xi + u·ξ·ω·W_xiw + F − E vs [1]₂ (`checkPairing`, :357-385) —
  matches the template's exact construction (l.692-734, read at source).
  calculateF carries the FIVE mulAcc terms (v1·A + v2·B + v3·C + v4·[S1] +
  v5·[S2], :345-355) per the port seat's own correction of the handoff.
- **H5 · the port seat's three ladder-caught bugs stay fixed:** m−2 Fermat
  exponent (`field256.hpp:235`), `f256_to_be` limb mirror with the
  round-trip comment (`:256-263`), `pl_g1_neg` = qf − y (`:308-316`).
- **H6 · replay:** nullifier insert is post-verify, same transaction, unique
  key, bounded set (note.cpp:325-332). Fresh replay attempts remain
  scheduled for tranche 2 on-chain.
- **H7 · batch-inversion zero-division:** ξ = ω^(i−1) requires grinding a
  keccak-derived field element to an exact value ≈ 2²⁵⁴ work — infeasible.

## FILED (real, not exploitable as deployed)

- **F1 · MEDIUM-LATENT — `f_batch_invert` buffer cap:** `field256.hpp:230`
  declares `u256 prefix[8]` but the loop writes `prefix[i+1]` for i < n —
  any caller with n > 8 overflows. The deployed circuit calls it with
  n = PL_NL+1 = 5 (nPublic = 4, `plonk_verify.hpp:153`) — safe. **A future
  vk with nPublic ≥ 7 = silent WASM stack corruption inside the proof
  check — precisely the class that forges proofs.** Recommended fix (one
  line): `static_assert( PL_NL + 1 <= 8, "f_batch_invert prefix cap" );`
- **F2 · LOW — 8-byte primary keys:** `pk_of` (note.cpp:291-294) keys
  nullifiers and commitments on their first 8 bytes. Two distinct
  nullifiers sharing that prefix → the second is refused as a double-spend
  (false refusal, denial class — never a false accept). Negligible at
  bounded scale (birthday ≈ 2³² vs caps of 1000); worth a documenting
  comment so a future unbounded-set change re-examines it.
- **F3 · PROCESS — ephemeral fixtures:** the M4 native-oracle run (23/23)
  cannot be re-executed by this review — its proof hexes were intermediates
  and are gone. `test_field256` re-ran clean under this seat (5/5 PASS,
  g++). Recommendation: check the working proof + pubs + oracle scalars
  into the repo as review fixtures; a breaker seat must be able to re-run
  the acceptance evidence.

## Tranche 2 (queued, attack list standing)

`poseidon2.hpp` (1248 lines, unread); the ceremony/vk provenance chain
(vk_constants ↔ pot14 ptau ↔ payment.circom); payment.circom semantics
(conservation + the M6 phantom-leaf claim); fresh on-chain forged-proof and
replay probes against the deployed gate; deposit/insert root-update
authority walk.
