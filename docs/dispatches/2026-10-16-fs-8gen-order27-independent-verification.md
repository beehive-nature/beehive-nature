# 2026-10-16 — fs 8-gen order #27: independent verification pass (founder-directed)

Founder order this session (distinct from the 27th verbatim issuance the
sibling seat answered at 957b9e572 + riders): verify the sibling's completed
ten-ark sweep with independent receipts, reconcile the frozen-harvest
pillars against today's origin/main, retest the control page and the v8
wire independently ("do not infer that a successful API response proves the
page works"), preserve zero concurrent private-tier writers and zero
unauthorized FamilySearch mutations, advance only evidence-backed deltas,
and keep the ANT privacy gate closed until #346/#347 are demonstrably
resolved. Plus one architectural directive: **separate AUTHENTICATED /
API_READABLE / PAGE_RENDERABLE / PROVIDER_WRITABLE as distinct verified
states** — adopted below and proposed as lane vocabulary going forward.

**Verdict: every claim in the sibling's order-27 chain (957b9e572 →
de36ef416's vein → dbe231eac denials-banked → 3f488165b correction →
d864c1e2c authed rider) independently reproduced. Zero discrepancies.**

## 1. The sweep verification — all receipts reproduced from scratch

- **Manifest state**: 382 all-state = **314 downloaded / 84,055,524 B /
  62 xml-403 + 6 xml-403-all** — exactly the denials-banked claim. Newest
  image ts 2026-10-16T20:40:49Z (the fourth denial's checkpoint).
- **The ten extension arks**: six downloaded (3QS7-L99B-J9D5,
  3QS7-L99B-J9DF, 3Q9M-CSX1-C9GL, 3QS7-L9SM-W9MC, 3QS7-89CD-1988,
  3Q9M-C9BT-84WG — ts 10-15T17:55–18:06Z) + four xml-403 (3Q9M-C911-X99L,
  3Q9M-C91F-29BP, 3Q9M-C9BR-C9MN, 3Q9M-CSH8-5SDN — ts 10-16T20:39–20:40Z).
  10/10 resolved; no pending remainder.
- **Disk truth for the six downloads**: every jpg re-read from disk —
  bytes match manifest AND sha256 recomputed matches (6/6). Sample:
  3QS7-L99B-J9D5 = 172,291 B.
- **Denial provenance for the four**: sample entry 3Q9M-C911-X99L →
  apid `apid:TH-909-53984-951-62` (byte-identical to the 10-12
  binding-probe-10 receipt row), bindingVerified = "ark-bound negative:
  guard fetched both the das/v2 binding and matching live image.xml
  denial", denial = { url …deepzoomcloud/dz/v1/…/image.xml, status 403,
  verifiedAt 2026-10-16T20:39:41.780Z }. All four carry the same shape.
- **Queue terminal**: `nextPending(5)` = [] through the guard's own loader
  run from THIS verification's worktree (wt-zcode-fs8gen-o27v) — my own
  process, not the sibling's claim. Queue = 376 rows / 375 unique arks
  (the documented legacy twin).
- **Writer lock**: present but DEAD — holder `imgqueue-order26-denials/zcode`,
  heartbeat 2026-10-16T20:40:25Z, read at 21:04:38Z = ~24 min stale (>10-min
  law). Takeover chain honest (previousWriter `imgqueue-order25/zcode-r5`
  recorded with its 10-15T18:06:35Z heartbeat). Zero live writers at
  verification time; zero writes made by this pass.
- **The await-fix**: diff vs `sweep-walker.mjs.pre-await-fix-2026-10-16`
  = exactly two lines (68 + 76, `guard.checkpointState`/`checkpointDownload`
  now awaited). Applied 09:13 local — BEFORE the 20:39Z banking run, exactly
  as the correction rider 3f488165b states (the banking loaded the FIXED
  walker).
- **Public summary**: `assets/profile-archive/lineage/sources/images-summary.json`
  at tip (generated 2026-10-16T20:42:41Z) — **reconciled 314/314 ALL MATCH
  against the private tier on ark + apid + sha256 + bytes** (normalizing the
  summary's `3:1:` ark prefix); harvested.attempted 382 and bytes total
  84,055,524 match; pending: []; openFrontier names only the ~7,037 1:1-ark
  rendered-DOM frontier. The public layer carries counts + hashes + pointers
  only — no image bytes.

## 2. Pillars at today's tip d864c1e2c (all fresh, post-fetch)

- **Ancestry**: 13/13 exit-0 (140d5e802, 849a4ed91, 0270f568a, 735fbde7a,
  8f9633c30, 25258d564, e55462a11, 8b2cfe606, de36ef416, 957b9e572,
  dbe231eac, 3f488165b, d864c1e2c).
- **Sources manifest**: scope string verbatim; byDepth 4/8/16/32/60/112/203/374
  = 809 persons depths 2–9; 23,673 / 13,589 / 13,249 / 0 — the frozen
  universe unchanged.
- **Transcription ledger**: 34 records at tip. The only corpus-path commits
  since order-26 are the sibling's receipted dispatch regens (de36ef416,
  dbe231eac).
- **Dispatch existence** (ls-tree, post-fetch): newest fs dispatch =
  the order-27 reconciliation chain; nothing newer at verification close.

## 3. The four-state oracle — independently probed this pass

| state | verdict | independent receipt |
|---|---|---|
| AUTHENTICATED | **TRUE** | header carries "Account: travis remington" on the live tab |
| API_READABLE | **TRUE** | v8 `person/KWJ4-XBD/details` = 200 / 120,644 B / "Albert Perry Rockwood" / sourceCount 108 / living false |
| PAGE_RENDERABLE | **FALSE** | the control ark `33S7-9GY8-1XT` renders "Page Not Found" WHILE authenticated — third authed occurrence, now reproduced by TWO independent seats (order-26 10-15, order-27 rider 10-16, this pass 10-16) |
| PROVIDER_WRITABLE | **FALSE for KWJ4-XBD; class UNTESTED-BY-POLICY** | `readOnly: true` — 6th confirmation (10-10, 10-12, 10-13, 10-15, 10-16 sibling, this pass); class-level writability gets no probe this wake (zero-mutation law; no founder-authorized write) |

The founder's architectural point is demonstrated by the table: a single
binary "session good" would have claimed all-well while the page is
unrenderable and the one parked write-target is provider-locked. Wire
(byte-count) note preserved honestly: this pass read 120,644 B (matches the
sibling's 10-16 read); order-26's was 120,649 B — the known day-scale
byte-shape variance of the same wire, both counts recorded.

The tab from order-26 SURVIVED in this same process (no pane-mortality
advance — continuity, not a fresh pane), parked on the control ark; it
remains the handoff anchor, session named "FamilySearch — image queue —
KEEP".

## 4. Tasks-queue recheck — not re-attempted, deliberately

The sibling's same-day rider already recorded tasks UNREADABLE (3 SPA
wedges + 1 guest death) with the operational law "the signed-in session
outranks the check on wedge-heavy days". The wedge class is live on this
profile TODAY; a re-attempt risks the parked pane for zero new evidence
(empty streak already stands on 10-11 / 10-15 / 10-16-morning reads).
Skipped for cause, not overlooked.

## 5. Boundary states

- **Zero FamilySearch mutations** this pass (reads only: one snapshot, one
  v8 fetch). Zero private-tier writes (the dead lock was only read).
- **Zero concurrent writers**: lock dead-stale, queue terminal, no sweep
  running.
- **ANT gate CLOSED**: gh live-read — #346 OPEN (updated 2026-10-04), #347
  OPEN (updated 2026-10-05), both codex-owned. No spend, no upload.
- **Evidence-backed deltas**: none executable this pass — every remaining
  genealogy open (QG8Q-V3C5/V3CN/P964 title-vs-wire class, Christen Olsen
  cluster merge, Daniel Briggs duplicate, Norway parish, Don Ray pass) is
  founder-ruled, and a verification pass does not lift founder gates.

## Writes this pass

This dispatch only (docs-only; worktree wt-zcode-fs8gen-o27v, branch
zcode/fs8gen-order27v-2026-10-16 — the sibling's wt-zcode-fs8gen-o27
worktree was observed, never entered; an existing local branch named
…order27-verification… at tip with no worktree was left untouched as a
possible other seat's claim).

Next owner: the daily wake cadence; opens unchanged (founder rulings, the
~7,037-ark rendered-DOM frontier, KWJ4-XBD lock recheck, codex #346/#347).
Proposed standing: the four-state table above rides every wake's oracle
section from now on.
