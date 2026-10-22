# Solana settlement evaluation with SAFE 7 / bSAFE 7

The [current integration map](../../tools/solana-tungsten/CURRENT.md) connects
this bench to the private-chain Groth16/PLONK lab and bTungsten workbenches.
This crate's transfer-plus-memo format does not yet accept that lab's
proof-plus-transfer transaction.

This is an **offline evaluation bench**, not production bPay authorization or a
live settlement service. It takes public data, composes a native SOL transfer
plus an intent-hash memo, verifies an external Ed25519 signature, and reconciles
explicit RPC evidence against the exact transaction. It has no wallet key,
RPC client, broadcast call, account delegation or firmware-update command.

The browser remains the account/UI layer. Rust owns deterministic intent and
receipt checks. A stock SAFE 7 can export addresses through official Trezor
Connect; a bSAFE T3W1 emulator exercises the firmware signing side with the same
Rust checks. The existing native `rust/bsafe-host` THP prototype is a separate,
unfinished physical transport integration. This bench does not call it complete.

## Operator input and commands

Build: `cargo build --locked -p settle-solana`.

Supply JSON on stdin to `settle-solana prepare`, `settle-solana verify`, or
`settle-solana reconcile`. All fields are public. Unknown input fields are
refused. `tools/firmware/solana-emulator-bench.py` creates a complete synthetic
input and demonstrates the first two commands without hardware or an RPC.

```json
{
  "intent": {
    "job_id": "evaluation-job-1",
    "authorization_ref": "unverified-evaluation-bound",
    "proof_ref": "unverified-evaluation-proof",
    "payer": "PUBLIC_SOLANA_ADDRESS_FROM_DEVICE",
    "recipient": "PUBLIC_SOLANA_RECIPIENT",
    "lamports": 1000,
    "max_lamports": 1000,
    "max_fee_lamports": 5000,
    "path": "m/44'/501'/0'"
  },
  "observation": {
    "genesis_hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "blockhash": "BLOCKHASH_FROM_DEVNET_RPC",
    "last_valid_block_height": 0,
    "observed_block_height": 0
  }
}
```

`prepare` produces a public summary, base64 message for `getFeeForMessage`, and
the stock Connect request. `serializedTx` in this method is message hex, without
transaction signature slots. `serialize` is explicitly false.

`verify` additionally needs `signature_hex`, `current_genesis`,
`current_block_height`, and `fee_lamports`. Its output is
`signature_verified_evaluation`, never a settlement. It reconstructs the message
from the intent before verifying; changing the destination, amount, job,
authorization reference, proof reference, path or blockhash invalidates it.

`reconcile` also needs:

```json
{
  "evidence": {
    "genesis_hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "requested_signature": "SIGNATURE_FROM_VERIFY",
    "status": {"confirmationStatus": "finalized", "err": null, "slot": 123},
    "transaction": {
      "slot": 123,
      "meta": {"err": null, "fee": 5000},
      "transaction": ["EXACT_SIGNED_TRANSACTION_BASE64", "base64"]
    }
  }
}
```

The evidence collector must bind these responses to the same signature and
devnet endpoint: `getGenesisHash`, `getSignatureStatuses` with
`searchTransactionHistory: true`, and `getTransaction` with
`commitment: finalized`, `encoding: base64`. The bench refuses missing execution
status, failed execution, nonfinal status, changed bytes, excessive fee and
different slots. A finalized observation may arrive after the original blockhash
expires; the signature acceptance fields describe the earlier signing check.

RPC evidence is supplied by the caller. Genesis names and finality observations
are not consensus proofs. Solana's wire message has no EVM-style chain ID; a
trusted collector must obtain the recent blockhash from the intended cluster.
The offline genesis check does not authenticate those observations.

## Boundaries that still need implementation

- `authorization_ref` and `proof_ref` are opaque labels. The memo binds their
  hashes to a transaction; it does **not** verify a capability or Groth16 proof.
  Every receipt explicitly says `authority_verified: false` and
  `proof_verified: false`.
- Production bPay needs its existing authority engine, a durable attempt ledger,
  trusted observations, replay/expiry handling, and a reviewed submission and
  reconciliation adapter. A valid signature alone grants none of those.
- Groth16 verification, Token-2022/confidential transfers, sponsored fees,
  allowances, durable nonces, lookup tables, multisig and the comparative Vaulta
  experiment are not implemented by this native-SOL slice.
- This bench does not provide user PQ keys. SAFE 7 device attestation, firmware
  signatures and user settlement signatures remain different capabilities.

## Source and decisive checks

`src/lib.rs::prepare` uses exact-pinned Anza `solana-message` 3.0.1 and
`solana-system-interface` 2.0.0 constructors. `verify_signature` uses
`ed25519-dalek` 2.2.0 `verify_strict`. `reconcile` checks evidence against exact
signature-prefixed bytes. Transitive versions/checksums are in `Cargo.lock`.

`cargo test --locked -p settle-solana` checks altered intent, wrong keys,
malformed signatures, network/fee/expiry refusal, missing error fields, failed
execution, nonfinal observations and transaction substitution.

Official interfaces:
[Connect Solana signing](https://connect.trezor.io/9/methods/solana/solanaSignTransaction/),
[Solana transactions](https://solana.com/docs/core/transactions),
[getTransaction](https://solana.com/docs/rpc/http/gettransaction),
[getSignatureStatuses](https://solana.com/docs/rpc/http/getsignaturestatuses).
