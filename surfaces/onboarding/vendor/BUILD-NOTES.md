# bnr-sign.js — build receipt

`bnr-sign.js` is the BNR wallet's browser signing stack, vendored as ONE
self-contained IIFE that exposes `window.BnrSign`:

```
{ Api, JsonRpc, Numeric, Serialize, RpcError,
  PrivateKey, PublicKey, Signature, JsSignatureProvider,
  sha256, keccak_256, secp }
```

- `eosjs 22.1.0` (MIT) — Api / JsonRpc / serializer / key conversions / JsSignatureProvider
- `@noble/hashes 1.8.0` (MIT) — sha256 + keccak_256 (EVM address derivation;
  keccak lives under the `@noble/hashes/sha3` subpath, NOT `…/keccak`)
- `@noble/secp256k1 2.3.0` (MIT) — K1 pubkey math (derive → 33-byte compressed / 65-byte uncompressed)
- `buffer` (feross, MIT) — Browser Buffer polyfill; eosjs dist code references the
  `Buffer` global and crashes with "Buffer is not defined" in every real browser
  without it. The entry installs it only when `globalThis.Buffer` is undefined.

Built with esbuild from pinned npm sources in a scratch dir OUTSIDE the repo
(keeps the estate's tree clean):

```sh
mkdir ~/bnrsign-build && cd ~/bnrsign-build
npm init -y
npm install eosjs@22.1.0 @noble/hashes@1.8.0 @noble/secp256k1@2.3.0 esbuild
# entry.js imports (dist subpaths — the eosjs main entry does NOT export
# JsSignatureProvider/PrivateKey; import them from dist or they are undefined):
#   import { Api } from 'eosjs/dist/eosjs-api.js';
#   import { JsonRpc } from 'eosjs/dist/eosjs-jsonrpc.js';
#   import { RpcError } from 'eosjs/dist/eosjs-rpcerror.js';
#   import * as Numeric from 'eosjs/dist/eosjs-numeric.js';
#   import * as Serialize from 'eosjs/dist/eosjs-serialize.js';
#   import { PrivateKey, PublicKey, Signature } from 'eosjs/dist/eosjs-key-conversions.js';
#   import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig.js';
#   import { sha256 } from '@noble/hashes/sha256';
#   import * as secp from '@noble/secp256k1';
#   globalThis.BnrSign = { Api, JsonRpc, Numeric, Serialize, RpcError,
#     PrivateKey, PublicKey, Signature, JsSignatureProvider, sha256, secp };
npx esbuild entry.js --bundle --minify --format=iife --target=es2020 \
  --legal-comments=inline --outfile=bnr-sign.js
```

The long-hex runs in the minified body (curve constants, lookup tables) carry a
same-line `PUBLIC-CONSTANT` marker per the secret-scan law — they are standard
public parameters, not secrets.

## Proven 2026-08-22 (receipts in the session log)

1. `deriveK1Key` (engine) → valid secp256k1 scalar; noble derives the pubkey.
2. WIF (37-byte eosjs form: `base58(0x80‖seed‖sha256d-chk)`) accepted by
   `JsSignatureProvider`. NOTE: eosjs 22.1.0 REJECTS the 52-char compressed
   WIF form (38 bytes, `0x01` suffix) that Anchor/cleos export — the wallet
   normalizes both forms before use. Never hand-roll EOS pubkey strings
   (checksum is not plain sha256) — use `PrivateKey.fromString(wif).getPublicKey().toLegacyString()`.
3. `Serialize.serializeAction({types, actions}, account, name, authz, args, enc, dec)`
   — the first argument is the `{types, actions}` object, NOT a bare types map.
4. Live wire proof on api.eosn.io: `POST /v1/chain/send_transaction` with
   `{signatures, compression: 0, packed_context_free_data: '', packed_trx: hex}`
   answered `unsatisfied_authorization` for the derived key on a real
   updateauth for kingbeelovis — packing/parse/digest/signature all ACCEPTED
   by the node; only the authority gate refused (pre-bridge). Post-bridge the
   same flow is a valid broadcast.
5. `abi_json_to_bin` is GONE on modern public nodes (410/404) — client-side
   serialization is not optional; this bundle IS the lane.

## v5 (2026-08-23) — schnorr added for the QR bridge + the QR vendor
- `bnr-sign.js?v=5`: `import { schnorr } from '@noble/curves/secp256k1.js'`
  (@noble/curves 2.3.0, MIT) appended to `entry.js` and exposed as
  `BnrSign.schnorr` — BIP-340 signing/verification for the QR bridge's
  ephemeral nostr transport. All v4 exports unchanged (re-verified).
  NOTE: `import * as ns` would grab the MODULE namespace — schnorr is a named
  export inside it (`ns.schnorr.sign`), destructure in the entry.
  Hex law: the single minified body line carries all curve constants — the
  same-line PUBLIC-CONSTANT marker is APPENDED to that line post-build
  (`/*PUBLIC-CONSTANT: …*/` at end of line 10).
- `bnr-qr.js?v=1` (NEW): `qrcode-generator 2.0.4` (MIT) + `jsQR 1.4.0`
  (Apache-2.0) behind `globalThis.BNRQR = { make(text)->matrix,
  scan(rgba,w,h)->string|null }` — build via `qr-build.mjs` (same esbuild
  recipe). Round-trip proven: make() → rasterize ×8 with 2-module quiet zone
  → scan() returns the exact URL. jsQR wants RGBA Uint8ClampedArray.
- pins: `npm install eosjs@22.1.0 @noble/hashes@1.8.0 @noble/secp256k1@2.3.0 @noble/curves@2.3.0 qrcode-generator@2.0.4 jsqr@1.4.0 esbuild`

## v6 (2026-08-23) — sync ECDSA for the EVM pay lane
- `import { hmac } from '@noble/hashes/hmac'` exposed as `BnrSign.hmac` AND wired:
  `BnrSign.secp.etc.hmacSha256Sync = (k,m) => hmac(sha256, k, m)` — @noble/secp256k1
  2.3.0 ships no default sync HMAC (its `utils` has no hook; the wire point is
  `etc`), so sync `BN.secp.sign(hash,key)` needs this at bundle time. Receipt:
  EIP-155 canonical vector — payload hash byte-identical (daf5a779…), our sig
  recovers to the published sender 0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f.
  r/s DIFFER from the example's nonce convention (its RFC6979 folds extra
  entropy noble's sync signer ignores) — mutual-validity law, same as
  eosjs↔k256: never string-compare signatures across libraries.
- pins unchanged + `@noble/hashes` hmac subpath (1.8.0).
