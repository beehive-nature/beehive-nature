# RECEIPT — bLibrary fresh-seat opening (5.3 Flash corpus worker)

**Date:** 2026-09-26 · **Seat:** 5.3 Flash / zCode (bLibrary corpus worker) · **Branch:** `zcode/blibrary-corpus-inventory-2026-09-26` (from `bLibRARY` @ f9a7f956e)
**Charter:** FRESH-SEAT ORDER (founder, 2026-09-26) — bounded executor, not policymaker. One-line identity: librarian/harvester worker, not counsel, compliance, governance, UI designer, or moral arbiter. PRESERVE FIRST. INDEX SECOND. INTERPRET LATER. NEVER DELETE SOURCE EVIDENCE.

## GATE-STATE + ONE-WRITER

Primary worktree `beehive-nature` carried foreign modifications (`Cargo.toml`, `docs/agents/WALLET-LEDGER.md`) and ~140 sibling worktrees — per the standing worktree discipline law, all writes happened in a freshly carved dedicated worktree `C:\Users\travi\wt-bLibrary`, branch `zcode/blibrary-corpus-inventory-2026-09-26` off `bLibRARY`. Foreign files untouched. Corpus harvester (Task Scheduler "Daily Bio-Alchemist harvest", 09:00/21:00) state "Ready" at 02:47 MDT — no concurrent writer in the corpus; scan is read-only regardless.

**UI:** no supervised browser/UX session was ever opened by this seat — nothing to release. No UI work performed.

## EXECUTION — priorities 1-3 (inventory, hash, dedupe)

Tool: `scripts/library/inventory.mjs` (zero-dependency Node 24; opens every corpus file READ-ONLY; writes only to `<corpusRoot>/library-records/`; no code path unlinks, moves, truncates, or rewrites a corpus file).

**First run FAILED honestly and is preserved in the record:** all 1231 reads errored ("file closed") — my own bug (read-stream `autoClose` default closed the handle before the tail read). Summary recorded 1231 READ_FAILED blockers, 0 records. Fixed (`autoClose: false`), re-run; the re-run overwrote only MY same-day tool outputs, never source bytes.

**Run 2 (2026-09-26T08:51:28Z, 2.1s, 8 workers):**

1. **Inventory delta:** 0 → **1231 DocumentRecords**, schema exactly per the order (plus additive `scanned_at`/`scanner`/`scan_root` tool metadata). Corpus root `C:\Users\travi\Downloads\hemp-research`, all documents under `blibrary/<subject>/` per the standing subject-folders law (14 folders). Non-document files under the root (37 .txt, 14 .md, 12 .json, 5 .mjs, 5 .html, 3 .svg, 1 .ps1) counted as observations, not records.
2. **Hashes/dedupe:** 1231 sha256 digests, 2,102,439,068 bytes total. **2 duplicate groups, 2 redundant files** — recorded as canonical + aliases, NOTHING deleted:
   - `doc-d17f002c85f5be78` — oak biomass functions paper: `OA-2008-biomass-functions-applicable-to-oak-trees-…` ≡ `OA-nd-biomass-functions-…` (extraction-biorefinery, 935,396 B)
   - `doc-efe0698dd0d1ad16` — `Fractally White Paper 1.0 (English) (1).pdf` ≡ without `(1)` (hemp-fibre-composites, 7,735,268 B)
3. **Newly indexed:** all 1231 (first content-level index of the corpus; prior dedupe was filename-only at download time).
4. **Corrupt/partial:** **none** — 1231/1231 `parse_state: CLEAN` (PDF magic + %%EOF trailer verified; non-CLEAN verdicts would be double-read-verified before recording).
5. **Provenance uncertainties:** all 1231 records carry `provenance: unknown` / `source: unknown` (mechanical truth of this pass; priority 6 not yet run). Mechanical split: 1109 filenames carry the `OA-` prefix (our own harvest-oa.mjs open-access rail convention — noted in `notes`, NOT treated as authority); **122 files have other filenames** = the provenance queue. `title`/`author`/`year`/`acquired_at`: unknown (priority 4 pending).
6. **Blockers:** zero scan blockers. OPEN items for the founder (not acted on): (a) records home not ruled — full-digest JSONL stays in `<corpusRoot>/library-records/` OUT of git (pre-commit hex law blocks 48+ hex runs; records are data, not source); (b) duplicate alias pattern suggests a harvester-side re-download guard — mechanical note only, no change made.
7. **Priority candidates (routing labels, not judgments):** `unsorted/` bucket = 10 files to review against the taxonomy OVERRIDES; the 122 non-OA-prefix files for the provenance pass; both duplicate groups are zero-decision (pure re-downloads).
8. **Exact paths:** tool `wt-bLibrary/scripts/library/inventory.mjs` · lane law `wt-bLibrary/library/README.md` · records `~/Downloads/hemp-research/library-records/inventory-2026-09-26.jsonl` (1231 lines) · `dedupe-2026-09-26.json` · `summary-2026-09-26.json`.

Per-subject: cannabinoid-medicine 297 (394.2MiB) · essential-oil-distillation 278 (268.7) · tree-biomass-forestry 121 (271.1) · extraction-biorefinery 107 (204.2) · cannabis-policy-economics 98 (110.8) · hemp-fibre-composites 83 (152.3) · hemp-agronomy 66 (176.4) · hemp-food-nutrition 49 (90.0) · sassafras-botany 35 (73.4) · hemp-construction-materials 25 (48.3) · green-reset-books 24 (109.9) · hemp-environment-lca 24 (43.1) · safrole-toxicology-regulation 14 (48.9) · unsorted 10 (13.7).

## BOUNDARY NOT CROSSED

No document deleted, moved, quarantined, renamed, or relabeled. No subject/source classified as anything beyond mechanical routing labels. No acquisition attempted; no access control touched. No UI. No agent policy authored. Metadata passes (4-6) and indexing (7) wait on the next working session — records are already shaped for them.

Charter banked to seat memory (`blibrary-corpus-worker-charter.md`) so every future Flash session opens under the same order.
