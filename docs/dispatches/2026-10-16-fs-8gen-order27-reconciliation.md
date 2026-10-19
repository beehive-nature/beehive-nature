# FS 8-gen order27 reconciliation — 2026-10-16

27th verbatim issuance of the standing order ("scrape every bit of
familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations; stage here + github, later ANT"), founder-issued
in the zCode session ~09:00 MDT. Answered per the standing law (earned
2026-09-26, held through orders 13–26): **verify-fresh + complete the
missing steps + name the unlock gestures — NEVER re-scrape.**

## Pillars verified fresh at post-fetch tip `ea4e90bb7`

- **Harvest + descendants of record** (all `merge-base --is-ancestor` exit 0):
  `140d5e802` (8-gen source harvest, PR #244 MERGED — GitHub staging is the
  standing state, not an open step), `849a4ed91` (hint census, PR #356),
  `0270f568a` (post-freeze 37-person sync), `735fbde7a` (authed reconcile),
  `8f9633c30` (order24), `25258d564` (order25), `e55462a11` (order26),
  `8b2cfe606` (order24 rider), `de36ef416` (order25 authed vein — newest fs
  dispatch on origin/main; zero fs dispatches 10-16 existed at claim time,
  checked by `git ls-tree origin/main docs/dispatches/` post-fetch).
- **Sources manifest scope-verbatim** (`git show origin/main:…sources/manifest.json`):
  809 cohortPersons, byDepth 4/8/16/32/60/112/203/374 (depths 2–9),
  sourceRefsTotal 23,673, sourcesAttached 13,589, uniqueRecords 13,249,
  recordsMissingDetail 0, redactedLiving 0, schema `skaists.sources-manifest/1`
  (generated 2026-09-18, frozen scope unchanged).
- **Images private tier manifest-true** (direct read of
  `images-harvest/images-manifest.json`, mtime 2026-10-15 12:06 local):
  **378 states = 314 downloaded / 84,055,524 B / 58 `xml-403` + 6 `xml-403-all`
  denials** — byte-identical to the order-25 receipt. auditLog tail = the
  10-03T05:20Z queue-rekey, quiet since. Public `images-summary.json` at tip
  carries 314 entries and matches.
- **Writer lock**: file present but STALE ~21h — holder
  `imgqueue-order25/zcode-r5`, heartbeat 2026-10-15T18:06:35Z (kernel dead;
  in-process claims die with the kernel per the chunked-driver law). No
  takeover performed (this wake writes no queue/manifest state). **r4/r5
  provenance closed**: last private-tier write (manifest 12:06:35 local) is
  receipted by dispatch `de36ef416` committed 12:08:16 local — every extension-
  era write is covered by a landed receipt; no unreceipted writes exist.

## Ten-ark extension verification (order26's named next-owner item)

Set-diff `sweep-queue.json` (376 rows / 375 unique) vs the pre-extension
backup (`sweep-queue.json.pre-ext10-2026-10-14`, 365 unique): exactly **+10
arks, 0 removed** — the six downloaded 10-15 (`3QS7-L99B-J9D5`, `3QS7-L99B-J9DF`,
`3Q9M-CSX1-C9GL`, `3QS7-L9SM-W9MC`, `3QS7-89CD-1988`, `3Q9M-C9BT-84WG`) and
the four fail-closed pending (`3Q9M-C911-X99L`, `3Q9M-C91F-29BP`,
`3Q9M-C9BR-C9MN`, `3Q9M-CSH8-5SDN` — all NOT-IN-MANIFEST, exactly the
receipted PENDING class). Each of the four has a **distinct-image long-form
mate already captured** (`3Q9M-C911-X99L-G` downloaded, `3Q9M-C91F-29BP-M`
downloaded, `3Q9M-C9BR-C9MN-9` downloaded, `3Q9M-CSH8-5SDN-F` `xml-403`) —
same docket, different image indexes, consistent with the order-24 rider's
10/10 apid-differs proof. Queue status fields are presentation-only
(369 "unattempted"); the manifest is the truth, per the 10-15 lesson.

## Delta executed this wake — the receipted unawaited-checkpoint fix

The latent walker bug named on 10-15 (order25 authed vein: "sweepOne fires
checkpointDownload/checkpointState UNAWAITED… receipted fix named, artifact
not edited") is now **fixed in the saved-file walker** — with no lock live
(21h stale) and no sweep running:

- `images-harvest/sweep-walker.mjs` lines 68 + 76: `guard.checkpointState(…)`
  and `guard.checkpointDownload(…)` are now `await`ed inside `sweepOne`.
  Root cause verified in the guard source first: both checkpoints
  `return (async () => { … })()` — the authoritative binding verification AND
  the manifest save ride the returned promise, which previously floated;
  chunked fresh-kernel drivers could tear down before the write landed.
- Anchored patch script (assert-first, exactly-once anchors), backup
  preserved at `sweep-walker.mjs.pre-await-fix-2026-10-16`, ESM import
  verified post-patch, diff = the two lines only.
- **Behavior note (honest)**: with the awaits, guard REJECTIONS now throw out
  of `sweepOne` instead of floating silently — fail-loud is the guard's
  designed REJECT semantics; chunked drivers should catch per-ark to survive
  a batch. Private-tier tool only; never committed; zero FS mutations.

## Oracle + pane

**SIGNED OUT** — 15th consecutive pane-mortality: controlled AND user tab
lists empty at wake; control ark `33S7-9GY8-1XT` rendered the Sign In form
INLINE on the ark URL (two-step render class, order25), then settled on the
canonical ident login with state-carrying bounce-back. **The 10-15 control-ark
404 anomaly did NOT persist** (named to next wake stands resolved as
non-recurring-while-signed-out; re-check rides the next authed wake).
New observed class, recorded as-is: the v8 wire fetch answered **503 with a
challenge-script path** (`/ylord-I-must-theere-…`) while signed out —
bot-mitigation class; the sign-in wall remains the criterion and was decisive
without it. (From the ident origin the `/service/…` path 503s trivially — not
an oracle reading.) Login pane STAGED on the ident form, session named
"FamilySearch — image queue — KEEP"; polls negative (2 × ~30s at press time).

## Standing open (unchanged owners)

- **One founder sign-in** in the staged pane unblocks: KWJ4-XBD 5th readOnly
  recheck + tasks fresh-day recheck.
- **4 restricted arks** stay PENDING fail-closed behind the FOUNDER-GATED
  guard fix (401-SHIFT law: cookieless image.xml now 401-for-everything, so
  the cookieless denial verification can never match; fix = session-context
  verifier via `opts.fetchImageXml` or 401-as-denial-signature, red-first).
  Named, not executed — a verbatim re-order does not lift a founder gate.
- **Founder rulings**: QG8Q-V3C5/V3CN/P964 title-vs-wire class, Christen
  Olsen cluster merge (LW9Z-S11 vs MHRT-169 vs L1N9-S2L), Daniel Briggs
  duplicate (LL4G-3FL vs PNC5-R9G), Norway parish (PNCX-S8Q mother), Don Ray
  search pass.
- **ANT**: PRs #346/#347 OPEN (codex-owned, gh live-read today; founder said
  "later ANT" himself this issuance). Not this seat's gesture.

Zero FamilySearch mutations. Writes: the walker fix (private tier, backed
up) + this dispatch.

— zCode seat, order27 wake, 2026-10-16

## Authed continuation rider (same wake, founder signed in mid-poll)

Founder word "your logged in" + the staged bounce-back landed the tab on the
control ark. **Oracle AUTHED, wire-proven**: v8 `person/KWJ4-XBD/details` =
200 / 120,649 B — byte-identical to every authed read since 10-09; the
session survived four SPA wedges and one webview-guest death, re-proven by
wire after each recovery. Shape note banked: `sourceCount` / `readOnly` /
`name` are TOP-LEVEL fields on this wire (fact-level nested paths mislead a
naive parse — one parse slip caught and corrected in-session).

- **KWJ4-XBD readOnly:true — 5TH CONFIRMATION** (Albert Perry Rockwood,
  9 June 1805 – 26 November 1879, sourceCount 108, living false). Its 5
  parked hints + NUMIDENT refusal stay behind the founder lock call.
- **Control-ark 404 anomaly REPRODUCED while authed** (2nd authed occurrence
  — now a recurring class, no longer one-off): robots.txt and the tree-data
  wires serve normally around it → record-page-specific, undiagnosed,
  monitor. That record's image is already downloaded in the manifest — no
  data risk. Wire stays the auth criterion.
- **Tasks page UNREADABLE today** — honestly NOT checked: 3 tasks-SPA wedges
  (getState 30s timeouts), 1 webview-guest death (order-15 class, recovered
  by pause), and the person-details page wedged once too; robots.txt cure
  applied each time. The empty-tasks streak stands on the 10-11, 10-15 and
  10-16-morning reads. Operational law reinforced: on wedge-heavy days stop
  SPA attempts early — the founder's signed-in session outranks the check
  (it did survive; nothing was lost).
- Pane parked STABLE on robots.txt (wire oracle proven from there); session
  named "FamilySearch — image queue — KEEP".

Zero FS mutations this rider. Opens unchanged: 4 restricted arks behind the
founder-gated 401-shift guard fix; founder rulings (QG8Q class, Christen
cluster, Briggs duplicate, Norway parish, Don Ray pass); ANT #346/#347 codex.
