# Genealogy chart viewport and final preservation edition

Seat: Codex, `C:/Users/travi/wt-codex-genealogy-eternalization`.

Follow-up to #311: the reported E Anna Tum DE LAGASH fan-chart cell also
clipped vertically. Live DOM measurement found a 446.40 px stage but a 150 px
SVG. The host's `.combwrap svg { height:auto }` beat the atlas stylesheet.
The atlas now owns its viewport through a more specific selector. A stage
ResizeObserver reapplies the existing camera when a hidden view becomes
visible or its panel resizes; it disconnects on destroy. Saved root,
selection, pan and zoom remain authoritative.

The open public browser also retained the earlier module after #311's
successful Pages run 37077535845. The host now versions both chart asset URLs
so reloads request the corrected renderer and CSS. This follows the measured
glyph-fitting fix in #311, rather than replacing full person names or records.

Validation before publication: 49 atlas tests and 48 navigation tests passed;
the existing import wiring assertion now permits an asset version query.
No localhost server was used. Live geometry verification follows deployment;
source tests alone do not prove browser rendering.

## Superseding artifact and quote

`C:/Users/travi/family-lineage/pkg10.tar` supersedes pkg8 and the intermediate
pkg9. The final package includes the corrected renderer, CSS and host URL
versions. It contains 22,153 files and 87,265,203 content bytes. All declared
files verified; two tar constructions reproduced byte-for-byte. A fresh local
extraction imports all six runtime modules, reaches generation 143, finds 36
people at generation 44, resolves the 39-hop Charlemagne route and retains
zero raw evidence values in 13,249 public source records.

- Tar: 107,806,720 bytes; `c5af1181cbd2fbce9016277f1a53c0e7c598ab9fe9f0cbaceb02d2d4fc9ae855` (PUBLIC-CONSTANT; `build-eternalization-tar.sh::verify_reproducible_eternalization_tar`).
- Manifest: `28ba77a9e3ce685cd279c19a074b79c569057e000ba971d65ab4daffa364d77d` (PUBLIC-CONSTANT; `preserve.mjs::verifyPackage`).
- ANT quote: 2.762555859375000000 ANT storage plus 0.000150000000000000 ETH gas;
  29 chunks, priced_sample, captured 2026-10-02T23:31:14.048Z through
  `capture-ant-quote.mjs::captureAntQuote` against a byte-verified snapshot.
- AR quote: 1.350464003759 AR, captured 2026-10-02T23:30:51.531Z through
  `arweave.js::fee`, size-based public GET.

ANT storage remains above the 2.5 ANT ceiling. Payment is code-disabled;
no approval, purchase, upload or network retrieval occurred. Both quote
receipts bind to the final artifact. Seven original screenshot/journey
artifacts were hash-checked unchanged and remain unstaged.

Hive text records with AR/ANT attachment pointers remain a design proposal;
this chart repair does not establish a live Hive publisher or Hive bIndexer.
