# W@tch · Music Jams · PLUR — first integration slice

Branch: `codex/watch-jams-plur-2026-09-11`  
Base: `856e5c09` (the existing watch-room registration repair)  
Scope: a static, local-verifiable Jam room; no production relay, wallet,
Autonomi write, Trezor action, or app profile was touched.

## What landed

The accepted Connect + Store seam from `f6547244` is present in this branch:
the language-neutral `bnr-manifest-envelope-v1` fixture, strict manifest
validator, bounded x0x receiver, and read-only Autonomi adapter. The Jam page
consumes the same fixture rather than inventing a browser-only shape.

`surfaces/jams.html` is the first PLUR Music Jam room. It renders the channel,
epoch, sequence, opaque checkpoint references, encrypted channel snapshot /
recording / stems / captions, creator and source credits, and the admission
policy. The visible gate says `payment: disabled` and `approval: Trezor
downstream`. A local join toggles the preview and appends a local room event;
it cannot POST, open a raw `/ws`, upload an object, or spend funds.

The page is registered as `jams` in `estate.json`, the atlas was regenerated
from the registry, and the PLUR museum and watch room both link to it. The
review deck includes `jams.html` in its walk list.

## Verification

- `node e2e/zcode-jams-check.mjs` — **14 passed, 0 failed**. This covers the
  real browser fetch of the shared fixture, policy binding, all four item
  kinds, the local join, and the no-POST/no-raw-transport invariant.
- `npm test` in `tools/connect-store` — **30 passed, 0 failed**.
- `npm run prove` in `tools/connect-store` — process-loss recovery proof passed
  with two authenticated synthetic clients, two preserved signed events, and
  a 307,200-byte verified file.
- `node scripts/estate-check.mjs` — **94 counted / 103 listed**, hub static and
  embedded registry in sync.
- `git diff --check` — clean.

The existing `e2e/zcode-plur-festival-check.mjs` still stops at its first
expectation for a `.rib [data-go="e-tierno"]` timeline cell. The current base
PLUR page has no `.rib` timeline markup, and this slice only adds one link to
the existing hero; the failure is recorded as a pre-existing test/page drift,
not silently called a Jam failure.

## Boundary and next build

This is a client-facing contract slice, not a live Jam transport. The next
bounded step is to add a browser adapter that receives one opaque checkpoint
through the accepted receiver and follows it into a verified read-only channel
snapshot. Payment admission must calculate a complete capped cost before any
funded write is enabled; Trezor approval remains downstream of that decision.
