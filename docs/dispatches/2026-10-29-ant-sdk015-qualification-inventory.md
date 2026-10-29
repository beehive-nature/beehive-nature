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

## Blockers

- Vendor/consumer ownership unacknowledged (gate above).
- `kernel.wasm` unbuilt on this seat (exact `ENOENT` evidence
  above); the pinned NixOS build path is the sanctioned producer.
- No live ANT network qualification attempted from this seat;
  nothing here claims SDK 0.1.5 works.
