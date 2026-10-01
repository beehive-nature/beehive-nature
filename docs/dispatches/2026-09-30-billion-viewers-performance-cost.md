# One billion simultaneous viewers of one video — 2026-09-30

Founder clarified **one billion simultaneous viewers**, not a billion monthly
users. This is a capacity and cost model, not a billion-client benchmark or an
infrastructure purchase recommendation. No current BNR or Autonomi deployment
has been measured at that scale in this lane.

## The unavoidable delivery volume

Assume the same original encoded video, one hour watched by each viewer,
no pre-existing viewer cache, and decimal units. Payload only; protocol
overhead, retries, speculative prefetch, replication and control traffic extra.

`outbound bps = concurrent viewers × encoded video bps`

`delivered GB/hour = viewers × Mbps × 1,000,000 × 3,600 / 8 / 1,000,000,000`

| Video rate/viewer | Required payload throughput | Delivered/hour | Illustrative OCI egress/hour | 100Gb/s serving units at 70% usable capacity |
|---|---:|---:|---:|---:|
| 5 Mb/s | 5 Pb/s | 2.25 EB | $19.125 million | 71,429 |
| 25 Mb/s | 25 Pb/s | 11.25 EB | $95.625 million | 357,143 |
| 100 Mb/s | 100 Pb/s | 45 EB | $382.5 million | 1,428,572 |

Egress arithmetic uses Oracle's published North America/Europe/UK starting
rate of $0.0085/GB after its free monthly allowance. This is not our actual
bill, a committed-volume quote, or evidence that OCI will provide this fleet.
Billing-unit conventions and negotiated transit pricing can change the number.
The 70% utilization and 100Gb/s unit are assumptions, not our box's measured NIC.
[Oracle networking pricing](https://www.oracle.com/cloud/networking/virtual-cloud-network/pricing/).

As a separate managed-video benchmark, Cloudflare Stream lists $1 per 1,000
delivered minutes: 60 billion viewer-minutes implies **$60 million/hour** at
list price. Enterprise volume discounts exist; this is not a quote or proof
of billion-viewer capacity, and a managed transcoded service is not necessarily
the same original-byte workload. Do not add that bill to the OCI bill; these
are alternative illustrations.
[Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/).

## Three paths, three different payers and bottlenecks

| Path | Who supplies media bytes | Performance/scaling bottleneck | Costs borne by us |
|---|---|---|---|
| Current hybrid | Autonomi → our relay → browsers; small prefix disk cache and each viewer's local full-video cache | Relay connections/egress, uncached upstream reads, browser decode and Blob seek handoffs | Relay compute, disk, bandwidth, monitoring and operation |
| Expanded hybrid with full regional edge caches | Autonomi fills caches; edges serve repeated content | Distributed edge bandwidth, fill/coalescing policy, admission bursts and geographic capacity | Edge/transit contracts or operated edge fleet, control and origin services |
| Proposed direct Autonomi/WebRTC + bounded x0x coordination | Browsers read authenticated storage nodes directly | Hot-chunk serving capacity, discovery/handshakes, node upload bandwidth, repair/churn and client decode | Our participating nodes, control infrastructure, optional fallback services; participating node operators bear the rest |

Current-source facts: `ops/ant-node/first-chunk-cache.mjs` serves a cached prefix
and splices the remainder from upstream. This is not a full-video CDN cache.
`surfaces/bview.html` uses HTTPS relay fetches and CacheStorage on each client.
`watch.html` additionally describes a separate hosted HLS room. Local browser
cache does not let a first-time viewer reuse another viewer's cache. Live box
line rate, whole-file caching below the prefix proxy, cache-hit ratio and actual
bill were not measured here; do not turn source facts into fleet runtime claims.

Autonomi documents paid-once upload and free owner access/download. It does
not follow that node electricity, internet uplink, hardware or upkeep are zero.
The direct path can remove our per-viewer media-relay bill while relocating
cost to node operators. A sustainable comparison must report both our bill
and aggregate delivery cost, including node compensation/incentives where
applicable. Upload prices require a real live quote; no constant storage price
or hypothetical token valuation is assumed.
[Autonomi overview](https://docs.autonomi.com/how-it-works/overview).

The browser SDK directly connects to certificate-pinned WebRTC storage nodes;
that does **not** automatically turn every viewing browser into a seed. Its
README labels this path experimental and requires matching SDK/node versions.
[Official browser SDK](https://github.com/WithAutonomi/ant-browser-sdk).

The same-video workload makes storage small but delivery immense: at 5Mb/s,
one hour of the original is about 2.25GB while this audience receives 2.25EB.
Content addressing and deduplication eliminate duplicate stored objects, not
the bytes that must cross one billion last-mile links. The hard decentralized
problem is allocating enough popular-chunk serving capacity fast enough.
Autonomi documentation labels opportunistic popularity caching as planned;
its current operation and fleet capacity must be established from actual
source/runtime evidence before using it as the scaling answer.
[Autonomi chunks](https://docs.autonomi.com/how-it-works/data-types/chunks).

If a separate viewer-to-viewer serving layer is added, let effective sustained
viewer upload be `u` and media rate be `r`. Ignoring overhead, required external
serving capacity is at least `max(0, N × (r − u))`; uploader distribution,
piece availability and topology can make it worse. Example assumption:
5Mb/s video and 1Mb/s effective contribution leaves 4Pb/s to infrastructure.
This layer is not implemented by the current direct-download API merely by
using WebRTC. Device consent, mobile data, battery and NAT reachability matter.

WebRTC itself is a transport. Any TURN/fallback fraction must be measured for
the actual topology; do not import the 20–40% assumptions from our old mixed
call/SFU model into public-node browser-direct downloads. Where a relay is
used, bytes cross its upstream and downstream legs and consume relay resources.
[TURN specification, RFC 8656](https://www.rfc-editor.org/info/rfc8656/).

x0x belongs to bounded discovery/coordination in this proposed comparison;
video fanout must not be implemented as global gossip. Start-up bursts are a
separate gate: admitting a billion viewers over 60 seconds means 16.7 million
new viewers/second before multiple peer sessions and lookup traffic. No
current x0x acceptance proves that capacity.

## The evidence that should decide the migration

Compare the exact same video and codec at progressively larger real concurrent
audiences, with synchronized-start and staggered-start arms, warm and cold
caches, multiple regions and a churn/recovery arm. Record p50/p95/p99
time-to-first-frame, sustained useful throughput, rebuffer seconds per viewer-hour,
completion rate, decoded/dropped frames, served unique bytes and retry amplification,
hot-chunk providers and load distribution, connection/lookup rates, actual relay
fraction, resource usage and billable egress. For x0x, correlate published IDs
with application-delivered IDs and timestamps rather than send-attempt counters.

Count simulated clients as control/protocol evidence only unless they actually
receive the full verified media payload. Extrapolation needs a demonstrated
linear region and named saturation limits; it is not a billion-viewer result.

Provisional engineering conclusion: our existing single relay cannot be
extrapolated into this workload. A full edge-cache hybrid has a known way to
serve one popular file efficiently, but its distributed viewer egress is paid.
Direct Autonomi can remove our delivery bottleneck and distribute its cost,
but a lower total cost or higher performance is **not yet measured**. Proven
popular-content fanout and regional capacity, rather than protocol labels,
should decide when the hybrid can be retired.
