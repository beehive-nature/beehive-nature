# Autonomi browser SDK 0.1.5

Runtime files copied byte-for-byte from the official npm package. The
0.1.2 file set, plus the two modules 0.1.5's import graph newly
reaches (`manifest.js`, `pointers.js`). JS source maps, declarations
and the standalone worker copy omitted (the site-root worker is not
part of this pin). MIT / Apache-2.0 licenses retained from the
package root.

Ownership for this pin: advanced by the ANT Browser SDK 0.1.5
qualification lane under the sprint lead's direct assignment of that
qualification to this seat (recorded in
`docs/dispatches/2026-10-29-ant-sdk015-qualification-inventory.md`).
The historical pin owner is the bView seat ("upgrade the adapter and
SDK together"); each consumer below moved with its adapter in the
same change, and wallet/payment moved under separate qualification.

Upstream: https://github.com/WithAutonomi/ant-browser-sdk
Package: https://registry.npmjs.org/@withautonomi/ant-browser-sdk/-/ant-browser-sdk-0.1.5.tgz
Tarball SHA-1: 52c459bada17f2c126406b92d9b4a6c09cae84b5 (matches the registry `dist.shasum`)
Tarball SHA-256: 26b8cf5b466bbd1103cda750d1ceea37008f8052a09d90f913c3a917d9de39dd PUBLIC-CONSTANT: public artifact digest
Tarball integrity: the downloaded tarball's SHA-512 recomputes to the
registry `dist.integrity` value (`sha512-yGSb94Xs…ccFXnQ==`).
WASM source: https://github.com/WithAutonomi/ant-client at 458c7175490e6934a5501e51ff1d80d784f27564, clean, browser-wasm feature, wasm32-unknown-unknown (package dist/wasm/source.json).
WASM SHA-256: eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf PUBLIC-CONSTANT: public artifact digest, matches source.json
Cargo.lock SHA-256 (from source.json): 5fbd0fe94e28fc0d81f4b763a3d12fc2e0f67bcba26d908a06ac7ff6bd724f1e PUBLIC-CONSTANT: public build provenance

Changed from 0.1.2 (file-level, vendored set): `capabilities.js`,
`client.js`, `ethers.js`, `file-reader.js`, `index.js`, `limits.js`,
`wagmi.js`, `internal/abort.js`, `internal/media.js`,
`internal/runtime.js`, `wasm/ant_core.js`, `wasm/ant_core_bg.wasm`
differ; `manifest.js` and `pointers.js` are new runtime modules.
Every other vendored file is byte-identical to 0.1.2.

Consumer moves in this change, each with its adapter:

- bViEw read path: `surfaces/bview.html` SDK root 0.1.2 → 0.1.5;
  its mocked suites' intercept paths moved with it. The public
  calls bViEw uses (`AutonomiClient.connect`,
  `client.openFile(address, {signal, onProgress})`,
  `reader.read(start, length, {signal})`, `createMediaSource`)
  keep their 0.1.1/0.1.2 shapes in 0.1.5 — verified by inspection
  of `client.js`/`file-reader.js` before the move.
- Wallet/payment (separately qualified): `surfaces/bpay-invoice.js`
  and `surfaces/bdrop.js` kit root 0.1.1 → 0.1.5. The calls they use
  (`AutonomiClient.connect({network…})`, `client.upload(file,
  {visibility, paymentMode, payment, signal})`,
  `createManualPaymentProvider`) also keep their shapes in 0.1.5.
  Their offline vector suites were re-run separately; no live
  payment, upload or wallet action is claimed by this pin.
