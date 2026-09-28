# RECEIPT — bLibrary priorities 4+6+7 (metadata, provenance, search) + delta inventory

**Date:** 2026-09-28 · **Seat:** 5.3 Flash / zCode (bLibrary corpus worker) · **Branch:** `zcode/blibrary-corpus-inventory-2026-09-26` (descendant commits in `wt-bLibrary`)
**Charter:** FRESH-SEAT ORDER 2026-09-26 (unchanged: bounded executor, preserve-first, zero-deletion, no UI, no policy). Autonomy correction 2026-09-28 ("don't gate to me ever. we run autonomous here") applied: this pass ran on the charter's own priority list, founder-gated nothing.

## DELTA INVENTORY (priority 1-3 re-run)

`inventory-2026-09-28.jsonl` — **1488 documents (+257 since the 09-26 opening scan's 1231)**, 2,553,826,292 bytes (2.55 GB), **1488/1488 CLEAN, 0 blockers, 3 duplicate groups** (+1 new: `SCRIBD-cradle-to-cradle-mcdonough.pdf` ≡ `blibrary/green-reset-books/203194078-Cradle-to-Cradle.pdf` — recorded canonical+alias, nothing deleted). Growth sits in `essential-oil-distillation` (278→528, the sassafras/EO phase volume runs). Scan took 225 s vs 2.1 s on 09-26 (observation: likely disk contention on freshly-written files; no errors resulted).

**Structural finding — 7 documents at corpus ROOT outside `blibrary/`** (125.4 MB): the Scribd lane's books (`SCRIBD-*` / `SCRIBD-PROVISIONAL-*`: Sapiens ES, Wikinomics, Cradle to Cradle, Guns Germs and Steel, Mastering Bitcoin, Permaculture Designers' Manual, Rise of the Robots). Per charter they were indexed, hashed, and preserved untouched — never deleted, quarantined, or labeled.

## SUBJECT CROSS-CHECK (priority 5)

`sort-blibrary.mjs` (estate tool, dry-run default) proposes exactly one move set: all 7 SCRIBD strays → `green-reset-books/`. **Move NOT executed — cross-lane collision, not founder-gating:** `SCRIBD-MANIFEST.json` (the Scribd lane's canonical ledger, written live by its 09:00 automation) declares `library_path: <corpus root>` and tracks all 7 by bare filename. Moving them without that manifest would desync an active sibling lane — the shared-state field-ownership law (my organization write never stomps another lane's authority fields). Disposition: documented here; the Scribd lane's own session reconciles manifest+files together (it owns both). `unsorted/` unchanged at 10.

## ENRICHMENT (priorities 4+6)

Tool: `scripts/library/enrich.mjs` — read-only region scans (head 64 KB + tail 384 KB) for PDF Info-dict and XMP metadata; filename-pattern claims; SESSION-LOG receipt correlation. All outputs in `<corpusRoot>/library-records/`: `enriched-2026-09-28.jsonl`, `metadata-conflicts-2026-09-28.json`, `enrichment-report-2026-09-28.json`.

**Metadata:** title **1486/1488** · author 1008 · year 1467 · DOI 733. Disagreement law held: **1098 records carry preserved multi-claims** (every claim kept with its source; display winner is mechanical — pdf-info/xmp over filename, with a pattern-rule demotion for producer-artifact titles like "Microsoft Word - …"). Known limitation, recorded not patched: 2 records display a junk title ("untitled" / xmp fragment) because BOTH their non-filename claims are junk that resists mechanical pattern rules — all claims preserved, filename fallback visible in the path.

**Provenance:** SESSION-LOG index built for 1232 filenames → **1230/1488 documents (82.7%) carry harvest receipts** (run timestamp, phase, harvest topic, KB at capture). 129 OA- files unreceipted (early harvests predating per-file logging). 128 unknown (incl. the 7 SCRIBD strays — their provenance receipts live in the Scribd lane's own SESSION-LOG blocks/manifest, not re-attributed by me). 1 Springer-style filename inference, labelled `not authority`. Honest tool note: the parser's first version matched only 8 files (old `(KB, openalex)` line shape); the volume runs log `(KB, topic: …)` with phase in the header — fixed and re-run, both receipts preserved in this dispatch.

## SEARCH/INDEX (priority 7)

Tool: `scripts/library/search.mjs` — queries over the enriched index (`--q --subject --source --provenance --year --hash --state --dupes-only --unprovenanced --json --limit`), `--q` covers title/author/filename/DOI/**harvest topic**/phase/all claims. Verified: `--dupes-only` → 3; `--q SCRIBD` → 7; `--q clevenger` → 62 (topic-level retrieval working).

## OUTPUTS + BOUNDARY

Committed in-tree: `scripts/library/inventory.mjs`, `scripts/library/enrich.mjs`, `scripts/library/search.mjs`, `library/README.md`, this dispatch. Records stay OUT of git in `<corpusRoot>/library-records/` (hex law; data, not source). Corpus files opened read-only throughout; nothing deleted, moved, renamed, or overwritten; no acquisition performed; no UI; no policy authored.

**Next on the charter's own list (no gate):** research-priority routing (8) as routing labels over the enriched index, and repair-copy evaluation for any future CORRUPT/PARTIAL findings (none today).
