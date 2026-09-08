# Grok — calm New bee listening page — 2026-09-08

Seat: Grok / Cursor cloud agent (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Lane: HTML-only calm of draft #33. Astra owns `showcase.js` / `collection.js`
on `codex/artist-showcase-integration-2026-09-07`.
Branch: `cursor/artist-audio-showcase-0ec3`.
Draft PR: https://github.com/beehive-nature/beehive-nature/pull/33

Owned this beat: `docs/mvp-walk/artist-audio-showcase.html`, wording
expectations in `e2e/artist-audio-showcase.test.mjs`, this dispatch.
Not touched: `showcase.js`, `collection.js`, `register.js`, kandi, midivault.
No history rewrite. No merge. No upload, mint, or campaign.

## What changed

New bee is a listening page, not a review desk.

- One visible Play action. `#watch` is retained but `hidden` (no video).
- Fixture credit stays large and readable on the player.
- Other ways to listen starts closed (no `open`, and no
  `data-view-disclosure="sources"` so current `defaultOpen` cannot force it).
- Save for later sits directly under the stage.
- Empty ANT/AR slots, storage receipts, bytes, and implementation notes live
  in labeled details. Still reachable in every skin.
- Raver puts the original bloom first and larger.
- Cypherpunk still opens storage / receipts / limits via existing JS defaults.

## Two recordings

The 1.5s generated fixture and the YouTube upload are **different
recordings**. YouTube is labeled CJ Bolland — “Sugar is sweeter” (Sugar
Daddy), not another encoding of the test tone. Astra will split the saved
reference identity in JS. This HTML does not claim that split is done.

## Honesty

**Real:** fixture label, hidden Watch, closed Other ways on first paint,
separate CJ Bolland credit, player controls still visible, collection
controls still present.

**Open:** YouTube embed still not guaranteed. No ANT/AR upload. Save still
bundles fixture credit + YouTube link until Astra’s JS lands. Inherited §7
red on `35e4752` / `1583818` not rewritten.

## How to open

```sh
python3 -m http.server 4188
```

`http://127.0.0.1:4188/docs/mvp-walk/artist-audio-showcase.html`

## Verification

Implementation commit: `09b6d06`.
`node --test e2e/artist-audio-showcase.test.mjs e2e/artist-audio-collection.test.mjs` — **14/14**.

Browser walk at `http://127.0.0.1:4188/docs/mvp-walk/artist-audio-showcase.html`
(Python server, not `file://`):

**Desktop**

1. New bee: one Play, Watch not visible, Other ways closed. Pass.
2. Fixture credit readable. Pass.
3. Single draft/test-audio banner. Pass.
4. Save for later sits after the stage, before the details stack. Pass.
5. Play started the 1.5s fixture. Native controls visible. Pass.
6. Other ways: YouTube labeled CJ Bolland / Sugar is sweeter, a different
   recording. Autonomi/Arweave are slots. Pass.
7. Raver: bloom first and larger; Play still present. Pass.
8. Cypherpunk: storage receipts open with null Autonomi. Pass.
9. Artist credits and storage reachable in every skin. Pass.

**390px**

10. Play full-width. Watch hidden. Other ways closed. Credit readable.
    Collection findable. No overflow. Pass.

Leftover `localStorage` from an earlier walk still showed a saved fixture
row on Cypherpunk. That is prior-session state, not this HTML change.

No JS, register, kandi, or midivault edits. No history rewrite. PR stays draft.
