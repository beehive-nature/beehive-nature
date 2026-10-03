# Genealogy public edition refresh

Seat: Codex, `C:/Users/travi/wt-codex-genealogy-eternalization`.

Origin was fetched before changes. The resumed checkout was on
`codex/plur-entry-completion`, with seven modified screenshot/journey files.
Those files remain byte-identical and unstaged. This lane branches from
`origin/main` at `0ce0ff781`; the existing PLUR commit and branch are retained.

## Reconciliation and live deployment

The handoff understated merged work: #305–#307 and #308–#312 are merged.
The latter added the reviewed runtime declaration and repaired chart labels
and viewport height. #326 also merged the completed image queue's public
summary: 308 private images represented by public metadata, with the raw
images excluded. Its temporary 100 ANT storage policy is recorded in
`ETERNALIZATION-EDITION-V2.json::separatedCeilings`. The public economics
receipt still said 2.5 ANT; this lane reconciles that display without enabling
payment or changing the separate 0.0002 ETH policy.

Pages run 37106192855 completed successfully for `0ce0ff781`, with the build
API reporting `built` at 2026-10-03T07:43:39Z. Six live HTTP 200 files matched
the checkout byte-for-byte: blood host, atlas module/style, Latvian tree,
person-panel corpus adapter, and public image summary. Exact hashes and
browser observations are in `docs/receipts/genealogy-live-2026-10-03.json`.
This verifies the existing deployment, not deployment of this new commit.

The public browser showed 11,041 deceased relatives, 143 recorded generations,
36 people at generation 44 and 905 noble entries. The fan SVG measured
1049.33 by 445.06 px. The Charlemagne journey opened and reported 39 hops;
its evidence remains labeled `unsourced-entry`. DOM automation timed out
during that interaction; after reload, the accessibility API completed it.
skaists.dev remains open. No localhost or preview server was started.

## Concrete preservation repairs

`preserve.mjs::declaredContents` now derives person HTML pages from the same
published corpus as person JSON objects. Stale directory entries cannot
silently enter an edition, and missing declared pages stop preparation.
`preservation-runtime.mjs::checkRuntimeDependencies` now checks person pages
as well as the shared runtime. Missing page scripts/styles/media therefore
stop preparation instead of producing a broken restored research page.

All 475 genealogy Node tests passed, zero failures or skips, in 208.701 s.
The focused preservation/service suite passed 33 tests, including the new
stale-page, missing-page and missing-page-dependency regressions. Expected
adversarial refusal diagnostics are in the local test log at
`C:/Users/travi/family-lineage/genealogy-refresh-tests.txt`.

The hook installer refused to overwrite the existing shared hook. Inspection
confirmed its secret-scan and identity-check delegates; they remain intact.

## Existing infrastructure and other seats

The existing archive resolver, runtime declaration, public projection,
deterministic tar builder and ANT quote capture are reused. AR quotes use
`surfaces/arweave.js::fee`. bData remains the artifact/policy owner; bPay's
quote/invoice/settlement/reconciliation separation is retained. Its historical
default archive context is not an authorization for this edition.

The prior component inventory remains applicable: Hive wallet RPC is not a
Hive publisher/indexer; no separate deployed Hive bIndexer endpoint was
established by this lane. Vaulta Reader remains the existing keyless registry
reader, and Rust `crates/bindexer` remains the supported-chain receipt indexer.
Neither is replaced or represented as a tested genealogy publication service.

Antigravity's #324 is still open at `a373beaf7`. Fable's latest review corrects
the gas criterion to an aggregate upload budget across approval and payment
batches; a per-transaction check alone is insufficient. Its pending adapter
work is preserved. #325's browser file-read work is also open and is not
counted as archive publication. This lane does not enable the paid endpoint,
change either branch, or claim their proposed behavior as deployed.

David Irvine's latest #504 comment still carries the folded #622 work:
slices 3–5, receiver/sender per-pair measurements, legacy DM-bus counters and
the Home A/B. #622 and #505 are closed; their badges do not substitute for
those acceptance terms. No mesh measurement or upstream reply is claimed.

## Current artifact and fresh quotes

`C:/Users/travi/family-lineage/pkg12.tar` supersedes pkg10. A fresh Windows
prepare of current source produced pkg11-public; comparison of all 22,153
manifest entries against pkg10 found only the image-summary content changed.
The final WSL build reused pkg10's verified bytes, copied that current summary
and the source records/economics inputs, then ran the repaired preparation,
verification and reproducible-tar tools. Its comparison against the fresh
current-source manifest differs only in package-safe economics (100 ANT).
No declared file disappeared. The private raw records are projected again.

- Declared content: 22,153 files, 87,248,672 bytes; 11,041 person objects,
  three evidence packs, 44 runtime files plus their declaration.
- Manifest: `16bc9081d2e1e7169bf9ff93314ccc343f0a5727c4a8aef536232ec23f0726c5` (PUBLIC-CONSTANT; `preserve.mjs::verifyPackage`).
- Tar: 107,786,240 bytes; `71c759ba9f0740a5167e0be6de8e20e3e29181985192dc467eade84dfa4661d6` (PUBLIC-CONSTANT; `build-eternalization-tar.sh::verify_reproducible_eternalization_tar`).
- ANT at 2026-10-03T07:51:16.962Z: 29 chunks, `priced_sample`,
  3.655445100585937500 ANT storage plus 0.000150000000000000 ETH estimated
  gas. `capture-ant-quote.mjs::captureAntQuote`, ant 0.3.9, byte-verified
  private snapshot. Both estimates are within the recorded policy; atomic
  enforcement is still absent, so payment remains code-disabled.
- AR at 2026-10-03T07:50:54.719Z: 1353564954399 winston, or
  1.353564954399 AR; existing `arweave.js::fee`, HTTP 200 for this tar size.

Fresh extraction loaded six runtime modules, resolved the 39-hop route,
reached generation 143 and retained zero raw evidence values across 13,249
public records. These are local restoration checks, not network retrieval.
The full raw quotes and artifact binding are in
`docs/receipts/genealogy-edition-v3-2026-10-03.json`.

Execution failures are retained: copying 22,153 Windows files into WSL was
too slow (1,056 copied after several minutes); only this lane's verified copy
process was terminated and replaced with the manifest-compared tar reuse.
The build wrapper's final display command returned exit 1 because its final
filename carried a CR character (`pkg12-tar.json\\r`). Preparation, validation,
both identical tar builds and extraction audit had already succeeded and
written their receipts. The wrapper was normalized to LF; the final tar
receipt and manifest comparison were read successfully separately.

No wallet access, payment, upload, storage-network retrieval or network
hash verification occurred. The historic v2 payment gate is not promoted by
this quote receipt. GitHub CI and publication of this new branch are separate
from the existing deployment verified above.
