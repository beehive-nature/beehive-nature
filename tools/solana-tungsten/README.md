# BNR Solana tungsten

An executable local reference experiment for BNRoSe Charter L2 (job identity)
and L3 (compute evidence). Two tiers keep the acceptance claims explicit:

1. `node tools/solana-tungsten/run.mjs`: Rust Groth16 proof, Solana host and
   arkworks cross-check, bounded in-memory policy, INVOICE-1 / RECON-1 **OPEN**.
2. `./tools/solana-tungsten/lab/run-local.ps1`: real x0xd delivery, compiled
   Solana verifier on a private validator, matching PLONK proof through the
   existing Vaulta verifier on private Spring, restart/replay checks, and
   INVOICE-1 / RECON-1 **PARTIALLY-SATISFIED**. See [lab instructions](lab/README.md).

The local chain tier spends faucet lamports and transfers nonredeemable fixture
units. It does not authorize or spend real funds. It is a measured reference
suite, not a universal standard certification or production bPay adapter.

## Rust statement and authority boundary

`src/lib.rs:Worker::prove` computes `7 * 7 = 49`. The real BN254 Groth16 circuit
in `SquareJob::generate_constraints` exposes **five** ordered fields: input,
output, two 128-bit limbs of the SHA-256 job commitment, and nonce. Private copy
constraints bind the context limbs and nonce. The circuit does not implement
SHA-256 or authenticate a payment grant; the host recomputes the commitment
from the exact authorized job. Digest limbs preserve all 256 bits.

`SolanaHost::verify` calls `solana-groth16-verify::verify`, after key validation
by `OnChainKey::validate_for_publish`. Conversion and verification are pinned
to `solana-program/groth16-verifier-program@8bd06b4fb07f636c1872993a99f1a296b23b69fa`.
`ArkworksHost::verify` is a second host path with shared arkworks ancestry; it
is not independent cryptographic assurance and is never called Vaulta PLONK.
`Worker::new` uses fresh single-party setup randomness. Public bundles export
the proof and verifying key, never setup randomness or the proving key.

`LocalGate::plan` checks exact job identity, recipient, assets, amount, fee,
ceilings, expiry, allowed rail, pinned key and one-use `(authorization_id,
nonce)`. The eight Rust boundary tests include valid-but-unauthorized proofs,
all ten altered job fields, replay across rail labels with fresh proof bytes,
wrong keys, invalid encodings and maximum-u32 input. Its HashSet is a model;
it is not a durable distributed authorization ledger.

```sh
cargo test --locked --manifest-path tools/solana-tungsten/Cargo.toml
cargo clippy --locked --manifest-path tools/solana-tungsten/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path tools/solana-tungsten/Cargo.toml --check
node tools/solana-tungsten/run.mjs
```

The original `VaultaUnsupported` host stub remains honest: it cannot verify a
Groth16 packet. The supported matching PLONK adapter is in `lab/`, where
`square.circom` supplies the equivalent statement to
`contracts/privacy/plonk_verify.hpp:plonk_verify`. Existing production privacy
contracts and their payment circuit/key are unchanged.

## Receipt comparison

Both local-chain runs retain the same job, commitment, output and seven-unit
principal in the common semantic core. Proof adapter, settlement adapter and
rail evidence are explicit. Key addresses, transaction references, chain IDs,
finality rules and costs necessarily differ; dropping those fields merely to
claim byte-for-byte identical receipts would weaken the evidence.

The two runs use independent counterfactual ledgers. This does not demonstrate
cross-chain atomicity or durable cross-rail double-spend prevention. The
distinct one-unit fee remains unpaid, so the existing reconciliation primitive
correctly reports **PARTIALLY-SATISFIED** on each rail. Actual Solana network
fees and Spring CPU/NET usage are separate expenses.

## Remaining production boundaries

Authenticated bPay grants, signer custody, a durable shared authorization
ledger, deployment/upgrade trust, canonical cross-language encoding, setup
provenance and distributed failure acceptance remain production work. The
Solana lab signer is trusted fixture code; the chain verifier alone does not
enforce BNR authority. x0x transports public proof material and has no payment
keys or authority decision in this harness.

See the [measured dispatch](../../docs/dispatches/2026-10-03-tungsten-chain-acceptance.md)
and [public evidence](evidence/2026-10-03-local.json). Upstream's
[trust assumptions](https://github.com/solana-program/groth16-verifier-program/tree/8bd06b4fb07f636c1872993a99f1a296b23b69fa#trust-assumptions)
explain why key pinning needs setup provenance and why proof hashes cannot
serve as replay protection.
