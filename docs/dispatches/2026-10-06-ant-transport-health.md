# bViEw: the WebRTC Direct dial funnel, measured in the browser

Seat: Claude (Seat 3). Date: 2026-10-06. Founder order: update the stack with
Codex's recommendations on Shu's transport finding.

## Why

Shu suspected that many WebRTC Direct endpoints in the Autonomi DHT cannot be
dialled from a browser. Codex read the current sources and reported two things,
not re-verified by this seat:

- `ant-client`'s browser lookup says a third to a half of the WebRTC Direct
  endpoints found on mainnet time out when dialled, which is why its lookup
  concurrency was raised and failed endpoints are suppressed.
- `ant-node`'s `advertised_addr()` builds the WebRTC Direct address from the
  QUIC-observed public IP plus the WebRTC listener's local UDP port, with no
  dial-back proof for that socket before it is published.

The number that matters is Z/Y: of the WebRTC endpoints advertised, how many a
browser can open right now. Codex's recommendation: measure it inside our own
apps, so they become part of the burn-in, not wait for the network to be
certified first.

## What changed

- `surfaces/ant-transport.js` wraps `RTCPeerConnection` once, before the SDK
  loads. The SDK's WASM glue calls `new RTCPeerConnection` at each dial, so
  every dial is seen. Per dial it records: dial, ICE connected, DTLS
  connected, data channel open, first answer, bytes received, and where a dead
  dial stopped. The endpoint comes from the remote answer's UDP candidate and
  is kept in memory only to tell endpoints apart; the snapshot carries counts
  and timings, never an address or peer id. Nothing leaves the device.
- `surfaces/bview.html` loads it and adds to the cypherpunk receipt, on the
  direct route: dials (opened, dead, waiting), share of dials that opened,
  endpoints reachable (and ones that failed once then opened), where dead dials
  stopped (before ICE, before DTLS, before the channel), dial to open p50/p95,
  dial to first answer p50/p95, time on dead endpoints, dead dials per opened
  dial. "Wire traffic" now reports data channel payload bytes when a dial
  happened, and still says not measured when none did.
- Lookup rounds per retrieval stay "not measured": the SDK's frames are its
  own and it does not expose them.
- `e2e/ant-transport.test.mjs` drives a fake peer connection through open,
  dead-before-ICE, dead-after-ICE, recovered and waiting dials; it is in CI.

## Receipts

- `node --test e2e/ant-transport.test.mjs`: pass 2, fail 0.
- `node --test e2e/bview-direct.test.mjs`: pass 8, fail 0.
- `node --test e2e/bview.test.mjs`: pass 17, fail 1 ("slow door" countdown
  timing). The same test fails the same way on unchanged `origin/main`
  7c9d9fcc0 on this laptop, so it is not from this change.

## Not done here

- Pooling the snapshot across viewers. That is a new outbound data flow and
  needs a collector and a privacy ruling first.
- The upstream fix: advertise a browser transport only after that transport is
  proven reachable (dial-back or independent observations). That change goes
  in `ant-node`; our receipt numbers are the evidence to bring to it.
- The same recorder on W@tch and bMeter once they dial directly.

## Live check, skaists.dev, commit 0c408392a

Built-in browser on the founder's laptop network, founder's 214 MB clip,
route "direct only".

- `ant-transport.js` serves and wraps `RTCPeerConnection`.
- A direct `AutonomiClient.connect()` from the page: connected in 3.4 s,
  5 dials, 1 opened, dial to open 0.36 s, first answer 0.41 s, 4 still waiting.
- The page's own attempt a minute later: 4 dials, all 4 dead before ICE,
  26.2 s of dial time spent on them, nothing opened. The stop line said only
  "storage nodes went quiet", and the funnel rows were hidden because they
  waited for a Watch attempt that never began.

## Second commit: after Shu's note

Shu benchmarks ants.tube strategies on time to first frame, connections
created and destroyed, and time spent stalled. bViEw now reports all three so
our runs line up with his table:

- `connections`: created, destroyed (dead plus opened and later closed), open now.
- `stalls`: count and seconds the playhead waited for bytes after the first
  frame; seeks are not counted.
- The funnel rows show whenever a dial happened, not only inside a Watch attempt.
- A quiet stop with no node reached now says that none of the N storage nodes
  it dialled could be reached from this network.

## Third commit: status that reads like a receipt

From a founder-relayed Codex read of the doxx.net app: its status row works
because every light is a live receipt. bViEw's direct-start status line now
says how many storage nodes answered as it happens ("1 of 5 nodes answered"),
taken from the dial funnel. No new styling.

## Live receipt, skaists.dev, after aae4d8751 (CI green)

Founder's 214 MB clip, direct only, founder's laptop network, one page session:

- WebRTC dials: 329 · 176 opened · 131 dead · 22 waiting
- connections: 329 created · 267 destroyed · 40 open now
- dials that opened: 57% of settled dials
- endpoints reachable: 118 of 247 settled endpoints, 48%
- where dead dials stopped: 129 before ICE · 2 after ICE, before DTLS · 0 after DTLS
- dial to open: 2.58 s p50 · 5.49 s p95; dial to first answer 2.88 s p50 · 5.68 s p95
- time on dead endpoints: 1,446 s summed across overlapping dials · 0.74 dead per opened
- wire traffic: 74 MB of data channel payload
- status line during the start: "Reading the video map · 19 of 37 nodes answered"

Reading: about half the dialled WebRTC Direct endpoints could not be
reached from this browser, and 129 of 131 failed attempts never reached
ICE-connected. That localises the failure to connection establishment and is
consistent with unreachable or misadvertised UDP endpoints (Shu's hypothesis,
the ant-client comment). It does not tell a closed port from a NAT mapping, a
firewall, a stale candidate or a wrong advertisement. One network, one time.
(Corrected 2026-10-06: an earlier line here said this "is where an unreachable
UDP port fails", which claimed a diagnosis the run did not measure.)

## Two independent networks, endpoint by endpoint (2026-10-06)

Same live page (`ant-transport.js?v=2`), same clip, direct only, 150 s each,
`e2e/ant-reach-probe.mjs` on both sides. The windows overlapped by about 45 s.

| run | network | dials | opened | dead | settled endpoints reachable | dead attempts never ICE-connected |
|---|---|---|---|---|---|---|
| laptop | founder's home network, 20:20:49Z | 760 | 441 | 295 | 231 of 526 | 295 of 295 |
| gh-runner | GitHub-hosted runner (Actions run 37525604244), 20:22:36Z | 794 | 509 | 285 | 230 of 505 | 276 of 285 |

`node scripts/ant-reach-compare.mjs` over the two exports:

- endpoints seen by both: 375
- dead from both networks: **195** (every attempt, both sides, never ICE-connected)
- opened from both networks: **170**
- differs by network: **0**
- unsettled on one side: 10; seen by one network only: 301

Reading: 375 endpoints were observed by both networks and 365 settled on both.
Among those 365, outcome concordance was 365/365: 195 failed from both and 170
opened from both; none opened from one network while failing from the other.
That makes a client-network explanation unlikely for this sample and points at
endpoint-side state: advertised address or port validity, remote NAT or
firewall, listener availability, a stale advertisement, or similar. The run
does not distinguish those causes, and it does not show the defect is in
`ant-node`'s `advertised_addr()`. Two networks, one 5-minute window.

Receipt: `docs/receipts/ant-reach-2026-10-06.json` (both run summaries, the
counts, and the 195 dead-from-both and 170 opened-from-both endpoints). The
endpoint IDs are truncated deterministic fingerprints (first 16 hex of SHA-256
of `ip:port`), not raw addresses. They are pseudonymous, not anonymous: anyone
holding the advertised endpoint set can recompute them, which is the point, so
the Autonomi team can match them.

## Next: does an endpoint keep its phenotype? (cohort, 2026-10-06 → 2026-10-09)

The question moves from "does network A differ from network B" to "does
endpoint X keep its outcome over time and from a third vantage point".

- Cohort: the first 20 dead-from-both and first 20 opened-from-both
  fingerprints in the receipt, sorted, so anyone re-derives the same 40.
- `scripts/ant-reach-cohort.mjs` reads any later reach() exports for those 40
  only: observed or not, and kept or flipped when settled.
- `.github/workflows/ant-reach.yml` now probes from a Linux and a macOS
  GitHub-hosted runner, on demand and every 6 hours, and the schedule stops by
  itself after 2026-10-09. The two runner pools are separate machines; that
  they leave through different upstream networks is not verified.
- Baseline (the two runs above): dead cohort 40 of 40 settled observations
  dead; live cohort 40 of 40 open. Trivially so, since the cohort was drawn
  from them; the later windows are the test.

Nothing in `ant-node` is touched from BNR. The sequence stays: evidence,
upstream review, upstream diagnosis, a patch at the source.
