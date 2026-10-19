# 2026-10-15 — fs 8-gen order #26: reconciliation (26th verbatim issuance)

Order received verbatim (6th-issued standing text): "scrape every bit of
familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations. we will stage it here and github and later ANT."

Standing law (founder-ratified freeze 2026-09-28, re-exercised every wake
since): a verbatim re-order of an already-executed order = **verify every
pillar fresh ON THE DAY + execute only the real delta + dispatch. NEVER
re-scrape the frozen, merged harvest; never re-sweep the terminal image
queue.** The 8-gen harvest is frozen+merged (PR #244 @140d5e802); "here +
github" is satisfied by that merge and the standing public tier; "later ANT"
rides codex's privacy gate. This wake re-verified every pillar fresh at tip
4c689a953, found the session **AUTHED (wire-proven)**, and **stood down from
vein 1 on a live sibling collision** — the image-queue extension is being
executed right now by another seat under the exclusive writer lock.

## Reconciliation receipts (all read post-fetch, at tip 4c689a953)

- **Dispatch existence** via `git ls-tree origin/main docs/dispatches/`
  (the 10-06 rider law — never a working-tree listing): newest fs dispatch =
  `2026-10-14-fs-8gen-order25-reconciliation.md` (25258d564). No sibling fs
  dispatch since; re-confirmed by a second fetch at wake close. Zero commits
  touched `assets/profile-archive/lineage` or `tools/genealogy` in
  `25258d564..origin/main`.
- **Pillar ancestry** (`git merge-base --is-ancestor`, exit 0 each):
  harvest 140d5e802 ✓, hint-census 849a4ed91 ✓, transcription addendum-2
  0270f568a ✓, authed-wake reconcile 735fbde7a ✓, order-24 dispatch
  8f9633c30 ✓, order-25 dispatch 25258d564 ✓ — all ancestors of origin/main.
- **Sources manifest at tip** (`assets/profile-archive/lineage/sources/manifest.json`):
  scope string verbatim ("material evidence (source references + record
  citations) for 8 deceased blood generations, grandparents on"); cohort
  byDepth 2:4 / 3:8 / 4:16 / 5:32 / 6:60 / 7:112 / 8:203 / 9:374 = **809
  deceased blood-relative persons, depths 2–9**; **sourceRefsTotal 23,673 /
  sourcesAttached 13,589 / uniqueRecords 13,249 / recordsMissingDetail 0** —
  the frozen universe unchanged.
- **Corpus-scope transcription**: the 9-artifact sources set present at tip
  (incl. `sources-sync-2026-10-13.json`); `tools/genealogy/sources-sync-ledger.json`
  at tip = **34 records** — unchanged.
- **Images manifest-true** (private tier re-read directly,
  `C:/Users/travi/family-lineage/images-harvest/images-manifest.json`):
  states **308 downloaded / 83,315,926 B + 58 xml-403 + 6 xml-403-all**
  (= 372 all-state, byte-identical to the order-22/23/24/25 record; newest
  image ts still 2026-10-03T05:20:30Z); `.writer-lock.json` **absent at
  wake start**; auditLog tail = queue-rekey-identifier-form-fix
  2026-10-03T05:20:16Z, quiet since. **Queue terminal at wake start
  through the guard's own loader**: `nextPending(5)` = `[]` run from this
  wake's worktree (wt-zcode-fs8gen-o26) — read BEFORE the sibling's
  extension landed (see collision note below; the two reads are reconciled
  by the queue file's mtime, not by re-running after the sibling claimed
  the lane). The 10-ark queue-extension receipt `binding-probe-10.json`
  stands in the private tier (`sources-sync-2026-10-12/`): 10 results,
  das/v2 3:1 binding read-only, all status 200 with apids.
- **ANT**: gh live-read 2026-10-15 — **#346 OPEN** (updated 2026-10-04,
  "keep living relatives out of the tree UI"), **#347 OPEN** (updated
  2026-10-05, "repair post-342 spatial privacy and grandparent self path"),
  both codex-owned privacy siblings — unchanged from order-25. No spend, no
  wallet, no upload from this seat; ceilings + stop-conditions regime
  unchanged.

## Session oracle: AUTHED, wire-proven (14th pane-mortality; NEW control-ark 404 anomaly)

Both tab lists (controlled + user) empty at wake — the pane died with the
prior ZCode process (14th confirmation). Fresh tab on the canonical control
ark `33S7-9GY8-1XT` did **NOT** render the sign-in wall of the prior four
wakes: the header carries **"Account: travis remington"** (plus "New
notifications available") — the founder has signed in since the 13th. But
the control-ark page itself rendered **"Page Not Found"** ("Well, this is
unexpected…"), stable across first load AND a full `tab.reload()` — a
render path never seen in this lane (prior wakes: sign-in form inline/ident
bounce). A third navigation at wake close (re-parking the tab on the same
URL) titled "FamilySearch.org" — the render is not deterministic. Recorded
as-is; UNDIAGNOSED, named below for the next wake.

Because the viewer did not render, the oracle was proven on the standing
wire criterion (SESSION-ORACLE LAW, 10-10/10-13 shape): from page context,
`GET /service/tree/tree-data/v8/person/KWJ4-XBD/details` = **200,
120,649 bytes, "Albert Perry Rockwood", sourceCount 108, readOnly: true**
— byte-shape identical to the 10-10 and 10-13 receipts. **Verdict:
authenticated.** No login pane staged (none needed); browser session named
**"FamilySearch — image queue — KEEP"**, tab parked on the control ark and
marked handoff.

**KWJ4-XBD readOnly STANDS — 4th confirmation** (10-10, 10-12, 10-13,
today): Albert Perry Rockwood, 9 June 1805 – 26 November 1879, provider
lock unchanged; his 5 hints + NUMIDENT refusal candidate stay parked behind
the founder call.

## Vein 1 (10-ark image queue extension): live sibling collision — STOOD DOWN

Mid-wake, the private tier changed under the standing terminal receipts:
`sweep-queue.json` mtime **2026-10-15 11:19:52 −0600** (this wake's
`nextPending(5)=[]` read predates it), queue 366 → **376** with the ten
binding-probe-10 arks appended (emphasis "binding-probe-10-extension
2026-10-14", backup `sweep-queue.json.pre-ext10-2026-10-14` = the 10-02
file byte-preserved), re-sorted at 11:23:59 to census order. The exclusive
writer lock is **HELD: `imgqueue-order25/zcode`**, claim 36782672-…,
heartbeat 2026-10-15T17:20:16Z (fresh, under the 10-min staleness). All
ten arks still `pending` in the manifest at this wake's 11:25 read — the
sibling's sweep is mid-flight. Per the exclusive-writer law (09-30c) and
the sibling-process identity law this wake made **ZERO writes to the
private tier** — no lock claim, no queue touch, no manifest write. The
sibling's lane owns the extension, the sweep, and the public
images-summary regen; their dispatch is the receipt of record for it.

## Tasks-queue fresh recheck (named standing vein)

`/en/home/tasks/` = Hints with an **empty list** (settled ~20 s after one
navigation timeout + settle; heading + "Select a hint icon to see what we
found." + empty list — same shape as 10-11 and 10-13). Zero open hints
account-wide.

## Writes this wake

This dispatch (docs-only). **Zero FamilySearch mutations** (every action
was a read: two control-ark renders + reload, one v8 details fetch ×3
extracts, one tasks-page navigation). No corpus file touched; no suite run
claimed (dispatch-only write, no code change — same shape as the order-24/
order-25 wakes).

## Open items + next owner

1. **Control-ark 404 anomaly** (new): the canonical control record's viewer
   page 404s while authed (2 stable renders), then re-titled on a third
   navigation — first instance in 26 wakes. Next wake: re-render once; if
   it persists, the wire oracle (v8 details 200) remains the auth criterion
   and the 404 gets named to the founder (record access on the site side,
   cause unviewable from here).
2. **Image-queue extension**: owned by `imgqueue-order25/zcode` (live at
   this wake's close). Next owner after theirs lands: verify the ten-ark
   states + regen'd public images-summary fresh, then the KWJ4-XBD lock
   recheck (5th) and the standing founder rulings (QG8Q-V3C5/V3CN/P964
   title-vs-wire class, Christen Olsen cluster merge, Daniel Briggs
   duplicate, Norway parish, Don Ray records pass).
3. **ANT staging** waits on codex #346/#347 (privacy), then: edition
   rebuild → fresh quote → execution under standing-granted approval with
   stop conditions armed (CLI-direct, no local servers).
4. The ~7,000-ark 1:1 image remainder (13,249 records → 7,037 distinct 1:1
   arks the das binding FORM-REJECTS) needs rendered-DOM or a new wire —
   named frontier, not attempted.

Wake seat: wt-zcode-fs8gen-o26, branch zcode/fs8gen-order26-2026-10-15.
