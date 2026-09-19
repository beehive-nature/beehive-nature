# 2026-09-19 · zCode — Genealogy Archive Core: independent verification receipt (dispatch found ALREADY LANDED)

Dispatch received by this seat (zCode/GLM): "end / Genealogy Archive Core —
remove the remaining architectural browser seam in genealogy," canonical
starting facts `lineage 97f18945 · Archive 1.1 0f44ee77 · F1/F2/F3 green ·
camera defect closed · atlas/person lanes terminal`, objectives 1–8 (extract
the pure core, `surfaces/archive-core.mjs`, zero Node deps, corrected
`relationshipPath`, wrapper consumes the ONE core, F1/F2/F3 and the
ambiguity/privacy/provider-record/bounded-route laws preserved, pathological
dozen + corpus-pair invariants re-run in both directions), deliverable "a
small named commit zGeneUI can consume directly to kill upPath."

## Verdict before work: the beat is LANDED. This seat did NOT re-extract.

- **`e1948156`** — "ARCHIVE CORE EXTRACTION — one relationship resolver, two
  environments" (bFUzZ, seat zGeneArchive, base `0f44ee77`, founder ruling
  bdf59735 applied mid-flight) is the exact commit the dispatch describes. It
  lives at `origin/bfuzz/gux01-archive-graph` = head of **PR #128 (OPEN)**.
  Receipt: `docs/dispatches/2026-09-19-bfuzz-archive-core-extraction.md`.
- **Consumption is also landed**: `e962b6eb` "GUX-01 BEAT 2e — THE upPath
  REPLACEMENT, WHOLE" (zGeneUI, PR #125 OPEN) composes
  `surfaces/archive-core.mjs` **verbatim** (blob `12fdc584` byte-identical on
  both branches — verified by blob hash this session) and deletes the
  safe-direction adapter. The one remaining `upPath` string in `blood-nav.mjs`
  is a tombstone comment; the `blight/web-llm.mjs` mentions are vendored
  minified bytes, untouchable.
- The camera defect the dispatch calls closed is Beat 2c (`49d26460`,
  composing the engine organ fix at `81e9ded8`).

Re-doing the extraction would have created the second implementation the
dispatch itself forbids (objective 5). This seat therefore executed the
dispatch's remaining testable content as an **independent verification** of
`e1948156`, with fresh machinery, not trust.

## Independent verification (fresh run, this seat, worktree at `e1948156`)

Harness: `.scratch/geneac-invariants-zcode.mjs` (session-local, follows the
`.scratch` harness precedent). Its recomputation is INDEPENDENT of the
implementation: ancestor closures by plain BFS, cyclic membership by two-pass
Kosaraju (the core uses iterative Tarjan), hop validity against a privately
built child/couple index, mirror-via edge-aligned per the documented seam fix.
Every corpus check runs through BOTH environments — wrapper `loadArchive` and
core-direct `createArchiveCore` on the same parsed model — with JSON-equality
required per direction (one resolver, two environments, behaviorally one).

- **Suite**: `node --test tools/genealogy/*.test.mjs` = **77/77** (fresh run).
- **Pathological dozen 12/12 PASS**, each law asserted on BOTH environments:
  direct up/down (note "direct blood line"), sibling shape
  `s1,h1,s2` + mirror, cousin shape `c1,h2,g,h1,c2` + mirror (F1: endpoints
  once, apex once, via monotone), pedigree collapse one-identity + single
  grandparent entry, cycle → `disputed` + termination + determinism +
  component reported (core-direct AND wrapper read model), co-parent V =
  affinity + `sharedDescendant` + NEVER blood (both directions), spouse-only
  affinity `spouseSteps=1`, ghost frontier = `none` with named refs
  (coverage-not-kinship), unknown-person, self-path, name ambiguity reported
  with candidates (never silently resolved).
- **Corpus pairs × both directions**: 286 pairs (246 seeded-random from all
  10,259 persons + targeted direct-line/spouse/cyclic/founder↔APR/unknown)
  = **572 directed runs, 0 violations**. Buckets: blood-direct 52,
  blood-collateral 34, affinity 484, none 0, unknown-person 2. Invariants:
  determinism (I1), endpoints/via-null (I2), hop alphabet + no node revisit +
  **every hop a real graph edge** (I3), blood climb-then-descend monotonicity
  + apex position + apex is a true common ancestor by independent BFS (I4),
  blood full node-aligned mirror with edge-aligned via flip (I5; 86 blood
  runs), blood preferred whenever independent ancestor sets intersect (I6),
  affinity flags independently recomputed + co-parent V never coexists with a
  common ancestor (I7), `disputed` ⇔ path crosses independent Kosaraju cyclic
  membership (I8), wrapper ≡ core per direction (I9).
- **F2 probe**: 302/302 `personPanel().onBloodline` ≡ `bloodlineSet().has`
  (300-person seeded sample + named + cyclic persons).
- **F3 probe**: duplicate provider ref fails the load naming the ref;
  same-person repeat stays one identity.
- **Zero-import law**: source scan (comments stripped) — no
  import/require/from/`node:` anywhere in `surfaces/archive-core.mjs` code.
- **Diff audit** `0f44ee77..e1948156`: the resolver (`relationshipPath`,
  `climb`, `bloodPath`, `bfs`, `crossesCycle`, `resolve`, `searchNames`,
  `cyclicComponents`) moved **verbatim**; `bloodlineParentward` is a
  character-identical port of `model.mjs`'s `bloodline()` (verified
  line-by-line); wrapper public API keys unchanged; F3 stays construction-side
  BEFORE core construction; `blood.html` untouched (4-file stat).

### One behavior found and CLEARED (disclosed, not hidden)

72 affinity pairs return different route COMPOSITION by direction (same kind,
same length, e.g. fwd spouseSteps 4 vs rev 3). Proven **pre-existing**:
re-running the same pair against `0f44ee77`'s pre-extraction bytes reproduces
the identical asymmetry, and the forward result is byte-identical across the
extraction. BFS over the mixed parent/child/spouse graph legitimately picks
different equally-short middles per direction; no estate law pins route
composition symmetry (kind/length symmetry ARE lawful and held on all 572
runs). Recording it here so the next seat does not "find" it as a regression.
Changing it would be the redesign the dispatch forbids.

## CI state (diagnosed, both reds NOT the extraction's)

- **PR #128 `static` FAILURE is inherited from the lane base**: the failing
  test `e2e/profile-views.test.mjs:284` ("unkeyed archive chrome:
  span>Ragnar Loðbrók (Ragnar Sigurdsson)") fails **identically at `97f18945`**
  (17/18, reproduced locally). The lineage lane's own earlier commits modified
  `surfaces/profile.html` (+164 lines vs the merge base `1aa2cc49`); main never
  touched that file, so the PR merge keeps the branch bytes and stays red.
  Neither `0f44ee77` nor `e1948156` touched `profile.html`. Cure belongs to the
  lane owner (key the span or add it to the record-data carve-out).
- **main's own static red is unrelated**: last 4 workflow runs on main FAIL at
  `§7 identity-check` — commit `f7465f414` (PR #130 merge, 2026-09-19 morning)
  is GitHub-web-authored as 'Travis Remington <…noreply…>' violating
  seats-are-committers-never-authors. A main-side ceremony fix, nothing to do
  with genealogy.
- PR #128 `node` job: SUCCESS. secret-scan: SUCCESS.

## The named commit zGeneUI consumes

**`e1948156`** — already composed verbatim by Beat 2e (`e962b6eb`), so the
consumption contract is closed. No new code commit is warranted by this
verification; this receipt-only commit is this seat's deliverable.

## Boundaries held

No code bytes changed by this seat. No corpus writes. `blood.html` untouched.
No edits to bFUzZ's lane branch or PR #125's stopped branch. Harness stayed in
`.scratch` (uncommitted, per precedent). No claims beyond evidence exercised.

Executed-by: zCode (GLM 5.3)
Seat: zCode verification pass on dispatch "end / Genealogy Archive Core"
Base: `e1948156` (branch `zcode/geneac-verify-2026-09-19`)
