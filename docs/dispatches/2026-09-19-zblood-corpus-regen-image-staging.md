# 2026-09-19 · zBlood — order re-issued: harvest verified standing, corpus regen landed, image pass staged founder-gated

**Order:** founder, 2026-09-19 — "I need you to scrape every bit of familysearch.com material evidence for at least 8 dead (grandparents on) blood relative generations. we will stage it here and github and later ANT."

**First finding — the order was already executed on 2026-09-18 and is standing, staged here + GitHub.** The 8-gen material-evidence harvest (809 deceased persons depth 2–9, 23,673 entity refs, 13,249 unique records, 2,502 requests, 0 errors, cross-wire reconciled) lives on `zcode/zblood-source-harvest-2026-09-18` (pushed; rider `1c7e5bf5` = local = remote, worktree clean, no other writer). This seat verified it FRESH (hollow-check law — no quoted stale receipts): manifest counts re-read from disk (809 / 13,249 / 0 errors), private tier intact (`sources-harvest/` 27.4MB raw + 13.7MB private records + search evidence). Today's work = the two follow-ups the harvest NAMED as not-done, plus staging the third.

## 1. Corpus regeneration — LANDED (the harvest's "named next")

- **Walk merge** (`C:/Users/travi/family-lineage/merge-walk-repairs.mjs`, local-only): 2026-09-16 walk (18,572 persons) + the harvest's walk repair → **777 persons added** (306 dangling-repaired + 471 parents-closure after dedup; 630 dump persons already in the walk, walk snapshot stands — 2 name drifts documented, corrections ride the overlay layer), **476 closure edges reconstructed** from `v8-parents-of:<child>` labels. Merged raw: 19,349 persons, 3,247 pre-existing deeper-medieval dangling refs unchanged (beyond scope; the frozen corpus carried the same).
- **Pipeline + sources fold** (`tools/genealogy/pipeline.mjs` gains the 6th arg → `importSourceWalk` after overlays): support-axis upgrade law holds — unsourced→sourced with honest basis, era untouched, attested never downgraded; `research.basis` now carries the per-person harvested count; `meta.sourceFold` stamped.
- **Result:** 19,351 raw · **10,988 published (was 10,259)** · bloodline 10,825 · livingStubs 3 unchanged · **spine 42 generations byte-identical to the frozen pin (Randver Radbardson 0670–0730)** · **0 lost persons, 0 identity moves** (registry reuse held; new iids appended only). **736 persons upgraded to `sourced`**; 55 cohort persons honestly stay `unsourced-entry` (Don Ray + Marilyn: 0 attached sources ON FS, their evidence is the search layer; 53 medieval-frontier persons: nothing attached). Grandparent lifespans fold the rider's documentary corrections (1931–2025 / 1932–2023) with recall AND record both preserved.
- **Checks:** genealogy suite **56/56** (one fixture updated — it encoded the pre-rider frozen lifespans `1931/1932–Deceased`; the corrections layer is the honest current state), person objects + pages regenerated (10,988), estate-check PASS (96), corpus digest **re-pinned same-breath** in `surfaces/profile.html` → `99B3F53940E934F49D8D8F293AF7A66F03B2DBE2AE105CD9699D5983CB05CDCF` // PUBLIC-CONSTANT.

## 2. The 28-dangler gap — named honestly, recovery staged

The source walker created person entries for v8-discovered parents but **did not persist the child→parent edge when the parent already existed** — 28 danglers (+26 cascade parents) sit unlinked in the merged walk; geometry is never invented to fill them. `PAGE_PARENT_CLOSURE_SOURCE` (fs-adapter, staged) recovers the edges with one paced v8 pass over the 203 depth-8 cohort persons (~203 requests under the founder session), then a corpus regen rider links them.

## 3. Record images — STAGED, founder-gated (BOUNDARY NOT CROSSED)

- **The gate, receipted:** the seat opened familysearch.org in the IAB pane and probed the site's own session wire (`/service/tree/tree-data/v8/person/L627-FH9/details`) → **401**; the homepage shows sign-up CTAs; a record ark URL renders an empty shell signed-out. **No live founder session = no image scrape, and none is claimed.**
- **Staged tooling** (fs-adapter, the only FS-aware file): `DISCOVER_RECORD_WIRE_SOURCE` — observe ONE record page's own network calls (the lane's law: the UI's real wire is discovered, never guessed — the platform REST 404s cookie-only; tf entityref taught this) → codify the sweep FROM the observation. Pacing/checkpoint/resume pattern reuses the proven source-walker discipline (≥160ms, localStorage checkpoint, single worker).
- **Heuristic plan inventory** (private: `C:/Users/travi/family-lineage/images-harvest/plan-inventory.json`, schema `skaists.images-plan/0`, labeled heuristic): of 13,249 records — 6,397 vital (mixed image availability), 1,414 probate/land, 905 census, 863 church books, 482 Find a Grave (partner-held photos), 225 obituary/newspaper (partner index), 152 immigration, 126 military, 50 NUMIDENT, 26 compiled genealogies, 2,609 unclassified. Predictions are never measurements; every record gets its real image state from the sweep.
- **Staging law for images:** bytes ride the PRIVATE tier only (archive copyright — FS record images are licensed, not ours to republish); the public/GitHub layer carries counts + sha256 + ark pointers; the ANT ride happens in a future APPROVED edition per the preserve discipline (frozen pkg3 untouched).

## ToS boundary note (stated, not hidden)

The whole lane rides the founder's own signed-in session over the site's own wires at gentle pacing for his own family's deceased ancestors — no credentials are touched, stored, or printed. Bulk automated image downloading sits against FamilySearch's Terms of Use; the estate's posture is private archival with attribution (citations + ark URLs retained per doctrine), no republication of archival images beyond the family's private tier, and honest labels everywhere. The founder owns this decision; this receipt does not disguise it.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

| claim | evidence | boundary |
|---|---|---|
| 8-gen harvest standing, staged here + GitHub | branch `1c7e5bf5` local = remote; manifest 809/13,249/0-err re-read from disk today | merges remain the founder's word (incumbent `lane/zcode-lineage-import` + stacked branch) |
| corpus regen folded sources | 56/56 suite; spine byte-identical; 0 lost/moved persons; digest re-pinned | 28 danglers + 26 parents unlinked (walker edge-persistence gap), recovery needs the session |
| image pass staged | fs-adapter exports import clean; discovery probe + inventory on disk | **0 images fetched — session 401; nothing measured** |

**The founder gesture that completes the order:** sign in to familysearch.org in the open IAB tab. Then: parent-closure → regen rider → record-image discovery → image sweep.

— zCode seat, stacked on `lane/zcode-lineage-import` (incumbent genealogy lane untouched; no registration ritual — existing surfaces edited only).
