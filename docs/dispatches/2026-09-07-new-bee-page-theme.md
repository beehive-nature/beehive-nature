# New bee page canvas and readable type — 2026-09-07

Founder asked that New bee backgrounds and text continue to match the approved hub. The shared toggle alone did not do that: older pages still used dark canvases and 9–13px text. This lane adds a shared page theme and complete adapters for the first reading families. It is not a claim that every tool has been redesigned.

## Landed scope

`surfaces/register.js` supplies the light canvas, neutral panel/inset/text aliases, system type and readable body/secondary scales. It follows the existing view preference and restores the original page styling when Raver or Cypherpunk is selected. The hub retains its own approved custom skin.

Eleven pages use the new shared treatment: `profile.html`, `buzz-directory.html`, and all nine pages in `surfaces/doors/`. Seven domain documents get their existing semantic hue families at deeper text stops, clearer cards and descriptions, and a quiet canvas without the scanline overlay. The two relay doors get paired light cards, relay-address fields and copy controls. The directory gets readable listing/status text and links. Profile has its own layout/type adapter, with larger names, descriptions and generation records. No page wording, links, numbers, claims or behavior were rewritten.

New shared-page content may explicitly use `data-bee-theme="shared"`; an authored theme uses `custom`, and preserved work uses `preserve`. Legacy tools without reviewed adapters get `pending`. The shared control remains present there. Theme status is an implementation detail, not a new visitor choice or access tier.

## Why migration is explicit

Independent review of the first broad experiment found three real problems: inherited dark ink on retained dark inputs/messages, bright semantic text on white cards, and a chart background changing independently of its geometry/HUD. That experiment is not shipped. Unconverted families keep complete original palette pairs; bQueenBee, Review and Comb are regression cases. Original fleet art, hosted art derivatives and both orbit artworks retain their own canvas. The frozen artifact bytes are unchanged.

The neutral theme does not replace categorical or semantic tokens globally. Reviewed document adapters use deeper stops within existing hue families. Chart/tool families need their own complete adapters before joining the shared theme. Background conversion alone is not acceptance.

## Checks and limits

The register suite has 15 checks: existing view/storage/form/host behavior, theme switching, preserved artwork, reviewed-family activation, unconverted-tool isolation and the declared reading-palette contrast floor. The color arithmetic verifies declared pairs; it does not assert rendered contrast of every element. All 48 focused atlas, dock, language, register and social source checks pass, as do the estate census, JavaScript syntax check and diff whitespace check. Committed-tree/CI/deployment results are recorded on the PR and coordination issue as they complete.

The independent source reviewer caught six door-directory titles with inline pale colors that bypassed the adapter. Those titles now use their existing semantic variables, preserving the original colors in the other views and receiving the deeper stops in New bee. The reviewer accepted the corrected source with no remaining actionable issue in the bounded 11-page review. This acceptance is not rendered usability testing.

No local browser interaction, screenshots, visual QA, human translation review, live relay probe or production box edits were performed for this lane. A rendered usability review remains separate. Cache versions: register 8, tour 38; generator templates preserve them. No corpus/floor changes; no new surface rows or altered art pins.

## Continuing the standard

`docs/DESIGN-CONSTRAINTS.md` §13 now records the founder's continuation: reuse the shared New bee theme, keep readable default text, and migrate complete palette units. The old dense-text ceiling is not the New bee target.

Grok retains its social/marketing ownership and cloud corpus worker bc-023a5487-2f9a-4350-8202-cbecc8b76cdd. Astra owns the shared theme and profile adapter. The next consumer work is tool-family adapters plus social copy/translation, with exact paths claimed in issue #10. Pending tools are not silently reported as light-themed.

Astra used the existing lead session; `grok_social_map` reused one bounded read-only review session, inherited model/effort with no override. No new implementation fleet or paid infrastructure. Rollback is a descendant revert of this lane with a fresh rider version when publishing; do not force-push or repin artwork.
