# ant-extsig — the member-signed memory write (Autonomi 0.18 lane)

THE CUSTODY UNBLOCK: the vending machine's ANT layer was gated on "who holds
the key that pays for storage." The answer, proven here: **the member
does** — an external-signer flow where the estate client NEVER holds a
wallet. This unblocks storage-substrate-split item 8's funded-write gate for
the custody half; the cost half (never price at $0 — R3) is unchanged.

## What was proven (2026-09-04, 8-node LocalDevnet + embedded Anvil, real
ant-node 0.18.1 processes — not test doubles)

- **PREPARE** the a1-genesis upload (`file_prepare_upload_with_mode`,
  public, Merkle mode requested) — the network priced 4 chunks as a **WAVE
  batch** (per-chunk quotes): the 318 B genesis is far below the 64-chunk
  merkle threshold, so the network's own Auto law routes small memory
  writes to wave payments. The 171-revision a1-log (69 KB) likewise waves.
  Merkle is the ≥64-chunk (bulk-media) class — the harness carries both
  arms; ADR-0003's vendor example proves the merkle arm at 1 GiB.
- **THE MEMBER PAYS** — a standalone evmlib Wallet (key from a member-held
  file; on mainnet this is the member's WAGMI/MetaMask — ADR-0003's
  "every keyless consumer" flow) paid all quote payments on-chain
  (46,875,000 atto-ANT per artifact on the devnet token).
- **THE INTERRUPT** — the estate client was DESTROYED (drop + teardown)
  after payment.
- **THE RESUME** — a FRESH `Client::connect` finalized the upload with the
  member's payment. **No new quote anywhere in the resume path** — the
  receipts: genesis DataMap `1e44a2ca…e25a` and full-log DataMap
  `f0e3cab8…7eed`, both byte-identical round-trips, `estate_client_held_
  wallet: false`, payer `0xf39F…2266` (devnet-funded stand-in).

## Files

- `src/main.rs` — the harness (Cargo.toml deps: ant-core git HEAD w/
  `devnet` feature, ant-node 0.18.1, ant-protocol 2.3.5; box:
  `~/ant-lane/ant-extsig`)
- `member-pay.mjs` — the MEMBER's ethers wallet for the WAGMI-parity shape
  (devnet leg used the evmlib standalone wallet directly; the ethers script
  documents the browser-wallet boundary and is the mainnet shape)
- `BROWSER-PATTERN.md` — the autonomi:// plain-page pattern (task 3)
- `build-a1log.mjs` shape lives in the lane receipt — a1.mjs's own exports
  built the 171-revision chain, verified head `f1da60d2…`

## Traps banked (all bit during the lane)

- `autonomi` (maidsafe monorepo, GPL) ≠ **ant-core** (WithAutonomi/
  ant-client, MIT/Apache) — the CURRENT client is ant-core 0.8.1; the old
  crate's `Client::init()` cannot even bootstrap (NoBootstrapPeersFound).
- LocalDevnet needs `anvil` on PATH (foundryup) and ~1.2 GB free disk: each
  node reserves ~0.49 GiB and REFUSES PUTs below it — the first run died on
  a full disk (the estate node's 8.4 GB chunks.mdb is real stored work).
- serde_json `json!` still rejects underscore literals; `?` on
  PayForQuotesError needs a manual map (no std Error impl).
- antd arm64 vs amd64: the box is aarch64; the amd64 binary dies "Exec
  format error" only at exec (file(1) tells you late).
