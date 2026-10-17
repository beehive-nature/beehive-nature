# FS 8-gen privacy PR #346/#347 read-only comparison — 2026-10-16

Founder-directed read-only comparison against current main `3037acc9f`
(repair commit `89950f3a1` verified ancestor). Zero merges, zero PR
comments, zero CI reruns, zero FamilySearch mutations; the browser pane was
not touched. This dispatch is the entire delta.

## The relationship: two generations of the same codex retest loop

- **PR #346** — head `codex/genealogy-privacy-regressions-342-current`,
  10 commits, cut 10-04 against main `8df6986ea`. Carries the three-finding
  repair + regression tests + **tests.yml CI wiring** + its dispatch doc.
  Today: `mergeable: CONFLICTING`.
- **PR #347** — head `codex/retest-342-current-main`, 8 commits, cut 10-05
  against main `a813465d6` (one day later, same retest loop, same three
  findings — its body says all three still reproduced). Today:
  `mergeable: MERGEABLE`, state UNSTABLE.
- Core-file overlap is near-total: `surfaces/tree-of-life.mjs` (~63–64
  changed lines each), `person-panel.mjs`, `blood.html`, `austras-koks.html`,
  `treeoflife-nav.test.mjs`, `blood-tree-of-life.test.mjs`. **#347
  supersedes #346's repair payload** (newer base, clean apply).
- **#346's unique residual** (not in #347): the tests.yml eternal job
  ("Genealogy — spatial tree privacy and branch navigation" running
  `blood-tree-of-life.test.mjs`), the dispatch doc, the
  `austras-koks-eternal.test.mjs` e2e changes, and the "rotate the spatial
  tree, not its root" test refinement. **#347's unique residual**: the
  `personpanel.test.mjs` lock on `grandparentPathHtml`.

## Outstanding privacy regressions on current main — all three CONFIRMED

Evidence is line-level, current main (`3037acc9f`):

1. **Living relatives still enter the tree UI** — `lineView` roots at
   `line.root` and accepts a living focus (`focusId && P[focusId]` with no
   deceased check); living nodes render as anonymous "held" dots. This
   violates the founder ruling recorded in #346's dispatch doc: *"the UI
   starts at the first deceased blood relative in each branch; living
   relatives stay out of the UI."* Honest scope of today's exposure on
   main: structural only — living nodes carry `name: null` /
   `lifespan: null`, get no buttons and no cards (hash-open rejected), and
   the public corpus pseudonymizes living persons. No names leak; the
   count/position shape of held living generations does render.
2. **No spatial focus transfer** — `.tol-space` appears 0× in main's
   `surfaces/austras-koks.html` (1× on both PR heads): the front-door climb
   still focuses flat-only `.tol-node[data-person]` while spatial mode is
   the default.
3. **Grandparent self still renders the empty disclosure** — main lacks
   `grandparentPathHtml` entirely; the "parent-to-child line from X to X"
   `<details>` with empty body persists in `person-panel.mjs`.

No independent landing of these fixes occurred on main: the repair-shaped
commits there (`0c3e36df5`, `412cfb75c`) are dated 10-03 — BEFORE both PRs —
and carry the #342-era partial mitigations (held-dot rendering, card
rejection), which is the weaker shape the findings flagged.

## Merge order recommendation (recommendation only — no merge executed)

1. **#347 first**, after a rebase/retest on current main: it is the
   newer re-cut, applies cleanly today, and carries all three repairs plus
   the personpanel lock. Two named pre-merge hazards: (a) main's
   `austras-koks.html` received the 2026-10-05 register-dressing rework
   AFTER #347's cut — git auto-merges (disjoint hunks) but a semantic
   retest of the focus transfer against the dressed page is warranted;
   (b) ~12 days of main drift since the branch was cut.
2. **#346 second, re-cut as residual-only** (or folded into #347's rebase —
   codex's call as owner): its repair payload is duplicate; its residual
   (tests.yml eternal wiring + dispatch doc + austras e2e + rotate-root
   test) is genuinely valuable — the founder ruling deserves CI teeth.
   If folded, #346 closes with a supersession receipt.
3. **ANT eligibility unchanged**: restoring #346's OPEN state restored its
   review process, not its qualification. Before ANT publication becomes
   eligible: the repairs must actually land on main, with regression
   evidence and exact-head CI green. This comparison confirms the gate is
   substantive — none of the three protections is on main today.

## CI status (honestly bounded)

Both heads' latest checks date from 10-04/10-05 runs — `eternal` and
`static` red on both (plus one wallet red on a #346 run). These predate
~12 days of main movement; per the inherited-CI-hold law, classification
(inherited vs own) belongs to the rebase retest on fresh exact heads, which
is the owner's next step. No merge recommendation here rides on stale
checks.

## Ledger

Read-only throughout: no merges, no PR comments, no labels, no CI triggers,
no browser touches, no corpus writes, no FamilySearch mutations. The frozen
809-person harvest and the terminal image queue remain untouched.

— zCode seat, order27 privacy-gate comparison, 2026-10-16
