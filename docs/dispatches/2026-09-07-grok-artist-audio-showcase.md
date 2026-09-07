# Grok — draft artist audio showcase shell — 2026-09-07

Seat: Grok / Cursor cloud agent (`bc-ba66b21d-9e13-4edc-b39a-ca2a74eb0ec3`).
Lane: three-view artist audio showcase while publication permission is pending.
Branch: `cursor/artist-audio-showcase-0ec3` (cloud prefix; suggested name was
`grok/artist-audio-showcase-2026-09-07`).
**Base SHA:** `a70dafe5245b0354666c7e96103ff04ff13edb0e` (`origin/main` at start).

Astra keeps shared theme/register infrastructure and the audio-prep tool on
draft #32. This lane owns the showcase UX shell only. Draft PR. No production
deploy, no ANT/AR upload, no mint, no campaign.

## Placement (bad hunches discarded)

`docs/mvp-walk/` is the clean home. Reasons:

1. The founder asked for a clickable HTML surface under `docs/mvp-walk/` or a
   clearly labeled review board. `docs/mvp-walk` is already Grok’s internal
   review pack on #28; it is **not** a live estate surface.
2. Putting this under `surfaces/` would trigger the registration ritual
   (`estate.json`, atlas, `review.html` SURFACES) and would publish a
   development fixture next to live tools. That is the wrong ritual for an
   unconfirmed-rights draft.
3. `surfaces/kandi.html` is the live gift engine. This lane does not edit it.
   Astra’s unfinished YouTube player on #32 is not merged here.
4. `surfaces/listening.html` is a seed-synth inscription demo, not an artist
   credit/storage shell. Reusing it would mix two different claims.

## Exact paths

| Path | What it is |
|---|---|
| `docs/mvp-walk/index.html` | Tiny walk index. Points at the showcase. Labels the pack as internal review. |
| `docs/mvp-walk/artist-audio-showcase.html` | Three-view shell. New bee default. `data-register-host` + `surfaces/register.js?v=9`. |
| `docs/mvp-walk/assets/artist-audio/showcase.js` | Play/pause, volume, bloom load, disclosure memory. Audio only after Play. |
| `docs/mvp-walk/assets/artist-audio/TEST-AUDIO-not-authorized-release.wav` | Generated 1.5 s 220 Hz mono WAV. 144044 bytes. |
| `docs/mvp-walk/assets/artist-audio/TEST-AUDIO-not-authorized-release.json` | `bnr-audio-release/1` manifest. Rights `unconfirmed`. Storage null. |
| `docs/mvp-walk/assets/artist-audio/README.md` | Fixture warning. |
| `docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg` | Astra bloom copied from #28 (`dc33607`). Not rebuilt. |
| `docs/mvp-walk/assets/genesis-3d/motion/README.md` | SVG contract; do not rewrite Blender builders. |
| `e2e/artist-audio-showcase.test.mjs` | Source checks wired into the static Front door job. |

## Real vs placeholder

**Real**

- Local WAV fixture (generated here; not ripped).
- SHA-256 of that file, recorded with a same-line `PUBLIC-CONSTANT` marker.
- Three-view register contract (`body[data-reg]`, `bregister`, New bee default).
- Artist credit line and storage details in the unmarked shared body (all views).
- Astra bloom SVG reused; reduced-motion CSS/JS pause.
- Honest empty receipts: Autonomi `address: null`, Arweave `transactionId: null`,
  status `prepared-local-only` / `not-uploaded` / `upload not performed`.

**Placeholder / not claimed**

- No authorized recording. Rights remain `unconfirmed`.
- No Autonomi or Arweave upload, quote, signature, or retrieval.
- YouTube is an optional **external** link only (`watch?v=pb6OqIyyLAk`).
  Not an embed. Not a clearance of CJ Bolland / Sugar Is Sweeter.
- midivault’s simulated 32 KiB `subarray(0,0x8000)` path was not used and
  was not modified.
- `#32` `scripts/prepare-audio-release.mjs` is not copied; language is aligned
  with that draft’s manifest shape.

## How to open locally

From the repository root (not as a `file://` URL — the bloom SVG is fetched):

```sh
python3 -m http.server 4188
```

Then open:

`http://127.0.0.1:4188/docs/mvp-walk/artist-audio-showcase.html`

1. New bee (default): large Play/Pause, volume, readable credit line.
2. Switch to Raver: same player beside the green–teal–purple bloom.
3. Switch to Cypherpunk: same listening plus empty Autonomi/Arweave receipts.
4. Confirm credits and storage details remain visible in every view.
5. Confirm audio does not start until Play. If the OS is set to reduce motion,
   the bloom stays still.

## Verification on this seat

- `node --test e2e/artist-audio-showcase.test.mjs` — run before the PR summary.
- Browser walk of the three views — recorded after push.
- `surfaces/kandi.html` and `surfaces/blight/midivault.html` not in this diff.

No production box, wallet, upload, or campaign post.
