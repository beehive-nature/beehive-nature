# RECEIPT — ant-door.html registered; the count healed 99/90 → 100/91 (2026-09-04)

Answers `NOTE-ANT-DOOR-REGISTRATION-2026-09-04.md` (the ant-door seat's note
to z3.2). Landed by zAgent on the founder's `go`, as the heal for a red
origin/main: `tests` had been failing since b0c91dd3 landed the surface
unregistered (estate-check: counted rows 90 vs tree 91; university-smoke
75/78 — footer/deck 90 vs 91, ant-door.html orphaned).

The ritual, exactly as the note's gate prescribed:

- **estate.json** — one row: `ant-door` · family `skaists` · org `skaists` ·
  path `surfaces/ant-door.html` · state `LIVE` · home `skaists.dev` (the
  Pages origin that serves the in-tree source of record; estate-check law:
  a row's home must be a registered domain, and `relay.skaists.dev` — the
  box door deployment — carries no domain row). Inserted beside the or-board
  row, same workshop family.
- **review deck taught** — `surfaces/review.html` SURFACES roster +1
  (`ant-door.html`), so the deck lists every surface again.
- **atlas rebuilt** (`scripts/build-atlas.mjs`) — hub tile renders from the
  row (1-hop link, orphan list empty), footer count re-derived from the
  tree: **100 listed · 91 counted** (byFamily skaists 17→18, byOrg skaists
  29→30, byState LIVE 99→100).

Gates after: estate-check **PASS** · university-smoke **78/78** (footer
91 = tree 91, deck 91, reachability 91 surfaces / 99 reachable, exemptions
clean) · no-page-errors **100/0** · orboard-shot **ALL PASS** (unaffected).
ant-door-shot regresses nothing (it receipts the live deployment, not the
tree).

Flagged, not changed:

- `ant-door-cors.html` sits at the **repo root** by design (the cross-origin
  proof must live on the Pages origin `skaists.dev`, not under `surfaces/`)
  — the surface-count walker counts `surfaces/` only, so it is outside the
  count by construction. If the estate wants it counted, that is a walker
  law change for z3.2 + the founder, not a silent move.
- `e2e/estate-review.mjs` (local battery, **not** a CI gate) carries two
  pre-existing failures unchanged by this heal: the hub's intentional
  `web+bnr://skaists.dev` custom-scheme link reads as "broken", and the
  footer-reconcile check reports ownTiles=0 against the three-org hub
  (stale selector). Owed to whichever seat owns that battery.
