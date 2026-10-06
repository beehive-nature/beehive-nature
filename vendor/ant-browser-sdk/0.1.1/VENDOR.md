# Autonomi browser SDK 0.1.1

Runtime files copied byte-for-byte from the official npm package. JS source maps, declarations and unused standalone worker copy omitted; worker is served at /autonomi-stream-sw.js (byte-identical between 0.1.0 and 0.1.1). MIT / Apache-2.0 licenses retained. No wallet integration is imported.

Upstream: https://github.com/WithAutonomi/ant-browser-sdk
Package: https://registry.npmjs.org/@withautonomi/ant-browser-sdk/-/ant-browser-sdk-0.1.1.tgz
Tarball SHA-1: 12fa624ceaa189b8cd6f09ab8dbaceaa4e2ff4bc
WASM source: https://github.com/WithAutonomi/ant-client at db85c72515f9c1061ef78c9663e79621e2816170, clean, browser-wasm feature, wasm32-unknown-unknown (package dist/wasm/source.json).
WASM SHA-256: 8fa35e58927fd3f5190ec43b1989313de3cc8968cac1bfa373247d4b3842fcd1 PUBLIC-CONSTANT: public artifact digest
Cargo.lock SHA-256: 51412fd67f073a306f12b766d6c5a35bc8a32c7a32f339b3b04ed987cbefab9c PUBLIC-CONSTANT: public build provenance

Changed from 0.1.0: client.js gains a streaming reader (every read treated as sequential, fetched ahead) that only AutonomiClient.createMediaSource opens; wasm/ant_core.js and the WASM core changed with it. All other runtime files are byte-identical.

bViEw calls the public AutonomiClient.connect, AutonomiClient.openFile and PublicFileReader.read. It reads whole chunks on their self-encryption boundaries (4190208 B; three equal pieces below three chunks), several at once, and hands them in order to its own progressive player. It counts completed chunks and plaintext bytes; these are not wire bandwidth or proof of viewer seeding. Crypto boundary: SDK internal/runtime.js initializeClientWasm loads the pinned Rust WASM; client.js openFile resolves the reader through BrowserNetworkClient.openPublicFile; file-reader.js PublicFileReader.read delegates readRange. No new crypto implementation or independent security audit is claimed. Upgrade the adapter and SDK together.

The SDK's media service worker (/autonomi-stream-sw.js) and internal MediaBridge are no longer used by bViEw. The worker file stays at the site root for browsers that registered it earlier; it only handles same-origin /__autonomi_stream/ requests and passes everything else through.
