# 2026-10-10 — zCode/bHERALDRY round 2: the gazette pass, revision 2, and the first surface

Seat: zCode (GLM-5.3). Founder order (this round): verify post-merge main CI
for PR #373 at d94783069; continue lane C with specimen revision 2 — verify the
Bulgarian heraldic law against the primary official gazette, examine the 2017
amendment, preserve unresolved historical disputes; build the first read-only
heraldry surface using existing BNR interfaces; keep unofficial translations
explicitly unattested, protect living-person identities, never imply
government endorsement or reproduction rights; add adversarial regressions,
preserve immutable specimen revisions, report exact SHA and CI receipts; no
user approval gate; reassess session handoff after this deliverable.
Worktree `../wt-zcode-bheraldry`, branch `zcode/bheraldry-002-2026-10-10`.

## 1. Post-merge main CI at d94783069 — VERIFIED GREEN

`gh api …/commits/d94783069…/check-runs`: every GitHub-Actions check-run is
`completed success` — build, deploy, eternal, formal, meter, node, pq00-teeth,
pq01-vectors, pq10-plonky3, saw, scan, static, test, wallet, wasm-corpus,
report-build-status (16/16). Four third-party suites (aikido-pr-checks,
claude, cursor, github-pages) sit `queued` and never run on push commits —
named, not blocking. (Main has since moved on through other seats' PRs —
#374–#385+ — none red at the merge points observed.)

## 2. The gazette pass — what the sources actually said

- **A second extraction of the same lex.bg page (2026-10-10) disagrees with
  the first (2026-10-09) in ~7 wordings** („е разположена“/„има“, „с
  желуди“/„с плодове“, „кантова ивичка“/„кант“…). An independent commercial
  rendering of the same instrument (ciela.net issue page, search-snippet
  mediated) **corroborates the second wording** on the diverging phrases;
  the Bulgarian Wikipedia's quote agrees with both on the opening sentence.
- **The 2017 amendment claim is WITHDRAWN** (withdrawn named withdrawn): the
  2026-10-10 lex.bg header carries NO amendment line; bg.wikipedia records
  no amendment history at all; the 2017 act that exists — **Решение № 480 от
  28.08.2017** (ДВ, 1 Sep 2017) — is a Council-of-Ministers *consent under
  Чл. 3 (2)* for the arms' image in an organization's mark, not a statute
  change. The „изм. - ДВ. бр. 100 от 29 Декември 2017г.“ fragment of the
  first extraction is recorded as a transport artifact; it survives only in
  revision 1's immutable bytes.
- **The primary gazette portal was LOCATED but its scan was NOT machine-read**:
  dv.parliament.bg/DVWeb/broeveList.faces serves (HTTP 200, 74,791 bytes,
  server-rendered index), but issue deep links are JSF POST flows; five
  direct URL patterns returned 404 and one bounded form-POST attempt
  returned the unfiltered index. Scan-level quote verification remains OPEN,
  carried in-record as the third position of the transport-variance dispute
  („No scan-based position exists yet“).
- Bonus evidence, carried as historical interpretation: **Решение № 1/1995
  (дело № 5/1995)** of the Constitutional Court — чл. 164's element list is
  not exhaustive, a crown is permissible (via bg.wikipedia, tertiary); and
  **Постановление № 476 от 17.12.1997** approving the graphic/plastic
  depictions (search-snippet mediated, UNVERIFIED at quote level).

## 3. Revision 2 — corrections that do not rewrite

`bg/national-arms` rev 2 supersedes rev 1 **by exactly the frozen digest**
`0bd62b1c…6d627c`; rev 1's builder (`bulgaria_national_arms_v1`) is
byte-identical and its frozen vector test still pins it. Rev 2: working text
switched to the corroborated rendering; both renderings RETAINED as the new
fourth dispute; adoption claim moved to the second extraction (no amendment
line); Решение № 480 added as a usage-history condition; the crown dispute
gains the 1995 constitutional position. **Frozen:** rev 2 = 60,787 canonical
bytes, digest `fd991cf4e2f6d86d5b4b9d1bc07d3a3b3b5d134b6b920ce15e6d07c61f70a759` <!-- PUBLIC-CONSTANT (frozen bg rev2 digest) -->.
`bnr/house-achievement` rev 2 (claim restructure demanded by the new law
below): 8,102 bytes, digest `8fe6a76f6acdae0686c5a959777a80141a2812c9352ec5f9ed9ca663f6222d69` <!-- PUBLIC-CONSTANT (frozen house rev2 digest) -->,
supersedes rev 1's `14866d24…d7991b`.

**New law (V9):** `BlazonTextDivergesFromSourceVerbatim` — a blazon whose
source carries a verbatim quote must carry exactly those bytes as its
working text. The metadata/working-text split is now a named refusal.

## 4. The first surface — read-only, on existing interfaces

`surfaces/bheraldry.html` + `surfaces/bheraldry-records.json` (deterministic
`--export-json` artifact of the crate, pinned to the freshly built seals by
`tests/artifact.rs` — a drifted artifact fails CI). The page: renders both
records (original motto, six translations with visible bLANGUAGEdock tiers,
⚙ machine drafts marked unattested; blazon + structured achievement; usage
law; 16 graded source claims; four retained disputes; asset binding), wears
the three registers through the shared control (verified live: raver click →
`body[data-reg]=raver`, tokens recolor, bee restores, persistence wired),
external links `target=_blank rel=noopener noreferrer` with the footer
naming the new-tab behavior, and the standing boundary pinned at the top:
not government endorsement, not reproduction rights (Чл. 3 (2)), no living
person named. Registration ritual rode this one commit: root `estate.json`
row (id bheraldry, LIVE), `surfaces/estate.json` row, `build-atlas` output
(112 counted surfaces, state-root recomputed), review.html SURFACES entry,
stack-inventory row updated (door: bheraldry.html). The surface is NOT in
`e2e/lang-coverage-set.json` (blood.html/record.html precedent — the i18n
keying lane owns corpus work; named carry-over).

Render verification (local, IAB over `127.0.0.1:8477`): full DOM snapshot —
every section renders, zero `[object Object]` leaks after the serde-enum
untangling fix, register toggle verified with computed styles. Screenshot
capture timed out in IAB twice (named; the DOM + computed-style evidence is
the render receipt).

## 5. Adversarial regressions (3 new, all DETECTED by name)

- `r01` blazon text swapped keeping the verbatim → `BlazonTextDivergesFromSourceVerbatim` + digest drift.
- `r02` gazette-portal claim URL swap → digest drift + `DigestMismatch`.
- `r03` withdrawal rollback (amendment line re-inserted into the adoption
  claim) → digest refuses to verify as shipped rev2; and the vector test
  `the_withdrawn_amendment_line_is_a_claim_corpse_only_in_rev1` makes the
  corpse-checkable while rev1 keeps its own bytes.
- a08 now also runs the REAL v1→v2 pair: rev 1 presented as current →
  `StaleRevision` naming rev 2's digest.

## 6. Receipts (local, Git-for-Windows, cargo 1.98.1)

- `cargo test -p bheraldry --locked` → **32 passed, 0 failed** (13
  adversarial, 2 artifact-parity, 1 bsigner ML-DSA seam, 10 positive, 6
  frozen-vector — rev1 pins UNCHANGED through the refactor).
- `cargo fmt --all --check` clean. `node scripts/estate-check.mjs` →
  PASS (112 counted · 121 listed · hub in sync).
  `node scripts/build-stack-inventory.mjs --check` → 23 components.
- CI receipts for this push: see the PR checks (all suites) — quoted in the
  PR and verified before merge.

### 6a. The red the tree named, and its cure (commit 4439845ca)

The first CI wave failed two tree-following beats, honestly recorded:
the static job's **Engine Room** step (the surface directory needed
regeneration for the new page — `build-stack-surfaces.mjs`, 130 surfaces)
and the eternal job's **bottom-half ratchet** (390px × three registers found
WIDE/CAPS/FAINT/SMALL/TINY on the new page). The ratchet findings were real
UX faults and were FIXED, not baselined: fixed-layout tables with
overflow-wrap (the 719px sideways scroll is gone), no forced capitals on
section labels, chip text at --sk-ink-soft (hue kept on borders), a 12px
type floor in every register, and 32px touch-target table links. Local
receipt after the fix: `node e2e/footer-audit.mjs --only bheraldry.html` →
**3 views, 0 findings** — zero is the floor, so nothing enters
footer-audit.baseline.json and the ratchet itself polices the page from now
on.

## 7. Boundaries not crossed

- The record still authenticates nothing about history or rights; the
  signature seam's ceiling stands (sound by construction, nothing more).
- The gazette scan is honestly UNREAD — no claim here rests on having read
  it; the working-text switch is recorded as a transport choice, not a
  ruling on the ДВ print.
- Решение № 480 / Постановление № 476 are snippet-mediated (PrimaryOfficial
  channel, quote-level UNVERIFIED — caveats in-record).
- No living person appears anywhere in the records or the surface; the
  standing banner says why.
- No secrets read, held, or printed.

## 8. Next owners + session handoff reassessment

- **Gazette scan (ДВ бр.62/1997)**: one careful JSF flow walk or a human
  click on dv.parliament.bg → verify Чл. 2 (1) verbatim → revision 3.
- **i18n corpus**: key the surface's visible strings into the 28-tongue
  canon (the bLANGUAGEdock lane's attestation flow).
- **lv/zh/ar motto attestation**: still ⚙ unattested, unchanged.
- **Handoff:** this session's lane work is complete and merged; the carry-
  overs above are queued with owners. No open work remains in this seat's
  queue for bHERALDRY; the session can be archived per the carry-over law
  once CI is green and the memory is updated.
