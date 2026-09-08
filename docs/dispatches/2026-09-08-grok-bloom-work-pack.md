# Grok — first-work presentation pack (bloom genesis) — 2026-09-08

Seat: Grok / Cursor cloud agent (`bc-1bff87ae-0cd7-443f-a2fd-170dbc6e4439`).
Lane: draft artist/fan pack for the first work — LoVis and his mother’s
green–teal–purple bloom. Presentation only.
Branch: `cursor/bloom-work-pack-4439` (cloud prefix; suggested name was
`grok/bloom-work-pack-2026-09-08`).
Base: `df895c7` (`origin/main` at start, after PR #34).

No production deploy. No mint. No campaign. No recruitment. PR stays draft.
`surfaces/kandi.html` was not edited. Autonomi/Arweave delivery is not claimed.

## What landed

| Path | Role |
|---|---|
| `docs/mvp-walk/works/bloom-genesis.html` | Work page. New bee default. Hero still + optional Astra breath. Shared credits. One Keep action. Share card link. Empty support slot. |
| `docs/mvp-walk/works/bloom-genesis-share.html` | Printable/OG-style card. Still, makers, invitation, draft path, reserved QR. |
| `docs/mvp-walk/works/bloom-genesis.js` | SVG mount, reduced-motion pause, listen-later save of a visual pointer. |
| `docs/mvp-walk/assets/genesis-3d/stills/green-teal-bloom.jpg` | 15 269-byte JPEG extracted from the packed original inside the breathing SVG. |
| `e2e/bloom-work-pack.test.mjs` | Source checks wired into the static Front door job. |
| this dispatch | Real vs pending. |

The walk index now points at both pages. Three views use the existing
`surfaces/register.js?v=9` host. Credits, colour meaning, Keep, Share, and
the empty support slot are unmarked shared facts.

## Real vs pending

**Real**

- Original artwork credit: LoVis and his mother.
- Colour meaning in words and hue: purple = humans, teal = AI, green = biomass.
- Lightweight still (packed original JPEG) plus optional breathing SVG already
  on main from the artist-showcase lane. `#31` 1 MB Blender reliefs were not
  copied.
- Keep a reference writes `bnr-listen-later/1` in this browser via the
  collection already shipped on main (PR #34). Empty `links`. Medium `visual`.
  That is a credited pointer, not a file and not a license.
- Share card is same-origin HTML. Invitation has no numbered how-to.
- Kandi remains the live bracelet gift engine, labeled live and untouched.
- External GitHub link to draft PR #31 uses `target="_blank"`
  `rel="noopener noreferrer"` and a visible new-tab label.

**Pending — named, not invented**

- Stable public work URL (Astra). The printed path is draft/local.
- QR (reserved empty; a code now would send someone nowhere).
- Connected receive for this work (Astra). Placeholder only. Kandi
  copied ≠ received is a different gift, not this artwork’s receive path.
- Artist-selected support/shop destination. Slot empty. No Bandcamp.
- Human observation or matriarch acceptance. Source checks and a later
  browser walk are not that.

## How this keys to Astra’s adoption spine

The promise on the page is the adoption order already in the estate:
make something beautiful, give someone a piece, stay connected to its maker.

| Beat | Where it already lives | What this pack does |
|---|---|---|
| View the work | `#31` studio / breathing SVG; showcase bloom on main | Puts the original still first. Motion optional. |
| Keep a piece | `bnr-listen-later/1` (PR #34) | Reuses that store for a visual reference. |
| Give a piece | Share card; later a public URL | Card now; URL marked draft. |
| Person-to-person gift | Live `surfaces/kandi.html` | Linked, not edited. Labeled not-this-work’s-receive. |
| Connected receive | Not shipped | Empty slot pointing at Astra’s future release. |
| Stay with the maker | Credit line; future support URL | Credit real; support destination pending. |

This follows the three-view journey dispatch
(`docs/dispatches/2026-09-07-three-view-journeys.md`): New bee’s first
outcome is to find something to enjoy; Raver may carry a gift; Cypherpunk
sees empty receipts. Same facts in every skin. Choose-click, not a
numbered procedure. Matriarch New bee law: view / emotion / one obvious
action.

## How to open

From the repository root (not `file://` if you want the optional breath):

```sh
python3 -m http.server 4188
```

`http://127.0.0.1:4188/docs/mvp-walk/works/bloom-genesis.html`

Share card: `http://127.0.0.1:4188/docs/mvp-walk/works/bloom-genesis-share.html`

## Verification

Source tests on this seat after the implementation commit:

```sh
node --test e2e/bloom-work-pack.test.mjs
```

**12/12** at `ec201b6`.

### Browser walk — 2026-09-08, `127.0.0.1:4188`

Opened via `python3 -m http.server 4188` from the repository root (not
`file://`). This is a seat walk, not matriarch or human-observation
acceptance.

- New bee default. Bloom hero visible. “Rest the bloom” present; status
  “A gentle breath inside this artwork. It is not a live connection.”
  Credit “LoVis and his mother” unmarked. Colour chips named in words.
  Keep is the large first action. No numbered how-to.
- Keep a reference → button “Kept in this browser”. Status: a reference,
  not ownership.
- Raver: dark atmospheric canvas, same bloom, same credit, Keep stays kept.
- Cypherpunk: mono canvas, same credit, nearby-path receipts name the
  draft/local path and pending receive.
- Share card: still, makers, invitation, draft path, QR reserved, copy
  status “Copied the draft path and credit. This is not a public URL and
  not a receive receipt.”
- 390px New bee: bloom, Keep, and chips reflow; no horizontal card overflow.
- PR #31 link labeled “(opens in a new tab)”.

PR stays draft.
