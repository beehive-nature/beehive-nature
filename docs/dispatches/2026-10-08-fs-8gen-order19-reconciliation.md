# 2026-10-08 — fs-8gen order #19: reconciliation, all pillars fresh, session SIGNED OUT, pane staged

## The order (19th verbatim issuance)

> "I need you to scrape every bit of familysearch.com material evidence for at
> least 8 dead (grandparents on) blood relative generations.  we will stage it
> here and github and later ANT."

Provenance: the daily 09:00 `family search` automation (a7a2be3b) fired this
morning ~09:08 MDT; this wake is that run (task text = the automation prompt
verbatim). Per [[order-reconciliation-before-labor]] and the 09-26/09-28
founder freeze, a verbatim re-issue is answered with verification + the
missing delta — the 8-gen source harvest itself is CLOSED AND FROZEN
(founder ruling 2026-09-28: no seventh scrape), and every reconcile-fresh
check passed this morning. The live frontier remains the 10-07 hint-census's
open hints, gated on a founder signed-in FamilySearch session.

## Reconciliation (all reads post-fetch from origin/main, tip 5aad23e2c)

- **Harvest standing:** merge 140d5e802 is an ancestor of origin/main
  (`git merge-base --is-ancestor` exit 0). Sources manifest at tip carries
  the order's scope string VERBATIM: "material evidence (source references +
  record citations) for 8 deceased blood generations, grandparents on" —
  809 cohort persons, byDepth 4/8/16/32/60/112/203/374, 23,673 source refs,
  13,589 attached, 13,249 unique records, 0 missing, 0 refused.
- **Hint-census standing:** PR #356 merge 849a4ed91 is an ancestor of
  origin/main; the public census artifact
  (`assets/profile-archive/lineage/sources/hint-census-2026-10-07.json`) is
  at tip: 823 pids swept, 85 open hints on 14 persons (23 cohort + 62
  extramural), 3 redacted living stubs.
- **Images standing (manifest-true, private tier):** `loadState()` +
  `nextPending()` — 372 all-state entries = 308 downloaded / 6 xml-403-all /
  58 xml-403; 365 member arks; **nextPending() = 0**; writer lock absent;
  auditLog tail = the 10-03 queue-rekey (quiet five days). Public
  images-summary at tip unchanged (generated 2026-10-03, openFrontier 100%).
- **No sibling movement:** `git ls-tree origin/main docs/dispatches/` shows
  no fs-8gen dispatch since 2026-10-07; today's dispatches are btungsten and
  zkr (other lanes). No open genealogy PR.

## Session gate: SIGNED OUT (8th consecutive pane-mortality confirmation)

Both controlled and user tab lists were empty at wake (the FS pane dies with
each process restart — now pattern, not incident). Fresh tab + the session
oracle on the known-good control ark 33S7-9GY8-1XT: the viewer redirected to
`ident.familysearch.org/en/identity/login/?state=…` (bounce-back state
carries the control viewer) = SIGNED OUT.

Login pane STAGED: one tab parked on the ident login form with the
bounce-back state to the control viewer, browser session named
"FamilySearch — image queue — KEEP". Poll: 9 rounds × 30s over ~9 minutes —
negative; the founder has not signed in during this run.

## One gesture unlocks (standing veins, from the 10-07 census NEXT OWNER)

Sign in inside the staged pane → the oracle bounces ident → viewer, and the
standing authorization resumes with NO ceremony, NO re-audit, NO repeated
try-now:

- **Cohort attaches:** KWJ4-XBD (AP Rockwood) ×7 — incl. the NUMIDENT
  6K4D-3KG4 verify-then-refuse candidate (SS-era record for an 1805 birth =
  same-name-different-person class); LKR3-6XT (Giles Lawton) ×8 RI records;
  singles: LJDG-CYG MCL8-D19 (1860 census), LN5V-3N2 MZ5M-5M6 (1870 census),
  MS86-N1C V5J1-Y9T, GWXR-H2K 6D9D-2ZCT + GWXR-3TD 6D9D-2ZCY (Somerset
  parent-pair), MVXD-XT8 FHXV-P42, G9LD-217 6859-16MF.
- **Standing refusal honored:** L6LW-1G2 × F6VY-27T (Benedict) — NOT OUR
  FAMILY per the 10-03b verdict; never re-attempt without new evidence.
- **Extramural (Olsen family):** Maren LZDH-WYF child events (Dorthe
  Cathrine / Oline / Karen / Johanne Marie), MLCS-MN5 ×4, MHRT-169
  overlapping parent-view rows, QG87-M751 identity-suspect verify. L1N9-S2L
  ×22 stay PARKED behind the founder cluster-merge call.
- **Links-wire full-record staging** for census arks (census household
  breadth into the archive tier).
- **Founder calls unchanged:** Christen Olsen cluster merge + birth-year
  ruling, Daniel Briggs duplicate (LL4G-3FL vs PNC5-R9G), Norway parish for
  PNCX-S8Q, Don Ray records-search pass.

## ANT

Deferred, unchanged ("later ANT" rides the order itself). Frozen edition +
separated ceilings; gate blocker remains payment-client ceiling-atomicity;
no spend, no wallet touched.

## Writes this wake

The staged browser pane and this dispatch. Nothing else: no queue or
manifest writes, no corpus changes, no FamilySearch mutations.

## Next owner

Any next session: re-run the oracle on the control ark; if AUTHED, resume
the census attach queue above at queue order under the standing
authorization, then land the labor receipt. The 09:00 automation re-fires
tomorrow and reconciles the same way.
