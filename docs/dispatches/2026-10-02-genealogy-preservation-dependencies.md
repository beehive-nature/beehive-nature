# Genealogy interactive preservation and full-depth publication

Seat: Codex, `C:/Users/travi/wt-codex-genealogy-eternalization`.

The public edition omitted the scripts, styles and fonts that run the current
genealogy experience. The builder now includes a reviewed runtime declaration
and refuses missing files, undeclared module imports, stylesheets, media and
font dependencies before replacing a package. It reuses the existing archive
resolver, person panel, blood navigation/atlas, Latvian tree, model/lifespan
helpers, shared chrome, fonts and profile media. It does not copy arbitrary
directories or add private raw source transcriptions or record-image bytes.
The 44 additional runtime files and their declaration preserve the existing
person pages, fan chart and noble-relative collection. External navigation and
live chain/service calls remain external; this is not an offline copy of the
entire estate or proof of delivery from permanent storage.

## 44+ generations throughout the genealogy system

The old headline used `spineGenerations` (42 rows on one selected route) as
the depth of the archive. `model.mjs::generationStats` now uses the existing
cycle-safe `depths` traversal: founder is generation zero; each published
relative is counted at its shortest recorded parent distance. The current
corpus reaches 143 generations under that definition. Corpus metadata,
pipeline output, profile data/fronts, archive headline and generation explorer
share this measure. A selected spine remains a separate route, not a cap.
The small tree/fan rendering windows remain bounded for performance, with
navigation through the full archive. Recorded and legendary claims do not
become verified relationships because a path is long.

## Inventory and reuse boundaries

| Component | Located capability and role | Current evidence / reuse |
| --- | --- | --- |
| Hive bIndexer | Separate investigation from the Rust chain indexer. The Hive read-ingestion pattern is mentioned in `docs/ledger/pirate-haul-candidates.md`; related ATP ingestion is deferred there. | Searched this checkout, the Hive worktree, and organization GitHub code. No distinct deployable Hive bIndexer implementation or configured endpoint located. `api.hive.blog` answered a keyless chain-head request, which is node availability, not bIndexer integration. No invented implementation or throughput claim. |
| Hive wallet adapter | `surfaces/wallet-adapter-hive.js::hiveCall`; native JSON-RPC, balance-only capability. | Reuse boundary for Hive RPC conventions. It cannot publish genealogy records or replace an indexer. |
| Vaulta Reader | `surfaces/blight/vaulta-reader.html::vpost/read`; keyless table reads with endpoint fallback, pagination and explicit caps. | Its first endpoint returned 10 registry rows with `more:true`; an actual read, not a complete table or genealogy anchor. Reuse for registry/address resolution. |
| Rust bindexer | `crates/bindexer`: Rust/SQLite chain-derived view, exSat/EVM first, BCH schema seam. `serve.rs::route` exposes read routes. | Implemented chain ingestion/indexing; no genealogy production database or Hive adapter demonstrated in this run. Reuse for chain receipts where its supported adapters fit. No live exSat ingest claimed. |
| bData | `surfaces/bdata.js`, `tools/antd-bridge/intake-server.mjs`: artifact intake, audience policy, history and preservation handoff. | Existing port 8807 reported intake ready, quote backend disconnected; direct 8817 health was unreachable. No local server started. Keep bData as artifact/policy owner; the existing standalone quote capture supplies this edition's estimate. |
| bPay | `tools/genealogy/bpay.mjs`: quote, invoice, authorization, settlement, receipt, reconciliation. | Reuse the state separation. Its default `ARCHIVE_CONTEXT` is historical pkg3 and is not reused as authorization for this edition. No invoice, receipt or authorization fabricated from an estimate. |
| ANT adapters | `surfaces/myspace-adapter-ant.js`; `tools/connect-store/adapters.mjs::AutonomiReadStore`; `tools/genealogy/capture-ant-quote.mjs::captureAntQuote`. | Reuse the committed snapshot-bound, keyless CLI quote capture. Browser prepare/finalize and storage retrieval are implemented paths, not live acceptance of this archive. Paid genealogy upload remains disabled by `preserve-service.mjs::PAYMENT_CLIENT_CAPABILITY`. |
| AR adapters | `surfaces/arweave.js::fee`, `surfaces/wallet-adapter-arweave.js`. | Reuse token-native public price lookup for the exact tar size. No signer or submit path invoked. AR retrieval and publication remain unverified for this edition. |

Performance decides the function: the existing in-browser graph serves
genealogy navigation; a Hive-derived index could serve text discovery and
version history; Vaulta serves small registry reads; Rust bindexer serves its
supported chain receipt queries; ANT/AR carry larger immutable artifacts.
These are role assignments, not unmeasured scalability benchmarks. Avoid
replicating the entire genealogy corpus into each chain-specific component.

## Hive text wiki and immutable evidence pointers

The founder's proposed next capability is an opt-in text edition of deceased
blood relatives: a versioned record for each relative, citations and separately
labeled relationship claims, plus a root manifest. Hive's documented `comment`
operation supports text and metadata and updates by author/permlink. This is a
design proposal, not a delivered signer, publisher or Hive bIndexer integration.
Source: <a href="https://developers.hive.io/apidefinitions/broadcast-ops.html" target="_blank" rel="noopener noreferrer">Hive API documentation (opens in a new tab)</a>.
Implementation-source verification of these Hive semantics is UNVERIFIED;
the citation establishes documented API behavior, not a tested integration.

Larger documents, images and snapshots belong behind ANT/AR pointers. Each
pointer should carry scheme/address, SHA-256, byte size, media type, source
attribution and version. Keep submitted, confirmed, retrieved and hash-verified
states separate. Corrections point to a new immutable object and retain the
superseded reference. A blockchain stores a claim's provenance, not proof that
the genealogy is true. Living/private material and raw transcriptions remain
outside this public edition; no Hive write is authorized or attempted here.

## Deployment and verification

GitHub reports #305 merged at `402236448`, #306 at `501ad553c`, and #307 at
`5237c66cb`. Pages build 1255949426 reported `built` for #307's full merge SHA
at 2026-10-02T21:36:10Z. The public skaists.dev browser displayed the Latvian
tree, 905 noble research entries and the 39-hop recorded Charlemagne journey.
That check also exposed the stale 42-generation headline corrected here.

The focused local battery passed 175/175: model, archive resolver, atlas,
navigation, Latvian tree, preservation, depth metadata and disabled payment
service boundaries. No preview/localhost server was started. Existing seven
screenshot/journey artifacts remain outside the changes. The corpus hash pin
on the profile was refreshed after its depth metadata changed.

Upstream priority checked before implementation: David's September 30 comment
folds #622 back into open x0x #504 (slices 3–5, per-pair delivery measurement,
legacy DM-bus counters/A-B). #505 carries September 15 field acceptance and is
closed. No new mesh measurement or upstream reply is claimed by this lane.

Exact rebuild, quote and publication receipts follow below.
