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

## Exact edition and fresh quotes

Final edition v3 is local `C:/Users/travi/family-lineage/pkg6-public`, prepared
at 2026-10-02T22:28:35.780Z: 22,153 files, 87,261,925 content bytes, 11,041
person objects and three evidence packs. The reviewed declaration supplies
44 runtime files; its own declaration is also preserved. Local manifest
verification passed all 22,153 entries with no mismatches and no approval.

- Manifest digest: `3c97337a2cc7650234bddc6f33a9c54a2bcea2b40cc49a6d22259f459c60c85e` (PUBLIC-CONSTANT; `preserve.mjs::verifyPackage`).
- Final `pkg6.tar`: 107,796,480 bytes; digest `da1b983d43fef73835dbd3cd6e8c74176420728a2f86258b501b1db4ab7d23a5` (PUBLIC-CONSTANT; `build-eternalization-tar.sh::verify_reproducible_eternalization_tar`).
- Two GNU tar constructions were byte-identical. A temporary Windows tar
  transported the verified package into WSL; it was not the quoted artifact.
- Fresh extraction loaded all six runtime modules, resolved the 39-hop
  Charlemagne route, counted 36 people at generation 44 and reached 143
  generations. Its 13,249 source records contained zero raw evidence values.
  This is local restoration, not storage-network retrieval or browser proof.
- ANT capture at 2026-10-02T22:35:23.498Z: 29 chunks, `priced_sample`,
  3.645898464843750000 ANT storage plus 0.000150000000000000 ETH gas.
  Source: `capture-ant-quote.mjs::captureAntQuote`, ant 0.3.9, private
  byte-verified snapshot. Storage exceeds the standing 2.5 ANT ceiling;
  estimated gas is within 0.0002 ETH. Paid upload remains code-disabled.
- AR capture at 2026-10-02T22:35:05.019Z: 1350464003759 winston,
  1.350464003759 AR for the same tar size. Source: `surfaces/arweave.js::fee`,
  public size-based price GET, HTTP 200. No USD conversion inferred.

Raw quote inputs, timestamps, artifact binding and false progression states
are committed in `docs/receipts/genealogy-edition-v3-2026-10-02.json` and the
public storage-economics record. The package-safe economics projection is
byte-identical after publishing the new quote, avoiding a self-reference.
Earlier pkg3, pkg4/v2 and pkg5 quotes do not price this final artifact.
No approval, purchase, upload, network retrieval or storage hash verification
is claimed. The historical economics scenarios are explicitly separated.

## Final source validation and publication boundary

All 471 genealogy Node tests passed, zero skips, in 31.154 seconds. The final
19-test preservation/depth subset passed including missing multiline imports,
CSS string imports and both video references. The classic tree no longer
depends on successful ES-module loading. Three depth-label rows contain all
29 languages and retain generation placeholders; translations remain machine
drafts under the existing corpus policy. GitHub runs browser acceptance;
no localhost server was started on this machine.

All seven pre-existing screenshot/journey artifacts were rehashed against the
starting snapshot and remain byte-identical and unstaged. The hook installer
refused to replace the existing shared hook; its secret-scan/identity delegates
were retained, the hook fixture battery passed, and commits passed both hooks.

PR #308 contains the publication changes. At this receipt commit, its final
merge and Pages deployment are pending; #305–#307 deployment is verified above.
The public browser remains open for verification after GitHub Pages publishes.
