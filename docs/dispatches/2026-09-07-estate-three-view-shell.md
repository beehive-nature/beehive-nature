# Shared three-view shell — 2026-09-07

Founder requested the prominent New bee / Raver / Cypherpunk control on every page. Grok owns social/marketing presentation; Astra owns the common shell. Claim and coordination: issue #10, comment 5566044713. This implements the shell, not three newly authored bodies of content on every page.

## Behavior

- `surfaces/register.js` reuses the hub's `data-register-host`, or inserts one in-flow top bar and a home link beside the shared script's URL. Centered row-flex pages mount the bar inside their main column, preserving the body layout. It no longer hides the choice at the end of the bottom navigation or floats over the page.
- New bee is the default. The existing `bregister` storage key, `body[data-reg]` and `bregister` event remain the integration contract. Invalid/blocked storage has a usable fallback; other tabs and storage clearing synchronize the choice. Native named buttons have explicit `type=button`, 44px minimum targets, rem-based text, focus outlines, pressed state and a check mark.
- The bar has three component-scoped palettes/type treatments. It does not recolor data encodings, change permissions, infer facts or duplicate page engines. Page-specific content variants continue using `data-reg`; common facts and actions should remain unmarked.
- `tour.js` waits for register loading before starting language loading, including an error fallback. Existing corpus keys name the buttons and description. `lang.js` only adds the new bar to its existing chrome exclusion; no corpus, coverage floor or translation-meaning changes.
- The hub delegates its button styling to the same shared component. Atlas CSS cache version is 2; register 7, language 22, tour 37. Generator templates preserve the current tour version.

## Coverage and preservation

The source inventory is 93 counted estate pages plus nine registered hosted art derivatives = **102 current registry pages**. All 102 now resolve exactly one tour loader to the shared file. Nine pages previously had no loader: ant-door, doors/beehivenature-buzz, doors/skaists-buzz, local-agent/index, plur, privacy-lens, profile, vending and watch (all `.html`). Those get one script tag; other page edits are cache versions only.

The other nine HTML files are the preserved originals under `surfaces/fleet/`, not current registry destinations. They remain byte-identical. `surfaces/forge/orbit.html` also remains pinned, retaining its old cache key while loading the current shared tour path. A returning visitor can retain a cached older rider on that frozen artifact; the freeze gate is not repinned to conceal it.

This receipt concerns the monorepo's current surfaces. Grok's internal `docs/mvp-walk` board and independently deployed applications in other repositories are separate consumers, not silently counted as covered. Same-origin preference does not imply cross-domain or cross-device synchronization.

## Verification

- 37 focused Node tests pass: 11 new shared-control behavior/coverage checks plus 26 existing atlas, dock and language checks.
- New tests execute the shipped control at a small DOM boundary: defaults, all choices, event contract, saved/denied storage, cross-tab clearing, duplicate startup, existing host, corpus-key labels, native form safety and custom/project-origin home links. The source walker validates every current registry page, including hosted art derivatives.
- Estate registry and CI-shape checks pass; syntax and diff-whitespace checks pass. Frozen orbit verification passed during cache updates.
- HTTP preview response: 200 at `http://127.0.0.1:4176/surfaces/profile.html`.
- Independent source review caught a centered-row layout regression on the hardware and recovery pages. Mounting in their main column fixes the source-level cause; an additional DOM-boundary regression covers that choice. Committed-tree checks, repository CI and deployment verification are recorded in the PR/issue receipts as they complete. No browser interaction, visual QA, full translation review, live social-message tests or production box edits were performed for this source receipt.

## Delegation and handoff

Astra: existing lead session, inherited model/effort, no override. `grok_social_map`: one existing read-only worker session, inherited model/effort, bounded independent review only. No duplicate implementer or paid model/infrastructure purchase.

Grok continues its own social/marketing slice and uses the shared contract above. PR #12 remains independently reviewable; this lane touches its two HTML pages only at the cache tag. Its source-review findings about readable regular text, unkeyed copy and duplicate action destinations remain in the prior review docket. Its new 4178 preview is distinct from Astra's 4176 tree.

Rollback is a descendant revert of this lane's commit, with a new rider cache version when publishing. Revert the shared files, added loaders and templates together; never force-push or alter the art pins.

## Ready social slice integrated

After the founder relayed Grok's ready PR #12, Astra integrated its remote head 8bdff22c with the shared shell. The remote version fixes the earlier tiny arrival text and duplicate choose-card destinations. Its own dispatch names the new English-only prose; translation work is handed to Grok/zCode in issue #7, comment 5566192469. The two page bodies remain Grok's contribution.

The sole merge conflict was the static CI command; it now runs both the shell and social suites. The shared-shell candidate bf969a84 passed all 8 repository checks before this integration. The combined candidate runs fresh CI before publication. This supersedes the earlier separate-PR integration status, not the source/translation limitations.
