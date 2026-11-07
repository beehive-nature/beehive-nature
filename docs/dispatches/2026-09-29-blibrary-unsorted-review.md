# RECEIPT — bLibrary refinements: archival-date correction, label semantics, unsorted review

**Date:** 2026-09-29 · **Seat:** 5.3 Flash / zCode (bLibrary corpus worker) · **Branch:** `zcode/blibrary-corpus-inventory-2026-09-26`
**Orders worked:** founder refinements 2026-09-29 (verify the 1910 label; make "high" mean collection-program relevance visibly; keep topic/filename clues provisional; review the ten unsorted; refresh routing) — no approval sought, none needed.

## THE 1910 LABEL — verification and correction

**The document is a scan.** `OA-1999-a-review-on-sisal-fiber-reinforced-polymer-composites.pdf` contains zero text streams and zero fonts — 27 image XObjects, "pagina01" as its own title (new tool `peek-pdf-text.mjs` extracted nothing; structure diagnostic confirmed). No in-document textual evidence exists.

**The producer date is impossible.** The "1910" came from pdf-info CreationDate while the same dictionary declares producer "Acrobat Distiller 3.0 for Windows" — a 1996–1998 product. Claims on file (all preserved): `1910 (pdf-info CreationDate)` vs `1999 (filename)`.

**External check:** Crossref title search returns near-neighbors (sisal-composites chapters, 2008) but no exact match; OpenAlex exact-title search rate-limited (its known shared pool). **Result: publication year UNRESOLVED beyond the 1999 filename claim** — recorded as such, not guessed.

**Rule corrections landed (the load-bearing part):**
1. `enrich.mjs` year display is now RANKED: textual claims (filename/title/DOI) beat producer machine dates (CreationDate/xmp CreateDate), which are producer artifacts and **never publication year**. Sisal display year: 1999; the 1910 claim stays preserved in `metadata_claims`.
2. `route.mjs` archive-record now requires a **non-producer year source** (filename/title text) in the 1500–1950 band. Both false positives are gone: sisal and the `D:0000` record. Current archive-record count: **0** — no record currently carries a textual pre-1950 year claim; the genuine 1833/1836/1886 title-sweep finds will earn it through the filename-year path when present.

## LABEL SEMANTICS MADE VISIBLE

- Every `high` routing `why` now reads "**aligned with the ACTIVE collection program** … — collection-program relevance, **NOT evidence quality**".
- `search.mjs` prints a standing legend on every routed query: `research_value = collection-program relevance (active phase / founder curriculum), NOT evidence quality · decisive is human-only · domain shown as folder-based, ~X = provisional keyword clue`. New `--why` flag prints a record's full routing reason + evidence.
- **Provisional axis split:** keyword-derived domains (acquisition topic / title / filename clues) moved from `domain` to a separate `domain_provisional` array — never folded into the folder-based filing axis. Current provisionals: robotics 5, cryptography 2, cannabis 2, economics 2, other 2, history 1, governance 1.
- Years displayed from producer dates now carry a `*` plus footer: "NOT publication year; treat as provisional".

## UNSORTED REVIEW (10 files)

**6 filed on extracted-text/title evidence** (new scoped tool `promote.mjs`: OVERRIDES insert into `blibrary-subjects.mjs` — the documented promotion path — + move + SESSION-LOG receipt block; idempotent; verified module still imports before any move):

| file | filed to | evidence |
|---|---|---|
| 1015914871-415-2017-Article-8663.pdf | cannabinoid-medicine | Springer 2017 "Cannabidiol as a treatment for epilepsy" |
| 998571204-1-s2-0-S2214714425001096-main.pdf | extraction-biorefinery | Elsevier review: cellulose/lignin/hemicellulose recovery |
| 727071312-nutrients-12-03704-v3.pdf | hemp-food-nutrition | Nutrients 2020 review: plant proteins, nutritional quality |
| 825471728-Henrietta-s-CHAPTER-ONE-1.pdf | cannabis-policy-economics | thesis ch.1 "Legalizing cannabis for medical and industrial uses" |
| 988186462-Chad-Ulven-CV.pdf | hemp-fibre-composites | NDSU mechanical-eng biocomposites researcher CV |
| 861926864-C05-PPT-Slides-2021.pdf | green-reset-books | "Bitcoin, blockchain, and cryptocurrencies" slides (Pedersen) |

**4 stay unsorted, documented not guessed:** `1055440149-SB-220.pdf` (Ohio Senate legislative text; no hemp/cannabis terms extractable — filing it would be guessing), `849494705-ProjectPresentation2.pdf` (no extractable text), `SelfAuthentication.pdf` + `bnr-mission-control.pdf` (estate-internal artifacts with no hemp-taxonomy home). All preserved, indexed, routed `unknown/unknown`.

One mid-run correction honestly noted: the first promote pass recorded the Elsevier filename with dots (`1-s2.0-`) where disk truth is hyphens (`1-s2-0-`); the OVERRIDES key was repaired and the file filed on the re-run (idempotency verified). The estate sorter's global `--do` was deliberately NOT used — its dry-run also proposes the 7 SCRIBD root files owned by the Scribd lane's manifest.

## REFRESHED CHAIN (2026-09-29 files)

`inventory → enrich → route` re-run end-to-end: **1488 documents, 1488/1488 CLEAN, 0 blockers, 3 dup groups, unsorted now 4**. Routing: high 690 / useful 529 / routine 265 / unknown 4; evidence_type: paper 1365 · book 32 · manual 2 · unknown 89 (no archive-record); confidence: rule-matched 1477 / partial 7 / unknown 4; `decisive_auto_assigned: 0`.

**Verified search examples:** sisal record now shows `1999` (no producer-date asterisk) and `paper`, not archive-record; `--subject unsorted` returns exactly the 4 documented stays; `--value high --why` shows the glossed reason inline; legend prints on every routed query.

## BOUNDARY NOT CROSSED

Zero deletion; the 6 moves are receipted organization with OVERRIDES evidence; SCRIBD root files untouched; shared `blibrary-subjects.mjs` edited only via its documented extension point in a no-run window (OA rail 09:00/21:00, Scribd cron 09:30; next fire hours away), import-verified before any move; no UI; no policy; no acquisition beyond ordinary public bibliographic lookups (Crossref/OpenAlex reads, both receipted above).
