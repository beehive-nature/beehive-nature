# Grok — Play / Watch / named sources + listen-later — 2026-09-08

Seat: Grok / Cursor cloud agent (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Lane: fold founder/Astra UX into the existing draft showcase on PR #33.
Branch: `cursor/artist-audio-showcase-0ec3`.
Draft PR: https://github.com/beehive-nature/beehive-nature/pull/33
Prior receipt: `docs/dispatches/2026-09-07-grok-artist-audio-showcase.md`.

No production deploy, no ANT/AR upload, no mint, no campaign. PR stays draft.

## What landed

Users choose **how** they read the page (New bee / Raver / Cypherpunk) and
**where** they play it. The three actions are the same in every view:

1. **Play** — local test-audio action. If YouTube is showing, Play stops that
   in-page embed and returns to the development fixture.
2. **Watch** — present and **disabled**. This board has no video file. The
   optional 3D bloom film was not copied from #31. Status text says so.
3. **Other ways to listen** — named sources. Local test audio and YouTube are
   selectable. Autonomi and Arweave stay visible as **slots**, not buttons,
   labeled not-uploaded / pending authorized release.

Source switches stop the previous in-page player. There is no automatic
fallback and no overlapping players. YouTube, once chosen, may show its own
native player. BNR cannot control an external app.

Skin changes (`bregister`) re-apply the current source and do not zero the
local playhead. Artist credits stay in the unmarked shared body. Storage
receipts live in a disclosure (open by default in Cypherpunk).

## Honesty (real vs open)

**Real**

- Local WAV fixture, still labeled TEST AUDIO — not the authorized release.
- Play / disabled Watch / named source list in all three views.
- Empty Autonomi/Arweave slots and `bnr-audio-release/1` null receipts.
- YouTube watch link `https://www.youtube.com/watch?v=pb6OqIyyLAk`.
- Referrer policy on the embed iframe: `strict-origin-when-cross-origin`.
- Listen-later collection (`bnr-listen-later/1`) in this browser only:
  public credits + explicitly selected `https://` external links.
- Duplicate save is idempotent. Failed `localStorage` writes say refused and
  keep the prior JSON. Export filename `bnr-listen-later.json`.
- Explore JAMS is an ordinary external link to https://jams.community/.

**Open / not claimed**

- No video on this board. Watch does not pretend otherwise.
- YouTube embed is **not guaranteed** here or on skaists.dev. A public HTTPS
  host may help client/referrer identification; YouTube still needs a valid
  client and per-video embed permission. DNS alone cannot guarantee playback.
  No captured API error code from #32’s failed embed; cause remains unconfirmed.
- No Autonomi or Arweave upload, quote, or retrieval.
- Export is **not** JAMS-compatible. No `jams://`, no JAMS import/playback,
  no logo reuse, no catalog or payment implication.
- Bookmark is not offline audio. No local paths, wallet data, or private
  storage addresses in the export.
- §7 on this branch: commits `35e4752` and `1583818` were authored
  `Cursor Agent <cursoragent@cursor.com>`. Identity-check on
  `origin/main..HEAD` will stay red for those ancestor commits. This beat’s
  commit uses founder author + seat committer + a parsed Co-authored-by
  trailer. No force-push (cure = descendant).

## How to verify

```sh
python3 -m http.server 4188
```

`http://127.0.0.1:4188/docs/mvp-walk/artist-audio-showcase.html`

1. New bee: Play, disabled Watch, Other ways to listen. Credits visible.
   Storage receipts reachable via disclosure.
2. Choose YouTube: local audio stops; YouTube host appears with the honesty
   note. Press Play: source returns to the local fixture.
3. Switch Raver, then Cypherpunk: same three actions; chosen source and
   local playhead remain; credits remain; storage remains reachable.
4. Autonomi/Arweave slots are not buttons and do not navigate.
5. Save this reference once. Reload. It is still there in all three views.
   Save again: stays once. Remove. Export after a save: parseable JSON,
   credits + YouTube https link, no local path / wallet / ANT / AR address.
6. Fixture label remains on the page and in the export.

Source tests: `node --test e2e/artist-audio-showcase.test.mjs e2e/artist-audio-collection.test.mjs`
— **14/14** on this seat after `2ecf7cc`.

## Browser walk (127.0.0.1:4188) — 2026-09-08

Opened `http://127.0.0.1:4188/docs/mvp-walk/artist-audio-showcase.html` (existing
Python server, not `file://`). Walk was 9/9.

1. New bee default. Play + disabled Watch (“No video on this board”). Credits
   labeled TEST AUDIO — not the authorized release. No autoplay.
2. Play started the 1.5 s fixture. Status after end: “The short fixture
   finished. Press Play to hear it again.”
3. Other ways to listen: Local test audio and YouTube are buttons. Autonomi
   and Arweave are `<p class="slot">` — click does not navigate or play.
4. YouTube: local audio stopped. Honesty note present (skaists.dev, client/
   referrer, DNS alone cannot guarantee). Watch-page link present. Embed area
   showed unavailable, as the honesty copy allows.
5. Play returned source to the local fixture and played it.
6. Raver and Cypherpunk kept the same three actions, credits, and reachable
   empty receipts. Local source stayed selected across skins.
7. Save this reference once. Reload: still there. Save again: button disabled,
   no duplicate. Remove cleared it. Save + Export downloaded
   `bnr-listen-later.json` (743 B). Parsed on this seat:
   schema `bnr-listen-later/1`, fixture true, rights `unconfirmed`, one
   `https://www.youtube.com/watch?v=pb6OqIyyLAk` link, note says
   “Not JAMS-compatible”, no local path / wallet / ANT / AR address.
8. Explore JAMS is an ordinary `jams.community` link, named external.
9. Receipts still `null — not uploaded / pending authorized release`.

## Astra integration checks (evidence)

Head for this receipt: `2ecf7cc` (implementation `1d3f07b`, test wording
`2ecf7cc`). Draft PR #33.

| Check | How verified |
|---|---|
| Collections survive reload | Browser: F5 after save; item still listed in New bee, Raver, Cypherpunk. `localStorage` key `bnr-listen-later`. |
| Duplicate saves idempotent | Browser: Save disabled after first save. Source test: second `saveItem` returns `{ already: true }`, length 1. |
| Failed writes never say Saved / never erase | Source test: throwing `setItem` leaves prior JSON. UI copy: “Save was refused. Earlier entries were not erased.” Browser cannot inject a quota error; that half is the unit test. |
| Exports preserve credits, no private data | Downloaded `bnr-listen-later.json` has title/artist/rights/fixture + one https YouTube link. Source test drops `javascript:`, local WAV path, and wallet-kind links. |
| Skin changes preserve playback and collection | Browser: local source stayed selected across Raver/Cypherpunk; saved item visible in all three views. JS re-applies `source` silently and does not zero `currentTime`. |
| Listening stays simple, optional, wallet-free | Three actions. No wallet UI. Save is a public reference, not a download. |

No box, wallet, upload, or campaign post.
