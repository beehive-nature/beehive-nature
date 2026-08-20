# SPEC-BINDEXER-0 — the b-indexer read path (Rust + SQLite), against blockbook as prior art

Sequencing item 5 of the founder-approved plan (2026-08-20): *write it against blockbook's
API surface as prior art, in Rust+SQLite.*

## 0 · What this is

A **read-only** chain indexer for the organism's read surfaces (the class the Vaulta
Reader gestures at): exSat (7200, the EVM inscription lane) first; BCH (the backup-anchor
lane) second. Rust + SQLite — single-file database, stranger-auditable, zero server
fleet. **Keyless by construction: no sendtx, no wallet, no key material anywhere in this
crate.** Broadcasting rides the rails that already exist; the indexer answers questions.

## 1 · Prior art, stated as a table — blockbook's v2 surface (fetched 2026-08-20 from `trezor/blockbook` `openapi.yaml`)

| blockbook capability | ours | note |
|---|---|---|
| `GET /api/status` — sync + backend state | **yes** | a reader's first duty is confessing how current it is |
| `block-index/{height}` · `block/{id}` · `rawblock/{id}` | **yes** | height↔hash is the spine of every receipt |
| `tx/{txid}` (normalized) · `rawtx/{txid}` | **yes** | normalized shape follows blockbook's field names where sane (`txid`, `vin/vout`, `blockHeight −1 = mempool`, `confirmations`, sats/wei as strings) — prior art honored, parser drift minimized |
| `address/{address}` (details ladder basic→tokens→…→txs) | **yes** | the ladder is good design; ours keeps `txids` as the default cheap depth |
| `xpub/{xpub}` (level-3 derived + descriptor output) | **phase 2** | xpub scanning is a wallet feature; first land serves direct addresses + our inscription records |
| `utxo/{descriptor}` · `balancehistory/{descriptor}` | **utxo yes (BCH lane) · history phase 2** | |
| `sendtx` (broadcast) | **NO — permanently** | keyless read-only by construction; this row is the spec's most important row |
| websocket envelope (`getAccountInfo`, `subscribeNewBlock`, `subscribeAddresses`, …) | **phase 2** (SSE first — static-friendly) | blockbook's push model documented as the shape to grow into |
| tickers/fiat, block-filters, estimatefee/feestats | **no** | not our problem; other instruments own price and fees |

**What we take from their backend design:** blockbook exposes per-column state metrics
(`dbSizeFromColumns`, rows/keys/values per column) in its status — we adopt the same
honesty: **the indexer's status endpoint reports its own SQLite row counts, WAL lag, and
last-block time.** An instrument that confesses its state is house-law; one that merely
says "OK" is not.

## 2 · SQLite shape (sketch, v0)

```
blocks(height INTEGER PRIMARY KEY, hash BLOB, parent BLOB, ts INTEGER, tx_count INTEGER)
txs(txid BLOB PRIMARY KEY, block_height INTEGER REFERENCES blocks, hex BLOB, norm JSON)
addresses(address TEXT, txid BLOB, delta INTEGER, PRIMARY KEY(address, txid))
utxos(txid BLOB, vout INTEGER, address TEXT, value INTEGER, height INTEGER)
tips(chain_id TEXT PRIMARY KEY, best_height INTEGER, best_hash BLOB, lag_ms INTEGER, sources_json TEXT)
```

`tips.sources_json` records **every source the tip was read from** — because:

## 3 · The two-oracle law is schema-level, not policy-level

An indexer is **one oracle.** House law (the census method): every chain fact on any
surface is read on two independent sources. So the b-indexer's API responses carry a
`sources` field naming both oracles that agreed on the block the answer is anchored to;
a response served from one oracle alone is marked `single_source: true`, and surfaces
render that mark — the reader sees the epistemic state of every number, which is the
difference between a reader and a witness. A page must not be its own witness; an
indexer must not be a surface's only one.

## 4 · Non-goals, named

No write path. No key material. No re-org rewriting silently — re-orgs append a
`reorgs` row (depth, orphaned hashes) and the API exposes it; history is append-mostly
and honest. No price data. No AI.

## 5 · Owed

Chain-source adapters (exSat EVM RPC + a second independent reader — Blockscout-class;
BCH + a second), the ingest backfill receipt, and the conformance test: **the blockbook
table above is the acceptance matrix** — each row implemented or explicitly phased,
receipted at landing.

**zAgent (GLM 5.3), 2026-08-20.** 🐝
