# RECEIPT — bLibrary priority 8 (routing labels) + two record corrections

**Date:** 2026-09-29 (worked 2026-09-28 evening MDT) · **Seat:** 5.3 Flash / zCode (bLibrary corpus worker) · **Branch:** `zcode/blibrary-corpus-inventory-2026-09-26`
**Charter:** FRESH-SEAT ORDER 2026-09-26, unchanged. **This dispatch CORRECTS two items in `2026-09-28-blibrary-metadata-provenance.md`** and lands priority 8.

## CORRECTION 1 — provenance arithmetic (the 258, decomposed)

The 09-28 dispatch headlined "82.7% receipted" and led the remainder with "128 unknown," leaving the full non-receipted total implicit. Explicit reconciliation, re-verified from `enriched-2026-09-28.jsonl` this session:

**1488 total = 1230 receipted + 258 non-receipted**, and the 258 = **129 + 128 + 1**:

| bucket | count | definition |
|---|---|---|
| OA-convention, unreceipted | **129** | filename carries the `OA-` rail prefix but no SESSION-LOG line exists — early harvests predating per-file logging |
| strict unknown | **128** | no receipt, no recognized convention: 7 root `SCRIBD-*` + 121 filed non-OA files (green-reset-books 24, hemp-fibre-composites 21, hemp-agronomy 16, cannabinoid-medicine 15, cannabis-policy-economics 15, extraction-biorefinery 9, unsorted 9, hemp-food-nutrition 5, hemp-construction-materials 4, essential-oil-distillation 2, hemp-environment-lca 1) |
| filename-inferred | **1** | Springer-style article filename — labelled `not authority` |

The 7 SCRIBD books' provenance receipts exist — in the Scribd lane's own SESSION-LOG blocks and `SCRIBD-MANIFEST.json` (runs 1–3 with doc IDs, page counts, sizes, SHA-256s) — recorded there, not re-attributed by this lane.

## CORRECTION 2 — schedule times (read from the saved schedules, not handoffs)

The 09-28 dispatch wrote "its 09:00 automation" about the Scribd manifest. **Wrong attribution — 09:00 is the OA rail, not the Scribd lane.** Verified this session from the saved schedules themselves:

- **Scribd lane** = ZCode cron `automation-fa15a4cf`, **`30 9 * * *` — daily 09:30** (title: "Daily 09:30 Scribd harvest…"), plus a separate one-shot re-probe cron armed for **Sep 30, 2026 14:00**. Observed SESSION-LOG actuals: 09:28 (2026-09-26), 10:52 (09-27), 09:16 (09-28) — the early/manual era before the 09:30 cron settled.
- **OA rail** = Windows Task Scheduler "Daily Bio-Alchemist harvest", triggers **09:00 AND 21:00** daily (-06:00); LastRunTime 2026-09-28 09:00:01, NextRunTime 21:00 same day.

The cross-lane ruling underneath is unchanged and unaffected by fire time: `SCRIBD-MANIFEST.json` owns the 7 root files by bare filename; this lane does not move them; the Scribd lane's own session reconciles manifest + files together.

## PRIORITY 8 — routing labels (the deliverable)

Tool: `scripts/library/route.mjs` → `library-records/routed-2026-09-29.jsonl` (1488 records = enriched + additive `routing` block; enriched file never mutated; corpus untouched) + `routing-report-2026-09-29.json`.

**The law the labels serve:** explain *why a document is relevant*, cite the metadata behind the choice, preserve uncertainty — retrieval priority, never truth ranking, never hiding material. `research_value: decisive` is **never auto-assigned** (report field `decisive_auto_assigned: 0`); it stays human/Laya-only.

Rules (all mechanical, all cited in-block): domain from the subject-folder table + keyword refinement (botany/forestry honestly land `other` — the charter's domain list has no slot, noted not forced); evidence_type from SCRIBD/curriculum → `book`, DOI → `paper`, handbook/ASTM/ISO/dataset patterns, year 1500–1950 → `archive-record` (year `0000` missing-data excluded after a live false-positive was caught); research_value from **current-phase awareness** — `harvest-state.json` says phase 1 = sassafras-extraction, so the 683 documents receipted under that phase label `high` ("active research front"), the 7 SCRIBD curriculum books label `high` (founder 150-book program, deadline 2026-10-13), 528 label `useful` (phase-0 corpus + reading curriculum), 260 `routine`, 10 `unknown` (unsorted/, taxonomy review pending). Every block carries `why`, `evidence[]` (exact fields+values used), and `confidence` (rule-matched 1471 / partial 7 / unknown 10).

**Verified search examples** (over `routed-2026-09-29.jsonl`, via `search.mjs` which now prefers the routed index and takes `--value/--domain/--etype`):
- `--value high` → **690** · `--etype archive-record` → **1** (1910 sisal review; the `0000` record now correctly falls elsewhere) · `--domain cryptography` → **1** (Blockchain Revolution, green-reset-books) · `--subject sassafras-botany --q albidum` → **9** (species-level retrieval)
- Spot-check (fine-root lifespan paper): `high/paper/other`, why cites `harvest_phase=sassafras-extraction` + `harvest-state.json phase=1` + `doi=10.3389/fpls.2014.00205` — the full block is in the routed file.

**Known cosmetic limitations, recorded not patched:** a few green-reset book titles display UTF-16 BOM dust (`þÿ` + spaced letters — claims preserved underneath); the 2 junk-title records named in the 09-28 dispatch stand.

## BOUNDARY NOT CROSSED

Additive-only pass; zero corpus reads beyond the routing rules' inputs; nothing deleted, moved, renamed, relabeled-as-judgment; no UI; no policy; no acquisition. Priority 9 (preservation receipts) continues per-run; the charter list now stands fully worked 1–8 with 9 rolling.
