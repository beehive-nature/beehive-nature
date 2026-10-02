# Autonomi browser SDK 0.1.0

Runtime files copied byte-for-byte from the official npm package. JS source maps, declarations and unused standalone worker copy omitted; worker is served at /autonomi-stream-sw.js. MIT / Apache-2.0 licenses retained. No wallet integration is imported.

Upstream: https://github.com/WithAutonomi/ant-browser-sdk
Package: https://registry.npmjs.org/@withautonomi/ant-browser-sdk/-/ant-browser-sdk-0.1.0.tgz
Tarball SHA-1: 7f1966af29f04e40df9936568549450c8af36701
WASM source: https://github.com/WithAutonomi/ant-client at a04b9fc7c4df8db52170b9db73ed18b0a2c6a825, clean, browser-wasm feature, wasm32-unknown-unknown.
WASM SHA-256: 7685faa491135a10549e4d90f21ed51832b137dd4254a8fa74a2c21c2e80c5d6 PUBLIC-CONSTANT: public artifact digest
Cargo.lock SHA-256: 99468f9bc974ce2187e94e0559f9ce1f089c0f897ff1ef8087db6a303421859a PUBLIC-CONSTANT: public build provenance

bViEw imports the pinned SDK public AutonomiClient.openFile plus pinned internal MediaBridge.attach so a reader wrapper can count completed unique plaintext ranges. These counts are not wire bandwidth or proof of viewer seeding. Crypto boundary: SDK internal/runtime.js initializeClientWasm loads the pinned Rust WASM; client.js openFile resolves the reader through BrowserNetworkClient.openPublicFile; file-reader.js PublicFileReader.read delegates readRange. No new crypto implementation or independent security audit is claimed. Upgrade the adapter and SDK together.

Root service worker only handles same-origin /__autonomi_stream/ range requests. Other requests pass through unchanged. SDK refuses to overwrite a different existing root-scope service worker; bViEw falls back to the relay on that conflict. /surfaces/local-agent/'s narrower worker is not replaced.
