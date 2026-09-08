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

## Astra integration checks (evidence)

| Check | How verified |
|---|---|
| Collections survive reload | `localStorage` key `bnr-listen-later`; `showCollection()` on load. Browser walk after reload. |
| Duplicate saves idempotent | `saveItem` returns `{ already: true }`; source test. |
| Failed writes never say Saved / never erase | `writeStore` throws; UI paints `before` and says refused. Source test with throwing `setItem`. |
| Exports preserve credits, no private data | `exportPublic` + `publicItem` keep title/artist/rights and `kind === 'external'` `https://` only. Source test injects javascript/local/wallet links and expects them dropped. |
| Skin changes preserve playback and collection | `applySource(source, { silent: true })`; no `currentTime = 0`; collection is storage, not view state. |
| Listening stays simple, optional, wallet-free | Three actions. No wallet UI. Save is a public reference, not a download. |

Browser walk receipts for this beat are recorded after the push, in a
follow-on dispatch note if the walk happens after the first commit.

No box, wallet, upload, or campaign post.
