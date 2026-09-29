# Connect-fixture generator (recorded)

Generates the SIGNED-transaction fixtures pinned in
`../../tests/adapter_signing.rs`, plus the independently confirmed
sender/hash figures for the EIP-155 specification's own published example
vector.

## Provenance and pins

- `@trezor/connect 9.7.3` — the bridge package whose
  `ethereumSignTransaction` request/response contract the adapter models
  (types inspected from the installed package source; the tarball also
  resolved `@ethereumjs/tx 10.1.3` and `@ethereumjs/common` as Connect's
  own serialization dependencies, pinned by it at `^10.1.0`).
- Signing/serialization: `@ethereumjs/tx 10.1.3` — the exact library
  family Connect's `serializeEthereumTx` calls (`createTx(...).serialize()`).
- The EIP-155 spec vector bytes are pasted verbatim from the EIP text;
  ethereumjs recovers its sender and hashes it here for pinning.

## Offline law

`npm install --ignore-scripts` fetches the packages (dependency download,
permitted by the z2.c order); `node gen.js` then runs purely locally. No
SDK initialization, no device, no Suite/iframe/popup, no network call, no
wallet/keyring/token access of any kind. The two signing keys in `gen.js`
are PUBLIC synthetic test values invented for this generator.

## Synthetic inputs (mirror `src/test_support.rs` `base_batch`)

chain 42161, vault `0x…b2`, token `0x…a1`, ts 1757717400, nonce 7,
gas 500000, fee cap 100 gwei, priority 1 gwei; depth-2 batch (pools
1..=16 tagged 1, all-ones tagged 2). The approve fixture uses nonce 0,
token destination, `approve(vault, 36)` (the base plan's derived
ceiling).

## Run receipt

- 2026-09-12, z2.c seat (GLM/zCode), OFFLINE: `npm install
  --ignore-scripts && node gen.js > fixtures.json`.
- The `fixtures.json` output is intentionally NOT checked in (long hex
  lines cannot carry same-line PUBLIC-CONSTANT markers under the
  secret-scan law); the pinned constants in the test file carry the
  markers and were spliced verbatim from this output.
- The same run printed the spec-vector figures:
  sender `0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f`,
  signing hash `0xdaf5a779…` (matches the EIP-155 text byte-for-byte),
  tx hash `0x33469b22…`.

## Regenerate and compare

```
npm install --ignore-scripts
node gen.js            # prints the JSON; diff against the pinned
                       # FIX_* constants in ../../tests/adapter_signing.rs
```

Signature (r, s) values depend on the signer's deterministic-nonce
derivation and may legitimately differ between library versions; the
invariants to compare are the RECOVERED SENDER and the TRANSACTION HASH
(the test asserts both against the pinned bytes).
