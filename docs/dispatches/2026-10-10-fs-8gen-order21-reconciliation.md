# 2026-10-10 — fs-8gen order #21: reconciliation, all pillars fresh at tip 3a008248e, session SIGNED OUT (10th), pane staged

## The order (21st verbatim issuance)

> "I need you to scrape every bit of familysearch.com material evidence for
> at least 8 dead (grandparents on) blood relative generations.  we will
> stage it here and github and later ANT."

Per [[order-reconciliation-before-labor]] and the 09-26/09-28 founder freeze,
a verbatim re-issue is answered with fresh verification + the real delta
only. The 8-gen source harvest is CLOSED AND FROZEN (founder ruling
2026-09-28: no seventh scrape); the live frontier remains the 10-07
hint-census attach queue, gated on a founder signed-in FamilySearch session.
Numbering per the 10-06 correction rider: yesterday's two dispatches were
the 20th issuance (reconciliation) plus its authed continuation; today's is
the 21st.

## Pillars verified fresh 2026-10-10 (all reads post-fetch, origin/main tip 3a008248e)

1. **Harvest (source records) — frozen + merged, standing.**
   `git merge-base --is-ancestor 140d5e802 origin/main` exit 0. Sources
   manifest (`assets/profile-archive/lineage/sources/manifest.json`) read AT
   the tip: scope string matches the order verbatim ("material evidence
   (source references + record citations) for 8 deceased blood generations,
   grandparents on"); cohort **809** (byDepth 2–9: 4/8/16/32/60/112/203/374);
   **23,673** sourceRefsTotal / **13,589** sourcesAttached /
   **13,249** uniqueRecords / **0** recordsMissingDetail. No seventh harvest.
2. **Hint census — standing.** PR #356 merge `849a4ed91` is an ancestor of
   the tip; the public census artifact
   (`hint-census-2026-10-07.json`) is at tip: 823 pids swept, **85 open
   hints** on 14 persons (23 cohort + 62 extramural), 3 redacted living
   stubs, sessionProof wire-200 recorded in-artifact.
3. **Record images — terminal, byte-identical, manifest-true.** Private tier
   read via the code-enforced guard itself (`tools/genealogy/walker-guard.mjs`
   `loadState()` + `nextPending()`, read-only): queue universe 366 entries /
   365 unique member arks; all-state **372 entries = 308 downloaded /
   83,315,926 B / 58 xml-403 + 6 xml-403-all**; in-queue resolved 365;
   **nextPending() = 0**; **writer lock absent**; auditLog tail
   2026-10-03T05:20:16Z (the identifier-form rekey) — quiet seven days.
   Public `images-summary.json` at tip unchanged (generated 2026-10-03,
   openFrontier 100%).
4. **Staging here + github — done.** Public tier (citations, hashes, ark
   pointers, derived structure; living-name redaction; bytes never bundled)
   lives on main; raw/private tiers stay outside Git per the privacy law.
5. **ANT — owned by the codex seat, unchanged.** PR #336 OPEN (mergeable
   UNKNOWN, updated 10-03), privacy siblings #346 (10-04) / #347 (10-05)
   OPEN. No new genealogy PR. No spend, no wallet, no upload from this seat.

**No sibling fs movement:** newest fs dispatch =
`2026-10-09-fs-authed-wake-partial.md`; today's dispatches are bview, pq and
pr-landing lanes.

## The 10-09 authed continuation reconciled INTO today's state

Order #20's poll was negative, but a same-day continuation wake PROVED the
founder signed in (oracle wire-side: person details 200, account chip
"travis remington") and read queue item 1 (Rockwood LDS Record of Members
6KKG-W2PJ): wife KWJY-BSR and child K2MQ-43S rows ALREADY ATTACHED — the
10-07 census open-hint list is PARTIALLY STALE (founder manual work is the
likely cause), and the **staleness law** is banked: every census queue item
is needs-fresh-DETACH-oracle first; attach only rows genuinely open. That
wake ended when the webview guest died mid-labor (order-15 class); its only
write was its dispatch.

## The session gate today: SIGNED OUT — 10th pane-mortality confirmation

Controlled + user tab lists empty at wake (the FS pane dies with each ZCode
process restart — standing pattern since order #12). Fresh tab → session
oracle on the known-good control ark `33S7-9GY8-1XT`:

- landed on `ident.familysearch.org/en/identity/login/?state=https://www.familysearch.org/ark:/61903/3:1:33S7-9GY8-1XT…`
  ("Sign-in to your account") = **SIGNED OUT**. New datum: the 10-09
  authed session did NOT survive the process restart — sign-in freshness is
  per-process, not per-FS-session.

Login pane STAGED per the standing pattern: the tab sits ON the ident login
form with the bounce-back `state` param pointing at the control viewer;
browser session named **"FamilySearch — image queue — KEEP"**. Sign-in poll
with the locale-corrected check (login path includes the `/en/` segment):
**9 rounds × 30 s, all negative** — the founder has not signed in during
this run.

## One founder sign-in unlocks (standing veins, staleness law FIRST)

Sign in inside the staged pane → the tab bounces ident → viewer; any next
authed wake resumes UNDER STANDING ORDERS — no ceremony, no re-audit, no
repeated try-now. Per census order, DETACH-oracle on every item first:

- **Cohort attaches:** KWJ4-XBD (AP Rockwood) ×7 — item 1's spouse/child
  rows already attached (10-09 finding), principal row still unread; incl.
  the NUMIDENT 6K4D-3KG4 verify-then-refuse candidate (SS-era record for an
  1805 birth); LKR3-6XT (Giles Lawton) ×8 RI records; singles: LJDG-CYG
  MCL8-D19 (1860 census), LN5V-3N2 MZ5M-5M6 (1870 census), MS86-N1C
  V5J1-Y9T, GWXR-H2K 6D9D-2ZCT + GWXR-3TD 6D9D-2ZCY (Somerset parent-pair),
  MVXD-XT8 FHXV-P42, G9LD-217 6859-16MF.
- **Standing refusal honored:** L6LW-1G2 × F6VY-27T (Benedict) — NOT OUR
  FAMILY per the 10-03b verdict; never re-attempt without new evidence.
- **Extramural (Olsen family):** Maren LZDH-WYF child events (Dorthe
  Cathrine / Oline / Karen / Johanne Marie), MLCS-MN5 ×4, MHRT-169
  overlapping parent-view rows, QG87-M751 identity-suspect verify. L1N9-S2L
  ×22 stay PARKED behind the founder cluster-merge call.
- **Links-wire full-record staging** for census arks (household breadth into
  the archive tier).
- **Founder calls unchanged:** Christen Olsen cluster merge + birth-year
  ruling, Daniel Briggs duplicate (LL4G-3FL vs PNC5-R9G), Norway parish for
  PNCX-S8Q, Don Ray records-search pass.
- Per the 10-06 rider: PNC6-GJQ / PNCX-S8Q read ZERO hints — not open
  veins; PNCP-RDN and PNC5-R9G hint rechecks ride the tasks-queue fresh-day
  pass.

## Receipts

- Ancestry checks: `git merge-base --is-ancestor` against post-fetch tip
  3a008248e (all exit 0). Manifest + census artifact + images-summary read
  via `git show origin/main:…` at the tip.
- Private tier: `loadState()`/`nextPending()` from `walker-guard.mjs` — the
  guard's own code path, read-only, no lock taken.
- PR states: `gh pr view 336/346/347` + `gh pr list` 2026-10-10.
- Oracle + polls: in-session browser URL/title evidence; the staged tab
  remains open on the login form (tab iab-tab:d79b2677-9612-4775-9e83-ae9fe744c3cc).
- Zero writes this wake beyond this dispatch and the staged pane: no
  manifest/queue/corpus writes, no FamilySearch mutations, no wallet.

NEXT OWNER: any next authed wake (founder sign-in in the staged pane) — the
veins above at queue order under the staleness law; the 09:00 automation
re-fires and reconciles the same way. The codex seat owns the ANT gate
(#336/#346/#347).
