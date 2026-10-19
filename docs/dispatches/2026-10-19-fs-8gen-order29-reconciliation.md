# 2026-10-19 — order #29 reconciliation: all four pillars verified fresh at tip `8ecbfc34f`; the local-evidence staging leg merged twice since #28; the refusal intact

Order (founder, verbatim, twenty-ninth issuance): "I need you to scrape
every bit of familysearch.com material evidence for at least 8 dead
(grandparents on) blood relative generations. we will stage it here and
github and later ANT."

Standing law (earned 2026-09-26, held through orders 13–28; founder-ratified
freeze 2026-09-28): a verbatim re-issue of an already-executed order = verify
every pillar fresh ON THE DAY + execute only the real delta + dispatch.
NEVER re-scrape the frozen, merged harvest; never re-sweep the terminal
queue. The automated-FamilySearch-frontier refusal (adopted, founder-kept
2026-10-18) stands: **zero FamilySearch requests this wake.**

All reads were tip reads (`git show origin/main:…`, `git merge-base
--is-ancestor`, direct private-tier reads through the order-28 verifier).
Tip this wake: `8ecbfc34f` (PR #471's merge, 2026-10-19T09:32Z).

## Pillars verified fresh 2026-10-19

1. **Harvest — frozen, merged, standing.** All 17 lane commits of record
   are ancestors of the CURRENT tip `8ecbfc34f`
   (`merge-base --is-ancestor` exit 0 each; list unchanged from order #28:
   `140d5e802`, `9bc79dd8e`, `268465ab2`, `a61f23c061`, `630f0ffbf`,
   `6f74e48a0`, `849a4ed91`, `0270f568a`, `735fbde7a`, `8f9633c30`,
   `25258d564`, `e55462a11`, `8b2cfe606`, `de36ef416`, `114fcff90`,
   `abd8a82e0`, `f58729e66`). Sources manifest at tip: scope string
   order-verbatim; **809** cohortPersons, byDepth 2–9 =
   4/8/16/32/60/112/203/374, **23,673** sourceRefsTotal / **13,589**
   sourcesAttached / **13,249** uniqueRecords / **0** recordsMissingDetail
   / **0** redactedLiving; schema `skaists.sources-manifest/1` unchanged
   since 2026-09-18. `records.json` at tip hashes byte-identical to the
   10-13 measuring commit `0270f568a` — full digest in the receipts line
   below. No eighth harvest.

2. **Record images — sweep terminal; frontier stopped and banked.**
   Re-ran the order-28 private-tier verifier (untracked WIP
   `scripts/tmp/order28-private-tier-verify.cjs`; read-only; counts never
   prose arithmetic) plus a fresh frontier-manifest tally:
   - Sweep manifest **382 states = 314 downloaded / 84,055,524 B + 62
     `xml-403` + 6 `xml-403-all`**; auditLog 12 events, tail still the
     2026-10-03T05:20:16Z queue-rekey, nothing after. Sweep queue 376
     rows / 375 unique member arks. images-manifest mtime
     2026-10-16T20:40:51Z — quiet since the denials banking.
   - frontier-map: queue **7,114** 1:1 record arks (generated
     2026-10-18T00:20:42Z); outcomes tallied from the run's own
     `manifest.json`: **40 = 18 mapped / 10 no-image-available / 11
     retryable / 1 walker failure**; pending **7,075** (= 7,074
     never-attempted + the 1 walker retry, per the 10-18 arithmetic
     receipt). `.writer-lock.json` absent — no writer active. Nothing
     rebuilt, retried, or re-swept.
   - Public `images-summary.json` at tip: 314 downloaded entries,
     generated 2026-10-16T20:42:41Z; counts + sha256 + ark pointers
     only, bytes never bundled.

3. **Staging here + GitHub — done, standing, and extended since #28.**
   Repo `beehive-nature/beehive-nature` visibility PUBLIC. The lineage
   tree `assets/profile-archive/lineage/` is byte-identical to the
   order-28 dispatch commit `cca719bd8` (`git diff --name-status
   cca719bd8..origin/main -- assets/profile-archive/lineage/` = empty):
   **22,104 files at both `cca719bd8` and tip**. Order #28's prose said
   22,103 — its count basis was the pre-#461 tip `e1c366d5b`, where the
   count IS 22,103 and the only delta to `cca719bd8` is exactly one
   file, `rights-qualification.json` (PR #461). Arithmetic closed, zero
   tree change since.
   New since order #28 (the "stage here" leg's local reader, this seat's
   own merges, both CI-green, neither touching a frozen pillar — the
   records.json hash at tip proves the corpus unmoved across them):
   PR #467 (local-evidence correction integration; merge `6e7f01bcb`,
   2026-10-18T23:24Z, CI 54 pass/8 skip/0 fail; actual-corpus read-back
   809/13,249/13,589/49,342 with zero external reads; 314 images
   re-hashed, 308 imported via queue-recorded associations) and PR #471
   (native local-reader host serving a verified immutable snapshot,
   loopback-only; merge `8ecbfc34f` = tip). **Post-merge main CI at the
   tip verified this wake: 3/3 runs at `8ecbfc34f` completed/success.**

4. **ANT — gated; no change; all four gates re-read fresh.** No ANT PR
   open (open-PR list checked this wake; `#336` and `#461` both MERGED,
   unchanged). Rights gate OPEN (Class I FS index-field layers omitted
   by default per `rights-qualification.json` at tip); image bytes HELD
   default-never (314 / 84,055,524 B, box-local); purchase
   capability-blocked — **`ant --version` re-read this wake: 0.3.9**,
   still no atomic ceiling enforcement; founder key-holder signature
   the one irreducible act; `uploaded:false` everywhere. No spend, no
   wallet, no upload from this seat.

## Completeness ledger (the order says "every bit" — the honest answer)

Citations are complete (809 people / 13,249 records / 0 missing detail,
frozen), but the evidence itself is not all in hand: 314 images
(84,055,524 B) downloaded; frontier 7,114 record arks with 40 observed /
7,075 pending (stopped by the adopted refusal); custodian wave 1 (MA/CT,
1,876 ids) at printed-page leads 518/530, zero resolved against original
manuscripts; rights UNASSESSED for the 12 largest collections; ANT
`uploaded:false`. "All evidence" is NOT claimed — this ledger is the
answer. (Founder-asked 10-18; unchanged this wake.)

## Not done this wake, named

- **Zero FamilySearch requests** — no session oracle, no pane staging, no
  walker: the automation refusal stands and nothing authorized needs a
  session.
- England wave 2 custodian+rights research (the 8 parishes ≥34 ids named
  in the 10-18 partition: Aylesbury, Studham, Wincanton, Chalfont St
  Giles, Chipping Campden, Portesham, Foxcote, Wetwang) is Seat 3's
  lane — not duplicated here.
- Identity rulings R1–R5 remain founder calls; the R2/R3 merges are
  founder-hand in FamilySearch.
- Post-#471 follow-ons named with owners: bounded EmbeddedStore iteration
  and the streaming bnr-archive writer (zBlood's crates).

## Real delta executed this wake

The reconciliation itself: every pillar re-verified fresh at the day's
tip, the post-#471 main CI confirmed green (3/3 at `8ecbfc34f`), the
22,103→22,104 count reconciled to the #461 rights file (zero tree
change), and this dispatch landed. No other delta was executable by this
seat — the harvest is frozen, the ANT gates are shut, and the remaining
frontier/custodian/rights work is owned by Seat 3, zBlood, or the
founder.

## Receipts

- Tip reads: `git show origin/main:assets/profile-archive/lineage/sources/{manifest,records,images-summary}.json`
  at `8ecbfc34f`; records.json sha256
  `4c11aaf0fe7e2625bbfed7e6cbda07a1ad2304e7ff2dacbe689e944b74911679` <!-- PUBLIC-CONSTANT: sha256 of the public frozen records.json -->
- Ancestor proofs: `git merge-base --is-ancestor <lane-commit> origin/main`
  ×17, exit 0 each, zero NOT-ANCESTOR lines.
- Private tier: `node scripts/tmp/order28-private-tier-verify.cjs` plus a
  frontier `manifest.json` tally (images 28 = 18 mapped + 10
  no-image-available; retryable 11; walker 1; pending 7,075), read-only,
  zero writes.
- CI / PRs / visibility: `gh run list --branch main` (3× completed/success
  at `8ecbfc34f`), `gh pr list --state open` (no ANT entries),
  `gh repo view --json visibility` = PUBLIC; `ant --version` = 0.3.9.
- Zero FamilySearch mutations, zero FamilySearch requests, zero
  private-tier writes, no wallet, no spend, no ANT upload.

NEXT OWNER: unchanged from order #28 — the zBlood seat owns ANT edition
assembly once the rights and purchase gates open; Seat 3 owns custodian
research (England wave 2 next); the founder holds R1–R5 and the two
FamilySearch merges.
