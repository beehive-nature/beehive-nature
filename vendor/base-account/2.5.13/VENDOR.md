# Base Account SDK 2.5.13 (`@base-org/account`)

This is the browser bundle `dist/base-account.min.js`, copied byte for byte from the official npm package. No other file is vendored. The Apache-2.0 license is kept.

It is used only by `tools/bpay-settle/live.html`, the live run of the Coinbase tungsten test on Base Sepolia. No product surface loads it.

## Where it comes from

- Upstream: https://github.com/base/account-sdk
- Package: https://registry.npmjs.org/@base-org/account/-/account-2.5.13.tgz
- Tarball SHA-1 (npm `shasum`): `e7c4a01a2c8ff0060418cababe1d4b808c8b7d5e`
- Tarball integrity: `sha512-2vYgmHbNCGLBkV9AqVKNExhVLTkW/JiFRJEO1Rm+RL5/z24rDgOhVma/9XafEdiDH/jGmN58DUi+qO2da8CjlQ==`. Recomputed from the downloaded tarball on 2026-10-10, and it equals the registry's published value.

## The vendored file

- SHA-256: `c279fa763dc92d1d61b99fd5b8c98d7c34499e0582c1b1f6a87f1eb22e6d76fd` PUBLIC-CONSTANT: public artifact digest
- Subresource Integrity: `sha384-Mcz9lgiIHE1FhVu4Tf9feilM+8nAAR5bKajaBvv9tYJf4fyCyt8id4k0sWr/kPi5`. The page loads the file with this pin.

## What it does on its own

The bundle talks to `keys.coinbase.com` (the wallet window) and `rpc.wallet.coinbase.com`. It also reaches the `chain-proxy.wallet.coinbase.com` RPC proxy and the telemetry hosts `cca-lite.coinbase.com` and `as.coinbase.com`.

The live page calls `pay()` with `telemetry: false`. What the wallet window itself reports to its vendor is outside this page's control. Upgrade the bundle and the adapter together.
