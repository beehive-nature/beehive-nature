# RECEIPT — bLibrary index maintenance: stale-snapshot guard + sisal publication evidence (correction)

**Date:** 2026-09-29 · **Seat:** GLM-5.3 / zCode (scale-out: library index maintenance) · **Branch:** `zcode/blibrary-index-maint-2026-09-29` (stacked on `zcode/blibrary-corpus-inventory-2026-09-26` @ 3378db856)
**Orders worked:** scale-out order (stale routed index check; scanned sisal review-page inspection; dated dispatch + focused draft PR; no corpus moves, no Scribd schedule/manifest touches).

## RECONCILIATION (before labor)

- Origin fetched; prior receipt commit **3378db856 is the tip** of `zcode/blibrary-corpus-inventory-2026-09-26`, NOT yet on main, no open PR for it. The prior session's worktree `wt-bLibrary` verified CLEAN at that tip (no uncommitted WIP to absorb).
- Duplicate-work check: full-ref history of `scripts/library/search.mjs` — newest change anywhere is 3378db856 itself. **No other seat fixed the stale-index bug**; this seat owns it. Own worktree `wt-zcode-library-maint` created (one writer per worktree law); shared checkout and `wt-bLibrary` untouched.

## 1. THE STALE ROUTED INDEX — bug present, fixed, tested

`search.mjs` preferred routed-*.jsonl **whenever any existed** (`useRouted = routed.length > 0`), with no date comparison. Consequence: after a fresh `enrich` run (new documents, new `enriched-<day>.jsonl`) but before `route` re-runs, search served the older routed snapshot and **silently hid every newly enriched document** — no signal.

**Fix (day-granularity guard, filename dates being the only clock):** when the newest enriched date is newer than the newest routed date, search now serves the enriched snapshot and prints a loud stderr line — `STALE ROUTED INDEX: … serving the enriched snapshot so no newer document is hidden; routing labels (--value/--domain/--etype) are absent until route.mjs re-runs`. Routing filters then honestly return zero (no `routing` blocks in an enriched snapshot) instead of answering from stale labels. Same-day routed (the normal chain: route derives from same-day enriched) stays preferred; the known granularity limit — a same-day re-enrich after routing is indistinguishable — is documented in the code comment.

**Tests (6, synthetic runtime-constructed fixtures only):** stale-routed-no-longer-hides (day-newer enriched record found + warning printed) · stale fallback returns zero for routing-only filters · same-day routed preferred with legend · routed-newer preferred · enriched-only path preserved · no-snapshot exit 2. `node --test` per-file: **9/9 green** (6 here + 3 below). Directory-form invocation still trips the known Node quirk (executes the dir); per-file form is the runnable one.

**Real-corpus verification (read-only):** corpus `~/Downloads/hemp-research` has enriched-2026-09-28, enriched-2026-09-29, routed-2026-09-29 — newest of both days equal ⇒ routed preferred, zero behavior change on today's state (query `--q sisal`: 1/1488, index routed-2026-09-29, labels print). The guard only changes behavior in exactly the hiding window it exists for.

## 2. peek-pdf-text.mjs — LZWDecode support (the tooling gap behind a wrong verdict)

The 09-29 refinement dispatch recorded the sisal PDF as "scan-only: zero text streams, zero fonts". **Both halves of that measurement are corrected here:** the file declares fonts (obj 15 resource dict, five /F-entries) and carries **13 LZW-compressed text content streams** — `peek-pdf-text.mjs` only inflated FlateDecode streams, so an entire Distiller-3-era compression class was invisible to it. (Image count also re-measured by full object enumeration: **19 /Subtype /Image XObjects**, vs the prior diagnostic's "27" — different counting method, recorded as method-dependent.)

**Fix:** `peek-pdf-text.mjs` now decodes LZWDecode streams (PDF LZW: 9→12-bit codes, early-change width growth, 256/257 clear/EOD) alongside Flate. The decoder is proven against the real corpus: exact expected byte counts on five Distiller-LZW images (250×23, 250×21, 365×250, 396×331 — every decode length == width×height), and full text extraction from all content streams of the sisal PDF itself. Tests (3, synthetic): LZW round-trip through the real CLI **past the 511-entry width growth** (the test's encoder grows one entry later than the decoder — the encoder table runs one entry ahead; mismatch caught and cured empirically, logged here because it bit mid-run) · Flate regression · empty-PDF no-crash.

## 3. SISAL PUBLICATION EVIDENCE — decisive, in-document, textual

Running the corrected extraction on `OA-1999-a-review-on-sisal-fiber-reinforced-polymer-composites.pdf` (13 pages, printed pagination **367–379**), page 1 title block reads:

> **"Revista Brasileira de Engenharia Agrícola e Ambiental, v.3, n.3, p.367-379, 1999 — Campina Grande, PB, DEAg/UFPB"**

with the abbreviated form ("R. Bras. Eng. Agríc. Ambiental, Campina Grande, v.3, n.3, p.367-379, 1999") repeated in the running header of **every** page. Authors from the same text layer: Kuruvilla Joseph, Romilda Dias Tolêdo Filho, Beena James, Sabu Thomas, Laura Hecker de Carvalho.

**What this changes, under the estate's own year-ranking law (textual claims beat producer dates):**
- Publication year **1999** now carries an **in-document textual claim** — the strongest class — consistent with the 1999 filename claim it independently corroborates. The 09-29 verdict "UNRESOLVED beyond the 1999-filename claim" is **upgraded**: the external-lookup failure (Crossref near-neighbors, OpenAlex rate-limited) no longer bounds the answer, because the document states its own venue, volume, issue, pages, and year in its text layer. Venue: Revista Brasileira de Engenharia Agrícola e Ambiental (RBEAA), v.3, n.3.
- The **1910 producer CreationDate stays what it was ruled: an impossible producer artifact** (Acrobat Distiller 3.0, 1996–98) — never publication year. No claim on file is deleted: the enriched record's `metadata_claims` still holds both entries; this dispatch is the evidence receipt for the next chain refresh (snapshot discipline: records are generated state, not hand-edited by a maintenance seat).

## 4. THE SCANNED PAGES — inspected; publication evidence lives in the text layer, not the scans

- **Im17 (obj 51): the only full-page scan** — 1264×1237, 1-bpc ImageMask, CCITTFaxDecode `/K -1` (pure Group 4). A T.6 decoder was built for this inspection (ITU tables re-verified against the TIFF-6.0 reproduction of T.4/T.6 after two recalled-table typos were caught by a prefix-freeness check — the tables as shipped in the repo tool below are the corrected ones). **Honest limitation:** the decode is verified row-exact through row 119 (row 0 hand-traced: H-mode, 0-white + 1264-black run — the all-black start is encoded truth, not decoder error) then diverges; 120 of 1237 rows rendered. The stream's EOFB (EOL+EOL) sits at the very end of the declared 16,550 bytes — one continuous image, not strips. The rendered region is a **halftone dot-pattern photograph** (the figure-page micrograph content; page 370's captions in the text layer are Figures 1–3: back-scattered image, SEM micrographs, schematic fiber-cell sketch).
- **Im18 (365×250):** chart — microfibrillar-angle vs work-of-fracture scatter for Pineapple/Sisal/Banana/Coir, matching the born-digital caption "Figure 4 … (Pavithran et al., 1987)" on page 372.
- **Im19 (396×331):** dark SEM micrograph (Figure 5, per page 374 caption). **Im1–Im16:** sixteen small LZW photo tiles (250×23/21) on the figure page — same halftone class.
- **No textual publication evidence exists inside the scanned images themselves** — no dates, journal marks, stamps, or legible lettering in any decoded image. The scans are content photography; the publication statement is a text-layer fact (§3). Uncertainty preserved: figure-page imagery beyond row 119 of Im17 was not visually verified (decoder divergence, recorded above).

## BOUNDARY NOT CROSSED

Corpus read-only throughout: **no document moved, no jsonl snapshot regenerated, no Scribd schedule or manifest touched** (the chain state is exactly as the owning session left it: routed-2026-09-29 newest). The sisal record was NOT hand-edited — this dispatch + the corrected tooling are the durable artifacts; folding the 1999/RBEAA textual claim into `metadata_claims` belongs to the enrich-chain owner's next refresh. Scratch decoders live outside the repo (temp); only the two focused script changes + tests + this receipt are committed. Draft PR opened against the library branch (focused delta); **no merge** — exact-head approval + green CI per the scale-out order.

## FILES

- `scripts/library/search.mjs` — stale-routed-index guard (day-granularity, loud fallback)
- `scripts/library/search.test.mjs` — 6 synthetic snapshot-selection tests
- `scripts/library/peek-pdf-text.mjs` — LZWDecode stream support (Flate-only gap closed)
- `scripts/library/peek-pdf-text.test.mjs` — 3 tests incl. width-growth round-trip
- `docs/dispatches/2026-09-29-blibrary-index-maint.md` — this receipt
