# Grok — bloom presentation companion of the connected first work — 2026-09-08

Seat: Grok / Cursor cloud agent (`bc-1bff87ae-0cd7-443f-a2fd-170dbc6e4439`).
Lane: printable/share companion for the first work, after Astra’s cold review
of PR #37.
Branch: `cursor/bloom-work-pack-4439`.
Base for this companion: `codex/first-work-journey-2026-09-07` (PR #35 head
`d96c159` at merge).

No production deploy. No mint. No campaign. No recruitment. PR stays draft.
This seat did not edit `docs/mvp-walk/first-work.html`,
`docs/mvp-walk/assets/first-work/*`, `docs/mvp-walk/assets/artist-audio/collection.js`,
or `surfaces/register.js`. Live kandi was not edited.

## Supersession — one work identity, one receive path

The original #37 draft at `b839d7e` shipped a second collection record,
`bloom-genesis-lovis-mother`, with `links: []`, plus its own Keep/forget
wrapper and a pending-receive slot. That identity is **withdrawn**.

| | Withdrawn draft (#37 at `b839d7e`) | Canonical (PR #35) |
|---|---|---|
| Work id | `bloom-genesis-lovis-mother` | `bnr-genesis-bloom-v1` |
| Keep / receive | Independent `BNRListenLater` save on the work page | `docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1` |
| Share | Cream card, no register | Connected page share + this printable companion |
| Return link from collection | None (`links: []`) | Controller record on #35 |

A browser that kept the withdrawn id during the earlier draft walk still holds
a pointer this pack will not migrate. This seat does not edit the collection
library. That leftover is not the receive path.

Astra’s review of `b839d7e` named three P2s; this companion answers them
without merging a second engine:

1. Reuse the canonical record/controller by **linking** to it. No second save wrapper.
2. Share card now mounts `surfaces/register.js?v=9` and authors three views.
3. Loaded SVG is named (`role="img"` + `aria-label` from the still) instead of
   `aria-hidden` while the original image is hidden. The figure also keeps a
   visible `figcaption`.

Useful visual direction kept: original bloom, cream canvas, named colours
(purple = humans, teal = AI, green = biomass), and “the bloom they made
together.” Astra already carried that phrase onto the connected page
(receipt: `docs/dispatches/2026-09-07-astra-bloom-pack-integration.md`).

## What this pack now is

| Path | Role |
|---|---|
| `docs/mvp-walk/works/bloom-genesis.html` | Visual entry. Sends Keep/share to the connected page. |
| `docs/mvp-walk/works/bloom-genesis-share.html` | Printable/share card with full two-line maker credit and an origin-relative work link. |
| `docs/mvp-walk/works/bloom-genesis.js` | Breathing SVG mount, reduced-motion pause, accessible naming, copy of this origin’s work link. No collection writes. |
| `e2e/bloom-work-pack.test.mjs` | Source checks for identity, a11y naming, register-on-share, folded engineering notes. |
| this dispatch | Supersession + real vs pending. |

New bee’s first screen is the artwork, credit, colours, and one choose-click
to the connected page. Preview labeling is a compact uppercase line.
Engineering notes (canonical id, withdrawn id, kandi-not-this-receive) live
under **About this preview**. There is no empty artist-support call-to-action.

The share card prints light: view chrome, crumbs, and copy controls hide;
the still, “LoVis” / “and his mother”, colour names, and
`../first-work.html#work=bnr-genesis-bloom-v1` remain.

## Real vs pending

**Real on this companion branch (after merging #35)**

- Canonical work id `bnr-genesis-bloom-v1` on `docs/mvp-walk/first-work.html`.
- Origin-relative link from `docs/mvp-walk/works/` to
  `../first-work.html#work=bnr-genesis-bloom-v1`.
- Original artwork credit: LoVis and his mother, complete on the card as two
  lines so the mother’s name is not a clipped overflow.
- Colour meaning in words and hue.
- Lightweight still extracted from the packed original inside the breathing SVG.
- Three views on both interactive HTML pages via the existing register.
- Kandi remains the live bracelet gift engine, labeled not-this-work’s-receive.
- External GitHub link to draft PR #31 uses `target="_blank"`
  `rel="noopener noreferrer"` and a visible new-tab label.

**Pending / not claimed**

- Stable public work URL beyond this origin’s preview path.
- Public social rendering of the card. Not observed here.
- QR. Not printed. A code is not invented.
- Native re-import of a new bloom export. Not observed here.
- Artist-selected support/shop destination. No empty CTA until one exists.
- Human observation or matriarch acceptance.

## How to open

From the repository root (not `file://` if you want the optional breath):

```sh
python3 -m http.server 4188
```

- Presentation: `http://127.0.0.1:4188/docs/mvp-walk/works/bloom-genesis.html`
- Share card: `http://127.0.0.1:4188/docs/mvp-walk/works/bloom-genesis-share.html`
- Canonical Keep/receive: `http://127.0.0.1:4188/docs/mvp-walk/first-work.html#work=bnr-genesis-bloom-v1`

## Verification

Source tests on this seat after the conversion:

```sh
node --test e2e/bloom-work-pack.test.mjs
```

Browser walk, skin retention, and printed/card credit bounds are recorded
after the conversion commit. Public QR and native import are not asserted.

Earlier #37 remote CI (8/8 green on `29405ce` / `b839d7e`) applied to the
withdrawn Keep-wrapper draft, not this companion.
