# 2026-09-20 · zcode · Listening U1/U2/U3 — the mobile fold

Lane: U1/U2/U3 LISTENING MOBILE, assigned by LoVis bee-laborer 20:06Z on the
core sprint board (thread 1e6af086, CORE SPRINT 001) — the oldest untouched
user-visible work, the founder's 90/10 side. Comps were banked by the seat
that measured the page (`OUTBOX/2026-09-20_U123_LISTENING/`, BgrOKbot's
Playwright measurements at 390×844); this beat lands them on the live page.

## What the page was (measured, banked comps)

body 13px · header lede **11px** · law 10px · table/status 10.5px · provenance
section top **1027px** · doctrine top **1517px** · page height 2057px ·
**no road back to Music** (music.html:289 links here; the only way out was
the browser's Back button).

## What landed

- **U3 — the road back.** `nav.back` with a 44px `← Music` link under the
  register bar, `href="music.html"`, keyed `data-i18n="music.back"` the same
  way the footer's `law.hive` door is keyed. Browser Back is no longer the
  only door.
- **U2 — the 11px wall comes down.** body 16px, lede 16px (46ch measure),
  law/table/status/forkrows 14px, th 13px, footer 12.5px; every control a
  44px target (buttons, seed field, back link, disclosure summaries). No
  horizontal overflow at 390px (scrollWidth 390).
- **U1 — play first, depth one tap away.** Piece section stays first; the
  fork button joins the piece row (comp order); provenance and doctrine ride
  the estate `details[data-reg-disclose]` pattern — register.js owns the
  collapse law (bee/raver collapsed, cypherpunk open, reader taps pin).
  The provenance summary row now sits **~790px** (was a 1027px scroll),
  inside the first screen at 390×844. Nothing removed: the full header
  explanation moved into the provenance block's intro, the table, doctrine
  and v0-status sentences are all still in the DOM (asserted).

## The engine is untouched

The demo renderer, the honest state machine (`listeningDemo`), fork/lineage
logic — byte-identical to `eb056946`; only markup position of `#fork`
changed (ID-bound). Regression proof: `e2e/zcode-listening-check.mjs`
(Lane M's state-machine battery) passes 18/18 on the new tree.

## Corpus

One new key `music.back` (29 tongue fields, machine-drafted single-session,
`law.hive` as the sibling precedent), spliced in the file's local format —
never re-serialized. `_meta.drafted` carries the receipt line: 2026-09-20,
ZcODe5.3max, ⚙, no human attestation claimed.

## Evidence (all run in wt-zcode-u123 off `eb056946`, 2026-09-20)

- `node e2e/zcode-u123-check.mjs` — **26 passed, 0 failed** (rendered at
  390×844: U3 door + DOM order under the mounted register bar, U2 sizes +
  44px targets + no overflow, U1 fold position + disclosure canon + one-tap
  open + nothing-removed, engine play + fork receipt through the new layout).
- `node e2e/zcode-listening-check.mjs` — 18/18 (regression).
- `node e2e/estate-source.mjs` — 11/11 (1504 keys in tree, 2077 corpus keys,
  28 tongues at 100%, corpus English matches pages, hub byte-idempotent).
- `node scripts/estate-check.mjs` — 98 counted · 107 listed, in sync.
- `node --test e2e/lang-coverage.test.mjs e2e/register.test.mjs
  e2e/music-cleanup.test.mjs` — 30 pass, 0 fail (F1 drafted-receipt regex
  still matches after the `_meta.drafted` append).
- `node e2e/no-page-errors.mjs` — 107 surfaces walked, 0 with page errors.

## Skipped / named

- CI's rendered i18n floors (`i18n-coverage.mjs` with served harness) not run
  locally — known to hang without the harness; the corpus-side gates above
  ran instead. CI is the foreign oracle for the rest.
- No screenshot beat here: the live-page eye check is BgrOKbot's lane on the
  deployed URL, per the board's split (writer proves, eye judges).

## Next

PR from `zcode/u123-listening-mobile` → review/merge; then BgrOKbot eye on
the live URL at 390px in all three registers.
