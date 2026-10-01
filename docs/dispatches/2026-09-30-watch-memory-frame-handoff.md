# W@tch shared video memory and bViEw frame handoff — 2026-09-30

Seat Codex, own worktree `C:/Users/travi/wt-codex-bview-ci`, branch
`codex/watch-memory-bview-frame`, based on main's PR #281 merge.

W@tch now exposes the same `bnr.bview.playlist.v1` browser record as bViEw.
Save/name/remove work across both pages and tabs. Play uses same-tab navigation
to bViEw's Autonomi-address player. W@tch's hosted HLS room and receipt passes
are separate; no room pass is copied into the public video list. The list is
usable in all three registers and remains explicitly browser-local. The two
one-file surfaces currently carry the same compact schema/validation code;
cross-page acceptance exercises compatibility. No surface was added or moved.

The user still saw flicker after earlier source-thrash repairs. Necessary
progressive Blob handoffs still emptied the visible decoder. bViEw now banks
the last decoded picture near the media edge, holds it in a non-interactive
canvas while the replacement source loads and seeks, then reveals an actual
replacement frame through requestVideoFrameCallback. A seek-and-paint fallback
serves older browsers. The frame copy is capped at 1080p, ephemeral, never
uploaded, never substituted for the original media. New addresses invalidate
the old frame. Original bytes, timing rule and Blob playback remain intact.

## Acceptance

`node --test bview.test.mjs bview-eternal.test.mjs watch-eternal.test.mjs`
from `e2e`: 27 passed, 0 failed/cancelled/skipped, exit 0, 127247.9519 ms.
Actual VP9 media, Chromium, mocked relay. Four observed source-reset events
all retained real non-black pixels: outgoing video and covering frame each
199.125 px high. Cover hidden after replacement seek; full tail reached.
Slow case reached 9.73/10 seconds, longest stop zero ms. Rate-drop estimate
12 seconds vs actual 12.2 seconds. Existing three-register contracts pass.
W@tch test saves, names, reloads, reads in bViEw, removes across tabs, tests
three registers and verifies Play uses the same tab. Mobile screenshot inspected.

First run: 25 passed, 2 failed. Frame coverage really failed because the decoder
could already be empty at reset; capturing just before the edge corrected that.
The new W@tch test attempted a save after reload without restoring the address;
its setup was corrected. Second run: 26 passed, 1 failed; the frame-height
assertion included the separate 6px download progress bar, which legitimately
disappears. Corrected the measurement to compare picture height with picture
cover height; pixel coverage and post-seek reveal assertions retained.

`node --test e2e/estate-source.mjs`: inner 11 passed, outer 1 passed, exit 0.
`git diff --check`: clean. Generated atlas bytes and existing registrations
unchanged. No secret or signing material added. Native Git hooks remain wired.
Hosted CI and exact production deployment receipts follow in the PR.

The billion-simultaneous-viewer comparison requested during this delivery is
published alongside this receipt in
`2026-09-30-billion-viewers-performance-cost.md`. It distinguishes arithmetic,
published prices, current source facts and unmeasured scale assumptions.
