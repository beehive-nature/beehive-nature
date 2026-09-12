# z1.d receipt — independent art candidate review: ACCEPTED with two findings

Date: 2026-09-12. Seat: z1.d (zCode, fresh session). Docket: #10 (21:13Z
handoff, z1.d task). Candidate: draft PR #62 @ `981f8c98` (branch
`zcode/genesis-assets-reconcile-2026-09-12`, base main `00258d7c`, MERGEABLE
against current main `0aede743`) = `e17fe953` + one manifest-dispatch commit.
No renderer rebuild, node work, or publishing; local static serve + fresh
browser contexts only.

## Source provenance — verified independently

- **42/63 files blob-identical to #31 head `26aa68eb`; 21/63 to #28 head
  `dc33607e`; zero from neither** — matches z1.c's manifest exactly.
- Purely additive: 63 A-status files vs base; zero path overlap with the
  Bloom merge (main `0aede743`); two-dot D/M/R entries vs current main are
  exactly the Bloom file set in reverse view (the branch is pre-Bloom
  parented); merge-tree onto current main is clean. Bloom/main files
  retained, nothing dropped.
- No Watch overlap: every path under docs/ (mvp-walk + dispatches); no
  surfaces/, e2e/, scripts/ or plur.html/watch files.
- Dependency chain closes on the union tree, including the core artwork:
  `motion/green-teal-breathing.svg` (83,287 B, sha per svg-receipt) already
  lives on main with the identical blob `86a7d047…` — correctly not
  re-added; the studio's `fetch()` resolves. (My one false alarm during
  review — "missing SVG" — came from trusting a diff-only file list; sealed
  by rev-parse against all three refs.)
- Naming flag honoured: 'breathing-bloom'/'original-blooms' here are
  genesis-3d ART; byte-comparison confirms zero overlap with the released
  first-work Bloom files.

## Cold browser check — 390×844, fresh tab, exact head served locally

**Motion studio** (`docs/mvp-walk/assets/genesis-3d/motion/index.html`):
- Artwork live (animated SVG replaces the fallback), status "Breathing
  bloom is playing. No sound."; credits visible: "Original artwork by
  LoVis and his mother" + "Motion study by Astra".
- Controls: expression switch verified (Celebration → 3.6 s, aria-pressed);
  intensity maps exactly to the receipted formula (80 % → strength 1.74);
  pause/resume toggles `is-paused` with honest labels.
- View retention: raver selected → reload → retained (localStorage
  `bregister`), artwork re-fetched, controls re-initialized.
- Reduced-motion: `@media (prefers-reduced-motion: reduce)` override and
  `is-paused` root rule present inside the SVG asset (verified at source);
  studio.js/board.js MQL handling reviewed. Live media emulation is not
  available in this browser surface — disclosed, not emulated.
- Save animated SVG: fires with "Creator credit travels with it."
- Cold weight ≈ 268 KB (SVG 83.6 KB fetch, poster 76 KB); **no mp4 request
  until the user clicks**; mp4 750 KB, motion .blend 470 KB and study
  .blend 7.4 MB only via explicit user action/download links.
- **3D loop playback could not be confirmed in this browser**: the webview
  pauses video-only media to save power (AbortError 13 ms after `play()`,
  with the element verified visible, in-viewport, display:block; identical
  fresh-element probes succeeded and later failed non-deterministically;
  the server serves the full 767,970 B; H.264 "probably"; a bare element
  reaches readyState 4 / duration 6 s). The page's failure path behaves as
  designed — poster restored, honest status, retry offered, vector bloom
  untouched. Environment-limited; not counted as a page failure.

**Marketing board** (`docs/mvp-walk/marketing.html`):
- Bloom board live with the same controls (Celebration switch + pause
  verified), register chooser present, PLUR provenance section and both
  provenance-receipt links present, credits intact.
- **Measured cold transfer: 8,298 KB across 21 requests** — six PNGs
  ≈ 8.1 MB (original-blooms 1.87 MB, plur-paired-hands-v1 1.94 MB, four
  renders 1.03–1.09 MB each).

## Findings (returned for Astra's severity call)

- **A — marketing weights, no lazy-loading.** None of marketing.html's 19
  `<img>` tags carry `loading="lazy"`; the six ~1–1.9 MB PNGs all download
  on first paint (8.3 MB total). Inherited verbatim from #28. Smallest
  fix: `loading="lazy"` + explicit width/height on the render and PLUR
  images. The motion studio already models the intended pattern.
- **B — minor, links.** The only external links are
  github.com/skaists/LOVErnment-DAO (both pages, ×3) and an absolute
  https://skaists.dev/surfaces/kandi.html on marketing — all same-tab
  (`target` empty). Not a BNR-link violation; new-tab would preserve the
  visitor's place.

## Checks

- PR #62 CI: 8/8 green (node · scan · static incl. §7 · test, both runs).
  Both branch commits founder-authored, z1.c-committed, one Co-authored-by
  trailer each.
- Two 390px screenshots captured as local session artifacts (this seat's
  image view is CDN-limited; judgments above are programmatic reads).

## Verdict

**ACCEPTED at `981f8c98` for the assigned scope** — provenance, identity,
additivity, gating, controls, retention and credits verified; Findings A
and B returned as concrete, bounded items for Astra's release decision.
Merge/closure of #28/#31 remains Astra's.
