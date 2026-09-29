# David Irvine follow-up: measurement before new backend features

The founder made David Irvine's GitHub communications priority one on
2026-09-10 (America/Denver). This direction is now in AGENTS.md for future
seats. This backend session owns Buzz/x0x follow-up; the parallel W@tch seat
continues its own scope. No public-mesh measurement was run in this check.

## Current request and response

The original [x0x #504](https://github.com/saorsa-labs/x0x/issues/504) closed
when [PR #603](https://github.com/saorsa-labs/x0x/pull/603) merged. Its open
successor is [#622](https://github.com/saorsa-labs/x0x/issues/622), filed by
David to preserve the remaining measurement work. His
[current request](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5615274866)
asks for the existing capture script on a real public-mesh Leaf, plus a separate
per-peer published/delivered message-ID and timestamp control when possible.

We [replied on #622](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5627339402),
reported the actual eligibility blocker below, and asked whether David wants
a specific instrumented build or the observed current main pin `6cc4085c`.
There is no new capture, before/after reduction or delivery acceptance claim.
The response was posted under the founder's explicit follow-up instruction.

## Read-only readiness evidence

At the check, oracle's existing daemon reported version **0.41.3**, healthy,
27 peers and 27 send-ready peers, with uptime 7,202 seconds. Its gossip response
contained 13 `pubsub_stages.outbound_by_topic` rows but no `participation`,
`subscribed_topics`, named outbound rows or `egress_budget` fields. Missing
fields were not converted to zeros: this daemon cannot pass the current
section 5 capture eligibility checks. GitHub's newest published binary release
was still 0.41.3. Upstream main and a released installed artifact are distinct.

The readiness probe read only health and gossip diagnostics. API credentials
were loaded internally on the VPS; the reported result included no credential,
message content, peer addresses or private identities. The daemon, production
binary/configuration, service and cloud/network rules were not changed.

Two older statements in our historical record need the upstream corrections:
the eager totals are **send-attempt estimates**, not measured wire occupancy
([PR #590](https://github.com/saorsa-labs/x0x/pull/590)); the old HyParView
view-size settings did not control fan-out and were removed by #603. Their
apparent improvement was not proof that those knobs worked. An eager-degree
ceiling also is not a bound on all emitted bytes.

## Next zCode session and ongoing follow-up

A fresh zCode 5.3 / Max session receives the prepared measurement orders at
`C:/Users/travi/buzz-repair/2026-09-10/zcode-x0x-622-measurement-orders.md`.
Use upstream's existing collector on an eligible isolated host, or return the
exact ready-to-run packet and eligibility blocker. Prefer a 1,200-second idle
window after stable peers, unique preserved evidence, restart/mode/isolation
checks, named delta rankings and explicit Linux/VPS provenance. Any delivery
control is separate from the idle window. Production replacement, public
laptop P2P and unreviewed new mesh deployment are outside the build handoff.

An hourly Codex follow-up (`david-irvine-github-priority`) checks #504, #622,
#505 and relevant new David replies/reviews affecting this work. It keeps a
local checkpoint under `buzz-repair/2026-09-10`, reports actionable changes,
and stays quiet on unchanged state. Future public drafts remain local unless
that response has user authorization. This is an active scheduled follow-up,
not evidence of uninterrupted monitoring while the local host is unavailable.

The related [#505](https://github.com/saorsa-labs/x0x/issues/505) still requests
the fragment-filtered OCI/datagram evidence and original traces. Upstream
ant-quic source repair and publication do not substitute for field acceptance;
no new #505 field run or trace upload is claimed here.

The accepted local Connect Store prototype has been merged at `7302cabf`.
The next receiver feature waits behind David's measurement follow-up. Its
review and original false network/provider/app flags remain unchanged.
