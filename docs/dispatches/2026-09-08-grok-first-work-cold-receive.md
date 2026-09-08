# Grok — first-work cold-receive acceptance — 2026-09-08

Seat: Grok / Cursor cloud (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Model: Cursor Grok 4.6. Effort: one medium bounded acceptance pass. No extra fleet.
Pinned head: `codex/first-work-journey-2026-09-07` @ `8eac71170c92122f627d1becc4320f4b068357d3`.
Branch: `cursor/first-work-cold-receive-0ec3`.
Companion to draft #35. Does not replay #33. No presentation rewrite. Astra’s
`work.js`, `receive.js`, `collection.js`, and CI were not edited.

This is software-behavior proof from an agent. It is not unassisted human
success, demand, or a 7-day return. Isolated browser contexts are not two
physical devices. Public social/QR and campaign launch were not this task.

## Method

The Cursor computer-use seat could not start (Claude usage limit). The walk
used headed Chromium (`puppeteer-core` against `/opt/google/chrome/chrome`)
on `DISPLAY=:1`.

- Sender: fresh BrowserContext @ `http://127.0.0.1:4193/docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1`
- Share recipient: second empty BrowserContext, same share URL
- Import visitor: third empty BrowserContext @ port `4194`
- Default profile `~/.config/google-chrome` and ports 4188/4190 were not used
- Older Downloads exports were quarantined under `/tmp/old-exports-quarantine/`
  (showcase TEST AUDIO + the earlier 720 B walk file) so they could not be chosen

390 px used a real viewport (`innerWidth` 390, `scrollWidth` 390), not a
DevTools chip and not an IAB override. Print used CSS `print` media emulation
only — not Chrome’s print-preview dialog.

File import used the page’s real `<input type=file>` / file-chooser API on
the exact downloaded bytes. The OS GTK picker was not clicked. The UI download
name is `bnr-listen-later.json`. A byte-identical copy
`/tmp/bnr-cold-bloom-export.json` was what the chooser accepted, so the older
TEST AUDIO file could not be substituted.

## Source checks on the pinned tree

`node --test e2e/first-work.test.mjs` — **14/14**.
`node --test e2e/artist-audio-collection.test.mjs` — **24/24**.

## Walk

| Step | Result |
|---|---|
| 1. Empty arrival | **Pass.** New bee. Genesis bloom + LoVis and his mother before Keep. `localStorage bnr-listen-later` was `null`. Status: “Nothing saved yet.” No sign-in, wallet, or tutorial. |
| 2. Keep → reload | **Pass.** “Genesis bloom is in your collection.” After reload: “In your collection”, “1 saved in this browser.” One row: Genesis bloom — LoVis and his mother. |
| 2b. Share recipient | **Pass (isolated context, not two phones).** Second empty context opened `http://127.0.0.1:4193/docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1`. Keep still “Keep this bloom”. Store still `null`. |
| 3. Export that bloom | **Pass.** UI download `bnr-listen-later.json`. **720 bytes.** sha256 `6b808735a5b71d8445afa2d8cc478fdf4757e720d462b600a692b12c0e8b52de` PUBLIC-CONSTANT. Schema `bnr-listen-later/1`. Item `bnr-genesis-bloom-v1`, artist LoVis and his mother, link `https://skaists.dev/docs/mvp-walk/first-work.html`. Note says not JAMS-compatible. No TEST AUDIO / YouTube id. |
| 4. Preview | **Pass.** Status: “Check the references, then choose Add. Nothing has been saved yet.” Preview lists Genesis bloom — LoVis and his mother. Store still `null`. Keep still unsaved. |
| 4b. Cancel | **Pass.** “Import cancelled. Your collection is unchanged.” Store still `null`. |
| 4c. Add → reload | **Pass.** “1 added; 0 already in your collection.” Reload: one matching bloom. |
| 4d. Import again | **Pass.** “0 added; 1 already in your collection.” Still one row; credit unchanged. |
| 4e. Open saved work | **Pass.** Collection link is the same work URL (`#work=bnr-genesis-bloom-v1`). Same-page, so no extra navigation event. Work + credit still shown. |
| 5. Keyboard | **Pass.** From the top, Tab reached Skip to the bloom, Keep this bloom, Share, then the import details. After opening the details, `#import-collection` took focus. Skip activation lands on `#work-content` (allowed hash). |
| 5b. Pause + skins | **Pass.** Pause → “Play motion” held through Raver then Cypherpunk. Collection and credit stayed. |
| 5c. 390 px | **Pass.** New bee empty: 390×924, `scrollWidth` 390, no horizontal overflow, credit readable. Sender after Keep also 390 with no overflow (that shot was still Cypherpunk because the sender context had changed skin). |
| 5d. Reduced motion | **Pass.** Control: “Motion reduced”. |
| Print | **Observed, not Chrome print preview.** New bee print-media: ink `rgb(24, 54, 42)` on cream. Cypherpunk: light ink `rgb(220, 241, 227)` on dark green. `first-work/style.css` has no `@media print` reset. If a printer drops backgrounds, Cypherpunk light text on white paper would fail. The print correction on the bloom companion pages was not re-tested here. |

No receive-path failure. Controllers were not edited.

## Honesty

**Real:** isolated-origin / isolated-context Keep, share receive, UI export of
this bloom, preview-without-save, cancel-without-save, Add, reload, no
duplicate, 390 viewport, reduced motion, Tab order.

**Not claimed:** two physical devices; OS file-picker click; Chrome print
preview; public OG/Twitter; QR scan; unassisted human Keep; campaign.

## Artifacts

Screenshots live with this run (desktop empty arrival, Keep, reload, share,
export, recipient, preview, cancel, Add, 390 New bee, reduced motion).
Export file: `bnr-listen-later.json`, 720 B, hash above.

No campaign, outreach, upload, box change, spend, or main merge.
