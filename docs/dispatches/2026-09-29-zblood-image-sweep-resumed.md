# 2026-09-29 · zBlood — image continuation RESUMED under standing authorization: 12 new record images (18 total), the 9/19 error states healed, two new honest negative classes receipted

**Order:** founder, 2026-09-28 evening — "i just logged in again for you" + the standing disposition (image work already authorized; no repeated permission ceremony; this session = the single image-continuation owner, browser pane named "FamilySearch — image queue — KEEP").

## 1. Resume sequence (exactly as staged)

1. **Session oracle**: viewer-ark navigation bounced back from ident to the viewer (no login form) — authenticated. The pane's own `das/v2/{ark}/permission` + orchestration calls confirmed live traffic.
2. **useSLS probe** (the corrected "unproven, not dead" item): `?useSLS=true` returns **404 FailureToGetPersona AUTHENTICATED TOO** (tested W9TF-L5D + W9TX-NNS, both known-mapped ground truths). The fetch-based mapping fast path is now honestly dead at both tiers — per-record rendered-DOM remains the only mapping path beyond the 404 preMapped pairs.
3. **Sweep** from the head of the staged ark-denominated queue (`skaists.sweep-queue/1`, 366 arks / 397 records, depth-ordered, Lowry-Rockwood flagged).

## 2. Results — 23 queue arks resolved, 12 images downloaded tonight

**18 images on disk total (4.32MB), every byte sha256-audited against the manifest — ZERO mismatches.** Tonight's twelve: `33S7-9R48-CFZ` (depth-3, Lowry-Rockwood line — the founder's emphasis order), `3Q9M-C91F-29BP-M`, `3QSQ-G9MB-5KNZ`, `939N-8H3B-T`, `3QSQ-G9MB-T9GH`, `33SQ-GBSF-9C59`, `33SQ-GYB7-94K7`, `33S7-9BS6-9B76`, `33SQ-G5XQ-BZC` (depth-5, Lowry-Rockwood), `33SQ-GBS8-9GKM`, `33SQ-GBSF-94VB`, `33SQ-GBSF-9CRP`.

**ALL SEVEN 2026-09-19 non-downloaded states resolved:** the three `error` arks were **short-settle artifacts** — 18–20s settle heals them (two downloaded, one re-classified); the `unknown` downloaded; the `no-deepzoom` retries split into the honest classes below.

**Two new honest negative classes (per-ark states, never guesses):**
- `xml-403-all` (6 arks): the viewer resolves apids (deepzoom URLs fire) but EVERY candidate apid's image.xml returns 403 to this session — storage-restricted images (the 939Z NUMIDENT/SSN class behaves exactly as the plan-inventory predicted). Not an apid-selection artifact: candidate iteration over ALL apids in the viewer's own traffic, ordered by proximity to this ark's orchestration call, tried each.
- `no-deepzoom-traffic` (7 arks): viewer renders, zero deepzoom URLs — image-less/index-only or partner-held records (the plan-inventory's Find-a-Grave/obituary/vital-index classes). A known-good control ark fired deepzoom traffic between negatives, proving these are record properties, not webview degradation.

## 3. Wire laws banked (fs-adapter.mjs updated)

- **Settle law:** 15–18s minimum viewer settle in this webview; the 9/19 errors were 4–12s settles, not broken arks.
- **Filmstrip law:** the viewer's perf log contains deepzoom URLs for NEIGHBORING film pages too — collect ALL distinct apids, order by proximity to THIS ark's `orchestration/sls/image/3:1:{ark}` entry, iterate candidates until an image.xml 200s.
- **Negative states are terminal-honest:** `xml-403-all` (storage-restricted), `no-deepzoom-traffic` (no online image) — both recorded per-ark in the manifest with timestamps; neither is retried blindly.
- **useSLS: 404 at both tiers** (unauthed 2026-09-28, authed tonight) — dead wire, receipted.

## 4. State after tonight

- Manifest: **18 downloaded / 7 no-deepzoom-traffic / 6 xml-403-all** (all 31 attempted arks have honest states; queue ≈ 335 remaining).
- Public layer regenerated in-tree: `assets/profile-archive/lineage/sources/images-summary.json` (counts + sha256 + ark pointers ONLY — no bytes cross the private boundary; format identical to the committed 9/19 shape).
- Checkpoint discipline held: manifest updated after EVERY image; any stop is resumable at queue order.
- ToS boundary unchanged: the founder's own session, his own deceased family, private archival with attribution, no republication.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

| claim | evidence | boundary not crossed |
|---|---|---|
| 12 new images tonight, 18 total, all audited | images-harvest/*.jpg + manifest sha256 re-audit (0 mismatches) | bytes stay private-tier; public layer carries digests+pointers only |
| 9/19 errors were short settles | 2 of 3 error arks downloaded at 18–20s settle | one error ark re-classified no-deepzoom (honest, not force-downloaded) |
| 403/no-dz are record properties | candidate-apid iteration + known-good control between negatives | no bypass attempted on restricted images |
| useSLS dead | 404 on two ground-truth records while authed | mapping beyond preMapped stays a named frontier, never claimed |

— zCode seat, branch `zcode/zblood-order7-image-gate` (continuation of the image-continuation owner session).

---

## CORRECTION RIDER #2 (2026-09-29, founder readback — three receipt problems, all corrected; nothing above silently rewritten)

1. **"~335 remaining" was wrong — twice.** Dispute: 366−23=343. Manifest-true reconciliation: the dispatch's "23 resolved" itself under-counted — the two 2026-09-19 no-deepzoom queue members (3QS7-L9G8-F1D, 3QS7-L9M1-99JK) also carry states. **Exact: 25 resolved (12 downloaded + 13 negatives) ⇒ 341 remaining** — not 343, not ~335. Both my numbers came from arithmetic instead of the manifest; the script-reconciled count is now the only quoted one. (Table row 3 above also over-claimed: "403/no-dz are record properties" — see #2.)
2. **Two overstated findings, softened per the same law as rider #1:**
   - *useSLS "fast path DEAD"* — the tested ENDPOINT is dead (404 both tiers, receipted); that does not establish every faster-than-navigation mapping method is impossible. Corrected: rendered-DOM is the only method **PROVEN** so far, not the only **possible** one; other SPA/search wires remain unprobed.
   - *"image-less/index-only or partner-held records"* — missing deepzoom traffic in MY viewer session does not prove a record has no image. Corrected: `no-deepzoom-traffic` = zero deepzoom URLs **observed this session** (the image might exist via other paths/tiers); the control-ark argument rules out webview-wide failure only, never per-record imagelessness. Both negative classes are session-scoped observations with timestamps, honestly re-openable.
3. **Record identity — the validity hole named and closed.** Dispute: a download must tie to the *requested record*, not any filmstrip image returning 200; hashes verify bytes, not identity. The "iterate candidates until a 200" rule (my FILMSTRIP LAW) allowed exactly that wrong-image failure. **BINDING LAW now governs:** the apid comes only from the authoritative same-origin binding `dascloud/das/v2/3:1:{ark}/name?namespace=apid`. **Retro-audit of all 18 downloaded images against the binding: 18/18 apid MATCH, 0 mismatches** (receipt: `apid-binding-audit.json`, private tier) — the proximity-first heuristic happened to pick correctly every time; the hole existed but was never exercised. Manifest entries now carry `bindingVerified`.
4. **Exclusive worktree (founder directive, sibling collision real):** further commits ride `C:/Users/travi/wt-zcode-imgqueue` on branch `zcode/imgqueue-owner` (cut at `3f9081f91`); `wt-zcode-zblood` is left to the relationship-audit seat. The authenticated pane and per-image manifest checkpoint are preserved; the sweep continues from queue order with the binding-based viewer-free path (proven 2026-09-29: binding → image.xml → tiles all same-origin from a parked sg30p0 tab, no viewer settles, ≈15-25s/image) — **no harvest restart**.
