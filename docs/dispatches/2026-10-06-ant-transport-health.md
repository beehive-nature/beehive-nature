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
