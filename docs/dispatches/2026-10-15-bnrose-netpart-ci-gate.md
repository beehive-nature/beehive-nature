# 2026-10-15 — BNROSE-NETPART-001 CI gate + evidence tightening (review order, post-#440)

The review's priority 1 and 2, delivered on branch
`zcode/bnrose-netpart-ci-2026-10-15` (cut from main @bde1a9cc6):

1. **The partition harness is a required CI gate** — the lane workflow
   now runs `netpart-demo.sh` inside `unshare -Urn` after the
   cross-node demo. The gate FAILS CLOSED before any fault runs:
   missing `unshare` or `iptables` is a loud failure, and a capability
   control proves partitions are real — a control server listens, an
   OUTPUT DROP goes in, and a connection attempt MUST time out; if
   packets flow, the gate refuses to proceed ("simulated faults are
   never a substitute"). Local receipts: the control passes
   (CONTROL-OK) and the demo re-runs green inside the namespace.
2. **Evidence tightened** — the RSS collector now keeps only the
   numeric measurement line (GNU time writes its exit-status
   diagnostic into the same stream; nodeC-lose-response now reads
   4188 KiB, not the status text), and the metrics receipt names the
   latency for what it is: "10 dual dispatches on one host, fsyncs
   included — a baseline, not a statistically strong scale result."

**#444 reconciliation** (coordination point, note posted on the PR):
#444 is a separate loopback/two-host experiment carrying the
NETPART-001 label — its findings are a different evidence class from
#440's one-netns per-link-drop qualification and must not be read as
passing the same gates; the note asks its topology be named in the
title/description.

Priorities 3 (independent failure domains: veth links, competing
recovery, asymmetric loss, reordering, node death, healing) and 4
(Arbitrum/Hive per-chain identity, duplicate-effect prevention,
reorgs, finality — never importing the stand-in ledger's finality)
remain named next depths, unchanged.
