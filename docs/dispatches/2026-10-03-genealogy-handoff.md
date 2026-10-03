# Genealogy handoff — 2026-10-03

## Status: incomplete user experience; published code is not whole-product completion

Founder requested a proper handoff after opening the full Charlemagne research page and finding no site menu or Wikipedia links. Stop feature work here; resume from this document when requested. Do not describe the flagship dApp as finished.

## First repair: the exact failed journey

URL: https://skaists.dev/assets/profile-archive/lineage/persons/p1790a81049.html

The interactive blood.html person panel was improved, but its “open full research” destination remains an older generated page. Local source confirms no shared menu, no Wikipedia link, and an unlabelled combined list of parents, children and spouses. Provider links lack the required new-tab attributes. This is a missed implementation boundary and acceptance check, not a user navigation mistake.

Generator: tools/genealogy/personpage.mjs, renderPage(). Generated output: assets/profile-archive/lineage/persons/*.html. Repair the generator, then regenerate all published pages; do not patch only Charlemagne. Reuse the person-panel family grouping, canonical grandparent resolver and Wikipedia mapping rather than adding a divergent model. Put a visible site menu and return-to-tree action on direct-load research pages. Show labelled parents, marriages and children with navigable relatives. Keep source classifications under Sources and research notes. Charlemagne and Louis I must have exact Wikipedia articles; other deceased people can have clearly labelled searches. Living people get no external identity search. External links must open new tabs with noopener noreferrer; same-origin navigation stays in the current tab.

Acceptance: open blood.html, choose Charlemagne, press open full research, and verify the destination retains navigation, Donna branch, family grouping and Wikipedia. Repeat for Louis I and direct-load both URLs at desktop and phone widths. Check all three visual registers. A successful panel test cannot stand in for this complete journey.

## What actually shipped

PR342 https://github.com/beehive-nature/beehive-nature/pull/342 — merged 2d1b41c25e9114542fc740b9a7cecf83000beb56.
PR343 https://github.com/beehive-nature/beehive-nature/pull/343 — merged 0d30d1b7675e971abc40101e8d700d6642a77050; current fetched main at handoff.

- Interactive person panels lead with the four-grandparent answer; Charlemagne and Louis I both have a recorded direct ancestor route through Donna Ruth Lawton. Other grandparents have no direct route to these two in this corpus. This identifies the recorded genealogy route, not inherited DNA segments.
- Plain marriage/children groups, expandable full paths, optional chart-root comparison, exact Wikipedia articles for these two people, and research material inside a disclosure.
- Shared Canvas-rendered XYZ Austras koks: rotate, zoom, reset, select people, follow branches, and switch to the existing flat tree. Four clickable grandparent labels fix overlap. This is an initial 3D generation window, not a mature flagship experience or a whole 143-generation overview.
- Versioned assets in blood.html and austras-koks.html.

Pages deployment 37152345313 succeeded for final merge 0d30d1b7. Public browser verified tree rotation, flat/3D switching, four readable grandparent labels, Charlemagne/Donna answer, Louis/Donna answer and exact Wikipedia destinations. Browser later visibly opened Louis_the_Pious in a separate tab. The full generated research page was not repaired by these PRs.

## Validation boundaries

116 focused final tests passed, zero failed: person panel, XYZ projection, tree navigation and blood navigation. GitHub job 111286839525 (run37151729586, earlier app revision e7e25375) succeeded; 625 rendered front tests passed, including bee/raver/cypherpunk 3D rotation, person selection and flat switching. Its overlap output identified the label collision subsequently repaired in PR343. One earlier static assertion required an unversioned import and was corrected in PR342.

Final-main run37152345393 remains in progress at this handoff: static and Rust test jobs passed; eternal, node, meter and wallet remain running. Re-read its conclusion on resume; do not carry this pending snapshot forward as green.

## Workspace and preserved artifacts

Own worktree: C:\Users\travi\wt-codex-genealogy-eternalization. Handoff branch: codex/genealogy-handoff. Commit only explicit owned paths; never add from the shared checkout. Fetch origin first on resume and inspect concurrent changes.

Seven pre-existing modified artifacts in e2e/shots-gux01-blood/ remain uncommitted and hash-verified against C:\Users\travi\family-lineage\genealogy-screenshot-baseline-20261002.json: cold-desktop.png, deeplink1-desktop.png, deeplink2-desktop.png, journey-results.json, person-390.png, person-desktop.png, second-person-fractal.png. Do not reset, regenerate, stage or delete them.

Receipts outside repository: C:\Users\travi\genealogy-final-tests.txt; C:\Users\travi\genealogy-eternal-ci.log; C:\Users\travi\genealogy-3d-live-20261003.jpg. Earlier implementation dispatch: docs/dispatches/2026-10-03-genealogy-family-3d.md.

## Other retained requirements, not claimed completed by this lane

Use GitHub Pages on skaists.dev; keep public browser open; no local server. Continue the original preservation package work from existing receipts, inventorying Hive bIndexer separately from Rust bindexer and reusing Vaulta Reader, bData, bPay and ANT/AR adapters. A previous quote is not current acceptance: obtain a fresh quote only after the final archive rebuild and restored interactive dependencies are verified. No payment or storage upload was authorized/performed by these genealogy UI PRs. Any earlier quote or integration claim requires fresh verification. Preserve 44+ generation exploration, existing genealogy resolver, fan chart and noble collection. The unresolved generated-page journey comes before further cosmetic or feature expansion.
