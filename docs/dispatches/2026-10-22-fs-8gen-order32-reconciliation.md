# 2026-10-22 — order #32 reconciliation: all four pillars verified fresh at tip `d0fb5d97a`; zero corpus delta since #31; the refusal intact

Order (founder, verbatim, thirty-second issuance): "I need you to scrape
every bit of familysearch.com material evidence for at least 8 dead
(grandparents on) blood relative generations. we will stage it here and
github and later ANT."

Standing law (earned 2026-09-26, held through orders 13–31; founder
freeze 2026-09-28): a verbatim re-issue of an already-executed order =
verify every pillar fresh ON THE DAY at origin/main tip + execute only
the real delta + dispatch. NEVER re-scrape the frozen, merged harvest;
never re-sweep the terminal queue. The automated-FamilySearch-frontier
refusal (adopted, founder-kept 2026-10-18) stands: **zero FamilySearch
requests this wake.**

All repo reads were origin reads (`git show origin/main:…`,
`git ls-tree -r origin/main`); the shared checkout's local main sits
876 commits behind origin tip (other seats' lanes in flight there —
not this lane's files; nothing read from it). Tip this wake:
`d0fb5d97a` (the #478 merge, 2026-10-22). Order #31's dispatch head
`67f1307fb` verified an ancestor of tip (`merge-base --is-ancestor`
exit 0), as were #31's tip `fb1fb9545`, #30's dispatch head
`eb408fa8b`, `5538a7ae6`, `8ecbfc34f`, `ecbc6e8a9`, the 10-13
measuring commit `0270f568a`, and the rail-qualification commit
`5607f3262`.

## Pillars verified fresh 2026-10-22

1. **Harvest — frozen, merged, standing.** Sources manifest at tip:
   **809** cohortPersons, byDepth 2–9 = 4/8/16/32/60/112/203/374,
   **23,673** sourceRefsTotal / **13,589** sourcesAttached /
   **13,249** uniqueRecords / **0** recordsMissingDetail / **0**
   nonBatchableRefs / **0** redactedLiving; schema
   `skaists.sources-manifest/1` unchanged since 2026-09-18.
   `records.json` at tip: digest recomputed this wake over the origin
   blob =
   `4c11aaf0fe7e2625bbfed7e6cbda07a1ad2304e7ff2dacbe689e944b74911679` PUBLIC-CONSTANT (sha256)
   — byte-frozen since 10-13 (`0270f568a`). No eighth harvest.

2. **Record images — sweep terminal; frontier stopped and banked.**
   Private tier `C:/Users/travi/family-lineage/images-harvest/` read
   directly, read-only: **314 images / 84,055,524 B** byte-exact;
   images-manifest state histogram = 314 `downloaded` / 62 `xml-403` /
   6 `xml-403-all` = **382 sweep states, the 62+6 denials terminal**.
   frontier-map: `queue.json` **7,114** 1:1 record arks (schema
   `skaists.sweep-queue/1`; its own source row pins records.json at
   the same frozen digest `4c11aaf0…1679`, 12,111,095 B);
   `pending.json` **7,075** at 2026-10-18T00:28:41.221Z; outcomes
   re-tallied this wake from the walker's own writer.log (2 batch
   events): **18 mapped / 10 no-image / 11 retryable-observation / 1
   walker failure = 40 observed; final pending 7,075** (7,074
   never-attempted + the 1 walker retry) — the founder's 10-18
   arithmetic unchanged, no unexplained ark. Writer lock absent; both
   writer.log lock-releases are STOP-file releases, the log ending on
   the 2026-10-18T00:28:56.241Z one. Nothing rebuilt, retried, or
   re-swept.

3. **Staging here + GitHub — standing, sealed, re-proven on the wire
   today.** Repo `beehive-nature/beehive-nature` visibility PUBLIC.
   Lineage tree `assets/profile-archive/lineage/` = **22,109 files at
   tip = order #31's count exactly** — `git diff 67f1307fb..origin/main`
   scoped to the tree is **EMPTY** (zero files, zero bytes changed).
   The `github-pages` rail remains the one qualified rail, and this
   wake re-proved it by direct reads of the deployed origin:
   `https://skaists.dev/assets/profile-archive/lineage/publication-state.json`
   delivered **2,405,249 B** hashing
   `d7492716ae36ca3ec36d905caa644aeb3ef663016c9db4a7b1ac5464509a845b` PUBLIC-CONSTANT (seal pin, exact match)
   and `publication-index.json` delivered **5,358,242 B** hashing
   `ec73ca14be26592c45b33e4535ddd1479313ce576a74d4300ffd52cf863abe41` PUBLIC-CONSTANT (sha256)
   — equal to the origin/main blob hash, byte-identical. The
   `genealogy-publication` drift-gate workflow is path-gated; no
   genealogy path changed since `5607f3262`, so it could not and did
   not trigger in the delta range.

4. **ANT — every gate still shut.** No ANT-upload PR among the 30
   open (`gh pr list`, all scanned). PR #478 (codex's ANT WebRTC
   read-observation measurement on NixOS) is now **MERGED** at
   `d0fb5d97a` — an observation lane, not an upload: no corpus content
   moved, no spend taken; it is today's tip and named in the delta
   below. Open #481 (BNRoSe kernel as an optional x0x control plane)
   is an assessment, not an upload. `ant 0.3.9` live-read this wake;
   purchase stays capability-blocked (no atomic ceilings). Corpus
   addresses EMPTY on the `autonomi` / `arweave` / `x0x` rails in
   `rail-manifest.json` (`github-pages` qualified:true is the only
   one). Image bytes remain HELD default-never (the 314 are
   local-only, absent from the repo tree). Rights decisions OPEN
   (Class I FS index layers omitted by default). Founder key
   signature irreducible. **Zero ANT spend; uploaded:false stands.**

## The real delta since order #31 (`67f1307fb` → `d0fb5d97a`, 6 commits)

The lineage tree moved by **ZERO files** — `git diff --stat` scoped to
`assets/profile-archive/lineage/` is empty; 22,109 → 22,109. The six
commits are other seats' lanes, zero corpus contact:
- `d0fb5d97a` — #478 merge: opt-in BNRoSe observation of ANT WebRTC
  reads on NixOS (measurement; its diff touches
  `.github/workflows/bnrose-rust-001.yml` — see the CI note)
- `359c82362` — #473: private PQ acceptance, a hiding receipt-chain
  STARK, compact batch ordering
- `66d5130a4` — G2-B: bounded read-only banchor receipt recovery
  (`lane/g2b-reader`; issues #23/#25)
- `cc207b89e` — #14: repo-managed Cursor Cloud Agent environment
- `7728b206a` — #322: bnames registry fee read in A, never legacy EOS
- `b3af7bf35` — #144: ACS marketing foundation v0.3 under `docs/`

No pillar required execution; the delta is reconciliation-only,
dispatch-only.

## CI at tip (fresh today) — one inherited red, routed

`d0fb5d97a`: 12 workflow runs at tip — **9 success** (secret-scan,
WB001 SAW proofs, WB002 WASM corpus, WB002 SAW equivalence, bTunGsTeN
RB, bTunGsTeN PQ, bTunGsTeN PQ SAW, BNROSE-EVOLVE,
BNROSE-ADAPTERS-REAL), **1 failure** (BNROSE-RUST-001), **2 queued at
read time** (tests, pages-build-deployment — pending, not concluded;
named here, not rerun by this seat).

The BNROSE-RUST-001 failure is inherited, not this lane's: failing job
"lane: Network-partition gate (rootless netns; REAL iptables drops or
a loud failure — simulated faults are never a substitute)", failing
line `FAIL CLOSED: baseline connection failed (rc=3) - the server is
not listening, so a later failure would prove nothing` (run
39770496957). First red = `d0fb5d97a` itself: the workflow ran green
TODAY at all five delta commits beneath it (`b3af7bf35`, `7728b206a`,
`cc207b89e`, `66d5130a4`, `359c82362` — runs 2026-10-22T11:25Z), and
the #478 merge diff touches
`.github/workflows/bnrose-rust-001.yml`. Per the inherited-CI law
(FOUNDER 10-13): **HOLD + route** — the #478 / BNROSE-RUST-001
successor lane (codex seat) owns the diagnosis; no rerun-until-green,
no ratchet weakening, no heal from this reconciliation lane. This
dispatch is a docs-only descendant of the red commit and touches no
code any gate reads.

## Completeness ledger (unchanged; never claim "all evidence")

Citations complete and frozen: 809 people / 13,249 records / 0 missing
detail. The evidence itself is NOT all in hand: 314 images downloaded;
frontier 7,114 record arks with 7,075 never attempted (the refusal);
custodian wave 1 (MA/CT, 1,876 ids) at 518/530 printed-page leads,
zero resolved against original manuscripts; rights UNASSESSED for the
12 largest collections; ANT uploaded:false. Evidence gaps + rights
decisions explicitly OPEN.

## Boundary (re-affirmed)

Frozen harvest; no FS requests; no new image acquisitions; no ANT
spend; no publication of held private evidence.
