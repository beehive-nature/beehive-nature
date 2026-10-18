# 2026-10-18 — order #28 reconciliation: pillars verified fresh; the rights-qualification gate merged; the refusal intact

Order (founder, verbatim, twenty-eighth issuance): "I need you to scrape
every bit of familysearch.com material evidence for at least 8 dead
(grandparents on) blood relative generations. we will stage it here and
github and later ANT."

Standing law (earned 2026-09-26, held through orders 13–27; founder-ratified
freeze 2026-09-28): a verbatim re-issue of an already-executed order = verify
every pillar fresh ON THE DAY + execute only the real delta + dispatch.
NEVER re-scrape the frozen, merged harvest; never re-sweep the terminal
queue. The automated-FamilySearch-frontier refusal (adopted, founder-kept
2026-10-18) stands: **zero FamilySearch requests this wake.**

Reads were all tip reads (`git show origin/main:…` / direct private-tier
file reads): the shared checkout sits 728 commits behind origin/main, so no
working-copy read was trusted.

## Pillars verified fresh 2026-10-18

1. **Harvest — frozen, merged, standing.** All 17 lane commits of record
   are ancestors of the pre-merge tip `e1c366d5b`
   (`merge-base --is-ancestor` exit 0 each): `140d5e802` (8-gen source
   harvest, PR #244 MERGED — GitHub staging is standing state), `9bc79dd8e`
   + `268465ab2` (10-04 tasks-harvest), `a61f23c061` (frontier close),
   `630f0ffbf` (order-15), `6f74e48a0` (order-16 tip), `849a4ed91` (hint
   census, PR #356), `0270f568a` (post-freeze 37-person sync + measuring
   commit), `735fbde7a`, `8f9633c30`, `25258d564`, `e55462a11`,
   `8b2cfe606`, `de36ef416` (orders 23–26), `114fcff90` (custodian plan
   adopted), `abd8a82e0` (stopped frontier banked), `f58729e66` (relayed
   note). Sources manifest at tip: scope string order-verbatim; **809**
   cohortPersons, byDepth 2–9 = 4/8/16/32/60/112/203/374, **23,673**
   sourceRefsTotal / **13,589** sourcesAttached / **13,249** uniqueRecords
   / **0** recordsMissingDetail / **0** redactedLiving; schema
   `skaists.sources-manifest/1` unchanged since 2026-09-18. `records.json`
   at tip hashes
   `4c11aaf0fe7e2625bbfed7e6cbda07a1ad2304e7ff2dacbe689e944b74911679` <!-- PUBLIC-CONSTANT: sha256 of the public frozen records.json -->
   — byte-identical to the 10-13 measuring commit `0270f568a` and to the
   10-18 Seat-3 verification. No eighth harvest.

2. **Record images — sweep terminal; frontier stopped and banked.**
   Script-reconciled from the private tier
   (`C:/Users/travi/family-lineage/images-harvest/`, read-only; verifier
   kept as untracked WIP `scripts/tmp/order28-private-tier-verify.cjs`;
   counts never prose arithmetic):
   - Sweep manifest **382 states = 314 downloaded / 84,055,524 B + 62
     `xml-403` + 6 `xml-403-all`** — exactly the 10-16 denials-banked
     receipt (mtime 2026-10-16T20:40:51Z, quiet since; auditLog tail still
     the 2026-10-03T05:20:16Z queue-rekey, 12 events, nothing after).
     Sweep queue 376 rows / 375 unique member arks, 100% resolved, mtime
     2026-10-15T17:50Z.
   - frontier-map: queue **7,114** 1:1 arks (generated
     2026-10-18T00:20:42Z); outcomes tallied from the run's own
     `manifest.json`: **40 = 18 mapped / 10 no-image-available / 11
     retryable / 1 walker failure** (images 28 = 18+10; retryable 11;
     walker 1); pending **7,075** (= 7,074 never-attempted + the 1 walker
     retry, per the 10-18 arithmetic receipt). writer.log shows the two
     admitted batches (8 then 32) and `lock-released` 2026-10-18T00:28:56Z,
     reason STOP file — the STOP file itself is not on disk this wake; the
     release is receipted in the log. `.writer-lock.json` absent — no
     writer active. Nothing rebuilt, retried, or re-swept.
   - Public `images-summary.json` at tip: 314 downloaded entries, generated
     2026-10-16T20:42:41Z (the denials-banking regeneration); counts +
     sha256 + ark pointers only, bytes never bundled.

3. **Staging here + GitHub — done, standing.** Public tier on main: the
   sources layer (manifest, records, index, relationship-audit,
   search-evidence, images-summary, and as of this wake's merge below
   rights-qualification) plus 22,103 lineage files under
   `assets/profile-archive/lineage/`. Repo visibility PUBLIC. Privacy gate
   CLOSED 2026-10-17T19:09Z (#347 landed-through-main, #346 superseded,
   ratification `8e5fa5d05` with the no-expansion clause).

4. **ANT — gated; today's real delta: PR #461 merged by this seat.**
   `#336` (edition refresh) **MERGED** — moved from order-16's OPEN.
   `#346`/`#347` CLOSED unmerged (reconciled 10-16; content landed through
   main). `#461` (rights-and-provenance qualification of the committed FS
   corpus — ANT partition + gates) was OPEN on its exact head with 52
   SUCCESS / 8 SKIPPED / 0 red, `MERGEABLE`/`CLEAN`, purely additive
   (2 files, +168/−0: `rights-qualification.json` + its dispatch), next
   owner "authorized merger", quiet ~19 h — **merged this wake per the
   no-stall + ordinary-merge laws** at 2026-10-18T15:14:22Z, merge commit
   `6b9df5e7a`. The ANT one-way door stays shut behind it: rights gate OPEN
   (Class I FS index-field layers omitted by default), image bytes HELD
   default-never (314 / 84,055,524 B, box-local), purchase
   capability-blocked (ceiling 100 ANT + standing-granted approval already
   on record, but ant 0.3.9 lacks atomic ceiling enforcement; fresh quote
   binds the exact edition hash at upload), founder key-holder signature
   the one irreducible act; `uploaded:false` everywhere. No spend, no
   wallet, no upload from this seat.

## Not done this wake, named

- **Zero FamilySearch requests** — no session oracle, no pane staging, no
  walker: the automation refusal stands and nothing authorized needs a
  session (today's Seat-3 precedent followed).
- Custodian research (wave 1: five towns; MA/CT printed-page leads;
  Rockwood necrology visually verified) is Seat 3's live lane today — not
  duplicated here.
- Identity rulings R1–R5 (10-17 dispatch) remain founder calls; the R2/R3
  merges are founder-hand in FamilySearch.

## Receipts

- Ancestor checks and public-tier reads: `git` against origin/main at the
  tips named; private-tier counts script-reconciled (node), never prose
  arithmetic; zero private-tier writes.
- PR states: `gh pr view` 2026-10-18T15:1xZ; #461 merged via
  `gh pr merge --merge`; merge confirmed by `state=MERGED` +
  mergedAt 2026-10-18T15:14:22Z.
- Zero FamilySearch mutations, zero FamilySearch requests, zero
  private-tier writes, no wallet, no spend, no ANT upload.

NEXT OWNER: the zBlood seat owns ANT edition assembly once the rights and
purchase gates open; Seat 3 owns custodian research (England wave 2 next);
the founder holds R1–R5 and the two FamilySearch merges.
