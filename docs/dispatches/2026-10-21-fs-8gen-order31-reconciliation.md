# 2026-10-21 — order #31 reconciliation: all four pillars verified fresh at tip `fb1fb9545`; rail-qualification delta since #30; the refusal intact

Order (founder, verbatim, thirty-first issuance): "I need you to scrape
every bit of familysearch.com material evidence for at least 8 dead
(grandparents on) blood relative generations. we will stage it here and
github and later ANT."

Standing law (earned 2026-09-26, held through orders 13–30; founder
freeze 2026-09-28): a verbatim re-issue of an already-executed order =
verify every pillar fresh ON THE DAY at origin/main tip + execute only
the real delta + dispatch. NEVER re-scrape the frozen, merged harvest;
never re-sweep the terminal queue. The automated-FamilySearch-frontier
refusal (adopted, founder-kept 2026-10-18) stands: **zero FamilySearch
requests this wake.**

All reads were origin reads (`git show origin/main:…`, `git ls-tree -r
origin/main`); the shared checkout's local main sits 869 commits behind
origin tip (other seats' lanes in flight there — not this lane's files;
nothing read from it). Tip this wake: `fb1fb9545` (sovereign-lab head,
2026-10-21). Order #30's dispatch head `eb408fa8b` verified an ancestor
of tip (`merge-base --is-ancestor` exit 0), as were `0270f568a`,
`8ecbfc34f`, `ecbc6e8a9`, and order #30's tip `5538a7ae6`.

## Pillars verified fresh 2026-10-21

1. **Harvest — frozen, merged, standing.** Sources manifest at tip:
   **809** cohortPersons, byDepth 2–9 = 4/8/16/32/60/112/203/374,
   **23,673** sourceRefsTotal / **13,589** sourcesAttached /
   **13,249** uniqueRecords / **0** recordsMissingDetail / **0**
   redactedLiving; schema `skaists.sources-manifest/1` unchanged since
   2026-09-18. `records.json` at tip hashes byte-identical to the 10-13
   measuring commit `0270f568a` — digest recomputed this wake over the
   origin blob: `4c11aaf0fe7e2625bbfed7e6cbda07a1ad2304e7ff2dacbe689e944b74911679` PUBLIC-CONSTANT (sha256). No eighth harvest.

2. **Record images — sweep terminal; frontier stopped and banked.**
   Private tier `C:/Users/travi/family-lineage/images-harvest/` read
   directly, read-only: **314 images / 84,055,524 B** byte-exact;
   images-manifest state histogram = 314 `downloaded` / 62 `xml-403` /
   6 `xml-403-all` = **382 sweep states, the 62+6 denials terminal**.
   frontier-map: queue **7,114** 1:1 record arks; outcomes re-tallied
   this wake from the walker's own writer.log (2 batch events):
   **18 mapped / 10 no-image / 11 retryable-observation / 1 walker
   failure = 40 observed; final batch pending 7,075** (7,074
   never-attempted + the 1 walker retry) — the founder's 10-18
   arithmetic unchanged, no unexplained ark. Writer lock absent; both
   writer.log lock-releases are STOP-file releases, the log ending on
   the 2026-10-18T00:28:56Z one. Nothing rebuilt, retried, or re-swept.

3. **Staging here + GitHub — standing, sealed, now rail-qualified.**
   Repo `beehive-nature/beehive-nature` visibility PUBLIC. Lineage tree
   `assets/profile-archive/lineage/` = **22,109 files at tip** =
   order #30's 22,107 + exactly 2 new files (delta below). The
   `github-pages` rail is the one qualified rail: `rail-qualification.json`
   records the deployed Pages origin delivering publication-state.json
   (2,405,249 B) and publication-index.json (5,358,242 B) byte-identical
   to the committed artifacts, stateSha256
   `d7492716ae36ca3ec36d905caa644aeb3ef663016c9db4a7b1ac5464509a845b` PUBLIC-CONSTANT (seal pin), index binding OK. The
   `genealogy-publication` drift-gate workflow is path-gated; it did not
   trigger at `fb1fb9545` (no genealogy-path change since), and its last
   runs — at `5607f3262` (the one delta commit that touched the lineage
   tree) and `79ed2cc3f` — are both success.

4. **ANT — every gate still shut.** No ANT-upload PR (`gh pr list`).
   Open PR #478 is codex's ANT WebRTC read-observation measurement on
   NixOS — an observation lane, not an upload: no corpus content moves,
   no spend taken; named here for honesty, not a gate breach. `ant
   0.3.9` live-read this wake; purchase stays capability-blocked (no
   atomic ceilings). Corpus addresses on the `autonomi` / `arweave` /
   `x0x` rails are EMPTY in `rail-manifest.json`: autonomi
   route-observed but NOT qualified for corpus delivery (upload = a
   founder gesture, no spend taken); arweave observed-absent; x0x
   structurally unqualified (loopback-only gossip, no stored history;
   live observation deferred 2026-10-20, box SSH refused). Image bytes
   remain HELD default-never (the 314 are local-only, absent from the
   repo tree). Rights decisions OPEN (Class I FS index layers omitted
   by default). Founder key signature irreducible. **Zero ANT spend;
   uploaded:false stands.**

## The real delta since order #30 (`eb408fa8b` → `fb1fb9545`, 8 commits)

The lineage tree moved by exactly **2 files, 36 insertions, 0
deletions** (`git diff --stat` scoped to the tree):
- `rail-manifest.json` (+35) and `rail-qualification.json` (+1), both
  NEW — commit `5607f3262` (2026-10-20, rail qualification pass):
  WHERE bytes may be fetched from, never WHAT to trust; every rail byte
  digest-verified against the pinned seal before rendering. The sealed
  state itself is untouched — `publication-state.json`,
  `publication-index.json`, `blood-relation-reconciliation.json`, and
  all of `sources/` are unchanged in the range; the records.json digest
  above is the proof the frozen corpus never moved.

The other 7 commits are the sovereign-rails lane (#479 first milestone
`79ed2cc3f`, #480 hardening `52ea0cf7a`), the x0x transport
investigation (`7b1ba528f`), and sovereign-lab hardening heads
(`84be42322`, `f895e70d0`, `3612f58d1`, `fb1fb9545`): the
`btungsten-sovereign-rails` crate + workflow, `e2e/blood-seal`,
`surfaces/stack.html`, dispatches — other seats' lanes, zero corpus
contact. No pillar required execution; the delta is
reconciliation-only, dispatch-only.

## CI at tip (fresh today)

`fb1fb9545`: **15/15 workflows success**, completed
2026-10-21T02:46–03:45Z (incl. `pages-build-deployment`, `tests`,
`secret-scan`, `btungsten-sovereign-rails`; `genealogy-publication`
path-gated as above, last runs green).

## Completeness ledger (unchanged; never claim "all evidence")

Citations complete and frozen: 809 people / 13,249 records / 0 missing
detail. The evidence itself is NOT all in hand: 314 images downloaded;
frontier 7,114 record arks with 7,075 never attempted (the refusal);
custodian wave 1 (MA/CT, 1,876 ids) at 518/530 printed-page leads, zero
resolved against original manuscripts; rights UNASSESSED for the 12
largest collections; ANT uploaded:false. Evidence gaps + rights
decisions explicitly OPEN.

## Boundary (re-affirmed)

Frozen harvest; no FS requests; no new image acquisitions; no ANT
spend; no publication of held private evidence.
