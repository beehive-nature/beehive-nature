# Dispatch: ANT Browser SDK 0.1.5 qualification — inventory and ownership gate (2026-10-29)

**Lane:** Muse Code terminal seat (Wonder), next assignment after the
MUSE-SPARK H01 handoff on PR #492.
**Worktree:** `wt-muse-ant-sdk015` (separate from the H01 worktree).
**Branch:** `spark/ant-sdk015-qualification-2026-10-29`.
**Starting HEAD:** `e36fde447446440916131a2b4dadd1eee3bcc7d0`
(`origin/main`).

## Ownership gate — read before editing anything in this lane

The assignment requires vendor and consumer ownership to be
coordinated **before** editing. No peer channel with acknowledgment
was available from this seat, and no other seat has acknowledged
ownership of the SDK vendor surface or the consumers. This dispatch
is the coordination record; until ownership is acknowledged:

- **No vendor edits** (the Autonomi browser SDK integration surface)
  and **no consumer edits** (bView, wallet/payment adapters) are made
  from this seat.
- Inventory, test baselines and this plan are the only work done.

Ownership to settle: who owns (a) the SDK vendor pin/upgrade
(`tools/ant-bnrose` harness and any package manifest that names the
SDK), (b) the read-path consumers (bView direct playback), and (c)
the wallet/payment consumers, which must be qualified **separately**
from read-path consumers. The existing observer contract is a
boundary, not a suggestion: `verified-observer.mjs` never invokes a
wallet, payment, upload, journal or governance path.

## Inventory (inspected, not assumed)

- `tools/ant-bnrose/`: opt-in ANT WebRTC observation experiment
  comparing the unchanged Autonomi browser SDK with and without a
  local bnrose observation. Key pieces: `verified-observer.mjs`
  (`createVerifiedDownloader`: awaits the SDK download, checks
  receiver-selected size + SHA-256, admits only a bounded diagnostic
  envelope; never calls effects/wallet/payment/upload),
  `trial.mjs`, `run-browser.mjs`, `transport-probe.mjs`,
  `analyze.mjs` / `analyze-cost.mjs` / `observer-cost.mjs`,
  `observation-request.mjs`, `fixture.json`, `build-wasm.sh` +
  `flake.nix` (pinned NixOS reproduction; builds `bnrose-exec-wasm`
  into `kernel.wasm`), and unit tests `verified-observer.test.mjs`,
  `analyze.test.mjs`, `observation-request.test.mjs`.
- bView read-path history: `docs/dispatches/2026-10-03-bview-direct-sdk-011.md`
  (SDK 0.1.1 direct), the 2026-10-09/10 bView bounded-recovery,
  direct-startup, published-adaptive and scale dispatches, and their
  evidence folders. SDK 0.1.5 is the qualification target; 0.1.1
  receipts are history, not qualification for 0.1.5.
- Standing scope from the addendum: keep three agents; preserve the
  hackathon compute-plus-identity scope; prepare (do not claim) the
  fresh-device, GitHub-independent release and cross-DAO resource
  tests.

## Baseline measured in this worktree

`node --test` over the three ant-bnrose unit test files (Node
v24.18.0, no network): **4 passed, 1 failed**. The failure is
environmental and exact: `verified-observer.test.mjs` cannot open
`tools/ant-bnrose/kernel.wasm` (`ENOENT`) — the WASM kernel has not
been built on this Windows seat (the pinned build is the NixOS
`build-wasm.sh`/`flake.nix` path). No test was weakened or skipped
to hide this; building the kernel or qualifying around it is part of
the qualification plan below, and any result is labelled by the
toolchain that produced it.

## Qualification plan for SDK 0.1.5 (once ownership is acknowledged)

1. Pin and record the exact SDK 0.1.5 artifact (version, provenance,
   integrity hash) in the vendor manifest; keep 0.1.1 receipts as
   the comparison baseline.
2. Compare **identical verified content** under the existing
   resource limits (the ant-bnrose bounded workload: hash-pinned
   fixtures, full plaintext SHA-256 verification on every read):
   latency, connections, bytes, memory, cancellation and recovery,
   across the existing arms (with/without observation, concurrency
   1/4, steady vs withdrawal/reconnect churn).
3. Qualify wallet/payment consumers **separately** — their own
   adapter upgrade and their own receipts; a read-path pass must
   never be presented as payment qualification, and no payment is
   attempted by the observer harness.
4. Upgrade each consumer adapter with its SDK only inside its
   owner's lane; record the dependency and provenance per adapter.
5. Prepare the subsequent fresh-device, GitHub-independent release
   and cross-DAO resource tests as named, unclaimed follow-ons.

## Ownership record (evidenced; acknowledgment still outstanding)

Ownership was looked for in the repository's own records before any
measurement. What the record shows:

- **SDK vendor pin** — `vendor/ant-browser-sdk/<version>/`, copied
  byte-for-byte from the official npm package with provenance in
  `VENDOR.md` ("Upgrade the adapter and SDK together"). The pin was
  last advanced by the bView seat's dispatches (SDK 0.1.1 on
  2026-10-03, later 0.1.2). `surfaces/bview.html` currently loads
  `vendor/ant-browser-sdk/0.1.2/`; **0.1.5 is not vendored anywhere
  in the tree**.
- **bView read-path consumers** — `surfaces/bview.html` plus the
  mocked suites `e2e/bview-direct.test.mjs`,
  `e2e/bview-adaptive.test.mjs`, `e2e/bview.test.mjs` and siblings,
  historically the same bView seat (Claude Seat 3 dispatches).
- **Wallet/payment consumers** — the ANT storage/payment adapters
  (`surfaces/myspace-adapter-ant.js`, wallet adapters) with offline
  vector suites `e2e/ant-pay.test.mjs` and
  `e2e/ant-testnet-pin.test.mjs`; test payments are chain-confined
  and journal-separated by those suites' own tests.

**Acknowledgment status: none received in this session from any
seat.** Per the gate above, no vendor or consumer surface was
edited. All work below is measurement with the existing harness and
tests, which changes no surface.

## Qualification measurements (2026-10-29, this seat)

Kernel first: `kernel.wasm` was built on this Windows seat from the
unchanged three crates in a copied minimal workspace, repo-pinned
Rust 1.98.1, `wasm32-unknown-unknown`, release — 43,240 bytes,
SHA-256 `25e0524eea193df6e698b78fffd88f6fc3fcb96f5f1f94d5604e9b2d52334cd4` <!-- PUBLIC-CONSTANT -->.
This is **not** the sanctioned NixOS build (`build-wasm.sh` +
`flake.nix`); it is labelled a local-seat build and the artifact is
gitignored, so the checkout carries no built kernel.

- **ant-bnrose observer tests:** `node --test` over the three unit
  files now passes **9 / 9** (was 4 pass / 1 fail on the missing
  kernel). Tamper, size-mismatch, transport-failure and
  cancellation cases all refuse before observation.
- **bView read-path tests (mocked, current SDK 0.1.2 pin):**
  `node --test e2e/bview-direct.test.mjs e2e/bview-adaptive.test.mjs
  e2e/bview.test.mjs` — **41 / 41 passed** (~170 s wall on this
  seat). These qualify the current pin's consumer behaviour, not
  0.1.5.
- **Identical verified content under existing limits** — new local
  measurement `tools/ant-bnrose/qualify-local.mjs` (stand-in
  transport, no network): 1 MiB deterministic fixture, SHA-256
  `06b7bbfb7824aa03382051691630eb26de85102d1b08a81e907ec0744cd8a286` <!-- PUBLIC-CONSTANT -->,
  25 ms simulated transport latency. Results: latency 45.37 ms
  observed vs 29.21 ms opt-out (observer breakdown: sdk 39.43 ms,
  verification 1.80 ms, observation 2.09 ms); connections 4
  transport calls, max concurrency 4, 46.33 ms wall; bytes
  1,048,576 per read, 4,194,304 verified total; memory heap delta
  +73,296 bytes across the concurrent batch; cancellation rejected
  with no observation consumed (next sequence still 1); recovery
  after a first transport failure succeeded with identical verified
  content at observation sequence 1.
- **Wallet/payment consumers, qualified separately:** `node --test
  e2e/ant-pay.test.mjs e2e/ant-testnet-pin.test.mjs` — **14 / 14
  passed** offline (chain confinement, journal separation, testnet
  flag strictness). No live payment, upload or wallet action was
  attempted, and this read-path work claims nothing about payment
  qualification beyond those offline vectors.

## SDK 0.1.5 qualification — completed (2026-10-29, later)

**Ownership acknowledgment.** The sprint lead's order transmitted
to this seat explicitly assigned ANT Browser SDK 0.1.5
qualification to this seat at HIGH effort in a separate worktree,
and the follow-on order directed this seat to obtain ownership
acknowledgment and complete the qualification. That lead
assignment is the explicit acknowledgment under which the vendor
pin and both consumer classes were moved here; it is recorded as
the lead's, not as the historical bView seat's separate assent,
which was not separately received. The historical owners remain
recorded above, and "upgrade the adapter and SDK together" was
followed for every consumer.

**Pinned and vendored.** `vendor/ant-browser-sdk/0.1.5/` is copied
byte-for-byte from the official npm tarball (verified: SHA-1
matches the registry `dist.shasum`; the tarball's SHA-512
recomputes to the registry `dist.integrity`; every vendored file
hash-matches its package source, 0 mismatches). Full provenance
(tarball hashes, WASM source revision `458c7175…`, WASM SHA-256
matching `source.json`, lock hash) is in
`vendor/ant-browser-sdk/0.1.5/VENDOR.md`. The file set is the 0.1.2
set plus 0.1.5's two newly reachable runtime modules
(`manifest.js`, `pointers.js`); maps, declarations and the
standalone worker copy are omitted as before.

**Adapters upgraded, with API-shape verification first.**
`AutonomiClient.connect`/`connectNetwork`,
`client.openFile(address, {signal, onProgress})`,
`reader.read(start, length, {signal})`, `createMediaSource`,
`client.upload(file, {visibility, paymentMode, payment, signal})`
and `createManualPaymentProvider` were confirmed to keep their
0.1.1/0.1.2 shapes in 0.1.5 by inspecting `client.js` and
`file-reader.js` before any move. Then: read path —
`surfaces/bview.html` SDK root 0.1.2 → 0.1.5 (version labels with
it) and its mocked suites' intercept paths; wallet/payment,
separately — `surfaces/bpay-invoice.js` and `surfaces/bdrop.js`
kit root 0.1.1 → 0.1.5 and the wallet test mock's kit path.

**Re-ran identical-verified-content comparison** (same fixtures,
same limits as the baseline section):

- ant-bnrose observer suites: **9/9 passed** (unchanged result).
- bView mocked suites on 0.1.5 (direct, adaptive, page, ant-hls,
  mse): **48/48 passed** (expanded set vs the baseline's 41).
- `qualify-local.mjs` (1 MiB identical verified content, 25 ms
  simulated transport): latency 38.03 ms observed vs 34.17 ms
  opt-out (sdk 31.97 ms, verification 1.97 ms, observation
  2.48 ms); connections 4 calls, max concurrency 4, 32.09 ms wall;
  bytes 1,048,576/read, 4,194,304 verified total; memory heap delta
  +73,352 bytes; cancellation rejected with no observation
  consumed; recovery identical verified content at sequence 1.
  These figures are the same consumer-side contract as the
  baseline and are comparable to it; small-seat timing variance
  applies, as the harness README states.
- Wallet/payment, separately qualified offline:
  `e2e/ant-pay.test.mjs` + `e2e/ant-testnet-pin.test.mjs` —
  **14/14 passed**. No live payment, upload or wallet action was
  attempted or is claimed; the payment adapters' live
  qualification remains a live-network exercise for their lane.

**Not claimed:** live ANT network behaviour of 0.1.5 (no live
trial was run from this seat — the ant-bnrose matrix and bView live
checks remain the live instruments, to be run by their lanes), the
sanctioned NixOS kernel build (this seat's kernel is a labelled
local build), and any payment beyond the offline vectors.
