# Autonomi browser SDK 0.1.2

Runtime files copied byte-for-byte from the official npm package, the same file set as 0.1.1. JS source maps, declarations and the standalone worker copy omitted; the worker at /autonomi-stream-sw.js is byte-identical to this package's copy. MIT / Apache-2.0 licenses retained. No wallet integration is imported.

Upstream: https://github.com/WithAutonomi/ant-browser-sdk
Package: https://registry.npmjs.org/@withautonomi/ant-browser-sdk/-/ant-browser-sdk-0.1.2.tgz
Tarball SHA-1: 7d196f43d6e44bc4841f062ef83cf86a6ac7bcd3
WASM source: https://github.com/WithAutonomi/ant-client at 9858af5dbbb2caf090e20db67ac62aa4bd100c81, clean, browser-wasm feature, wasm32-unknown-unknown (package dist/wasm/source.json).
WASM SHA-256: ab58bd3e331436d22acfe3d08b384992be9addec52145fa0325468c27b6da70a PUBLIC-CONSTANT: public artifact digest, matches source.json
Cargo.lock SHA-256: 51412fd67f073a306f12b766d6c5a35bc8a32c7a32f339b3b04ed987cbefab9c PUBLIC-CONSTANT: public build provenance (unchanged from 0.1.1)

Changed from 0.1.1: only wasm/ant_core.js and the WASM core. They carry two browser fixes, both WebKit (Safari) problems; Chromium was not affected by either:
- ant-client#215: a connection the browser reports failed or closed is no longer reused, so a request on it fails at once and retries elsewhere instead of waiting out a 10 s deadline.
- ant-client#216: ICE gathering takes one page-wide turn per connection, so WebKit stays under its 256-socket-per-page cap and stops closing live connections.

bViEw moves to 0.1.2. bpay-invoice.js and the wallet stay on 0.1.1 until their own lane moves them ("upgrade the adapter and SDK together"). The dial recorder (surfaces/ant-transport.js) still sees every dial: the glue still calls `new RTCPeerConnection` at each one.
