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

Implementation: `a57d3c1`.
`node --test e2e/first-work.test.mjs` — **13/13** (Astra’s controller tests, unchanged).

Walk at `http://127.0.0.1:4190/docs/mvp-walk/first-work.html`:

| Check | Result |
|---|---|
| Desktop bloom + credit before Keep | Pass. Skip-to-bloom present. |
| Keep → reload | Pass. Button became “In your collection”. |
| Share card + honesty caption | Pass. Card shows LoVis and his mother. Caption: not a proven public-platform preview or scanned QR. Copy: “Preview link copied. It opens on this machine.” |
| Pause through bee/raver/cypherpunk | Pass. Stayed on Play motion. Raver glow. Cypherpunk mono. Keep retained. |
| Export | Pass. `bnr-listen-later (1).json` 720 B, id `bnr-genesis-bloom-v1`, artist LoVis and his mother, note Not JAMS-compatible. |
| Choose file → preview → Add | Pass as a real picker. The file chosen from Downloads was the older showcase export (`bnr-listen-later.json`, TEST AUDIO), not the just-downloaded bloom file. Preview appeared (“Nothing has been saved yet”) then Add merged it. The 720 B bloom export itself was not re-imported in this walk. |
| 390×924 DevTools | Pass. Dimensions chip 390. No overflow. Keep/share/pause usable. |
| prefers-reduced-motion | Pass. Control: “Motion reduced”. Bloom static. |

**Untested / not claimed**
- Dedicated click on Explore JAMS (markup has `target="_blank"` + `rel="noopener noreferrer"` + “new tab”; the walker clicked “Meet the hive”, which is same-origin).
- Public skaists.dev OG/Twitter render.
- QR scan.
- Independent-phone observation.
- Re-import of the 720 B Genesis bloom export into an empty store.

No campaign, outreach, upload, or spend.
