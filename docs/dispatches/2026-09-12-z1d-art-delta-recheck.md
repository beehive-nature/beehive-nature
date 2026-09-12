# z1.d receipt — focused delta re-check at 293a4e7a: BOTH FINDINGS VERIFIED FIXED

Date: 2026-09-12. Seat: z1.d (zCode, existing session). Docket: #10
(Astra 21:47:57Z assignment). Scope honoured: initial request weight,
image/layout availability on scroll, external navigation — no provenance
re-run, no asset rebuild. Acknowledged correction accepted: same-tab
GitHub navigation was an AGENTS.md violation; my "not a violation" framing
was wrong even though the underlying observation stood.

## Delta shape — exactly the two fixes

`981f8c98..293a4e7a`: `docs/mvp-walk/marketing.html` (44 lines) + a 7-line
integration dispatch. Nothing else; no artwork bytes, motion logic or video
changed (verified by file list). All 19 image tags — including the
JS-generated storyboard poster in board source — carry `loading="lazy"
decoding="async"`. Seven large-PNG instances reserve intrinsic dimensions;
all six distinct PNGs' reserved values match their actual IHDR bytes
(1800×820, 1000×1000 ×4, 1448×1086 — verified locally, not from the PR
description). Both LOVErnment anchors: `target="_blank"
rel="noopener noreferrer"` + visible "(opens in a new tab)" labels. The
kandi link is now relative `../../surfaces/kandi.html`, same-tab per the
estate law.

## Initial request weight — true cold, measured

Fresh-origin load (empty HTTP-cache partition, 390×844, load + 2.5 s):
**15 requests / 6,486 KB on the wire, vs 21 / 8,298 KB at `981f8c98`.**
Deferred at load: plur-paired-hands-v1.png (1.94 MB) and the far images;
six below-fold images not yet complete. The five 3D renders (~6.1 MB,
document offsets 3.5–5.0 kpx) still load during initial layout — they sit
inside Chromium's lazy-load distance margin on this connection class. As
Astra framed, the hint defers by proximity, not a promised byte ceiling;
full page traversal still totals ≈ 8.5 MB, reached progressively.

## Image/layout availability on scroll

- Every lazy image renders on the 306 px column with exact reserved
  aspect (306×139 for 1800×820; 306×230 for 1448×1086; 306×306 for
  1000×1000) — dimensions reserve correctly, no distortion observed.
- The second green-teal render lives in a collapsed
  `<details>Review notes, sizes, and limits</details>` inside the #raver
  section: opening it renders the image (decoded natural 1000×1000,
  306×306 box). One quirk noted: that same-URL instance reports
  `complete:false` despite full decode (memory-cache path); visual
  availability is intact and it is the only image so affected.

## External navigation — verified live

Trusted click on the first LOVErnment anchor: the board tab stayed on
marketing.html and a new tab opened at github.com/skaists/LOVErnment-DAO
(observed in the browser's open-tab list). Both instances carry the
protected attributes and visible labels. The kandi link's same-tab
behaviour is source-verified (relative href, no target).

## CI at 293a4e7a (flagged, not a delta defect)

Same-head PR run: static ✓ scan ✓ test ✓ (node pending at writing). The
push run's static FAILED on the shared "Connect Store channel — auth and
process-loss recovery" step ("Missing expected rejection") — a suite this
delta cannot touch (marketing.html + one dispatch; zero connect-store
paths) and the same head passes it in the PR run. Flagged as a flake for
Astra's merge gate; merge should wait for the two node jobs either way.

## Verdict

**Focused delta check PASSED at `293a4e7a`** — both findings verified
fixed with measured behaviour. Merge awaits node CI and Astra's call.
