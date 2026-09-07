# Kandi integration — gift identity, saved arms and usable recovery

2026-09-07 · Astra integration seat · base `832bdf83`; Grok PR #29 reviewed at `b85e108f`, after the independent comment on `50c4c697`.

## What is integrated

Grok's deliberate handoff, preview-before-Keep, Unicode names, full export memories and three-view presentation are retained. This integration repairs the remaining state and clipboard failure paths and puts the kandi suites in the actual push/PR workflow. The shared cache chain advances to tour 41 → language loader 25 → corpus 17; register remains 9. Other estate HTML changes are cache references only. Frozen orbit, original fleet artwork, bracelet drawing and the comet drawing remain unchanged.

## Review findings and repairs

- `surfaces/kandi.html`, former `mergeStates` / `save`: a fixed left > crossing > right union resurrected an offered piece after Take back, even with a delivered storage event. Assigning the merged state before a failed write also made splice/pop rollback affect a different array. `commitChange` now locks `bnr-kandi-store`, reads a fresh validated snapshot, changes a private candidate, writes once, and only then publishes a detached committed state. Storage events replace from fresh bytes and never union stale arms.
- `parseState` / `initializeStore`: whole records are validated. Malformed or unreadable saved arms are preserved and visibly refused, not overwritten with a welcome. Legacy missing crossing arrays, stranded `rcv:false` pieces and short memories migrate under the same lock. A denied read is never treated as an empty store.
- `openCross` / `#xdo`: an already-kept incoming string cannot retire another offered piece or duplicate the left arm. Current identity and both sides are checked inside the transaction. Receive is idempotent against the latest committed state.
- `copyText`, gift, crossing and Show handlers: callbacks belong to the operation that started them. A late clipboard rejection for gift A cannot replace gift B's text. Exports remain readonly and selectable. A new explicit copy after completion keeps the completed status. Close or pagehide cancels the prepared operation; animation never commits a handoff.
- `renderMemories`: completed gifts have an ordinary expandable recovery card with their exact export and a copy action, available after reload. Copying a memory neither restores the bracelet to the arm nor proves receipt. Older memories explicitly say when no full export exists.
- New bee: inherited light canvas, readable semantic text colors, larger labels, persistent form labels, 44px controls, focus outlines and native recovery disclosures. View changes preserve work and manual disclosure choices. Art color constants and drawing functions are preserved.

## Verification boundaries

`e2e/kandi-state.test.mjs` exercises the extracted production adapter in Node VM: stale tabs, Take back, repeated retirement, denied reads, malformed records, quota failure, legacy migration, Unicode export identity, lock timeout/reentry and detached commit state. `e2e/kandi-handlers.test.mjs` exercises the production handlers with deterministic DOM/clipboard boundaries. These are executable source checks, not screenshots or human acceptance.

`.github/workflows/tests.yml` now runs the kandi views/state/handler suites in static and all five existing Chromium suites — gift, arms, crossing, arrival and thread — in the node job. Every suite has `if: always()`; the workflow shape check counts 39 guarded suite steps. The gift storage-denial fixtures patch `Storage.prototype.setItem`, so refusal is actually injected instead of relying on an instance assignment. Remote CI results and the deployed commit are recorded in the integration PR/release comment. Local browser testing was not performed.

Source and registry checks pass before publication. A release requires all eight candidate push/PR checks green, guarded fast-forward publication to main, successful Pages build and served-file comparisons. A prior eight-green PR run without these suites is not accepted as gift verification.

## Limits kept visible

The lock coordinates cooperating tabs of this same origin only. Older open page versions do not use it: reload all kandi tabs after upgrading. Without Web Locks/timeout support, saved arms remain readable and writes are refused with a visible explanation. A pending write is bounded to one action per page with a three-second lock wait. This is not cross-device storage, a remote atomic exchange, an inbox, exclusivity or an authenticated receipt. FNV remains a checksum, not a signature.

KND1 encoding is not version-bumped. Current readers preserve Unicode names; older ASCII-only readers may refuse them. The seven new Grok corpus keys cover all 29 docked languages as machine drafts. Existing corpus rows and attestation metadata are unchanged. Other unkeyed kandi prose, including new recovery explanations, remains English fallback; this receipt does not claim complete translation or human attestation.

Issue #27 remains open. Creative PR #28 is a separate draft; review feedback was returned at https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5575327549. Its storyboard, reconstructed marks and blank observation forms do not establish finished continuous PLUR animation, original founder artwork or completed field research. No production box, mesh, funds or campaign publication is changed by this lane.
