# Autonomi browser SDK 0.1.5 (qualification candidate)

Runtime files copied byte-for-byte from the official npm package: the
0.1.2 file set plus the two new modules 0.1.5's client requires
(`manifest.js`, `pointers.js`). JS source maps, declarations and the
standalone worker copy omitted, as in 0.1.1/0.1.2. MIT / Apache-2.0
licenses retained. No wallet integration is imported: `ethers.js` and
`wagmi.js` carry the only bare external imports (`ethers`,
`@wagmi/core`, `viem`), and the reader path
(`client.js` → `file-reader.js` → `internal/*`, plus `manifest.js` /
`pointers.js` for the new calls) never touches them.

Upstream: https://github.com/WithAutonomi/ant-browser-sdk
Tag: refs/tags/v0.1.5 = 7c545016555f1a351595f1ac428c394b08fc84d8 (also
upstream main at qualification time; verified via ls-remote)
Package: https://registry.npmjs.org/@withautonomi/ant-browser-sdk/-/ant-browser-sdk-0.1.5.tgz
Tarball SHA-1: 52c459bada17f2c126406b92d9b4a6c09cae84b5 (matches registry shasum)
WASM source: https://github.com/WithAutonomi/ant-client at 458c7175490e6934a5501e51ff1d80d784f27564, clean, browser-wasm feature, wasm32-unknown-unknown (package dist/wasm/source.json)
WASM SHA-256: eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf PUBLIC-CONSTANT: public artifact digest, matches source.json and the vendored bytes
Cargo.lock SHA-256: 5fbd0fe94e28fc0d81f4b763a3d12fc2e0f67bcba26d908a06ac7ff6bd724f1e PUBLIC-CONSTANT: public build provenance (from source.json)
Toolchain per source.json: rustc 1.99.0, wasm-pack 0.15.0.

Changed from 0.1.2 (JS side): `client.js` gains pointer and manifest
calls (`writePointer`/`resumePointer`, `checkSha256`, manifest entry
helpers); `index.js` re-exports `decodeManifest`/`createManifest`/
`createFileLink`, `pointerAddress`/`PointerError`. WASM core grows
5,552,542 → 6,017,879 bytes (new ant-client revision).

bpay-invoice.js and the wallet stay on their current SDK until their
own lane moves them ("upgrade the adapter and SDK together; qualify
wallet/payment consumers separately").
