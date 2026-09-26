# ANTD BRIDGE — vendor gap finding + build decision · 2026-09-17

**Seat:** zBlood (`lane/zcode-lineage-import`). **Order:** "Replace the raw-key purchase backend. Reuse the existing wallet/device-signing interface and the documented external-signer architecture."

## The finding (verified at source)

**The `antd` daemon referenced in the vendor docs does not exist as a separate binary.** The [ant-client repo](https://github.com/WithAutonomi/ant-client) ships only the `ant` CLI (`ant.exe`). The installer (`install.ps1`) installs nothing else. The node daemon (`ant node daemon start`) is for node management only — no upload endpoints.

**BUT: the `ant-core` Rust library HAS the complete external-signer flow** ([verified in source](https://github.com/WithAutonomi/ant-client/tree/main/ant-core/src/data/client)):
- `data_prepare_upload` — Phase 1: encrypt + collect quotes (**keyless**)
- `data_prepare_upload_with_visibility` — Phase 1 with public/private control
- `finalize_upload` — Phase 3: complete storage with signed tx hashes
- `fold_external_merkle_payments` — merkle payment handling
- Full types: `PreparedUpload`, `PaymentIntent`, `PreparedChunk`

The vendor docs at [docs.autonomi.com](https://docs.autonomi.com/developers/sdk/install) describe the HTTP API (`POST /v1/upload/prepare`, `POST /v1/upload/finalize`) — the library supports it, the CLI doesn't expose it, and no separate daemon binary ships.

## The build decision

**We build our own bridge** — `antd-bridge`, a thin Rust HTTP service wrapping ant-core's external-signer functions. This is not a competing implementation; it is the integration our spec commissioned (SPEC-AUTONOMI-TREZOR-1: prepare → sign on device → finalize).

The bridge:
- Runs WITHOUT any wallet key (prepare is keyless by design)
- Exposes the documented API endpoints (`/v1/upload/prepare`, `/v1/upload/finalize`)
- The UI composes unsigned transactions from the prepare output
- Trezor Connect signs on the device (the bantfarm pattern, proven)
- The UI broadcasts via Arbitrum RPC
- The finalize endpoint completes storage

**Status:** Cargo project created (`C:/Users/travi/family-lineage/antd-bridge/`). The stub compiles and runs keyless. The full ant-core wiring (replacing the stubs with actual library calls) is the immediate next step — the build is fetching dependencies in background.

## What this unblocks

Once antd-bridge runs with real ant-core calls:
1. blood.html "Preserve this archive" → calls the bridge's prepare
2. Gets the payment structure (amounts, vault address, token address)
3. Constructs ERC-20 approve + payForQuotes transactions
4. Trezor Connect signs on the device (founder confirms on screen)
5. UI broadcasts via Arbitrum RPC
6. UI calls the bridge's finalize with the tx hashes
7. Storage completes; the receipt flows back automatically

No terminal. No SECRET_KEY. No key export. The device is the gate.
