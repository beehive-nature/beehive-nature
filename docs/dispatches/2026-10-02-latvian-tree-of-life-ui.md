# Latvian Tree of Life UI — lane dispatch

Date: 2026-10-02  
Lane: `codex/latvian-tree-of-life-ui`

## What changed

`surfaces/blood.html` now opens on **Austras koks**, the interactive Latvian Tree of Life already developed in `surfaces/tree-of-life.mjs` and proven on `surfaces/austras-koks.html`. The page derives the tree from the same public genealogy corpus and the same `fetchArchive()` resolver used by the evidence panel. It does not create a second family model.

The first view now lets a visitor:

- see the private founder stub as the trunk while living people remain unnamed;
- touch a named relative to open a research card;
- follow that relative's branch so the person becomes the new trunk;
- open the full person panel for evidence standing, claims, relationships, source records, uncertainty, and archive links;
- switch to the existing pedigree, fractal, or tree research maps without losing the selected root or person.

The Tree of Life and atlas mirror root and person navigation through an explicit `onContext` seam. A cold visit uses the founder stub as the shared home root. Existing person/root deep links retain their serialized atlas context.

## Blank local-file recovery

The screenshot that triggered this lane opened `blood.html` as `file://`. Browser module and JSON fetch rules prevent that path from loading the 11,041-person corpus. The page now paints a real tree silhouette immediately and gives an exact local-server recovery message instead of leaving a blank white field. Hosted and local HTTP visits upgrade that shell into the live tree.

## Privacy and evidence boundary

The mount rebuilds the already-published public tree, then runs `validate(tree, { public: true })`. Any living-name, unsourced culture-claim, roots, or line privacy problem refuses the interactive mount. The UI says “published parent relationship with its own evidence standing”; it does not upgrade a walked link to documented fact or invent a confidence score.

## Verification

- `node --test e2e/blood-tree-of-life.test.mjs` — **2/2 pass**: primary Tree-of-Life world, person research, branch re-root, atlas handoff, and `file://` recovery.
- `node e2e/gux01-blood-journey.mjs` — **39/39 pass**: existing selection, root, representation, history, deep-link, panel, rail, and phone behavior after the new front door.
- `node --test tools/genealogy/treeoflife-nav.test.mjs tools/genealogy/bloodatlas.test.mjs` — **59/59 pass**.
- `node --test tools/genealogy/bloodnav.test.mjs tools/genealogy/lifespan.test.mjs tools/genealogy/treeoflife-nav.test.mjs` — **65/65 pass**.
- `node --test e2e/austras-koks-eternal.test.mjs` — **6/6 pass**.
- `node --test e2e/blood-eternal.test.mjs` — **9/9 pass**.
- Live Chromium inspection at 1440x1000 and 390x844 found no page or console errors and confirmed named nodes, held living nodes, branch controls, person research, and atlas switching.

## Eternalization boundary

The previously quoted privacy-safe archive included `surfaces/blood.html`. These UI bytes supersede that tar and its ant v0.3.9 quote. No payment or upload occurred in this lane. Before eternalization resumes, rebuild the privacy-safe package and request a fresh quote against these committed bytes.
