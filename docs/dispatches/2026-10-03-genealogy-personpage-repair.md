# Genealogy person-page repair — 2026-10-03

## Status: delivered to main; the unresolved generated-page journey from the
## handoff is resolved. No PR — founder order mid-lane ("NO MORE PR'S …
## JUST COMMIT YOUR WORK"): work committed from the zCode worktree and pushed
## directly to main.

## The repair

The handoff (docs/dispatches/2026-10-03-genealogy-handoff.md, 253bcffc1)
named the exact miss: PRs #342/#343 improved blood.html's interactive person
panel, but its "open full research" destination stayed the older generated
page — no site menu, no return-to-tree, no Wikipedia, no grandparent branch,
unlabelled parents/children/spouses mixed in one list, provider links
without the new-tab law. Repair executed as specified there: the generator,
then every page — never a Charlemagne-only patch.

## What shipped

Commit 3508c59ec on main (pushed directly; first attempt a3f55d517, rebased
twice over a concurrently pushing vending seat).

- tools/genealogy/personpage.mjs rebuilt. ONE MODEL: familyGroups,
  grandparentBranches and wikipediaLink are imported from
  surfaces/person-panel.mjs — the same functions blood.html mounts; no
  divergent family model. The staged object contributes only
  research/publication wording and the generatedFrom receipt.
- All 11,041 research pages regenerated (206 MB total, avg ~19 KB; full
  unelided branch chains are the product — the 44+ generation exploration
  stays whole).
- Every page: estate crumbs (reserve → dynasty profile → blood comb →
  person), a return-to-tree action reopening blood.html#p=<id> with the
  person selected, the shared site menu via surfaces/tour.js?v=42 (register/
  language/rails riders included), the four-grandparent answer with the
  direct branch named and its full hop chain in a disclosure, labelled
  parents/marriages/children with navigable relative pages, sources and
  research notes kept classified (era ≠ support), ghost parents as counts,
  and the coverage sentence. Wikipedia: exact articles for Charlemagne and
  Louis I; clearly labelled search for other deceased people; living people
  get no external identity search. Every off-site link hand-carries
  target=_blank rel="noopener noreferrer" and says a new tab opens;
  same-origin links keep the current tab.
- New battery tools/genealogy/personpage.test.mjs (10 tests) runs in CI's
  node job with the rest of tools/genealogy: orientation contract,
  exact-vs-search Wikipedia law, living-privacy leak check (founder/liv-1/
  liv-2 carry zero external anchors), Donna branch answer for both named
  emperors, labelled family groups, new-tab provider links, same-origin
  current-tab law, a ~300-page stratified link sample, and a
  generator↔output sync check so future drift fails in CI, not in the
  founder's browser.

## Validation

- Local, pre-commit: node --test tools/genealogy/*.test.mjs → 487 pass,
  0 fail. Whole-run scan: 0 missing relative targets, 0 external anchors
  without the law, 0 pages missing crumbs/menu/back-tree.
- CI on 3508c59ec (run 37155290228): secret-scan, static, test (Rust),
  wallet, meter, node ALL SUCCESS — node includes the 487-test genealogy
  battery with the new contract tests. eternal FAILED on one PLUR festival
  lazy-load test (bee variant) — the same test failed raver+cypherpunk
  variants on 0d30d1b76 before this commit; different variants per run with
  identical code = timing flake, inherited, in PLUR surface territory this
  lane never touched. Failed job rerun: run 37155290228 concluded SUCCESS —
  the flake did not reproduce, and main's full battery is green on 3508c59ec.
- Pages deployment for 3508c59ec: SUCCESS.
- Public-browser acceptance (playwright against skaists.dev, no local
  server), all under the live deploy:
  - blood.html → search Charlemagne → open full research → destination
    keeps crumbs, back-tree, site menu, the Donna branch ("Through Grandma
    Donna Ruth Lawton" + 37-hop chain), the Hildegard marriage with Louis
    grouped as the couple's child, exact Wikipedia link labelled "(new
    tab)". Clicking it opened en.wikipedia.org/wiki/Charlemagne in a popup
    while the research page stayed put. Zero page errors.
  - Same journey for Louis I: exact Louis_the_Pious article, Donna branch,
    marriage block, navigable child. Zero page errors.
  - Direct loads of both URLs at 1280 px and 390 px: no sideways scroll,
    menu/crumbs/back-tree present in all four combinations.
  - All three registers (bee/raver/cypherpunk, 390 px mobile contexts,
    localStorage bregister): the full journey completed with the register
    applied on the research page, every marker present, zero errors.
    Live receipt: C:\Users\travi\genealogy-personpage-live-20261003.jpg.

## Boundaries not crossed

No payment, storage upload or quote work — untouched, per the handoff. The
honesty lines (era ≠ support, coverage-not-contradiction,
route-not-DNA-segment, affinity-never-blood) ship on every page. Living
people: redacted stubs, no external identity search, provider refs absent
both in the archive view and on the rendered page.

## Open items (next owners)

- The PLUR festival eternal flake (e2e/plur-festival-entry.test.mjs) —
  owner: PLUR lane. First seen failing on main runs starting 0d30d1b76
  (2026-10-03 20:39Z); this lane's rerun receipt is above.
- Preservation-package continuation (bIndexer Hive vs Rust inventory,
  Vaulta Reader/bData/bPay/ANT-AR adapter reuse, fresh quote only after
  rebuild + interactive dependencies verified) — carried from the handoff,
  not started here.
- Austras koks 3D window remains an initial generation per the handoff's
  own boundary; no cosmetic expansion was done on this lane.
