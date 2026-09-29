# DESIGN LANE RIDER — the kit's blobs: the one open obligation from #257

date 2026-09-28 · seat zCode · closes the #257 session (kit landed byte-exact,
contract reconciled to the sheet, all live) by RECORDING its single follow-up
so the lane can continue without that chat. continuation of
[2026-09-26-golden-dress-contract.md](2026-09-26-golden-dress-contract.md).

## what #257 landed (state: LIVE, verified on skaists.dev)

- `design-system/` — the founder's kit byte-exact: README.md (the skaists
  design law), manifest.json (component kit schema), tokens.json (the
  AUTHORITATIVE sheet), ui-design-version-eternal.html (the graded canvas).
- register.js contract sets reconciled TO the sheet: Instrument Serif/Sans ·
  Unbounded/Sora · IBM Plex Mono; radii 18/12/6 (radius-sm); glow-sovereign
  `0 0 14px rgba(156,111,214,0.45)`; senary spacing, control heights, the
  rainbow gradient, flow/hatch direction tokens. Loader `register.js?v=12`.
- gates: wallet-registers 113/113 (with the three-grammars lane's evolution),
  register.test 15/15, wallet-fund 94/94, secret-scan clean.

## THE OPEN OBLIGATION — land the kit's blob assets in-tree

The export's asset blobs did NOT ride in the canvas file (its bundle carries
only the 10 canvas page assets — all `text/html`). They live HOST-SIDE in the
claude.ai artifact export (`XHZx1nzbdkyA5Pm98pn5rE`, the same drop that
produced `README (2).md` / `manifest.json` / `tokens.json` /
`UI Design version eternal.html`). `design-system/manifest.json` is their
authoritative inventory — 25 files, ~501,801 blob bytes:

- `fonts/` — 8 woff2: burti, InstrumentSans-wght, InstrumentSerif-Regular,
  Sora-wght, Unbounded-wght, IBMPlexMono-{Regular,Medium,SemiBold}
  (+ OFL license texts)
- `assets/Icons/` — the ten 16px strokes (bee, raver, cypherpunk, lock, eye,
  forever, no-undo, check, chevron-right, chevron-left), 239–311 B each
- `assets/Signs/` — the eight crest signs (austras-koks, saule, auseklis,
  jumis, mara-cross, mara-water, cell, heart), 253–862 B each
- `assets/Logos/` — bnature-logo.svg/.jpg
- `assets/Font/` — burti.ttf + skaists v1.0 (specimens + ttf; skaists v1.0
  stays unused per the sheet's own "not synced")

**How they land:** the founder drops the export's asset files (any host-side
fetch of the artifact's Files panel) into `design-system/` per the manifest
paths, or a seat extracts them wherever the hive can reach the export. They
are PUBLIC design assets — no secret-scan concern; ids/bytes in the manifest
are the verification (a landed file must match its manifest bytes).

**Why it matters:** today every contract surface renders the sheet's families
with SYSTEM-STACK FALLBACKS (the zero-fetch rule the sheet itself sets). The
moment the woff2 files land, one `@font-face` wiring in register.js lights the
true faces with zero surface changes — Instrument Serif's bee, Unbounded's
raver, Plex's cypherpunk, burti's wordmarks.

**Acceptance when done:** (1) every landed file byte-matches its
`design-system/manifest.json` entry; (2) a served page computes the resolved
family as the KIT face (not the fallback) for all three registers;
(3) wallet-registers + register.test still green; (4) loader pin bump if
register.js gains the @font-face wiring (ALL pins move with it — the #235/#257
heal law).

## session state

#257's session is COMPLETE and may be archived: rule banked (flash agents no
UI, supervised UX closed), kit live, contract sheet-true, this rider is the
only carry-over and it lives in-tree now, not in the chat.
