# Direct x0x delivery under bounded load and receiver churn

Measured October 20, 2026, 09:32–09:35 UTC on Hostinger NixOS 26.05
(build 26.05.20260829.c5c4a43), x86_64, shared VPS.

## Executed path and source

The new experiment is on x0x branch `codex/bnrose-direct-delivery`, descending
from PR #4 `85633f6a6dfea44e62a0cad778aa429275fc4604`.
Published harness revision:
[`42a306546b0e50d3d10f33b26a09a621f400dfad`](https://github.com/loviswaternakamoto/x0x/commit/42a306546b0e50d3d10f33b26a09a621f400dfad).
It uses real `NetworkNode::send_direct` / `recv_direct` socket delivery over
the existing locked ant-quic 0.27.54 transport. Receivers then verify signed
x0x announcements using either `verify_baseline` or `ShadowObserver::observe`.
Production source, Cargo.lock, peer policy and transport settings are unchanged.
PR #4 remains unmerged.

Native Rust 1.95.0 release build, existing pinned Nix shell:
`09063bd1f2b36fd9fd793c36dfade7bd40a93dfc`.
Executable SHA-256: `e121a98615a0581a0f2090e9ffd912503ac0335196bb34af992a210a681703e9`. PUBLIC-CONSTANT
Example source SHA-256: `beecb7b9ad94654f76cc6942b7e5d914fdd02711b2f302855a965966c3533c5a`. PUBLIC-CONSTANT
Cargo.lock SHA-256: `cec652ac6795999a949e0f56b6c6513e6cc1077ccb5b3bcdfb6ed26c035929bb`. PUBLIC-CONSTANT

## Method and counts

24 fresh processes: baseline/shadow × 8/64 in-flight sends × steady/churn ×
three repeats. Arm order alternates by repeat; window order is fixed.
Each process runs two independent peer pairs, each sending three bursts of
128 signed 7,410-byte announcements. The churn arm takes one receiver offline
for the middle burst, then recreates it with the same ephemeral transport
identity and a new port. The second pair does not withdraw.

This is bounded burst pressure, not a sustained offered-rate saturation test.
Each send has a 500 ms deadline and each phase a 500 ms settle interval.
There is no application retransmission and the withdrawal is between bursts.
All receiver inputs are matched to their original send ID and monotonic
timestamp. Missing delivery is not hidden by a successful send counter.

- **18,432 attempts; 16,896 verified deliveries.**
- **Zero missing messages while their receiver was online.**
- **1,536 failed sends during deliberate withdrawal; zero delivery then.**
- **All 12 recovery bursts delivered 128/128 after rejoin.**
- **48/48 network-delivered tampered-signature controls rejected.**
- Reconnect call duration after recreating the receiver: 2.412–6.606 ms.
  This excludes the offline interval and does not measure WAN recovery.

## Comparison and the observer-ordering limit

| In-flight bound | Condition | Baseline latency | Shadow latency | Baseline burst goodput | Shadow burst goodput |
| --- | --- | ---: | ---: | ---: | ---: |
| 8 | steady | 17.124 ms | 16.767 ms | 25.045 MiB/s | 24.285 MiB/s |
| 8 | withdrawal/rejoin | 12.277 ms | 13.613 ms | 25.359 MiB/s | 26.884 MiB/s |
| 64 | steady | 21.135 ms | 20.400 ms | 25.102 MiB/s | 25.177 MiB/s |
| 64 | withdrawal/rejoin | 21.517 ms | 19.622 ms | 22.700 MiB/s | 24.551 MiB/s |

Latency is the median across runs of each run's median active-phase p50
send-to-verified-delivery latency. Goodput uses the analogous aggregation of
active-phase payload bytes from first send to last verified receive; it excludes
handshake setup and settle intervals. The intentionally offline phase is excluded
from these timings and reported as failed sends above. These are not pooled
quantiles or sustained network bandwidth. Shared-host variation is substantial:
paired latency changes range from -51.13% to +76.52%. No speedup is established.

**5,899 of 8,448 shadow-verified inputs (69.83%) were labelled Replay by
the observer's monotonic watermark; only 2,549 entered core admission.**
There were **zero duplicate application IDs**. Independent QUIC streams delivered
unique signed sequences out of order. `src/bnrose_shadow.rs::observe` checks
signatures first, then treats older sequence numbers as diagnostic Replay.
The harness preserves these verified application deliveries.

This result measures the existing observer under reordering, not BNRoSe admission
on every message. It is not equivalent to the prior ordered offline microbenchmark.
Turning the diagnostic verdict into a delivery gate would discard valid messages;
this evidence does not justify such a change. Any future ordered observation
queue or replay-window redesign needs its own bounded-state and refusal tests.

## Security, autonomy and governance

`src/bnrose_shadow.rs::verify_baseline` calls
`announce_v3.rs::IdentityAnnouncementV3::verify` and checks the locally selected
machine, agent and signed freshness. The shadow arm retains that call before
its diagnostic work. No signature cache or classical substitute is introduced.
Each transport receiver allowlists only its own counterpart. Runtime negotiated
key-exchange identifiers are not exposed by this harness; this is evidence of
unchanged transport configuration and exercised signature refusal, not a separate
attestation of the TLS negotiated group.

Every process had a distinct loopback-only network namespace, non-root dynamic
user, empty effective capabilities, no-new-privileges and a 512 MB memory limit.
Receivers can withdraw independently. No DAO governance, vote, policy authority,
user identity, wallet, delegation or production configuration was modified.
This does not test DAO consensus or voting. Direct bandwidth supply by autonomous,
self-funded peers remains the intended architecture.

The existing production node remained healthy with 25 send-ready peers and
zero restarts. No public mesh traffic was generated by the experiment.
Rounded systemd resource summaries are retained; post-exit exact resource
properties were unavailable, not zero.

## WebRTC–ANT portion remains unexecuted

BNR main inspected at `5538a7ae6d54e4b70963223b0e5a109316db3cea` uses
`surfaces/bview.html::tryDirect`, SDK 0.1.2 and the WebRTC dial recorder in
`surfaces/ant-transport.js`. The SDK vendor provenance pins ant-client
`9858af5dbbb2caf090e20db67ac62aa4bd100c81`; its
`ant-core/src/browser/wasm_transport.rs` uses the WebRTC Direct profile.
This browser chunk path is distinct from the x0x NetworkNode path above.

There is no BNRoSe observation hook connecting the browser chunk path to the
current Rust shadow adapter, nor an existing controlled ANT storage-peer churn
harness for this paired experiment. Browser-to-ANT delivery, its application
verification, actual selected WebRTC path, and its with/without-BNRoSe comparison
were **not executed**. No inference of PQ coverage on that browser path follows
from these x0x measurements.

The concrete next integration requirement is a bounded, local, opt-in observation
boundary after the existing ANT verification result, with attributable requested
and verified chunk IDs and WebRTC path counters. Controlled peer withdrawal must
use dedicated test storage peers, preserving real content verification and local
resource authority. The current announcement observer is not a chunk-verification
API; manufacturing an announcement to claim ANT verification would be invalid.
Oracle's independent capacity blocker does not become a passing two-host result.

Upstream discussion was rechecked: #622 moved its measurement requirements back
to [#504](https://github.com/saorsa-labs/x0x/issues/504); #505 has explicit field
acceptance. This private direct-stream experiment does not satisfy #504's public
Leaf idle-egress acceptance or its gossip delivery matrix.

## Receipts and separate lanes

[Raw receipts and reproducible analysis](../receipts/bnrose-delivery-20261020/).
Native release build, `cargo fmt --all -- --check`, and native release Clippy
for `--features bnrose-shadow --example bnrose_delivery -- -D warnings` passed.
The fixed matrix completed. Full repository CI,
all-target/all-feature Clippy, a one-hour soak, WAN/NAT tests, and DAO execution
were not run for this benchmark. Initial launcher/PATH and missing-format-tool
setup failures are retained separately from the measurement matrix.

The dependency audit remains PR #3, invitation-convergence validation remains
PR #5, and PR #4 is unmerged. No all-CI-green claim follows from these measurements.
