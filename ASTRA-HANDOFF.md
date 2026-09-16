# ASTRA-HANDOFF — Beehive genealogy POC · 2026-09-16

**From:** zCode seat · **To:** Astra/Codex reset · **Lane:** `lane/zcode-lineage-import` (commits `d8307f43` page+data, plus this tooling commit) — pushed, awaiting founder merge.

## What works (run it yourself)

- `node --test tools/genealogy/smoke.test.mjs` → 7/7.
- `node tools/genealogy/pipeline.mjs <raw-walk.json> <corpus.json> [page-data.json] [spine-regex]` — regenerates the public corpus from a raw walk dump; validated end-to-end on the real 18,572-person walk (spine pinned to "Sigurd Ring de Trondheim" → 45 generations).
- GEDCOM 5.5.1 export AND import round-trip, proven on the real corpus: 18,566 INDI / 8,610 FAM, source ids and evidence notes survive the loop (`M8WZ-XZY` Ragnar parses back by id).
- The crest bio profile page (`surfaces/profile.html` `#blood-record`) renders the inline payload: first-party SVG fan (7 rings, tier colors), 45-gen spine rail, saga ring; ×29-tongue corpus keys; verified at 390px + desktop, Latvian live; estate-check PASS.

## Architecture (deliberate decisions)

- **Adapter boundary:** all FamilySearch knowledge lives in `tools/genealogy/fs-adapter.mjs` (r9 response shape, page walker, `importWalk`). `model.mjs` / `gedcom.mjs` / `pipeline.mjs` are provider-agnostic; a second provider is a second adapter.
- **Model `skaists.lineage/2`:** keyed persons map (no id inside records — gotcha that cost a pipeline bug, see git history), `edges` child→parents (ghost targets ALLOWED and reported as `unresolved:` by validate — the walker's frontier depends on them), `couples` with marriage strings.
- **Evidence is a first-class field:** `{class, basis}` per person. Classes are era heuristics today; `basis` says so on every record. Saga ≠ documented, in code and on the page.
- **Privacy is scoped, not absolute:** raw models carry living persons at full fidelity and NEVER enter the repo; public artifacts drop the living except an anonymous root stub; `validate(m,{public:true})` fails closed on leaks.
- **Living data lives in `C:/Users/travi/family-lineage/`** (this seat only): raw walk JSON, GEDCOM FULL + privatized (v1 blood-filtered and v2 whole-walk variants), page-data, server script.

## Verified vs uncertain

**Verified:** extraction receipts (3,023 requests, 0 errors); spine edge-completeness root→Ragnar→Sigurd Ring (0715)→Sigurd Ring de Trondheim (0600); page render + i18n; corpus privacy (exactly one living stub, the root); GEDCOM round-trip fidelity on real data; tests 7/7.

**Uncertain / known gaps (ordered by value):**

1. **Evidence is era-heuristic, not source-based.** The walk did NOT harvest per-person `sourceCount`/`sourceLists` (the r9 response carries `sourceCount` per person — one field addition to the adapter harvest + a `--sources` pass over persons). Until then every tier is a label, and the founder's "AI confidence to 0600" project has no graded input.
2. **The walk is a snapshot.** FS tree changes; no diff/merge. Re-walking produces a new corpus, not an incremental update. A person-level merge key exists (FS id) but no merge tool.
3. **Descendants un-walked** (by design — ancestry only). Collateral/descendant research (Marilyn's lines) needs a descendancy adapter method.
4. **GEDCOM subset:** NAME/SEX/BIRT/DEAT/FAM/FAMC/FAMS/MARR/NOTE only. No places-as-structures, no notes beyond source/evidence lines, no DATE day precision (years only — the model stores lifespan strings).
5. **Couples model is shallow:** marriage as a string, no couple-level sources; `parent1ParentIds` double-parent assumption means single-parent families need verification on real data.
6. **The page inline payload is a build artifact** (page-data embedded at build); a future build step could fetch the corpus instead — today's single-file law won.
7. **FS rate limits untested at scale** beyond ~3k requests; the walker self-throttles at concurrency 4 with ~2s budgets.

## Highest-value next steps (my recommendation, in order)

1. Harvest `sourceCount` (+ conclusions flags if available) per person in the adapter → recompute evidence with a real basis → the 0600-confidence project gets its input.
2. Person-level corpus diff/merge (FS id keys) so re-walks are incremental and reviewable.
3. Descendancy walk for Marilyn's collateral lines (same adapter, new endpoint).
4. Page: replace inline payload with corpus fetch + build step; add zoom/pan for deep fans if the founder wants more than 7 rings.
5. GEDCOM: day-precision dates + PLAC structures when a consumer needs them.

## Where the receipts live

- `docs/dispatches/2026-09-16-family-lineage-extraction.md` — the extraction receipt.
- `assets/profile-archive/lineage/remington-bloodline.json` — the public corpus (digest pinned in the page manifest).
- `tools/genealogy/README.md` — reproduce-from-scratch instructions.
- This seat's memory (`familysearch-genealogy-extraction-lane`) carries the spine chain and the §7 authorship law reminder.
