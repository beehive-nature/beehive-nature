# PUBLIC-SURFACE POLISH LANE — bounded translation finish, 390px audit, one-click failures, live checks

**Branch:** `zcode/surface-polish-2026-09-13` (3 commits, review only — nothing merged, nothing deployed)
**Order:** the five-beat polish lane — finish translations beyond profile/gallery (New bee + Raver first), audit every public surface at narrow widths, convert recoverable failures to one-click for bee/raver with diagnostics kept in cypherpunk, add live-browser regression checks, push a reviewable branch only.

## 1 · Translations — 169 corpus keys × 28 tongues, five doors

Doors keyed (en extracted through estate-source's own extractor, never hand-transcribed; every cell non-empty; an en-echo gate with true homographs whitelisted as exact pairs — fr *roses*, nl/da *model*, the canon register names):

| surface | before | after | what keyed |
|---|---|---|---|
| or-board.html | 0% | **87%** | full chrome + live-status labels; quoted buzz posts are records, stay verbatim |
| vending.html | 8% | **65%** | steps 1–4 + CARE footer; the plan dialog is a consent ceremony — corpus law keeps it English |
| plur.html | 0% | **39%** | wing glosses, rose counts, tutor seeds, footer, composer hints, all status lines |
| watch.html | 29% | **54%** | routes/privacy headings, audit gloss, stream setup; the `lang="en"` privacy body stays by authoring |
| wallet.html | 5% | 9% (bounded) | all six register-prose blocks + fold + all fifteen section heads; deep section prose = recorded backlog, floor 24→42 |

**The buried defect this uncovered:** plur's `data-key` reserved-key manifest (24 keys × 28 tongues, committed since the PLUR lane) had **no renderer anywhere in the estate** — those sections read English forever while every gate stayed green, because nothing walks `data-key`. lang.js now treats it as data-i18n's twin (markup-aware swap + census), guarded: a container whose key was never filled is left untouched (no innerHTML rewrite, listeners live) and counts honestly unkeyed. The dock line was split into keyed spans so its two links survive translation — proven.

**English islands kept, named:** wallets/addresses/txids/timestamps (wallet, vending receipts), the four audit state words and meter check names (z3.2 canon vocabulary), plur's word walls and privacy map (exhibits + dense disclosure), watch's privacy body (consent-grade text), vending's plan dialog (consent), or-board's buzz post quotes (records), every name (bzDiD, Vaulta, SKAISTS, bLOVErAi…).

## 2 · Narrow-width audit — the sweep and its seven fixes

NEW TOOL `e2e/narrow-register-audit.mjs`: every LIVE surface (103) × bee+raver registers, fresh 390×844 mobile context, one walk measuring unkeyed strings per register, document overflow, hard clips (hidden/clip with no scroll or ellipsis affordance), and dead-end failure copy. Receipt: `e2e/narrow-audit-2026-09-13.json`. Two false-positive rounds taught the instrument (sr-only `#bregdescription`, scrollable ≠ clipped, tour-bar internals); re-verified clean.

Fixes (each re-measured clean):
- **six fleet-hosted pages had no viewport meta** — phones rendered them at the 980px default layout, text tiny (resonance, acid-cascade, indigo-index, blend-lab, edible-tracker, spliff-lab). indigo-index then showed its true mobile state (+304px) and got stacking queries, panel scroll, capped charts, and its redundant in-bar dollar labels removed (the val column carries every number).
- flower-lab's fixed 300/1fr/320px grid stacked under 760px (was +600px).
- midi-organ's contract select capped (long option names made it +103px).
- midivault stat figures clamped (SIMULATED stopped jutting).
- tour.js's fixed bar pinned `max-width:100vw` (the pin-the-tour-bar law).
- Residual: midivault +6px scrollWidth with nothing past the edge (tour-bar internals only) — recorded, not chased.

## 3 · One-click recoverable failures (bee/raver), diagnostics in cypherpunk

The gallery #73 pattern extended to the two real dead-ends the sweep found:
- **or-board** relay-unreachable: bee/raver get "The live board did not answer — everything below is the honest file floor. Nothing broke; you can ask again." + one **Try now** button; cypherpunk keeps the exact read-door error + feed URL. The poll can outrun the register toggle's mount — unset register now defaults to bee (canon), and a register switch repaints the failure in the new voice.
- **watch** example-manifest refusal: bee/raver get "did not load — nothing about the room changed" + **Try again**; retry re-runs the fetch and recovers to *shape checked*; cypherpunk keeps `error.message`.
- Reviewed, not converted: museum's "ARCHIVED — live read failed" is an honest archive floor, not a recoverable failure; or-board's ⚠️ agent-error posts are quoted buzz records (record law — no rewrite).

## 4 · Live-browser regression + the founder's acceptance posture

- NEW `e2e/polish-i18n.mjs` (CI-wired after profile-i18n): **25/25** — corpus-exact ru cells per door, data-key activation with link survival, both one-click flows with cp diagnostics retained, RTL arabic, zero page errors.
- NEW `e2e/live-regression.mjs`: read-only walk of the eight highest-traffic **live** skaists.dev doors — HTTPS 200, toggles mount, corpus loads, Russian actually renders, ⚙ counter, zero errors, hub register toggle travels. **RUN AGAINST LIVE: 50/50 PASS** (pre-merge baseline; re-run post-deploy is the merge receipt).
- Eight 390px receipt shots in `e2e/shots-polish/` (wallet ru bee+cypher, plur ru, vending ru raver, or-board ru + the one-click failure, watch ru + ar). **The founder's live visual check remains the acceptance gate** — this branch changes nothing until you take that look.

## Instrument fix worth naming

`i18n-coverage.mjs` censused on a fixed 700ms window; stack.html's door-fetched organ board raced it (106/118 flake, flagged in the profile lane as pre-existing; my +8% corpus widened it). The census now **settles** — repeats until two passes agree, bounded — patience only raises counts, floors stay honest. Contract tests extended for the twin selector; one new twin-law test. Floors raised: plur 16→106, wallet 24→42, vending/or-board/watch added to set+floors (47/94/55).

## Gates (all run on this branch)

estate-source 11/11 · polish-i18n 25/25 · plur-views PASS · watch-manifest 29/29 · front-door battery 103/103 · no-page-errors 103 surfaces / 0 errors · university smoke 87/0 · coverage selftest PASS · floors PASS (×2 runs) · estate-check PASS · lint-ci-shape 45/45 · live-regression 50/50.

## Flags

- privacy-lens measured 0 keyed in the doc regeneration pass — its JS-rendered rows race even the settle window; untouched by this lane, floor not enforced, observed and recorded.
- wallet deep-section prose (balances/pay/receipts/fund/fiat/arweave/composer internals) remains the recorded backlog — bounded by order; the register prose and every section head are done.
- `#tx-out`'s worker-error text on wallet under a bare local server was a harness MIME artifact (.js served as octet-stream kills workers) — both audit tools now serve correct MIME; not a live defect.
