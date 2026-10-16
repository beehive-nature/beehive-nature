# 2026-10-12 — order #23 reconciliation: pillars all standing; the transcription pass tooled; the session gate closed

Order (founder, verbatim, twenty-third issuance): "scrape every bit of
familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations. we will stage it here and github and later ANT."

Standing law (ratified waves 27–31, founder-ratified freeze 2026-09-28):
a verbatim re-issue of an already-executed order = verify every pillar fresh
ON THE DAY + execute only the real delta + dispatch. NEVER re-scrape the
frozen, merged harvest; never re-sweep the terminal image queue.

## Pillars verified fresh 2026-10-12 (post-fetch tip af9df15e1)

1. **Harvest (source records) — frozen + merged, standing.**
   Ancestor-verified at tip: source-harvest merge `140d5e802` and hint-census
   `849a4ed91` both `merge-base --is-ancestor` of origin/main (exit 0).
   Sources manifest read AT the tip via `git show origin/main:…`: scope
   string matches the order verbatim; cohort **809** deceased persons
   (byDepth 2–9: 4/8/16/32/60/112/203/374); **23,673** sourceRefsTotal /
   **13,589** sourcesAttached / **13,249** uniqueRecords /
   **0** recordsMissingDetail. No seventh harvest (founder freeze 2026-09-28).
2. **Record images — terminal, byte-identical.** Read via the guard's own
   loaders (`loadState()`/`nextPending()` in `tools/genealogy/walker-guard.mjs`):
   all-state **372 images = 308 downloaded / 83,315,926 B + 64 denials
   (58 xml-403 + 6 xml-403-all)**; `nextPending()` = 0; **no writer lock**;
   auditLog tail = the 2026-10-03T05:20:16Z identifier-form rekey, nothing
   since. Identical to the order-22 record.
3. **Staging here + github — done, standing.** Public tier (citations,
   hashes, ark pointers, derived structure; living-name redaction; image
   bytes never bundled) lives on main; raw/private tiers stay outside Git
   per the privacy law.
4. **ANT — owned by the codex seat, unchanged.** Privacy siblings **#346 /
   #347 both OPEN** (mergeable UNKNOWN at read time, `gh pr view` 2026-10-12).
   No spend, no wallet, no upload from this seat.

Newest fs dispatch at tip = order22 (2026-10-11) — this wake is the 23rd
issuance; no sibling fs dispatch since (`git ls-tree origin/main`, never a
working-tree listing).

## Session oracle: SIGNED OUT (11th pane-mortality confirmation)

Both tab lists (controlled + user) empty at wake — the pane died with the
ZCode process, the standing pattern. Fresh tab → control ark
`33S7-9GY8-1XT` → **ident.familysearch.org login form** (the URL itself,
locale-corrected check). The 10-10 sign-in did not survive to this wake.
Login pane STAGED per the standing pattern: the tab sits ON the ident login
form with the bounce-back `state` param pointing at the control viewer;
browser session named **"FamilySearch — image queue — KEEP"**. Two sign-in
polls during the wake (~5 min apart): both negative.

## The real delta: the order-22 named labor is now TOOLED (execution rides the next authed wake)

Order #22 named the next corpus labor: *"the links/sources transcription
pass for the 10-10 attaches (rides next sources pass, no tooling yet)"*.
This wake built the missing instrument (the hint-census precedent: answer a
gated order with the tool the next authed wake executes):

- **`tools/genealogy/sources-sync.mjs`** — folds a completed
  `PAGE_SOURCE_WALKER` dump (the proven cookie-session wires: v8 details +
  tf entityref + batched `links/sources?readExternalData=true`) over ONLY
  the touched persons into a NEW public artifact
  (`skaists.sources-sync/1`) without mutating the frozen manifest.
  - `payload` subcommand emits the walker payload: walked set as cohort
    entries, extramural at **dep 9** so the walker's own depth gate
    suppresses parent-repair; `known` = all 809 frozen fsids. Dry-run on the
    real index: 11 walked pids, tiers confirmed from real data —
    **LJDG-CYG/LN5V-3N2 (dep 5) and GWXR-H2K/GWXR-3TD (dep 8) are frozen
    COHORT members** (the 10-10 Benadum/Eder/Somerset attaches are genuine
    sync debt on the public layer); the Olsen-cluster pids
    (LZDH-WYF/MHRT-169/MLCS-*) are extramural.
  - `build` subcommand: cohort sync-debt = fresh entityref ids minus the
    frozen index ids (ledger-matched or honestly "unattributed"); extramural
    = ONLY ledger-proven attaches transcribed (no frozen baseline exists;
    standing sources counted, never mixed in). Public projection reuses
    fs-adapter's `publicSourceRecord` verbatim (notes dropped, living-name
    redaction). **Fail-closed**: the build REFUSES to run without the
    private-tier living-name redact list — an absent list must not mean "no
    names".
- **`tools/genealogy/sources-sync-ledger.json`** — the dispatch-derived
  ledger: 17 post-freeze records (10-06d marriage/confirmation, 10-07
  census-wake church records, all 11 of the 10-10 labor), every entry traced
  to its committed dispatch with the person rows the dispatch names.
- **`tools/genealogy/sources-sync.test.mjs`** — synthetic fixtures only
  (fixture-refinement law): 11/11, covering repair suppression, cohort
  debt + provenance, unattributed deltas named, ark matching across
  id/about/urls forms, the extramural allowlist, redacted stubs with the
  fsid withheld **even as the map key** (hint-census privacy law), living
  flags overriding the allowlist, redaction flow-through, and the
  fail-closed guard.
- Full genealogy suite in the worktree: **33 test files, 0 fail**.

Honest boundary: the tool is UNTESTED AGAINST THE LIVE WIRE (this wake had
no session) — the next authed wake runs it on live evidence and fixes on
live proof, exactly like the hint-census instrument before it. Ane Sophie
LZDH-WB1 (10-03/10-07 attaches) is the named follow-on pid, not in this
run's walked set.

## One founder gesture unblocks (unchanged in shape since orders #9–#22)

Sign in inside the staged pane (the in-app browser tab showing the
FamilySearch sign-in form). After sign-in the tab bounces to the control
viewer — any next wake oracles that and resumes UNDER STANDING ORDERS, no
ceremony, no re-audit:

- run the transcription pass: `sources-sync.mjs payload` → install
  `PAGE_SOURCE_WALKER` → poll dump → private-tier raw dump →
  `sources-sync.mjs build` (with the private redact list) → commit the
  public artifact;
- recheck the KWJ4-XBD provider lock (5 items + the NUMIDENT
  verify-then-refuse candidate parked behind it);
- L1N9-S2L ×22 stays parked behind the founder's Christen-Olsen
  cluster-merge call; QL85-3YKX stands terminal (unindexed browse-only).

Founder calls unchanged: Christen Olsen cluster merge + birth-year ruling;
Daniel Briggs duplicate (LL4G-3FL vs PNC5-R9G); Norway parish (PNCX-S8Q);
Don Ray records-search pass; the KWJ4-XBD read-only lock.

## Receipts

- Pillar counts: script-reconciled (manifest via `git show origin/main:`,
  images via the guard's own `loadState()`/`nextPending()`), never prose
  arithmetic.
- PR states via `gh pr view 346/347` 2026-10-12; dispatch existence via
  `git ls-tree origin/main docs/dispatches/` post-fetch.
- Oracle + polls: in-session browser reads (URL/title evidence); pane
  preserved open on the login form, session "FamilySearch — image queue —
  KEEP".
- Writes this wake: the three tooling files + this dispatch (worktree
  wt-zcode-fswake12, branch zcode/fsgen-order23-2026-10-12), the staged
  pane, and a temp-dir probe script. No FamilySearch mutations, no
  manifest/queue writes, no wallet, no ANT.

NEXT OWNER: the next authed wake (founder sign-in in the pane) — run the
transcription pass first (the tooling is staged and tested offline), then
the standing veins above; the codex seat owns the ANT gate (#346/#347).

---

## ADDENDUM (same wake, founder signed in — the transcription pass EXECUTED)

The founder signed into the staged pane mid-wake; oracle re-proven
wire-side (v8 KWJ4-XBD details = 200, 120,644 B — the known byte-shape).
The pass ran under standing orders, no ceremony:

- **Walk**: PAGE_SOURCE_WALKER over the 11-pid payload (extramural at dep
  9, `known` = 809) — **27 fetches / 27 ok / 0 errors / 13.7s**, 75 source
  ids in 5 links/sources batches, authStreak 0. GOTCHA BANKED: the walker's
  localStorage checkpoint (`__zb_source_walk_v1`) survives runs in the
  browser profile — the first install came up `resumed: true` with stale
  09-18 refs for 5 pids (would poison the diff); cleared + reloaded +
  reinstalled fresh (`resumed: false`). Any sync-scale run clears it first.
- **Private tier**: raw dump
  `C:/Users/travi/family-lineage/sources-sync-2026-10-12/raw-dump.json`
  (171,442 B, 16 persons / 11 refs / 75 records) + the redact list derived
  by the ORIGINAL staging rule verbatim (walk living flags MINUS the 4
  founder-attested deceased overrides) = **5 names, 0 hits** — the same
  numbers as the standing 09-26 battery.
- **Live-wire tool fixes (the honest boundary from the morning, now cured
  on live proof)**: (1) the dump's src values are RAW links/sources
  payloads — the build now parses through `parseSourceDescriptions` before
  projection (the original pipeline law; raw records lack urls/evidence
  fields entirely); (2) **the ark rides inside the citation prose**
  ("…/ark:/61903/1:1:MCL8-D19 : …") — record bodies carry NO about/urls on
  this wire; the matcher scans citation + uri + about + urls. Tests 12/12;
  full genealogy suite 33 files 0 fail.
- **Artifact**: `assets/profile-archive/lineage/sources/`
  `sources-sync-2026-10-12.json` (skaists.sources-sync/1) — 11 persons
  (4 cohort + 7 extramural), **37 ledger rows transcribed attached, 0 null
  citations, redactedLiving 0**. Cohort sync debt vs the frozen index:
  LJDG-CYG +1, LN5V-3N2 +1, GWXR-H2K +1, **GWXR-3TD +2**. Extramural
  standing sources counted, never transcribed without provenance. The
  FROZEN manifest is untouched — the sync rides as a new layer.
- **DISCREPANCY recorded, not resolved** (corrective-receipt discipline):
  the 10-10 dispatch describes QG8Q-V3C5 as "Maren's OWN birth/christening,
  b. 22 Jul 1811 Sønderup" — the live citation reads *"Maren Nielsdr in
  entry for Ane Sophie Christensen, 1841"* (child-event class, the same
  citation shape as QG8Q-N45H/15JW/78S6; possibly the same-event re-index
  twin of QG8Q-P964 across the Baptisms/Church-Records collections). The
  "new birth source for Maren's birth-side conclusions" claim is
  contradicted on the wire; the artifact carries the wire's citation and
  the founder rules. Maren's true 1811 birth record, if attached, is not
  among the ledger arks checked this pass.
- **GWXR-3TD's second delta** (WFPS-YWL, "England, Somerset, Church
  Records" for Ann) is unattributed to any lane dispatch — founder manual
  work or a re-index twin of 6D9D-2ZCT; named, not resolved.
- **KWJ4-XBD lock recheck (standing vein, read-only)**: summary wire =
  `readOnly: true` STANDS (Albert Perry Rockwood, sourceCount 108). The 5
  parked items + the NUMIDENT verify-then-refuse candidate stay behind the
  founder call.
- **Zero FamilySearch mutations this wake** — the walk and the lock check
  are reads. Repo writes: the artifact, the tool fixes + tests, and this
  addendum.

NEXT OWNER (updated): the founder's QG8Q-V3C5 ruling; optionally fold Ane
Sophie LZDH-WB1 (10-03/10-07 attaches) into a follow-on sync run — the tool
takes any walked set; then the standing veins (L1N9-S2L parked, KWJ4-XBD
lock, tasks/tasks-queue recheck on a future authed wake); codex owns ANT.

---

## ADDENDUM 2 (same wake, founder ratified "all looks good; I want all the data" — the FULL post-freeze universe executed)

- **Full walk**: 37 persons (every person the lane attached records to after
  the freeze, per all dispatches 10-03 → 10-10) — 102 fetches / 102 ok /
  0 errors / 94.3s / 414 source records. Private tier:
  `sources-sync-2026-10-12/raw-dump-full.json` (1,036,514 B) + the probe
  receipts below. Rollin Eugene Lawton **KWCL-VJS** (1894–1974, read from
  Donna KWCL-VNB's own parents this wake) joined as a **fifth cohort-tier
  person** — his WWI-draft attach is frozen-layer sync debt.
- **Artifact v2**: `sources-sync-2026-10-13.json` (the 10-12 artifact stands
  as v1 — versioned, never erased) — **64 attached rows transcribed, 0
  not-found, 0 null citations, redactedLiving 0 hits; 6 privacy stubs by
  design** (Jim Briggs living-flagged creation; David Briggs, Theodora
  Lawton, Muriel Whitney, Maree + Claire Schneider — marginal/living
  households ride the private tier, the Don/Marilyn obit precedent).
  Cohort debt total 6: LJDG-CYG/LN5V-3N2/GWXR-H2K/KWCL-VJS +1 each,
  GWXR-3TD +2.
- **Ledger corrected against the wire** (the stray-ark law class, caught in
  my own ledger): the 10-03 baptism arks were memory-mistranscribed — the
  wire says **H29J-NL3Z** (Johanne Marie, 1835) and **H2S7-W1MM** (Mette
  Kirstine, **1843** — her birth year per the record, correcting the
  allowlist's 1840). QG8Q-V3CN verified genuine and retitled (Church
  Records, not Baptisms). Citations are the authority, memory never.
- **The stub guard caught my own allowlist typo** (`L1N9-S2L` vs the real
  `L1N9-SL2` — transposed): the census-cluster Christen rendered as a
  redacted stub until the key was fixed; the privacy law protected the
  corpus from its author. He is now properly named + transcribed
  (QG8Q-GRKK), attach work still parked behind the founder merge call.
- **QG8Q-V3C5 ruling evidence deepened**: QG8Q-V3CN (the 10-03 Ane Sophie
  attach) reads *"Christen Olsen in entry for Ane Sophie Christensen, 1841"*
  — the SAME event class as V3C5's *"Maren Nielsdr in entry for Ane Sophie
  Christensen, 1841"*: adjacent arks, mother-view + father-view of one 1841
  christening. The 10-10 "Maren's own birth 1811" description is now doubly
  contradicted on the wire.
- **Image frontier measured precisely** (from the public records layer,
  zero requests): 13,249 records carry **7,037 distinct 1:1 record arks**
  (4-4/4-3 forms — the das binding FORM-REJECTS these, live-proven with
  "Invalid ARK") and only **59 distinct 3:1 long-form image arks** inside
  citations — 49 already resolved in the manifest, **10 never probed →
  probed read-only this wake: ALL TEN = 200 with real apids** (TH-909/TH-19x
  films; receipt private tier `binding-probe-10.json`). Those 10 are
  queue-extension candidates — downloads require the writer lock + queue
  membership per the guard law; named, not executed. The remaining frontier
  (~7,000 record arks → unknown images) needs the rendered-DOM walk or a
  new wire; the binding speaks only long-form image arks.
- **Zero FamilySearch mutations** — walks, binding probes, and the lock
  recheck are reads.

NEXT OWNER (final): founder rulings parked with him (QG8Q-V3C5 class
description; Christen Olsen cluster merge; Daniel Briggs duplicate; the
KWJ4-XBD lock); a queue-extension decision for the 10 newly-bound arks; the
image frontier stays a measured, named vein; codex owns ANT (#346/#347).
The corpus-scope data ("all the data" for every record the lane attached)
is now transcribed and public.
