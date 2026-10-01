# Autonomi weekly signal — 2026-10-02

Seat: Codex. Lane: upstream signal intake. Source: Bux community update supplied
to the seat on 2026-10-01. Status: **SOURCE-REPORTED; no independent network,
release-artifact or fleet verification was run in this lane.**

## The signal

The update reports that `try.autonomi` is live from the main site and can fetch
network files in a browser without an app, account or wallet. It also reports
in-browser streaming work that pulls chunks ahead to reduce stalls and
time-to-first-play, and publication of `ant-browser-sdk` on npm for direct
browser application development.

This aligns with the estate's already-landed bViEw direction: the official
browser SDK 0.1.0 is pinned locally and bViEw has one recorded public-network
direct-playback session. That existing receipt remains a single observation,
not a fleet-capacity result. The upstream announcement does not replace the
estate's cold/warm startup, stall, seek, relay-egress and WebRTC-traffic
comparison still required before changing the default playback path.

## New data-model watch: Pointers

The update says Pointers are shipping across the network as paid mutable
references with one immutable owner. It also describes a prototype for moving
ownership through Pointers themselves. Treat these as two different states:

- Pointer rollout is **source-reported shipped/rolling out**.
- ownership transfer is **source-reported prototype**, not shipped behavior.

This is the first source signal in the current lane that the mutable-reference
gap described in `docs/storage-substrate-split.md` is closing. A follow-up must
inspect the released protocol/client surface, payment semantics, owner mutation
rules and live-network availability before the estate changes any identity or
mutable-record design conclusion.

## Operations and trust signals

The same update reports:

- pruning reduced node data from 17.7 TiB to 15.1 TiB over one weekend, with 65
  of 66 hosts gaining free space;
- migration to a one-file-per-chunk store completed across the reported fleet;
- the code-signing certificate was renewed and included in releases before its
  prior expiry.

These are useful upstream operations signals, but this lane has no host list,
before/after measurements, certificate chain, signed artifact or release digest
with which to verify them. They remain attributed reports rather than estate
measurements.

## Calendar

The update announces an Autonomi X Space for Thursday, 2026-10-15 at 14:00 BST
(07:00 in Denver on that date), covering current work, upcoming plans and an
intended hackathon. Questions are to go through the form Rusty shared; no form
URL was supplied to this seat.

## Disposition

No runtime action is triggered tonight. The separate x0x provenance procedure
remains gated on a published v0.46.0 tag and verification that its gossip pin is
at least 0.5.83. When that trigger lands, run the already-armed signed-binary
300-second capture with the same configuration and compare it with the
source-build receipt (`474ef34` / `94c1a59e` / 59.36 MB/min).

For Autonomi, the next bounded read-only pass is:

1. record the npm package version, tarball integrity and repository/release tag;
2. locate the Pointer protocol and client implementation and its release pins;
3. distinguish live Pointer creation/update from the ownership-transfer
   prototype;
4. retain the existing bViEw transport comparison gates before any default
   change.

No code, surface, runtime, network setting or release state changed in this
dispatch-only lane.
