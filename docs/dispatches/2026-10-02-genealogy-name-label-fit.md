# Genealogy map names fit their cells

Seat: Codex, `C:/Users/travi/wt-codex-genealogy-eternalization`.

The public fan chart at root `pc996e1efee` rendered the shortened name
`E Anna Tum DE LAG…` at 120.44 px across a roughly 100.4 px hexagon. The old
18-character cutoff ignored font metrics and cell radius. Full identity and
the selected research person are separate from the map root by the existing
navigation contract; this change preserves that contract.

`surfaces/blood-atlas.mjs::fitCellLabel` now fits measured glyph widths into
at most two lines, preferring word boundaries and retaining Unicode graphemes.
The renderer derives usable width from each hexagon or pedigree box, fits the
year separately, and omits captions on cells too small to contain them.
Each SVG text run carries its measured length so a webfont swap cannot spill
outside the cell. Zoom and completed font loads refit captions; ordinary pan
moves do not remeasure them. Full names remain in aria-labels, titles, research
cards and tree rows. No person record or relationship is edited.

Validation: all 49 atlas tests passed, including variable-width names, the
reported name, narrow cells, CJK names and combining accents. No localhost
server was started. The prior #310 full six-job CI run 37074564803 has now
completed successfully, including the repaired footer audit.

## Updated preservation edition

The updated edition is `C:/Users/travi/family-lineage/pkg8.tar`, built through
`preserve.mjs` and `build-eternalization-tar.sh::verify_reproducible_eternalization_tar`.
It contains 22,153 files and 87,264,676 content bytes. Manifest comparison with
pkg7 proves only `surfaces/blood-atlas.mjs` changed; 22,152 file hashes match.
Two tar constructions reproduced byte-for-byte. Local extraction loaded all
six runtime modules, reached generation 143, resolved the 39-hop Charlemagne
route and retained zero raw evidence values in 13,249 public source records.

- Manifest: `3741d430a0e0eff77aa450a74f3fa7e478140e1d555479f9bbda8f5f4c662d5f` (PUBLIC-CONSTANT; `preserve.mjs::verifyPackage`).
- Tar: 107,806,720 bytes; `876422ee0d0848a89235a8002ed31e6f19fb834cc50f9bf1a91bacb658bc7eee` (PUBLIC-CONSTANT; reproducible tar builder above).
- ANT: 2.762555859375000000 ANT storage plus 0.000150000000000000 ETH gas,
  29 chunks, `priced_sample`, captured 2026-10-02T23:24:58.390Z by
  `capture-ant-quote.mjs::captureAntQuote`, ant 0.3.9, private byte-verified snapshot.
- AR: 1350464003759 winston / 1.350464003759 AR, captured
  2026-10-02T23:24:32.119Z by `surfaces/arweave.js::fee`, public price GET.

The canonical economics record and quote receipt now bind to pkg8. Earlier
pkg7 prices describe that earlier artifact. Storage still exceeds the 2.5 ANT
ceiling, and the client cannot enforce both payment ceilings atomically.
No approval, payment, upload or storage-network retrieval occurred.

The seven pre-existing screenshot/journey artifacts remain unstaged. Final
GitHub Pages publication and browser geometry checks follow this commit;
source tests and local restoration are not a claim of live browser acceptance.
