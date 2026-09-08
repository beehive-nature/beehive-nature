# Gallery controls clear of the directory

Founder report: the live Raver gallery showed a wide horizontal scrollbar and a dense fixed directory across the bottom of the artwork controls.

## Diagnosis and change

Browser inspection distinguished the directory's internal overflow from page overflow: at the initial 640px layout, the document was 640px wide, while the fixed `#tbar` held 3,607px of content in a 640px viewport and occupied 74px at the bottom. This was a navigation layout problem, not oversized inscription artwork.

`surfaces/blight/gallery.html` now uses the existing `surfaces/tour.js` inline-host contract, inside a native, initially closed "Explore the estate" disclosure below the gallery. All 57 links observed in the populated directory remain available. Its native summary supports keyboard opening and closing. The same directory and language loaders still run; the language selector now has a visible host beside the main navigation, with a 44px control and colors from the selected view. The footer follows each view's content width.

The first phone-width check caught the status badge retaining a 375px intrinsic width inside a 347px directory. Scoped flex and wrapping rules now let it fit. Neither document overflow clipping nor artwork changes were used. Shared tour/register code, gallery JavaScript, RPC reads, collection identity and SVG bytes are unchanged. The collection rail remains independently scrollable on wide layouts.

## Verification

- Local preview: `http://127.0.0.1:4191/surfaces/blight/gallery.html`, served from the isolated `wt-astra-gallery-layout` worktree.
- Rendered browser checks, each in New bee, Raver and Cypherpunk: requested viewports 390 x 900 and 1440 x 900; actual document widths 375px and 1425px after the vertical scrollbar. Open and close the directory with Enter. At every open state, document `scrollWidth === clientWidth`; directory `scrollWidth === clientWidth` too (347px narrow; 1000px New bee wide; 1345px other wide views). `#tbar` is static, the old floating toggle has zero rendered height, and all 57 links remain.
- On the loaded public collection, Next advances 1/15 to 2/15 and Previous returns to 1/15; New bee's collection dialog opens and closes; the reported FROGGI collection room remains usable in Raver. Keyboard focus is visible on the uncovered controls.
- `node --test e2e/first-click.test.mjs e2e/register.test.mjs e2e/agent-dock.test.mjs e2e/lang-coverage.test.mjs`: 45 passed, zero failed. These Node suites are not substitutes for the rendered checks above.
- `git diff --check`: passed.

The partial-chain-read notice still appeared during this check, with 15 pieces available. This patch does not claim to repair RPC availability or complete the collection. No human usability study or adoption outcome is claimed.

## Release and rollback

This is a small gallery hotfix based on main, independent of the draft first-work release. Candidate CI, publication and served-byte evidence will be recorded on its PR. Rollback is a normal revert of this gallery patch; no storage migration or box operation is involved.
