# Genealogy completion after the October 3 interruption

Seat: Codex. Worktree: `C:/Users/travi/wt-codex-genealogy-finalize`.
PR: #336. This continuation uses the isolated checkout; the original
eternalization worktree belongs to another active session.

## Reconciliation

Fetched origin and merged main `42c466b56` without conflicts. Preserved the
Cryptol/SAW PQ batch, its pinned toolchains and all eight workflow families;
there is no change to cryptographic proof scope or verification policy.
The updated commit process was clarified by the founder as Cryptol/SAW PQ,
not a replacement signing identity. Existing secret-scan and identity hooks
remain active and are not bypassed.

The previous head's two failed eternal jobs were the same footer-audit
regression: vending.html CAPS 0 to 1 in each register. Main includes the
selector repairs `b5feafef4` and `571238a25` and later UI work. The audit
baseline remains unchanged. All other checks on that prior head passed.

Current main also includes regenerated research pages, the hint census, and
hosted ANT storage PR #391. Its browser purchase path is limited to 32 MiB;
it does not establish large-archive payment acceptance. Existing bData,
bPay, the ANT quote adapter and Arweave fee adapter remain the owners of
their respective states. No substitute indexer, reader or payer is added.

David Irvine's latest #504 note (2026-10-05) calls for per-kind counters
(#1170) and same-workload delivered/published capture. #622 and #505 remain
closed. No x0x measurement result is claimed by this genealogy lane.

## Source audit

The full comparison against pkg14 hashed 22,151 nonprojected source files:
11,047 changed, zero missing, zero stale person JSON/HTML files. Changes are
all 11,041 person HTML pages and six shared files: profile.html, blood.html,
tour.js, lang-corpus.json, register.js and skaists.css. Records and economics
continue to use the existing public projections. The seven original dirty
screenshot/journey artifacts retain their previous hashes.

The new archive is built from current source, not by relabeling pkg14.
The first prepare refused with `Undeclared interactive dependencies:
surfaces/skaists.css -> surfaces/fonts/skaists.woff2`. The updated stylesheet
references this existing 6,968-byte font; this lane adds it to the reviewed
runtime allowlist. The refusal correctly prevented an incomplete edition.
The captured source was supplemented with that font and the updated
allowlist before preparation was rerun.

The merge-wide whitespace check reported inherited trailing whitespace in
the regenerated pages and verbatim upstream specimens. Those unrelated
bytes were preserved; the final lane diff is checked separately.

Merge commit `8993ce049` passed the active hooks: secret-scan reported clean
for 697,382 added lines, and both identity checks passed. The focused
preservation regression suite passed 19/19, no skips.

## Acceptance boundary

Main advanced again to `0931f62e1` with bView startup and hosted-ANT release
receipts. Merge `64168ece7` preserves those changes and the updated tests
workflow. None of the archive's files changed in that second reconciliation.

Pkg15 is `C:/Users/travi/family-lineage/pkg15.tar`: 22,154 declared files,
266,410,635 content bytes and 286,801,920 tar bytes. Both tar constructions
are byte-identical. All package hashes pass, and all 22,152 nonprojected
files match the current source. The two projected files are source records
and package-safe economics. The source audit is banked in
`docs/receipts/genealogy-staleness-2026-10-10.json`.

- Manifest `39c0e9fb2bc3683ef11e3452fecc37e8d047e2d893b09905558a24b3ee90ebf9` (PUBLIC-CONSTANT; preserve.mjs::verifyPackage).
- Tar `e5e3b013adc3bcbb6967c552f73763b5fee5538d0b43504dca9f7eb57f02711e` (PUBLIC-CONSTANT; build-eternalization-tar.sh::verify_reproducible_eternalization_tar).

Fresh keyless estimates for these exact bytes (October 10 in Denver):

- ANT captured `2026-10-11T03:45:41.910Z`: 5.009055375000000000 ANT storage,
  0.000050000000000000 ETH estimated gas; 72 chunks, Merkle mode,
  priced_sample, existing ant 0.3.9 quote adapter.
- AR captured `2026-10-11T03:44:44.828Z`: 3.708064485204 AR,
  existing arweave.js fee adapter.

The new raw receipt is
`docs/receipts/genealogy-edition-v3-2026-10-10-pkg15.json`. The public economics
and current-edition pointers now name pkg15. Earlier packages are retained
as historical evidence. These estimates do not authorize or prove payment;
the hosted single/wave path's size/mode limits remain separate.

Fresh extraction imports all six runtime modules, resolves the 39-hop
Charlemagne route, reaches generation 143 and retains 13,249 public records
with zero raw transcription values. Local integrity is distinct from
storage-network retrieval. Final CI and live publication results are added
to PR #336's completion evidence after this source/receipt commit.

No payment, upload or wallet operation is authorized or performed by this
completion pass. No localhost server is used.
