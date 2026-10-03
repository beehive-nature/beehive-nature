# 2026-10-03 — zBlood order #13: verbatim re-issue reconciled to terminal state + 4 seed records attached (no re-scrape)

The founder's order ("scrape every bit of familysearch.com material
evidence for at least 8 dead (grandparents on) blood relative generations;
stage here + github and later ANT") arrived verbatim for the thirteenth
time. Per the standing law (wave 27, founder-ratified): a verbatim re-order
of an already-executed order = **verify fresh + complete the missing
staging step + name the unlock gestures. NEVER re-scrape.** That is what
this wake did. The 8-gen harvest remains frozen and merged; nothing was
re-scraped, re-walked, or re-downloaded.

## Reconciliation — everything verified fresh this wake

- **Harvest standing:** merge commit 140d5e802 (PR #244, the 809-person /
  23,673-ref / 13,249-record harvest) is an ancestor of origin/main
  (tip 2e8b445402). Order-12 closeout a61f23c061 (PR #326) likewise.
- **Image queue — manifest-true, terminal, unchanged:**
  `sweep-queue.json` = 366 member arks; `images-manifest.json` states
  filtered by memberArks (the counting law): **302 in-queue downloaded +
  63 in-queue explicit denials (57 xml-403 + 6 xml-403-all) = 366/366
  resolved (100%), 0 pending.** All-state totals: 308 downloaded /
  83,315,926 B (including the 6 legacy pre-queue census images and the
  two long-form-ark recoveries). `nextPending()` returns empty. No writer
  lock present (correctly released at order-12 closeout).
- **Public GitHub layer current:** main's
  `assets/profile-archive/lineage/sources/images-summary.json` = 308
  entries, openFrontier text carries ALL 366 resolved / identifier-form
  exception CLOSED. Here + GitHub staging: DONE and current.
- **ANT gate, read fresh from main's ETERNALIZATION-EDITION-V2.json:**
  approval STANDING-GRANTED; price axis cleared by the founder's temporary
  100 ANT cap (quote 2.8255 ANT in bounds); **upload code-disabled solely
  on payment-client atomic ceilings — ant 0.3.9 probed today, still no
  storage/gas ceiling flags.** The artifact changed 2026-10-03, so the
  gate's own rule applies: rebuild + fresh quote precede execution. The
  edition refresh is IN FLIGHT as **PR #336** (codex seat, MERGEABLE,
  touches preserve.mjs + preservation-runtime + edition receipts) — that
  seat owns the gate file now; this seat did not touch it.
- **Lane hygiene:** PR #315 (this lane's standing-orders rider) was CLOSED
  as superseded — every law it carried landed stronger via #326's merged
  gate JSON; its copy was stale (openFrontier 364/366) and conflicting.
  The one semantic it carried that main words differently (progression
  spend-authorized YES-STANDING vs NOT YET) is routed to #336's owner.
  Branch retained for the record.

## Seed labor — 4 records attached under the standing tree-curation order

Session oracle: **AUTHED** ("Account: travis remington" chrome; cookies
profile-wide — pane tabs had died with the process restart, sixth
confirmation of pane mortality; a fresh tab inherited the live session).

The portal assistant digest would NOT render this wake (three tabs +
reloads; the widget stays flaky), so the **Record Hints rail vein was run
through the record-matches wire instead** — proven this wake for the
colonial ancestors (it was empty only for the Danish duplicate-cluster
people on 2026-10-03). Four attaches, every one match-over-create,
verified in the linker compare view before confirming, each with a
documented reason:

| # | Record | Tree person | Notes |
|---|--------|-------------|-------|
| 1 | Find a Grave Index `1:1:QVL3-SY3T` (conf 5) | Charles C Benadum L6LW-1G2 | b.1863 Liberty Twp Fairfield OH matches; burial 1931 Maple Grove Cemetery — **conflict with tree's 1923 burial recorded in the reason, not overwritten** |
| 2 | Ohio Death Index `1:1:VK2B-86S` (conf 4) | Florence M Eder LJD7-VHS | **sources the tree's 0-source death fact** (2 Jan 1959 Worthington, Franklin, OH — exact match) |
| 3 | 1920 US Census `1:1:MDPQ-C65` (conf 4) | Charles C Benadum | Walnut Twp household, wife present |
| 4 | 1920 US Census, Laura row | Florence M Eder | census "Laura" = Florence name form; PA birth place matches with 1-yr variance |

All four receipted by the verified-done signature: success toast
"Record attached" + control flipped to Detach + "Person is Attached".

**Lars baptism stays digest-gated** (search wire exhausted honestly):
the personas wire's date params filter on the PRINCIPAL's birthlike date,
so father-side queries inside child-year windows return nothing; the
indexed mother form is "Maren Nielsdr" (-dr, not -datter); family parish
read from Mette Kirstine's record = **Bakkendrup, Holbæk, Denmark**
(banked for any future search). No Bakkendrup Lars surfaced in-window.

## Open veins (next owners)

1. **Mary Ann Hadlock** hint rail — needs her full pid (digest re-render;
   corpus carries other Hadlocks but no Mary Ann).
2. Benadum conf-3 Ohio County Death `1:1:F6VY-27T` ("Charles Benedict"
   name form; spouse Florence M) — attachable same flow.
3. Lars (digest card) — one personas search + linker away, id L1N9-SL2.
4. Edition v3 rebuild + fresh quote + ceiling-atomic payment client →
   ANT execution under standing-granted approval (PR #336 seat first).

## Gotchas banked

- Linker buttons carry EMPTY textContent with the label in `aria-label` —
  DOM walkers matching text miss them; click by aria-label prefix
  ("Compare and attach…", "Attach <record name>").
- Inline `evaluate` reason-strings break on apostrophes — write reasons
  without them.
- `walker-guard loadState()` takes NO path argument (internal defaults);
  passing a directory returns a silent empty state.
- record-matches wire (`/service/tree/tree-data/record-matches/{pid}/all`)
  returns per-person hints for clean colonial persons — a digest-free
  path for the rail vein.
- Personas index abbreviates Danish patronymics (-datter → -dr);
  household regexes must match both forms.

## Writes this wake

Browser-session labor only (the four attaches + reasons), plus this
dispatch. Zero writes from the shared checkout; dispatch committed from
wt-zcode-zblood on branch zcode/dispatch-8gen-order13. No wallet, no
payment, no upload, no harvest-side state touched.
