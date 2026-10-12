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
