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

## W@tch parity slice

The existing W@tch page now projects the same manifest contract beside its
room iframe. The page keeps its one-file deployment shape, so its small
browser validator is inline; the shared module at
`surfaces/manifest-reader.js` is used by the Jam page and carries the full
strict shape checks. W@tch only reads the fixture, shows channel/sequence,
bounded checkpoint identity, and encrypted item count, and leaves the live
HLS, room, meter, and pause-not-kill paths unchanged.

`node e2e/zcode-watch-manifest-check.mjs` — **6 passed, 0 failed** — proves
the W@tch projection against a local fixture server and asserts that it emits
no POST and opens no raw `/ws`. The Jam check remains **14 passed, 0 failed**.
The hosted Node job runs both projections and the encrypted Store proof after
the pinned Playwright setup.

## Browser encrypted Store read slice

The Jam now has an explicit browser adapter in `surfaces/store-reader.js`.
Given an explicit gateway origin and one manifest reference, it performs only a
bounded `GET /v1/data/public/:address`, rejects credentials, redirects, unsafe
endpoints, oversized responses, malformed base64, size mismatches, and SHA-256
mismatches, then returns the verified ciphertext bytes to the caller. It does
not POST, upload, charge, open a raw x0x socket, or decrypt bytes itself; the
future Autonomi WASM decryptor remains a separate client-side boundary.

`surfaces/jams.html` exposes this only when a `store` endpoint is explicitly
provided. The default page remains an offline manifest preview. The status
distinguishes `manifest verified` from `N encrypted objects verified`; neither
state claims plaintext access. This preserves the operator boundary: an HTTPS
gateway may observe IP, object reference, timing, and traffic metadata, while
the browser is responsible for decryption and final content use.

`node e2e/zcode-jams-store-reader-check.mjs` — **9 passed, 0 failed** —
proves four bounded object reads, browser-side digest verification, the
no-write/no-raw-transport invariant, and a tampered response that fails closed
without changing room state. The existing Jam and W@tch checks remain green.

## Boundary and next build

This is still a client-facing read slice, not a live Jam transport or a
decrypted production media path. The next bounded step is to connect the
browser adapter to one opaque checkpoint from the accepted receiver, follow it
into a verified read-only snapshot, and then add the Autonomi-compatible WASM
decryptor as a separately tested client boundary. The current W@tch production
deployment is still the runbook's one-file `/srv/watch/index.html`; publishing
the fixture endpoint and adapter module alongside that file is part of the
deployment step before the new card is expected to show `verified` on the live
box. Payment admission must calculate a complete capped cost before any funded
write is enabled; Trezor approval remains downstream of that decision.
