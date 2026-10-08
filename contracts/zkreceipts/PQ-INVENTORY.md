# PQ INVENTORY — this lane's cryptographic dependencies (founder order 2026-10-08)

Classification per dependency: **retained** (quantum-irrelevant or
margin-acceptable), **replaced** (a concrete replacement exists and is
adopted), **unresolved** (no adopted replacement; owner named). The
order's framing holds throughout: adding PQ signatures alone does not
make the stack post-quantum — the proof system is the deep item.

## 1. Signatures (transaction/account authorization)

| dependency | primitive | PQ status | classification |
|---|---|---|---|
| Vaulta/Jungle4 tx auth (every push this lane receipts) | ECDSA secp256k1 (ANT/WIF keys, keosd-held) | Shor-broken | **UNRESOLVED — chain-level** (a Vaulta protocol PQ-auth upgrade; not in this lane's control; the estate's PQ-signature capability is being built by the safe7 lane — branches `safe7-pq-*` — as an estate asset, not a Vaulta integration) |
| test/dev keys (bnrzk wallet, bench keys, sponsor key) | secp256k1 | Shor-broken | **UNRESOLVED** — same chain-level dependency (testnet-scope risk only) |

No in-lane signature primitive is retained-or-replaced: the lane SIGNS
nothing itself; it rides the chain's auth.

## 2. Key establishment / transport

| dependency | primitive | PQ status | classification |
|---|---|---|---|
| public API reads/writes (greymass, eosnation) | TLS 1.3, classical ECDHE + classical certs | harvest-now-decrypt-later | **UNRESOLVED — endpoint-controlled** (PQ/hybrid TLS is the API operators' upgrade; the follower path below reduces but does not eliminate it) |
| follower P2P (net_plugin, the nine peers) | plaintext TCP (no TLS in default posture) | already non-confidential | **UNRESOLVED — chain-level** (authenticity comes from block validation, confidentiality is absent by design; a PQ P2P is a protocol upgrade) |
| local rehearsal chain / loopback RPC | none (loopback) | n/a | **RETAINED** (no exposure to establish) |

## 3. Proof systems (the core)

| dependency | primitive | PQ status | classification |
|---|---|---|---|
| count.circom / count_scale.circom proofs | PLONK over **BN254** (pairings) | pairing/DL broken by Shor — a quantum adversary FORGES | **UNRESOLVED — the deep item**: replacement = hash-based transparent STARKs (FRI; security from hashes only, no ceremony) — a different prover stack and wire format; the nine-phase plonk_verify port does not carry. Named owner: this lane, WHEN ordered; it is a rewrite, not a port |
| ceremony (hez17 powersoftau, BN254) | trusted-setup over BN254 | tied to the broken curve | **UNRESOLVED** with the proof system (a STARK needs no ceremony — the replacement dissolves this dependency) |
| in-circuit hash (Poseidon over BN254 scalar field) | field-arithmetic sponge | field-bound | **REPLACED-WITH-THE-SYSTEM** (STARK stacks use Poseidon2/Rescue over STARK-friendly fields) |
| snarkjs wasm prover | BN254 PLONK prover | follows the system | follows the proof system |

## 4. Hashes and digests (retained class)

| dependency | primitive | PQ status | classification |
|---|---|---|---|
| SHA-256 (fingerprints, receipts, wasm/genesis digests, rammarket…) | SHA-256 | Grover: 256→~128-bit PQ | **RETAINED** (margin acceptable; no change ordered) |
| keccak-256 (deposit commitments, M9 checkpoint folds, chain intrinsics) | Keccak | Grover margin | **RETAINED** (same) |
| SHA3/BLAKE2 (ceremony transcript digests) | — | Grover margin | **RETAINED** (same) |

## 5. Historical verification

| dependency | what must stay verifiable | classification |
|---|---|---|
| all past proofs + on-chain receipts (this lane and the M-lane payments) | BN254 PLONK verification of already-landed proofs | **RETAINED AS-IS** — history verifies classically forever; it is not retro-unsafe to VERIFY. Its integrity rests on the chain's own signature layer (§1) — a systemic, chain-level exposure, recorded not solved here |
| receipt digests in dispatches | SHA-256 | **RETAINED** (§4) |

## Bottom line for the PQ program

- A complete PQ posture for this lane needs THREE independent upgrades:
  (a) chain auth (§1) — Vaulta protocol level; (b) transport (§2) —
  endpoint/protocol level; (c) the PROOF SYSTEM (§3) — lane level and
  the largest: a STARK-class rewrite of circuit + prover + on-chain
  verifier.
- (c) is the one this lane owns. Until it is ordered and built, the
  count-proof receipts are explicitly CLASSICAL-ASSUMPTION artifacts.
- PQ signatures (the safe7 asset) upgrade (a)'s key material but leave
  (b) and (c) untouched — signatures alone ≠ a PQ stack, exactly as
  the order states.
