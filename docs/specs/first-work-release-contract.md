# First bloom: work, share, receive and collection contract

Version 1, 2026-09-07. This is a credited public-reference journey. Keep does
not transfer ownership, grant a remix licence, or record receipt on a chain.

## One work, one link

- Work ID: `bnr-genesis-bloom-v1`.
- Page: `docs/mvp-walk/first-work.html`.
- Share fragment: `#work=bnr-genesis-bloom-v1`.
- Title: Genesis bloom. Original artwork: LoVis and his mother.
- Reference data lives in `assets/first-work/work.js`, exported as
  `window.BNRFirstWork`. Links never supply artist/title/asset metadata.
- `resolveHash(hash)` accepts the known ID, empty arrival, and the page's
  `#makers`, `#collection` and `#share` anchors. Other fragments refuse Keep.
- `shareURL(pageURL)` uses that page's HTTP(S) origin/path, removes query
  parameters and replaces the fragment with the known work ID. Local preview
  links are local; the public route becomes available after release.

## Controller and page boundary

Astra owns `assets/first-work/work.js`, `receive.js`, collection persistence,
behavior tests, CI, registration/integration and this contract. Grok owns the
presentation in `first-work.html`, `assets/first-work/style.css`, and the
share-card presentation. Keep the IDs below while improving copy/layout.

| Element ID | Contract |
| --- | --- |
| work-content | Known work presentation; hidden for an unknown fragment |
| unknown-work | Unknown-link explanation; initially hidden |
| keep-work | Explicit Keep button; disabled until collection can be read |
| work-status | Status near Keep, role=status |
| share | Native details containing the share controls |
| show-share | Opens the share details without changing the selected work |
| share-link | Read-only input, filled by the controller with the canonical link |
| copy-link | User-triggered clipboard copy; selectable fallback on failure |
| native-share | Optional browser share action; hidden if unavailable |
| share-status | Copy/share outcome, role=status |
| makers | Maker credit and context anchor; no invented profiles or follows |
| collection | Personal collection anchor |
| work-collection | List of saved references; controller renders safe DOM nodes |
| collection-status | Read/write/import/export outcome, role=status |
| export-collection | Downloads the existing BNR JSON envelope |
| import-collection | Local file input; selecting previews only, never saves |
| import-preview | Import preview container, initially hidden |
| import-items | Safe list of proposed imported references |
| confirm-import | Deliberate merge; never erase/replace existing collection |
| cancel-import | Dismiss the preview without writing |
| work-bloom | Same-origin SVG artwork object using the original bloom asset |
| bloom-pause | Pause/resume visual motion; independent of Keep/share |

Shared `surfaces/register.js` owns the three-view toggle. Skin changes never
recreate the work, input, import preview or collection. The known work is
visible before any Keep. No save, autoplay, wallet or network node on arrival.
Local section links, including the `#work-content` skip target, must resolve
the same work. The skip target is focusable and never hides itself on arrival.
External destinations carry a new-tab indication, `_blank`, and
`noopener noreferrer`. Creator-supplied original JPG is retained unchanged.

## Persistence and recovery

Reuse `window.BNRListenLater`, store `bnr-listen-later`, schema
`bnr-listen-later/1`, including the existing exclusive Web Lock. The work is
a `medium: visual-art` public reference with its stable ID and maker credit.

- `previewImport(text)` validates an existing export, returning {schema,items}.
- `importItems(storage,text,{locks?})` merges under the existing lock, returning
  {store,added,already}. Same ID + differing normalized content refuses the
  entire import; exact duplicates count once. Old entries are never replaced.
- The first-work controller additionally rejects an imported known bloom ID
  whose normalized credit/record differs from the bundled canonical record.
- Failed and uncertain writes retain the existing collection semantics.
  No app can promise recovery after browser data is cleared without an export
  or a separately demonstrated recovery mechanism.

## Acceptance

Known link -> correct bloom and credit -> explicit Keep -> one saved record
after reload -> export -> preview import in a separate store -> deliberate
merge -> same work and maker. Unknown link, malformed import, duplicate taps,
conflicting metadata, denied storage/clipboard and stale file reads must not
silently corrupt state or claim success. Test all views and new-tab links.
Real people and independent-phone observations remain separate evidence.

Grok can build the share card around this fixed work ID and route. A static
share card is not a verified platform-specific social preview or scanned QR.
Only call those verified after the actual public link/render/scan works.
