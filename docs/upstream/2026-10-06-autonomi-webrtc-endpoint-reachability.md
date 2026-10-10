# For the Autonomi team: WebRTC Direct endpoints that browsers cannot reach

From the BNR / skaists.dev team, 2026-10-06. Ready for upstream review. We
have not touched `ant-node` and do not plan to; this is evidence, not a patch.

## The finding

Across the first two independent networks, 365/365 commonly settled
endpoints agreed in outcome. A fixed 40-endpoint cohort checked again about
35 minutes later from three execution vantage points kept its baseline
phenotype in 93/93 settled observations: 43/43 dead stayed dead and 50/50
live stayed open. Two non-cohort endpoints showed cross-network disagreement
in the broader window, so we do not claim network effects are impossible.
The evidence points strongly to endpoint-specific reachability state,
without yet identifying the mechanism.

## The numbers

Browser: Chromium, the published `@withautonomi/ant-browser-sdk` 0.1.1 (window 3:
0.1.2), reading one public 214 MB file (`try_autonomi.mp4`) for 150 s per run.

| window | vantage point | dials | opened | dead | settled endpoints reachable | dead attempts that never reached ICE-connected |
|---|---|---|---|---|---|---|
| 1 | home network (laptop), 20:20Z | 760 | 441 | 295 | 231 / 526 | 295 / 295 |
| 1 | GitHub-hosted Linux runner, 20:22Z | 794 | 509 | 285 | 230 / 505 | 276 / 285 |
| 2 | home network (laptop), 20:54Z | 688 | 398 | 272 | 209 / 477 | 268 / 272 |
| 2 | GitHub-hosted macOS runner, 20:55Z | 775 | 449 | 307 | 228 / 533 | 305 / 307 |
| 2 | GitHub-hosted Linux runner, 20:56Z | 949 | 617 | 329 | 280 / 592 | 322 / 329 |

- Window 1: 375 endpoints seen by both; 365 settled on both; 195 dead from
  both, 170 open from both, 0 opposite. All 195 never reached ICE-connected,
  on any attempt, from either network.
- Window 2, all three vantage points: 259 settled on all three; 127 dead
  from all, 130 open from all, 2 differ (both outside the cohort).
- Roughly half of the settled endpoints a browser dials are unreachable from
  a browser, and almost every failed attempt fails before ICE connects.

## What we do and do not claim

- We claim: whether a browser can open one of these endpoints depends on the
  endpoint, not on the browser's network, for this sample.
- We do not claim a cause. "Never reached ICE-connected" localises the
  failure to connection setup; it does not tell a closed UDP port from a NAT
  mapping, a firewall, a listener that is down, a stale advertisement or a
  wrong address/port.
- What the code does (read at release v0.21.0 and main
  [`d41a353`](https://github.com/WithAutonomi/ant-node/blob/d41a353544f11b333e6e0ab42d9de7723ef5f772/src/web_rtc.rs#L874-L893);
  the function is identical in both): `advertised_addr()` returns an explicit
  `advertised_addr`, else a bound specific IP, else the first non-relay native
  address of the same family with the WebRTC listener's local port.
  `refresh_browser_endpoint()` publishes that into the DHT
  ([L731–L764](https://github.com/WithAutonomi/ant-node/blob/d41a353544f11b333e6e0ab42d9de7723ef5f772/src/web_rtc.rs#L731-L764)).
  We found no reachability check of that socket before publication; the
  listener snapshot itself notes "no external probe is implied" ([L520](https://github.com/WithAutonomi/ant-node/blob/d41a353544f11b333e6e0ab42d9de7723ef5f772/src/web_rtc.rs#L520)). `ant-client`
  already records that "a third to a half" of mainnet WebRTC Direct endpoints
  time out when dialled
  ([wasm_transport.rs](https://github.com/WithAutonomi/ant-client/blob/48c4d7d72a121844d00ce34c325c966c34f687d2/ant-core/src/browser/wasm_transport.rs#L85-L90)).
  So `advertised_addr()` is a good place to look; our data does not prove the
  defect is there.

## Matching our endpoints to yours

Endpoint IDs in our receipts are the first 16 hex characters of
SHA-256 of `"ip:port"` (for example `SHA-256("203.0.113.7:10001")`). They are
pseudonymous, not anonymous: with the advertised endpoint set you can
recompute them and see exactly which nodes are in the dead-from-every-network
group. Raw addresses are not published.

## Reproduce it

- Receipts: [two-network](https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/ant-reach-2026-10-06.json) ·
  [cohort](https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/ant-reach-cohort-2026-10-06.json)
- Recorder (wraps `RTCPeerConnection`, records dial → ICE → DTLS → channel →
  answer per attempt): [surfaces/ant-transport.js](https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/ant-transport.js)
- Probe, one run on whatever network it is on:
  [e2e/ant-reach-probe.mjs](https://github.com/beehive-nature/beehive-nature/blob/main/e2e/ant-reach-probe.mjs)
- Runner probes: [.github/workflows/ant-reach.yml](https://github.com/beehive-nature/beehive-nature/blob/main/.github/workflows/ant-reach.yml)
  (runs 37525604244 and 37529869576 carry the raw exports as artifacts)
- Compare and cohort: [scripts/ant-reach-compare.mjs](https://github.com/beehive-nature/beehive-nature/blob/main/scripts/ant-reach-compare.mjs) ·
  [scripts/ant-reach-cohort.mjs](https://github.com/beehive-nature/beehive-nature/blob/main/scripts/ant-reach-cohort.mjs)

## Update 2026-10-07: current SDK, and 24 hours

- SDK 0.1.2 (2026-10-05) fixes two WebKit-only problems (ant-client #215,
  #216; #216 notes Chromium "never lost a connection"). Our runs are Chromium,
  so they do not explain these results. Window 3 ran on 0.1.2 from all three
  vantage points: 147 endpoints settled on all three; 73 dead from all, 73
  open from all, 1 differs.
- The fixed 40-endpoint cohort over ten runs in about 24 hours (SDK 0.1.1 and
  0.1.2): the 20 dead endpoints stayed dead in **108/108** settled
  observations; the 20 live ones stayed open in **126/128**. Both misses are
  one endpoint (`09d7e457307accd9`), dead from one runner and open from the
  other at the same moment: network effects are real for some endpoints, just
  not for the dead group.
- Receipt: [cohort, 24 h](https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/ant-reach-cohort-2026-10-07.json).

## Update 2026-10-08: cohort closed

- Across 17 runs over about 34 hours (SDK 0.1.1, then 0.1.2), the 20 dead
  endpoints stayed dead in **159/159** settled observations and the 20 live
  ones stayed open in **203/205**; both misses are the same single endpoint.
- Final window (2026-10-08 06:24Z), laptop vs GitHub Linux runner: 285
  endpoints settled on both; 148 dead from both (147 never ICE-connected on
  any attempt), 137 open from both, 0 opposite.
- Receipt: [final cohort](https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/ant-reach-cohort-2026-10-08-final.json).
  The scheduled probe is stopped; the workflow and probe stay available on demand.
