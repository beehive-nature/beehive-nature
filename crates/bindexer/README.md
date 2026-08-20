# bindexer — SPEC-BINDEXER-0

The read-only chain indexer (Rust + SQLite), written against blockbook's v2 API
surface as prior art. **exSat (7200, the EVM inscription lane) first; BCH (the
backup-anchor lane) second.** Single-file database, stranger-auditable, zero
server fleet.

## The three laws

1. **Keyless by construction** — no sendtx, no wallet, no key material anywhere
   in this crate. Enforced by a CI source-scan test (`tests/keyless.rs`), not by
   policy. The CLI's `--help`, the API's `status`, and the 405 refusal all carry
   the row: `sendtx: NO — permanently` — the spec's most important row.
2. **The two-oracle law is schema-level** — `tips.sources_json` records every
   source that agreed on the stored tip; every API response carries `sources`;
   a single-source answer is marked `single_source: true` (only possible with
   the explicit `--allow-single-source` flag) and surfaces render the mark.
   Oracle divergence fails closed: nothing is written, the error names both
   hashes.
3. **Append-mostly honesty** — reorgs append a `reorgs` row (depth, orphaned
   hashes); nothing is ever deleted; `status` confesses per-table row counts,
   page/WAL stats, and lag in blocks rather than saying "OK".

## Acceptance matrix — SPEC-BINDEXER-0 §1, every row a named test

| blockbook row | ours | receipt (test) |
|---|---|---|
| `GET /api/status` | yes | `matrix_status_row` — confesses sync state, row counts, WAL, lag |
| `block-index/{height}` · `block/{id}` | yes | `matrix_block_spine_row` — height↔hash inverts both ways |
| `tx/{txid}` normalized | yes | `matrix_tx_normalized_row` — blockbook field names, wei strings, `blockHeight −1 = mempool`, confirmations |
| `address/{address}` ladder | yes | `matrix_address_ladder_row` — `txids` default cheap depth, signed balance |
| `sendtx` (broadcast) | **NO — permanently** | `matrix_sendtx_row_permanently_no` + `no_broadcast_signing_or_custody_vocabulary_in_this_crate` + `non_get_is_405_read_only_by_construction` |
| two-oracle sources | schema law | `two_oracle_law_sources_field` · `two_oracle_divergence_fails_closed` · `single_source_needs_the_flag_and_is_marked` |
| reorgs | append-only | `reorg_appends_a_row_and_deletes_nothing` |
| `utxo` | BCH lane, phase 2 | `utxo_row_is_bch_phase_and_confessed` — table present, empty, confessed |
| `xpub` · websocket/SSE · tickers/fees | phase 2 / no | documented in `status.notes`; not a route |
| deliverable | one sealed file | `deliverable_is_one_sealed_file_with_meta_receipts` — WAL truncated, `meta.keyless = true` |

## Stranger's audit

```sh
cargo test -p bindexer                       # the whole matrix, offline
cargo run -p bindexer -- prove-keyless       # the attestation, for CI logs
cargo run -p bindexer -- init --db bindexer.db --chain 7200
cargo run -p bindexer -- ingest --db bindexer.db --from N --to M \
    --oracle-a URL --oracle-b URL            # two independent endpoints = the pair
cargo run -p bindexer -- audit --db bindexer.db   # prints the confession + the SQL to re-run
sqlite3 bindexer.db 'SELECT key,value FROM meta;' # the receipts are in the file itself
```

## Owed (spec §5)

- The Blockscout-class second oracle adapter (trait seam already in place).
- BCH lane (utxos table is live schema, empty, confessed).
- SSE push surface (static-friendly) before any websocket envelope.
- Live exSat smoke run — the acceptance matrix is offline and deterministic by
  design; live endpoints are configured by the operator, never baked in.

**VERIFIED / UNVERIFIED ledger (house pattern):** schema, ingest law, fail-closed
paths, and the matrix tests are VERIFIED (they run in CI). Live exSat behavior is
UNVERIFIED until the first real ingest lands with two production oracles and its
receipt is filed.
