# 2026-09-28 · zBlood — 8-gen order #7 reconciled: delta = image continuation only; live attempt receipted SIGNED-OUT; session-oracle law banked

**Order:** founder, 2026-09-28 — "I need you to scrape every bit of familysearch.com material evidence for at least 8 dead (grandparents on) blood relative generations. we will stage it here and github and later ANT.go" + "try n0ow".

## 1. Reconciliation (the standing order-reconciliation law, 7th issuance)

This is the **seventh** verbatim-family issuance of the 8-gen order. Receipts → tip verified → delta named:

- **The harvest is DONE, FROZEN, and MERGED**: 809 persons (4/8/16/32/60/112/203/374 by depth), 23,673 source entity-refs, 13,249 unique records, 0 errors (2,502 paced requests, 2026-09-18), parent-closure complete, 754/754 positive-source cohort `sourced`, corpus 11,041 published, spine byte-identical. PR #244 merged at `140d5e8028d6f105e30d29f64074e0579859cc57` (verified on origin/main tonight; order #6 closeout `55e842a3f`/`137e7ccfe` stands).
- **"stage it here and github"**: already true — private full-fidelity tier at `C:/Users/travi/family-lineage/` (never committed), public layer in-tree at `assets/profile-archive/lineage/sources/` (manifest + per-person index + deduped records, ~18MB) and on GitHub via the merged PR.
- **"later ANT.go"**: matches the banked plan verbatim — ANT ride = future approved edition per the preserve discipline (frozen artifact + separated ceilings; authorization/settlement outstanding; no image/ANT authorization exists — order #6 closeout named this explicitly).
- **DELTA = image continuation only** (the one open frontier): record→image-ark mapping beyond the 404 preMapped pairs (12,845 records) + the image sweep (405 queued: 398 mapped-not-downloaded + 7 retry states).

## 2. The live attempt — receipted honestly: SIGNED OUT

The founder said "try now"; the seat attempted the delta under the in-app browser pane:

1. `fssessionid` cookie present on www.familysearch.org, homepage shows no sign-in link — **misleading, corrected below**.
2. Record SPA (`/ark:/61903/1:1:W9TX-NNS`): loads JS chunks + permission calls, then **skeleton forever** (record body never renders).
3. Raw fetch of the record URL: **20KB SPA shell, zero `3:1:` arks** — the fetch+parse fast path is DEAD for mapping; only the rendered DOM carries "View Original Document".
4. `?useSLS=true` data wire: **404 FailureToGetPersona** (signed out; authed behavior UNTESTED — named as the first probe next authed session, see §4).
5. Image viewer (`/ark:/61903/3:1:33S7-9GY8-1XT?view=index`): **redirected to ident.familysearch.org login — full username/password form rendered**. This is the authoritative verdict: **the founder is NOT signed into the in-app browser pane this session drives**. (The 2026-09-19 session worked because the founder signed in INSIDE that pane.)

### SESSION-ORACLE LAW (banked in fs-adapter.mjs)

A present `fssessionid` cookie does NOT prove a signed-in session. The one cheap oracle that cannot false-positive: **navigate any viewer ark URL — signed-in bounces through ident and back; signed-out lands on the login form.** `sessions/CURRENT` returned 406 from a robots.txt context (page-context dependent, not portable). A stuck record SPA in the IAB is a session symptom, not a record dud.

## 3. Mapping-state refinement (measured, replaces the "~2%" estimate)

The 4,654-entry search-wire map (`record-image-map-partial.json`) joins to the 13,249-record citation set at **0%** — all 4,654 keys fall outside it (search surfaces different records than the tree's attached sources). The standing mapping state is therefore exactly: **404/13,249 mapped (preMapped, all in-set), 12,845 to discover, per-record rendered-DOM loads the only proven path** — unless the authed `useSLS` probe (§4) unlocks the fetch path.

## 4. What the next authed session runs (staged, in order)

1. **Sign-in oracle**: viewer-ark navigation (the §2 law).
2. **useSLS probe** on 2-3 records (one preMapped ground-truth): a 200 with `3:1:` arks unlocks the fetch-based mapping walker (in-tab, localStorage-checkpointed, the proven PAGE_SOURCE_WALKER pattern; ~hours for 12,845). A 404/401 keeps the navigation walker (~30-60s/record ⇒ multi-day at 12,845; run grandfather-priority + Lowry/Rockwood emphasis first).
3. **Image sweep** (the 405-image queue): viewer → apid from the page's own performance log → park sg30p0 → `PAGE_IMAGE_STITCHER_SOURCE` (proven 2026-09-19, 6 images) → manifest checkpoint. Bytes stay private-tier; public layer gets counts + sha256 + ark pointers only.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

| claim | evidence | boundary not crossed |
|---|---|---|
| harvest frozen + merged + staged here/github | origin/main contains `140d5e802`; public layer files in-tree; manifests re-read tonight (809/23,673/13,249) | no re-scrape of the standing harvest (order #6 law) |
| founder NOT signed into the IAB pane | ident login form rendered on viewer redirect; record SPA skeleton; useSLS 404 | no credentials exist on this seat; no sign-in attempted by the seat |
| search-wire map joins at 0% | 4,654/4,654 keys outside the citation set (measured) | the partial map stays private-tier reference, never called a mapping |
| image continuation unchanged | manifest re-read: 6 downloaded + 7 retry states + 398 mapped-not-downloaded | zero new image bytes; ToU boundary unchanged (private archival, founder's own session, no republication) |

**The one founder gesture that unblocks the delta:** sign in to FamilySearch inside the in-app browser pane (it is parked on the FS sign-in page), then say "try now" — everything downstream is staged in `fs-adapter.mjs` + this dispatch.

— zCode seat, branch `zcode/zblood-order7-image-gate` (rider on origin/main).
