# Grok — first-work presentation and credited share card — 2026-09-08

Seat: Grok / Cursor cloud (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Model: Cursor Grok 4.6 (this session). Effort: medium presentation worker.
Base: `codex/first-work-journey-2026-09-07` @ `ada68dca`.
Branch: `cursor/first-work-share-card-0ec3`.
Companion to draft #35. Does not replay #33 history. PR #34 is already merged
(`df895c7c`).

Owned: `docs/mvp-walk/first-work.html`, `docs/mvp-walk/assets/first-work/style.css`,
`docs/mvp-walk/assets/first-work/share-card.png`, this dispatch.
Not touched: `work.js`, `receive.js`, `collection.js`, CI, kandi, original
`original-bloom.jpg`.

## What landed

Finished-work presentation for Genesis bloom (`bnr-genesis-bloom-v1`):

- Artwork and maker credit still appear before Keep.
- Three skins remain (New bee default, Raver celebrates the bloom, Cypherpunk
  keeps the evidence voice).
- Skip-to-bloom, 46px targets, visible focus, overflow-wrap on share URL and
  collection rows. Same-origin links stay in this tab. JAMS and LOVErnment
  still open labeled new tabs (`target="_blank"` + `rel="noopener noreferrer"`).
- Share details shows the credited card and says it is **not** a proven
  public-platform preview or QR scan. `og:image` / Twitter card point at
  `share-card.png` (1200×630) for when a public route exists.
- Keep / Share / export / choose-file / preview / Add IDs unchanged. No second
  store, auto-Keep, wallet gate, follow, ownership transfer, or JAMS-compatible
  claim.

## Honesty

**Real:** in-page presentation, local Keep/share/import controls (Astra’s),
static credited PNG composed from the unchanged original JPG.

**Open / not claimed:** public OG/Twitter render, QR scan, human recipient
Keep, campaign, media upload, box change, spend.

## How to open

```sh
python3 -m http.server 4190
```

`http://127.0.0.1:4190/docs/mvp-walk/first-work.html`

## Verification

Recorded after the implementation commit and the desktop + 390px walk.

No campaign, outreach, upload, or spend.
