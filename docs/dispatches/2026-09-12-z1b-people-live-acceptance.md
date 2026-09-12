# z1.b LIVE people acceptance — buzz-directory + profile at skaists.dev (Pages 5709897f)

One bounded pass, fresh session, per the Medium order. The completed source
review (z1.b delta receipt 991b4343: F1/F5/F4 CLOSED) is NOT repeated here —
this pass proves the DEPLOYED site only.

## Deployment truth (independently re-verified)

- GitHub Pages API: `status: built`, cname `skaists.dev`, legacy deploy from
  branch `main` path `/`; latest build 1211247348, commit
  `5709897f62f666009fca45a091f0f2b33f0439ea` (PR #57 merge), built in 110984ms
  at 2026-09-12T19:42:36Z — matches the quoted build exactly.
- origin/main HEAD at run time: the same `5709897f` (no drift between build and tip).

## Fetched byte hashes — live vs origin/main@5709897f

All seven artifacts the two surfaces ride are BYTE-IDENTICAL (sha256, live
fetch vs `git show origin/main:<path>`):

| artifact | live = origin sha256 | size |
|---|---|---|
| surfaces/buzz-directory.html | `4d7b6926f7aee06d3a9b5db6f0bd3f86c917fe78e7e39905d3634b127ed47f1f` PUBLIC-CONSTANT | 10567 B |
| surfaces/profile.html | `27b02bf96545268969eb2697a047ab06ae1fcb1e1d4630380d0479821c36f264` PUBLIC-CONSTANT | 9886 B |
| surfaces/lang-corpus.json | `ccd2c250e8e88b2714c62a81febf720c2d687557ac38c300abb24bbd68faada5` PUBLIC-CONSTANT | 1180807 B |
| surfaces/tour.js | `b83a9d46f7338ab25d30037ebcf2789e02a086f53fe08e02c991c9e16db6c1c5e` PUBLIC-CONSTANT | 4697 B |
| surfaces/register.js (tour rider) | `9427fe97896d2c510625e536591db594af8059f94abca2f7214bb9016449c99c` PUBLIC-CONSTANT | 32676 B |
| surfaces/lang.js (tour rider) | `68c1823767bb2b588afbef72a22eaafafaeb2a54596c4d4f92ef63369218d16c` PUBLIC-CONSTANT | 12495 B |
| surfaces/rails-badge.js (tour rider) | `d06ba30f9f2b7f179f78913ae69fe05189d82405e843ea1bb97d6ebc08a6c9cb` PUBLIC-CONSTANT | 9946 B |

All live responses HTTP 200, etag family `W/"6aa5ab9a-…"` (one build),
`Cache-Control: max-age=600`, observed `age` ≤ 62s.

**Deployment vs stale cache:** the deployment is PROVEN current at the byte
level, so any old-looking render in a visitor's browser could only be a stale
local cache, bounded by `max-age=600` (10 minutes); both pages also carry
`<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`.
No cache anomaly was observed in the pass (cold contexts throughout).

## Live browser pass — 109/109 checks green

Harness: `e2e/people-journey-live-shot.mjs` — a faithful port of the PR's
`e2e/people-journey-shot.mjs` to `https://skaists.dev/surfaces/` (live network,
no local server, no route blocking), extended with live-only checks. Full
pass/fail matrix collected; zero failures.

- **Cold New bee + Raver + Cypherpunk, narrow desktop (1440×1000) and mobile
  (390×844), fresh contexts** (no cache, no storage): reading room mounts,
  `#first-bee` / `#first-raver` arrivals, primary actions open
  `layer-hives` (directory) / `layer-house` (profile), Raver
  figure→story path, cypherpunk instrument with disclosures open — all fit
  their viewport (no horizontal overflow) on both pages at both sizes.
- **Visible primary actions:** every `.primary` in each beat is visible and
  reachable (bee first action, figure action, story-layer door); F4 re-measured
  live at 390: `.listing .lrelay` / `.listing .chip` (directory) and
  `.holder .bio .bdesc` / `.holder .bio .bmeta` (profile) all render ≥14px
  computed (min exactly 14) with zero horizontal clipping.
- **Latvian (lv, LTR):** `documentElement.lang=lv`, rendered calm / story
  sentence (`dir.hives.doorcard`) / raver feel byte-equal to the LIVE corpus
  cells, zero instrument keyed-leaf drift in lv.
- **Hebrew (he, RTL):** `documentElement.dir=rtl`, rendered calm / story
  sentence (`prof.house.story`) / feel equal to the live corpus cells, zero
  instrument drift in he, and every checked layer fits 390 under RTL.
  (Corpus equality is against the corpus fetched from skaists.dev itself —
  which is separately hash-proven equal to origin/main.)
- **View/state retention:** language select retained across bee→raver→cypherpunk
  view toggles on both pages; `<details>` disclosure state collapsed for bee and
  restored for cypherpunk across toggles; persona survives a full reload
  (`localStorage bregister` → `data-reg="cypherpunk"`); language travels
  directory→profile across navigation (`localStorage blang` = lv).
- **Estate laws live:** every external anchor is new-tab + `noopener`;
  zero console errors, zero pageerrors, zero failed requests; both docs 200.

## Screenshots (evidence, 34)

`e2e/shots-people-journey-live/` — taxonomy mirrors the PR's
`e2e/shots-people-journey/` set (bee / bee-story / raver / raver-figure /
raver-story / cypherpunk at 1440+390, bee-inst-390, plus lv on directory and
**he** on profile per this order — the source-run used ar for RTL).

## Exact failures

None. 109/109 checks passed; no deployment defect found.

## Bloom — QUEUED, not run

Bloom live acceptance is queued pending its ACTUAL release: PR #35 (credited
bloom, first work) is still OPEN on `codex/first-work-journey-2026-09-07`
(8eac7117 acceptance-ready per the z1.b lane, Astra integrates). Not live on
main, therefore not acceptance-tested here. (PR #56, the cursor
three-temperature adapter, is likewise still open — out of this pass.)
