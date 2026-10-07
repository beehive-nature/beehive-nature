# SLICE B — the stray tracked `surfaces/workbench.tmp` is deleted (2026-09-19)

Writer: ZcODe5.3max (channel session, bGENEaLOGy). Cut: bFaBLe5.1 wide queue
`PLANS/WIDE_QUEUE_2026-09-19.md` (event `1e06583d`); confirmed owner by LoVis
bee-laborer (event `dd8ac1c5`, over the 2026-09-13 "Astra's call" deferral — that
deferral was the sweeping seat's own note, never a ruling; it is named here per the
coordinator's condition so Astra can object at review). Base: `5fea6b13`
(= `origin/main` at cut time).

## What shipped

1. `git rm surfaces/workbench.tmp` — the only tracked `*.tmp` in the repo.
2. `e2e/no-dead-host.test.mjs`: the SITES pin row for `surfaces/workbench.tmp`
   is dropped. Guard (1) — the fleet scan that walks `surfaces/` for
   `.html/.js/.tmp` — is UNTOUCHED and still scans `.tmp` (verified: the
   `'`+`.tmp`+`'` ext entry count in the file is 1 after the change). Any future
   `.tmp` near-code file is still covered by the #67 law.

## Observed state, reproduced by me at base `5fea6b13` (writer, not read off the cut)

- `git ls-files "*.tmp"` → `surfaces/workbench.tmp` (the only one).
- Size 67,945 B (matches the live `Content-Length: 67945` bFaBLe5.1 measured at
  `https://skaists.dev/surfaces/workbench.tmp` → 200 OK; controls: the real page
  200, nonsense `.tmp` → 404 — GitHub Pages serves tracked files verbatim).
- Added `4a79b586` 2026-08-29.
- References outside itself: 3 dispatches (2026-09-12-bnames-rpc-heal,
  2026-09-13-dead-host-inventory, 2026-09-13-dead-host-sweep) + the dead-host
  test pin row. Zero page/script references.
- Drift vs the real `surfaces/blight/workbench.html`: 13 diff lines (tmp lacks the
  2026-09-16 44px touch floor and the three `data-reg-disclose` notes; pins
  `tour.js?v=34` vs `v=42`) — the tmp was a stale fork of the page, not a source
  of truth for anything.

## Why this is a slice, not a founder ask

The 2026-09-13 dead-host sweep subtracted the dead literal from the tmp and
deferred deletion to "Astra's call" (`2026-09-13-zcode-dead-host-inventory.md:53`,
`…-sweep.md:33`). No ruling or dispatch ever reserved it; six days elapsed.
Deletion is reversible housekeeping (one `git revert` restores it), so under the
scheduler law (thread `d6ec03ef`) it is seat work. The live-URL effect —
`https://skaists.dev/surfaces/workbench.tmp` going 404 — happens only through the
founder's own merge + Pages deploy; that merge stays the gate, exactly as cut.

## Evidence (all run by me, in this worktree, at this head)

- Baseline at base: `node --test e2e/no-dead-host.test.mjs` = 11/11 PASS.
- RED-FIRST: `git rm` the tmp with the pin row still present → exactly 1 FAIL
  (`ENOENT ... surfaces\workbench.tmp`) — the pin row genuinely guards the file.
- Cure: pin row dropped → 10/10 PASS, 0 fail. Guard (1) `.tmp` glob still present.
- Full CI front-door line (29 files, `tests.yml:81` set): 332/332 PASS, 0 fail,
  0 skipped (333 at base − the removed pin-row test; every other assertion identical).
- `node scripts/estate-check.mjs` → PASS, 96 counted / 105 listed, hub static +
  embed in sync — unchanged (the tmp was never in `estate.json`).

## Boundaries

File family exactly as cut: the tmp (delete) + the one test row + this dispatch.
No other file touched; no corpus, page, or script changes; read-only beyond the
family. Blast radius: zero live references; the only observable external change is
the 404 after the founder's next Pages deploy.

Executed-by: ZcODe5.3max (GLM 5.3) · Seat: zGeneUI channel session (second lane)
Orders: bFaBLe5.1 cut `1e06583d` + LoVis bee-laborer confirm `dd8ac1c5`
Base: `5fea6b13`
