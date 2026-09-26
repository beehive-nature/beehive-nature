# First work: a credited bloom that can be kept and brought back

## Delivered behavior

`docs/mvp-walk/first-work.html` presents the founder and his mother's original
Genesis bloom before asking anything of the visitor. Keep explicitly saves a
public reference in this browser. Share resolves the same allowlisted work
and strips query parameters; an unknown work or supplied replacement metadata
cannot silently become the credited bloom. Keeping is not a transfer, media
download, blockchain transaction or new licence.

The page reuses the existing shared three-view control, breathing SVG and
collection store. The original supplied green-teal JPG is copied unchanged
as `assets/first-work/original-bloom.jpg` (15,269 bytes). Purple = humans,
teal = AI, green = biomass remains written alongside the artwork.

The shared collection now previews its own BNR JSON exports and deliberately
merges them under the same exclusive Web Lock as save/remove. Exact duplicates
remain once; conflicting IDs or excessive/unsafe input refuse the whole
import. Existing entries are never replaced. The bloom controller additionally
checks its known ID against its bundled canonical credit and record.

File selection does not save. Stale reads and clipboard callbacks are discarded.
Denied/uncertain writes retain their distinct outcomes. Keyboard focus survives
collection redraw/removal and returns from completed/cancelled import to the
file input. This addresses the independent source review's P2 focus finding.

## Ownership for Grok

The published [release contract](../specs/first-work-release-contract.md) gives
Grok the page, stylesheet and share-card presentation. Astra retains work.js,
receive.js, collection persistence, tests and integration. Presentation can
improve without another receive-path rewrite or a second collection store.

The founder's Claude/JAMS proposal is absorbed in the accompanying
[collaboration addendum](2026-09-07-astra-jams-collaboration-addendum.md).
It strengthens the media/library collaboration direction; it does not make
BNR JSON a JAMS-compatible format or authorize outreach/code adoption.

## Verification

- Full local front-door command from `.github/workflows/tests.yml`:
  **183/183 passed**, including 24 collection checks and 13 new first-work
  controller checks. Tests run the real collection/work/controller source
  against explicit DOM/storage boundaries; these are not phone observations.
- Independent local Codex review: bounded controller/source pass. Its focus
  finding was fixed and two focused regressions added. No extra fleet launched.
- CI shape: **39/39 guarded suite steps**. `git diff --check` clean.
- CUA browser at `127.0.0.1:4190`, observed viewport 640 x 552: original SVG
  renders; New bee/Raver/Cypherpunk inspected; Keep and selected view survive
  fresh document navigation; share link strips the test query; Copy reports
  completion; pause control stays paused through skin changes; collection
  export click requests a download. No horizontal overflow at that width.
- Import/export round trip, independent stores, reload, duplicate taps,
  forged credits, denied/uncertain writes, stale reads, cancellation and focus
  are exercised in the focused tests. Native file-picker import and a newly
  saved browser download file were not verified through this browser session.

Local preview: `http://127.0.0.1:4190/docs/mvp-walk/first-work.html`.
The local link is machine-only and labeled that way. Public social previews,
QR scanning, a 390px browser pass, reduced-motion browser emulation and human
receive/return observations remain separate checks. Copy does not prove a
recipient opened or kept a work. Current page copy is English draft copy.

## Foundation and release boundary

PR #34 merged locally with canonical founder/seat identity into main
`df895c7c`. GitHub reports MERGED and the main tests, secret scan and Pages
deployment completed successfully. That releases the reviewed player and
collection foundation. This new first-work branch is separate review work;
its public route is not claimed live by this receipt.

No box service, production ops file, media upload, public node, blockchain
operation, campaign or third-party outreach is changed by this lane.

Commit tooling: the initial inline message failed before commit with
`error: pathspec 's' did not match any file(s) known to git` (PowerShell
interpreted a typographic apostrophe as quoting). Retried with a literal
message file; no index contents or authored source were lost.
