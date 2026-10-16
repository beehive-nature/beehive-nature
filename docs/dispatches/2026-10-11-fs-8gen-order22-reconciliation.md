# 2026-10-11 — fs-8gen order #22: all pillars fresh at tip efbe0c3dd; the session was ALIVE at wake (first in lane history) — three authed veins resolved read-only

## The order (22nd verbatim issuance)

> "I need you to scrape every bit of familysearch.com material evidence for
> at least 8 dead (grandparents on) blood relative generations.  we will
> stage it here and github and later ANT."

Per [[order-reconciliation-before-labor]] and the 09-26/09-28 founder freeze,
a verbatim re-issue is answered with fresh verification + the real delta
only. The 8-gen source harvest is CLOSED AND FROZEN (founder ruling
2026-09-28: no seventh scrape); the image queue is terminal; the live
frontier is the residual attach queue, and today it gated OPEN: the session
oracle ran wire-prove SIGNED IN at wake — the first wake in the lane's
history that did not find the pane dead or signed out.

## Pillars verified fresh 2026-10-11 (all reads post-fetch, origin/main tip efbe0c3dd)

1. **Harvest (source records) — frozen + merged, standing.**
   `git merge-base --is-ancestor 140d5e802 origin/main` exit 0. Sources
   manifest (`assets/profile-archive/lineage/sources/manifest.json`) read AT
   the tip: scope string matches the order (material evidence — source
   references + record citations — 8 deceased blood generations,
   grandparents on); cohort **809** (byDepth 2–9: 4/8/16/32/60/112/203/374);
   **23,673** sourceRefsTotal / **13,589** sourcesAttached /
   **13,249** uniqueRecords / **0** recordsMissingDetail. No seventh
   harvest. Counts script-reconciled via node parse of the `git show`
   stream, never prose arithmetic.
2. **Hint census — standing.** `git merge-base --is-ancestor 849a4ed91
   origin/main` exit 0. Census artifact at tip
   (`hint-census-2026-10-07.json`): 823 pids swept, **85 open hints** on 14
   persons (23 cohort + 62 extramural), 3 redacted living stubs,
   sessionProof wire-200 in-artifact. (The census predates the 10-10
   attaches; the staleness law governs any future use of its open-hint
   list.)
3. **Record images — terminal, byte-identical, manifest-true.** Private
   tier read via the guard's own code path (`walker-guard.mjs`
   `loadState()` + `nextPending()`, read-only, executed from a checkout
   whose guard file was verified `git diff origin/main` clean): all-state
   **372 entries = 308 downloaded / 83,315,926 B + 58 xml-403 + 6
   xml-403-all**; queue universe **366 entries / 365 unique member arks =
   302 in-queue downloaded + 63 denied = 365 resolved, 0 pending**;
   `nextPending() = []`; **writer lock absent**; auditLog tail
   2026-10-03T05:20:16Z (identifier-form rekey) — quiet eight days.
   Public `images-summary.json` at tip unchanged (generated 2026-10-03,
   openFrontier 100%).
4. **Staging here + github — done.** Public tier (citations, hashes, ark
   pointers, derived structure; living-name redaction; bytes never bundled)
   lives on main; raw/private tiers stay outside Git per the privacy law.
5. **ANT — the gate MOVED, all of it today.** **PR #336 MERGED
   2026-10-11T04:53:36Z** (edition refresh: person-page preservation gaps
   closed, 11,041 regenerated pages, 19/19 preservation suite, 0 missing /
   0 stale) — the edition pillar this lane tracked since order #16.
   **PR #401 MERGED** (genealogy consent operation: exact-edition consent
   review + Ed25519 signing over manifest/tar hashes, destination and
   permanence terms, wired to the existing wallet keychain; agent performed
   no wallet action, no real signature). Wallet/ANT-storage support lanes
   #400 / #402 / #403 also merged today. **Remaining gate: privacy
   siblings #346 (10-04) / #347 (10-05) OPEN**, mergeable UNKNOWN. No
   spend, no wallet, no upload from this seat (unchanged).

## The real delta: a live session, three veins resolved — all reads, zero writes to FamilySearch

The session oracle: controlled-tab list empty at wake (pane dies with the
process — 10 prior confirmations). Fresh tab → control ark `33S7-9GY8-1XT`
landed on the VIEWER (no ident redirect) — insufficient alone, since that
record renders publicly; per the SESSION-ORACLE LAW the wire check ran from
page context: `GET /service/tree/tree-data/v8/person/KWJ4-XBD/details` =
**HTTP 200, 120,649 bytes, "Albert Perry Rockwood", sourceCount 108** —
byte-shape identical to the 10-09/10-10 receipts. **SIGNED IN, wire-proven.
New datum against order #21's "sign-in freshness is per-process" reading:
the 10-10 founder sign-in SURVIVED the process restart this time — session
persistence is webview-profile-dependent, not a reliable per-process law.
Keep oracle-ing every wake.**

Under standing orders (no ceremony, staleness law first), the residual
queue resolved as follows:

1. **KWJ4-XBD lock recheck — the lock STANDS.** The same wire read that
   proved the session carries `readOnly: true` on the v8 summary — Albert
   Perry Rockwood's record remains provider-locked. The 5 parked items
   (X33K-L9ZJ-principal, X33K-NW5G, 65MC-2NM1, 6KKG-W2PZ, MCSX-7GZ) + the
   NUMIDENT 6K4D-3KG4 verify-then-refuse candidate stay parked. Founder
   call unchanged; nothing on our side can cure an FS-side admin lock.
2. **QL85-3YKX retry — CLASSIFIED, no action exists.** The 10-10 "empty
   SPA shell" record now hydrates fully (46s settle): it is an Image
   Viewer page whose Image Index panel reads **"No indexes are available
   for this image"** and whose attach control is disabled ("To attach, go
   to the Image Index tab at the bottom" [disabled]). Terminal
   classification: unindexed browse-only image — zero linker rows, zero
   writable action, neither attachable nor refusable. The MHRT-169 list
   item closes as not-attachable; the image itself remains citable by ark.
3. **Tasks-queue fresh-day recheck — ZERO hints.** `/en/home/tasks/`
   renders "Hints" with an empty list (settled 32s, DOM complete at 594
   chars). PNC6-GJQ (Nels Martinsen) and PNCX-S8Q (unnamed mother) still
   read zero hints — the 10-06 rider stands, they are NOT open veins;
   PNCP-RDN (Jim Briggs) and PNC5-R9G (Daniel Briggs) hint rechecks also
   read zero. The account-wide tasks queue is clear on the fresh day.
4. **L1N9-S2L ×22 — honored PARKED** behind the founder's Christen Olsen
   cluster-merge call. Not touched, per standing order.
5. **Census links-wire staging — unchanged, next-owner work.** The
   `links/sources` transcription pass for the 10-10 attaches rides the
   next sources pass by design; no tooling exists to run mid-wake and none
   was half-built here.

## Founder calls outstanding (unchanged, not agent-decidable)

Christen Olsen cluster merge + birth-year ruling; Daniel Briggs duplicate
(LL4G-3FL vs PNC5-R9G); Norway parish for PNCX-S8Q; Don Ray records-search
pass; KWJ4-XBD read-only lock. Benedict L6LW-1G2 × F6VY-27T standing
refusal honored — never re-attempted.

## Receipts

- Ancestry checks: `git merge-base --is-ancestor` against post-fetch tip
  efbe0c3dd (exit 0 both). Manifest, census artifact, images-summary read
  via `git show origin/main:…` at the tip; counts parsed by node script.
- Private tier: `loadState()`/`nextPending()` from `walker-guard.mjs`
  (working-tree copy verified identical to tip before execution) — the
  guard's own code path, read-only, no lock taken.
- PR states: `gh pr view 336/346/347` + `gh pr list` 2026-10-11 (#336
  MERGED 04:53:36Z today; #346/#347 OPEN).
- Session oracle + all record reads: in-session browser URL/title/DOM
  evidence and page-context fetch (status + byte length + name fields
  only). No screenshots (IAB guest capture unsupported — standing note).
- **Zero FamilySearch mutations this wake** — every vein resolved by
  reads; there was nothing writable left to prove. Zero repo writes
  beyond this dispatch. No wallet, no ANT spend.

NEXT OWNER: the next issuance or authed wake — oracle first (this wake
proves live-at-wake is possible); if signed in, the only remaining
authed-labor surface is the KWJ4-XBD lock recheck (parked items read-only
until FS lifts it) and any new founder calls; the links-wire sources pass
is the next corpus labor; the codex seat owns the ANT gate remainder
(#346/#347). The 09:00 automation re-fires and reconciles the same way.
