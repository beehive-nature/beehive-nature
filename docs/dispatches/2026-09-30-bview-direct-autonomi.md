# bViEw direct Autonomi playback — 2026-09-30

Codex, own worktree wt-codex-bview-ci; branch codex/bview-direct-autonomi.
Founder authorized the recommended direct-first migration work with “okay go”.
This first delivery adds a selectable direct playback path with relay fallback;
Relay stays default pending comparative performance evidence. No viewer node,
viewer seeding, x0x gossip lane, wallet operation or shared bzDiD sync is claimed.

## What ships

The self-hosted official @withautonomi/ant-browser-sdk 0.1.0 npm runtime and
its Rust WASM core are pinned. vendor/ant-browser-sdk/0.1.0/VENDOR.md records
package provenance, artifact hashes, licenses and the exact SDK functions used.
The upstream JS/WASM runtime and root range service worker are byte-faithful;
source maps, declarations and the redundant vendor worker copy are omitted.
No new surface is added or moved. The existing bViEw page is modified.

Playback route offers Relay or Direct Autonomi + relay fallback. Direct uses
AutonomiClient.openFile and the pinned internal MediaBridge.attach to serve
random-access verified plaintext ranges from WebRTC-connected storage nodes.
An adapter wrapper counts completed unique plaintext ranges; those are not
wire bytes or discovery bandwidth. Native video seeking keeps one source URL.
Connected sessions reuse the client pool across addresses; old readers close.
Page exit closes the pool. Public retrieval needs no wallet/account adapter.

Startup is bounded: 45 seconds for direct setup and 45 seconds to obtain a
media frame, then relay fallback. A media error or a sustained 15-second stall
falls back once and carries the playhead into the existing relay engine. A
viewer pause cancels the stall timer. The previous picture is held during that
fallback; new addresses invalidate it. Cancellation suppresses stale results.
A conflicting existing root worker is respected and triggers relay fallback.
The narrower local-agent worker is not overwritten. The Autonomi worker only
handles its same-origin stream routes; ordinary requests pass through.

Three-register copy identifies the actual transport and distinguishes direct
session ranges from the relay's whole-file browser cache. The saved-video
schema remains shared with W@tch and records actual playback.

## Live network evidence, before landing

Ordinary in-app browser on the local candidate, official SDK, public Autonomi
network, the release demo's 11.6 MB Mandelbrot MP4: first decoded 1280px frame
at 34.10 seconds; path webrtc, service-worker media URL, playback reached the
12-second tail and ended there. No relay fallback occurred. This is one observed
session, not a throughput capacity benchmark, fleet version pin or security audit.
It supports keeping Relay as default until representative comparison proves a
better default. Decoder and connection behavior are distinct from video seeding.

## Acceptance and limits

The direct tests mock only the storage network reader and exercise the actual
vendored MediaBridge, root service worker and real VP9 frames. They gate stable
source URL + seek, connection reuse and reader disposal, startup fallback,
playhead preservation, sustained-stall fallback and viewer-pause handling.
Final focused suite: 8 passed, 0 failed/cancelled/skipped, exit 0, 36781.8206 ms.
The existing 27 playback/three-register/W@tch tests passed before final fallback
picture/copy refinements; the focused final suite and hosted checks follow in
PR receipts. estate-source: 11 inner passed, 1 outer passed. No test result is
substituted for the separate live-network session above.

## Upstream and next slices

Read current dirvine comments before starting. x0x #622 folded into #504 on
September 30: S1 unicast caps/capability-gated DM hedges, S3 consume-only Leaves,
then S4 enforced shed_normal with revocation exemptions; each step needs the
E-D17 delivered/published matrix. #505 is field-accepted, closed. No additional
backend traffic or field-measurement acceptance was claimed in this UI lane.

Next: compare identical video cold/warm startup, stalls, seeking, relay egress
and actual WebRTC traffic; promote direct only on those results. Then add
explicit opt-in useful viewer upload with bounded x0x discovery and WebRTC
chunk delivery, verify hashes and availability, measure departures/admission
bursts, and retire relay capacity only after reliable field evidence. Identity
and private personal-data persistence belong to the shared bzDiD/bData lane.

Commit provenance: implementation was performed by Codex. The first commit
inherited the worktree's founder author AND committer settings; the hook therefore
labelled it founder-typed. That label is not evidence the founder typed the code.
The Co-authored-by Codex trailer identifies the seat. This correction is a
normal descendant commit with the seat's committer identity; no pushed history
was rewritten.

Additional real-network comparison: the founder's current 214 MB video reached
the sustained-stall condition on the direct candidate, then automatically
entered the relay fallback. Exact first-frame/playhead timing was not captured
in that initial observation. Fallback status now retains those timings for
subsequent attempts, rather than discarding them during the relay reset. This
negative field result is another reason the default remains Relay.
