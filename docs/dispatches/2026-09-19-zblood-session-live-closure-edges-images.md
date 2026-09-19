# 2026-09-19 · zBlood — the founder signed in: parent-closure COMPLETE, corpus rider landed, image wire PROVEN, sweep opened

**Order:** founder, 2026-09-19 — "you're logged into familysearch.org now" + the staged boundary: resume the `0e158fb3` state, no broad re-scrape; authentication unlocks only the two pending pieces (missing-parent closure, image retrieval); images stay private, public artifacts get provenance/counts/hashes/ark pointers.

## 1. Session + parent-closure — COMPLETE (every frontier link recovered)

Session verified against the site's own wire (v8 root person resolves, 200). `PAGE_PARENT_CLOSURE_SOURCE` ran as staged: 203 depth-8 + 112 depth-7 v8 details (315 fetches, 0 errors after one transcription-mangled pid was re-fed as `LZNP-9D8`), persisting FULL `parents[]` arrays — the edges the source walker never saved for already-known parents. Result folded via `merged-walk-v4` (35 closure edges added, 0 ghost refs):

- **ALL 306 repaired danglers now linked** (was 28 unlinked) and **306/306 in the public corpus**; the full positive-source cohort is **754/754 published and `sourced`**.
- Corpus regen rider: **10,988 → 11,041 published** (+53), spine still byte-identical (Randver Radbardson 0670–0730), person pages regenerated (11,041), suite **56/56**, estate-check PASS, digest re-pinned same-breath → `735477B97F57C130C72DE27977829B8755EFA8AC6AF621FF96F9F5859DA8296D` // PUBLIC-CONSTANT.
- Private tier: `sources-harvest/parent-closure.json` (50KB, 315 persons, never committed).

## 2. Image wire — DISCOVERED AND PROVEN end-to-end (real bytes on disk)

The staged discovery law held: every guessed variant of the record-data wire failed; the page's own traffic was the oracle.

- Record SPA page DOM carries the image ark (`View Original Document` → `3:1:{ark}`); the record DATA wire (`?useSLS=true`) 401s outside the SPA (headers-only discovery dead: page fetches strip User-Agent; the orchestration service demands one — `FS-User-Agent-Chain` alone gets 401).
- Image viewer page → its own traffic resolves `sg30p0.familysearch.org/…/orchestration/sls/image/3:1:{ark}` → deepzoom `apid:TH-…`; read the apid from the viewer's performance log (cross-origin orchestration fetch impossible: CORS + UA gate).
- Parked on sg30p0: `image.xml` (DeepZoom pyramid) + `image_files/{level}/{x}_{y}.jpg` tiles stitched on an HTML-namespace canvas (XML documents need `createElementNS` — banked) → JPEG ~0.82.
- **Executed: 6 images on disk (1.55MB), sha256'd, one visually verified complete 1940 census page** (425KB, 2048×1524, level 11/12 — readable tier, honestly labeled, never claimed as maximum pyramid fidelity). Manifest + per-image states at `images-harvest/images-manifest.json` (private); public summary at `assets/profile-archive/lineage/sources/images-summary.json` (counts + hashes + ark pointers ONLY — the boundary the founder drew).
- Honest non-image states recorded: `no-deepzoom-traffic` (viewer data-stall / restricted), non-viewer arks among the raw-payload pre-mapped set (waypoint/collection arks over-captured by the 3:1 regex — named).

## 3. Open frontiers — named with exact state

- **Record→image mapping at 13k scale:** the person-keyed `hr/v2` search wire (entry.id IS the 1:1 ark suffix; entry gedcomx carries the 3:1 Persistent ark) joins to our citations at only ~2% — search surfaces different records. The reliable mapping is the record SPA page's own DOM (one load per record). The mapping walker ran 175/807 persons (4,654 mappings, checkpointed in-tab at `__zim` + localStorage; partial dump saved private-side).
- **Sweep cost:** ~30–60s per image through the proven path (viewer load + stitch). Full coverage = a dedicated multi-hour session with the queue + manifest checkpointed exactly where they sit.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

| claim | evidence | boundary |
|---|---|---|
| 306/306 danglers linked, 754/754 sourced | regen output + 56/56 suite; corpus digest re-pinned | — |
| image wire proven | 6 images on disk + sha256 + one visual verification | 6 of an estimated few-thousand unique images — the sweep is OPEN, checkpointed |
| record→image mapping | 4,654 search-wire mappings (partial, checkpointed) | ~2% join rate to our citations; per-record DOM mapping un-run at scale |

**Boundary preserved exactly as ordered:** no re-scrape of the standing 809/13,249 harvest; record image BYTES private-tier only; public/GitHub carries provenance, counts, sha256, citations/ark pointers, and the wire documentation for reproducibility.

— zCode seat, branch `zcode/zblood-source-harvest-2026-09-18`, stacked on `lane/zcode-lineage-import`.
