# BNR Solana tungsten: the smallest local proof boundary

Serves BNRoSe Charter **L2** (deterministic job identity) and **L3** (evidence
for compute). Experimental host code, outside the kernel workspace. No public
mesh, deployed contract, wallet, payment, or production authorization.

```text
fixed local grant -> Rust square job -> real BN254 Groth16 proof
  -> JSON loopback -> Solana host verifier / arkworks reference verifier
  -> bounded dry-run observation -> existing INVOICE-1 / RECON-1 -> OPEN
```

Run from the repository root with Rust/Cargo (measured with 1.98.1), Node.js,
and network access for the initial dependency download:

```sh
cargo test --locked --manifest-path tools/solana-tungsten/Cargo.toml
node tools/solana-tungsten/run.mjs
```

The runner writes JSON to stdout. Each run makes a fresh in-memory setup and
proof, so the proof and verifying-key address vary. The job commitment stays
the same. Only public observation fields are printed; no proving key, setup
randomness, wallet key, or credentials are emitted. No endpoint or signer is
configured. The optional output file `observation.local.json` is ignored.

## What this demonstrates

`src/lib.rs:Worker::prove` computes `7 * 7 = 49` and generates a real proof.
`SquareJob::generate_constraints` enforces the square relation and two
context-copy constraints. The four public inputs are input, output, and two
128-bit limbs of the domain-separated SHA-256 job commitment. Splitting the
digest preserves every bit instead of reducing a 256-bit digest modulo Fr.
The host hashes the job; this circuit does not implement SHA-256 or validate
payment authority. That distinction is load-bearing.

`SolanaHost::verify` calls the actual `solana-groth16-verify::verify` host path
after `OnChainKey::validate_for_publish`. Both the verifier and conversion
library are pinned to upstream commit
`8bd06b4fb07f636c1872993a99f1a296b23b69fa`; `Cargo.lock` pins transitive inputs.
`ArkworksHost::verify` checks the same wire-format proof/key through
`ark_groth16::Groth16::verify_proof`. This is a cross-check between two host
paths with shared arkworks ancestry, not independent cryptographic assurance.

`LocalGate::plan` checks exact job identity, recipient/asset/amount/fee binding,
separate amount and fee ceilings, expiry, allowed rail, pinned key, and one-use
`(authorization_id, nonce)` before recording a dry-run observation. A valid
proof for a different recipient does not grant spending authority. Generating
different proof bytes for the same job does not bypass replay checks.

The two counterfactual runs use separate in-memory ledgers. Their observation
envelopes compare equal after changing only `proof_adapter` and
`settlement_adapter`. The `solana-dry-run` and `vaulta-dry-run` values are rail
**labels in the policy model**, not transaction builders or settlement
implementations. A single ledger refuses a second use across either label.

`run.mjs` uses the existing `buildGenericInvoice` and `reconcileObligation`
functions. Fixture units have no token value or exchange rate. Instruction-only
evidence must return **OPEN**. No payment receipt or finality is manufactured.
`crates/bmesh-meter` is a pricing engine; this experiment does not relabel it
as a reconciliation implementation.

## The Vaulta boundary remains visible

The existing Vaulta route is `contracts/privacy/payment.circom` plus
`note.cpp:payment_gate` and `plonk_verify.hpp:plonk_verify`, documented in
`docs/specs/SPEC-PRIVACY-1.md` M4/M7. It proves a private-note payment statement
using PLONK, not this square job using Groth16. `VaultaUnsupported` returns an
explicit unsupported error. The arkworks reference path is **not** a Vaulta
verification result. This experiment does not prove live rail interchangeability.

## What must change before a live experiment

- Replace the trusted, unsigned local grant fixture with authenticated bPay
  authorization. Bind chain/network, asset identifiers, recipient addresses,
  fee asset and ceilings, circuit/setup provenance, and verifier deployment.
- Specify a production canonical job encoding and circuit. This v1 digest uses
  fixed Rust struct serialization, not a claimed interoperable BNR standard.
  Fresh single-party setup is only a local fixture, not a public ceremony.
- Give the existing Vaulta route an explicitly supported equivalent job
  statement and adapter, respecting the PLONK ruling.
- Replace JSON loopback with measured x0x delivery. This run demonstrates no
  discovery, signatures, encryption, or mesh reliability.
- Implement settlement adapters and a durable shared authorization ledger with
  reservation, retry/crash recovery, finality and reconciliation. The local
  HashSet resets on restart and offers no cross-process exclusion. Consuming a
  dry plan here is a model, not a production payment state machine.
- Check the actual deployed Solana program, upgrade authority, and key account;
  an address derived locally is not evidence of deployment or on-chain success.

Upstream explains why a pinned key needs setup provenance and why proof hashes
cannot prevent replay in its [trust assumptions](https://github.com/solana-program/groth16-verifier-program/tree/8bd06b4fb07f636c1872993a99f1a296b23b69fa#trust-assumptions).
The native-executable/interface analogy is supported by
[pnpm's installation documentation](https://pnpm.io/installation); this lane
makes no package-manager changes or performance claims.
