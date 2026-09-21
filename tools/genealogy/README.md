# tools/genealogy — the Beehive genealogy POC

Zero-dependency Node modules (`node --test tools/genealogy/smoke.test.mjs`).
Sources: **FamilySearch only through `fs-adapter.mjs`** — the model, GEDCOM,
and pipeline know nothing about any provider.

## Layout

| file | role |
|---|---|
| `model.mjs` | `skaists.lineage/2` — persons/edges/couples, evidence classes, privacy (`privatize`, scoped `validate`), bloodline/depths/spine |
| `fs-adapter.mjs` | the ONLY FamilySearch-aware file: pure `harvestResponse()` for one r9 portrait-pedigree payload, `PAGE_WALKER_SOURCE` (runs in a signed-in tab), `importWalk()` for raw dumps |
| `gedcom.mjs` | GEDCOM 5.5.1 `toGedcom()` / `fromGedcom()` — round-trips persons, edges, source ids, evidence notes |
| `pipeline.mjs` | raw walk JSON → public privatized corpus + page-data (+ optional pinned spine target) |
| `smoke.test.mjs` | 7 tests: eras, validation, privacy, bloodline/spine, r9 shape, GEDCOM round-trip, raw import |

## Laws carried in code

- **Evidence:** every person carries `evidence: { class, basis }`. Era classes
  (recorded/colonial/medieval/saga/living) are heuristic LABELS (`basis:"era-heuristic"`);
  saga is never presented as documented. Upgrading to `basis:"sourced"` requires the
  per-person source harvest (see ASTRA-HANDOFF).
- **Privacy:** raw models may carry living persons at full fidelity (they stay
  OUTSIDE the repo); public artifacts drop the living entirely except an anonymous
  "Living" root stub. `validate(model, {public:true})` enforces this.
- **Provenance:** `source` + `sourceId` ride every person and survive GEDCOM
  round-trips (`1 NOTE source familysearch:XXXX-XXX`).
- **Adapter boundary:** no FamilySearch string, URL, or shape outside
  `fs-adapter.mjs`; another provider is another adapter into the same model.

## Reproduce the extraction (founder session required)

1. Sign in to familysearch.org in a browser you control (never share credentials
   with any agent or tool).
2. On any familysearch.org page, run the walker from `PAGE_WALKER_SOURCE`:
   `installWalker("L627-FH9")` then call `__rwStep()` until `queue` reaches 0
   (each call ≈2s), then `__rwDump()` and concatenate `__rwDumpChunks`.
3. Save the concatenation as `raw-walk.json` OUTSIDE the repo (contains living
   persons at full fidelity).
4. `node tools/genealogy/pipeline.mjs raw-walk.json corpus.json page-data.json "Sigurd Ring de Trondheim"`
5. For GEDCOM: `import { importWalk } from './fs-adapter.mjs'; import { toGedcom } from './gedcom.mjs'`
   → build the model → `toGedcom(model, { privatizeLiving: true })`.

Receipts from the 2026-09-16 run: 3,023 requests · 0 errors · 18,572 persons ·
bloodline 10,097 · spine 45 generations to Sigurd Ring de Trondheim (0600).
