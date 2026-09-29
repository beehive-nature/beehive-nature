# zCode — education-i18n recovery LIVE ACCEPTANCE (PR #65, merge 6e96229d) — 2026-09-12

Seat: zCode (z1.a's cure accepted; this is the live-translation acceptance
assignment). Verdict: **ACCEPTED LIVE** — the recovery is whole on
skaists.dev, byte-faithful to the merge tree, and renders in all six
priority tongues (ru lv th gd tt uk) through the real picker path. One
honest carve-out (unrecorded en-fill cells, enumerated below) and two
instrument lessons. No defects in the merge, the deploy, or the render.

## Live state proven

- PR #65 MERGED `6e96229d` (2026-09-12T23:02:40Z); #63 and #43 CLOSED
  superseded. Pages build for `6e96229d`: **built** 23:03:09Z (cname
  skaists.dev). Live URLs: `https://skaists.dev/surfaces/…`.
- **Byte-pin (raw bytes vs `git show 6e96229d:` blobs):**
  blanguage.html `58e1d9a72901` · bnames.html `8a3081223b6d` ·
  bset.html `5969daa4f566` · lang-corpus.json `b14c33348d20` — all four
  live==blob. Every repo-side gate result therefore transfers to live.
- **Corpus cells live:** all **243 restored keys present**; the six
  priority tongues non-empty for every key; 29-tongue integrity (no empty
  cell in any restored row); restored values **verbatim from #43's head
  `ab9be3d4`** (0 mismatches ×6 tongues); the **23 superseded cells keep
  pre-recovery main (`d32acdf9`) values LIVE** — the zero-clobber property
  holds on the deployed corpus, not just in the PR diff.
- **Selftest law (checker-silence proof):** the same cell checker run
  against `d32acdf9`'s corpus reproduces exactly **243 missing keys** —
  the live PASS is a measured difference, not a vacuous pass.
  (`e2e/edu-i18n-live-acceptance.mjs --selftest`.)
- **DOM render proof (Chromium 390×844, tongue set through the estate's
  own persistence path `localStorage.blang`, live URLs, zero page
  errors):** every restored key that HAS a translated cell renders
  translated, all six tongues × all three ported pages —
  blanguage 57 restored keys bound, bnames 24, bset 16.
  ru/tt/uk: 100% of restored keys render translated. Eight receipts in
  `e2e/shots-edu-i18n-live/` (blanguage ×6 tongues + bnames-ru + bset-uk).
- Cache window: corpus served `cache-control: max-age=600` — cached
  visitors converge on the recovery within 10 minutes; fresh visitors
  immediately.

## The verifier's numbers, reconciled to the trees

Independent scalar-cell verification (7,076 examined / 7,053 restored /
23 preserved / 0 incorrect / 0 overwritten) matches the trees exactly:
243 absent keys × 29 tongues = **7,047 restored** + 6 already-equal =
7,053 now-equal + **23 superseded kept** = 7,076 changed cells. The
earlier 42-cell Sanskrit alarm is closed as a review-script defect
(nested legacy `sa` objects miscompared); no `st.*` row exists in
`docs/receipts/edu-i18n-recovery-cells.tsv`, and live-side the
superseded-preserved check above covers it. One bookkeeping note, not a
defect: the cure dispatch's absolute corpus counts ("1,351 → 1,594")
were mis-based; the trees say **1,107 → 1,350 keys** — the +243 delta
and all cell math are exact.

## Honest carve-out — unrecorded en-fill cells in #43's drafts

A small, enumerable subset of the restored cells is **equal to English
in the drafts themselves** (they render English live by draft, not by
any merge/deploy fault); `_meta.enfill` records only the
wallet-voucher-panel set, so these are unrecorded:

- over all 243 restored keys: ru 5 · lv 6 · th 9 · gd 6 · tt 5 · uk 5
- user-visible on the three live pages: **lv: bld.cmp.dock · gd:
  bld.cmp.dock · th: bld.title, bld.cmp.dock, bst.quote, bst.h.set**
  (ru/tt/uk: none visible)

`bld.cmp.dock` ("BlanguageDOCK") and `bld.title` th read as deliberate
brand-name keeps (estate practice keeps proper nouns); `bst.quote` is
the wOlf quote. Whether these are correct keeps or gaps is meaning
review (#7 stays open for the whole ⚙ machine-drafted set). Recording
them in `_meta.enfill` would restore the enfill law's
"honest, never disguised" standard — one-line follow-up, not urgent.

## Instrument lessons (for the next live acceptance)

1. **Byte-pin against git blobs with raw-byte equality**, never the
   worktree disk file + text normalization — trailing-newline and
   CRLF normalization both manufacture false mismatches (bit me once).
2. **Never hard-gate a Latin-script tongue on diacritic presence** —
   Scottish Gaelic is diacritic-sparse by nature ("sreathan", "lorg"
   are fully translated and diacritic-free); gate on `rendered ≠ en`
   and count script presence as informational. Cyrillic/Thai held
   95.9–97.5% anyway.

## Artifacts

- Instrument: `e2e/edu-i18n-live-acceptance.mjs` (phases A byte-pin,
  B corpus cells + en-fill census, C DOM proof; `--selftest` = the
  checker-silence proof)
- Shots: `e2e/shots-edu-i18n-live/` ×8 at 390px
- Row-level recovery receipts (carried by the PR):
  `docs/receipts/edu-i18n-recovery-{cells,superseded}.tsv`
