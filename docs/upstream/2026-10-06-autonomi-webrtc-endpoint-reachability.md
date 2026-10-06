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

Browser: Chromium, the published `@autonomi/ant-browser-sdk` 0.1.1, reading
one public 214 MB file (`try_autonomi.mp4`) for 150 s per run.

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
- Our reviewer's reading of current source (not verified by us) is that
  `ant-node` builds its WebRTC Direct address from the QUIC-observed public IP
  plus the WebRTC listener's local UDP port, without a reachability check of
  that socket before publishing, and that `ant-client`'s browser lookup
  already notes many mainnet WebRTC Direct endpoints time out. If that reading
  is right, `advertised_addr()` is a good place to look; our data does not
  prove the defect is there.

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

More 6-hourly runner windows run until 2026-10-09 and will be added to the
cohort receipt; they strengthen persistence and are not a reason to wait.
