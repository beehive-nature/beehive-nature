# Forge room: three presentations and a working second-tab join

2026-09-07 · Astra integration of Grok PR #24, reviewed at `7841967b` against main `b1527486`.

The room opens as a cream New bee studio, becomes a vivid instrument in Raver, and exposes its technical context in Cypherpunk. The same canvas, controls and composition survive view changes. New bee has a single **Open a second tab** action, visible seed label, large controls and expandable explanations. The light navigation retains every destination; the duplicate floating beta navigation is removed.

## Review findings and repairs

Grok's original head had eight successful checks. Its entire art CORE and module matched main, so the presentation work did not introduce the following runtime defects. They nevertheless affected the second-tab experience being offered:

- **Late arrivals missed history.** BroadcastChannel carried only future deltas, and each arriving tab wrote the default seed. `forge/visual/shared.js#createSharedPiece` now exposes `snapshot()`, and the room requests complete document state on arrival and merges it alongside ongoing deltas. The default seed is a rendering fallback, never an automatic document write. Existing binary delta messages retain their format. This follows the [Yjs document-update API](https://docs.yjs.dev/api/document-updates): `encodeStateAsUpdate` supplies a complete update that `applyUpdate` can merge, including when a later delta arrives first.
- **Controls could appear usable before they worked.** The room disables its own controls during imports, with a visible loading status and a ten-second limit. Import failure, missing BroadcastChannel, or a failed channel constructor now leads to an interactive local field and an explicit sharing error. A partially constructed channel closes. No server, account or remote fallback is introduced.
- **Displayed controls could disagree with the composition.** Rendering now synchronizes sliders and the seed from document state. An active seed draft remains intact until its change or blur; Roll updates the visible value too.
- **Navigation restoration needed the same care.** Channels and presence timers close on pagehide. A restored shared page requests missed history. A restored local fallback keeps its local composition and remains local, even if sharing subsequently becomes available; it never silently replaces that work with a fresh document.

The marked hexfield CORE is byte-identical to both reviewed inputs. Yjs in the room remains **13.6.20**. The test dependency is now pinned to that same version, replacing its previous floating `^13.6.0` range and resolved 13.6.32. `shared.js?v=2` ensures the updated room receives the snapshot API. This is an additive provider method; other shared-piece consumers retain their existing contract.

## Copy, language and limits

The visible boundary remains **this browser only**. Changes live in the tabs and are not saved. Private windows, browser profiles and different site origins remain separate. Technical details explicitly say that LiveKit is planned and that this page does not connect people across devices. Concurrent same-control edits converge; the copy does not promise that wall-clock order decides the winner or that work persists forever.

Twenty-three new `room.*` strings have English plus 28 docked language drafts: 667 nonempty cells, bringing the corpus to 822 keys. Existing translations, attestation records and founder language order are unchanged. Native review remains open, especially Scottish Gaelic, Cyrillic Tatar and Sanskrit browser/control/color vocabulary. Technical prose, canvas metadata and some accessibility text still use English; this is not a claim of complete translated-page acceptance. Dynamic status and presence labels preserve their English fallback when languages change.

The cache chain advances corpus 15→16, language loader 23→24 and tour 39→40. Generator sources and generated Home agree. The freeze-aware rider script updates current pages; original fleet files and frozen `forge/orbit.html` remain untouched.

## Validation and release boundary

- Front-door source/VM suites: **82/82**.
- Actual room-module fixture with real pinned Yjs and a queued channel bus: **15/15**. This covers late join, simultaneous startup, bidirectional edits, blocked imports, timeout, channel-constructor failures, seed focus, Roll, page restoration and local-state preservation.
- Shared-piece convergence/API checks: **9/9**, including out-of-order delta before snapshot and duplicate snapshots.
- Art CORE checks: **72/72** across six existing copies; the room's CORE also compared byte-for-byte with main and PR #24.
- CI shape: **34/34** guarded suite steps. The shared/core/room runtime checks now run in the static CI job alongside the presentation tests.

An initial restoration regression failed with expected seed `my-local-composition`, actual `hive-1000`: a failed reconnect copied a newly empty document over local work. The explicit local-fallback restoration branch fixes that failure. An intermediate cache check saw `tour.js?v=39` while the rider sweep was still running; after completion, all current-page loader checks pass. No test was relaxed to accept either defect.

Two existing local agent sessions were reused for bounded source/runtime and language work; no new fleet was launched. Validation here is source execution and protocol simulation, not a rendered-device or matriarch acceptance claim. Existing remote browser CI remains a release gate. The integration PR must pass its own eight checks before main advances; Pages completion and served-byte verification are recorded on PR #24 and coordination issue #10 after publication.

No production box, mesh transport, wallet, publishing account or social-message path is changed by this lane. Grok keeps social journeys and marketing; Astra keeps the shared theme and integration. Existing room tabs should both be reloaded once after release so they use the same snapshot-capable client. Closing every tab discards unsaved work.
