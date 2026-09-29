# FAMILY LINE EXTRACTION — FamilySearch → the crest bio profile page · 2026-09-16

**Lane:** founder order — "extract my entire family line from FamilySearch… export and import into our family crest bio profile page." **Seat:** zCode. **Session:** live, founder-signed-in browser pane.

## What was extracted

The founder's FamilySearch tree (root person the fan-chart URL names, built 12 years ago with his grandmother **Marilyn Lowry Remington**) was walked through the same wire the fan chart itself drinks from — `familysearch.org/service/tree/tree-data/r9/portrait-pedigree/{pid}` — same-origin under the founder's own cookie session, 8-generation windows, recursive + guided-spine completion.

**Walk receipts:** 3,023 requests, zero errors, zero auth failures. **18,572 persons** harvested; **10,097 deceased bloodline persons** reachable from the root (+ spouses); the crawl was stopped at the saturation threshold (the shared medieval web keeps opening; the walker is re-runnable any time the session is live — method recorded in the corpus meta).

**The spine (45 generations, founder → 0600), verified edge-complete through the founder's grandmother Donna Ruth Lawton (1925–1988) exactly as the founder stated:** Lawton → Fuller → Maxson → Randall → Trevisa → Courtenay of Landrake → Carminow of Boconnoc → Mandeville → Valognes → Bolbec → Ponteaudemer → Wevia de Crépon → Princess Gynrithe of Denmark → King Olof Björnsson → Björn III Eriksson → Eric Edmundsson → Alof Ragnarsdottír → **Ragnar Loðbrók (0740–0845)** → **Sigurd Ring Randversson (0715–0810)** → … → **Sigurd Ring de Trondheim (0600)** — the founder's 600 AD target is the connected terminus of the walked line.

**Saga honesty (founder question answered at source-in-tree):** Sigurd Snake-in-the-Eye is NOT a person in the walked record — Ragnar's children here are Alof (our blood, by Queen Thora) and Björn Ironside (Ragnar + Queen Aslaug). In this tree the Swedish crown rides Björn Ironside's line (House of Munsö: Björn III → Olof → Gynrithe); the sagas seat Sigurd snake-in-eye in Denmark. Every name before ~970 is saga, not documented history — the page says so, on the panel, in 29 tongues.

## What landed in the estate

- **`surfaces/profile.html`** — new `#blood-record` archive-panel inside the house-archive: first-party SVG **fan chart** (7 rings, tier-colored, tooltips), the **45-generation spine** (collapsible rail, era-banded), the **saga ring** (Ragnar/Thora/Aslaug/Alof/Björn Ironside/Sigurd — the crest's paired serpents meet the snake-in-eye king, labeled honestly), stats line, corpus link. Register-scoped, tokens-bound, no network, inline data.
- **`assets/profile-archive/lineage/remington-bloodline.json`** — `skaists.lineage/1` corpus: 10,251 deceased persons + edges + marriages + spine, era-tiered (recorded ≥1850 · colonial 1550–1850 · medieval 1000–1550 · saga <1000 — **era heuristic, NOT a source verdict; the founder's AI-confidence lane replaces these**). **Living persons redacted to "Living" — no names, no dates, no FS IDs.** sha256 digest pinned in the page manifest (PUBLIC-CONSTANT).
- **`surfaces/lang-corpus.json`** — +18 `prof.arch.blood.*` keys × 29 tongues, machine-drafted ⚙ per corpus law; dynamic strings re-render on the `blang` event (Latvian verified live).

## Local-only artifacts (NOT in the repo — living family)

- `C:/Users/travi/family-lineage/familysearch-ancestry-full.json` — full-fidelity walk (3.7 MB, includes living persons + FS IDs)
- `C:/Users/travi/family-lineage/remington-ancestry-FULL.ged` — GEDCOM 5.5.1: 10,261 INDI / 5,624 FAM, importable anywhere
- `C:/Users/travi/family-lineage/remington-ancestry-privatized.ged` — living redacted variant
- `C:/Users/travi/family-lineage/*.mjs` — the walker, analyzer, GEDCOM builder, corpus adders (re-runnable)

## Verification

estate-check PASS (95 counted, no drift — existing surface edited, no registration ritual needed) · build-atlas byte-clean · i18n-coverage exit 0 · all 18 corpus en cells byte-match the markup · render-verified in-browser: fan 123 slices, spine 45 rows, saga 6 rows, stats live; desktop + 390px screenshots judged clean; Latvian pass on title/stats/legend/caption. FLAG: full e2e battery not run on this seat; CI is the arbiter on push.

## Follow-lanes

AI-confidence grading to 0600 (founder's stated project — needs per-person source counts + conflict data from FS, next walk can harvest `sourceCount` and conclusions); descendant lines (Marilyn's collateral research) un-walked by design; Sigurd snake-in-eye could be sourced into FS itself if the founder wants him on the record rather than the legend rail.
