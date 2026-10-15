# 2026-10-15 — BNROSE-NETPART-001: genuine network partitions around the execution core

The review order's acceptance standard: demonstrate safety through
genuine network failures WITHOUT claiming global exactly-once
execution or consensus. Delivered (branch
`zcode/bnrose-netpart-001-2026-10-14`, dedicated worktree, cut from
main `4c689a953`): a rootless network-namespace harness —
`scripts/bnrose-rust-001/netpart-demo.sh` + `netpart-courier.py` —
where sovereigns and the destination are independent processes on a
private segment, every message is a real TCP stream, and every
partition is a real `iptables OUTPUT DROP` on a per-link port. Packets
are dropped; operations time out; nothing is simulated in-process.

## Legs (all asserted, all passed; Linux-built bnrose-exec-host)

1. **Cut BEFORE dispatch** — the isolated node cannot fetch the
   intent over its dropped link (real timeout), `journalRecords=0`:
   no dispatch, no state; the reachable node's effect lands once.
2. **Cut AFTER dispatch** — both sovereigns dispatched the SAME
   intents (10, dual-dispatch); one receipt is stranded behind the
   cut (its PUT times out); on restore it is re-delivered and the
   destination answers `already`. A courier-injected DUPLICATE GET
   delivery changes nothing.
3. **Cut DURING recovery** — `--lose-response` (exit 3), recovery
   mints the receipt, the destination's link is dropped when it
   would arrive: the destination applies nothing blind; on restore
   the recovered receipt applies exactly once. A WRONG-KEY receipt
   delivered over the wire is refused (exit 1), no mutation.

## Metrics (reproducible receipt: docs/receipts/bnrose-rust-001/netpart-metrics-local.json)

10 dual dispatches: p50=38ms, p95=142ms, p99=142ms (both sovereigns,
fsyncs included). Courier: 25 PUTs / 25 GETs, 17,405 bytes in /
17,630 bytes out (the out>in delta = the injected duplicate). Node
peak RSS ~4 MiB (dispatch) — full table in the JSON. Topology and
fault schedule are in the receipt verbatim; the harness reruns them
deterministically (`unshare -Urn` is CI-portable — CI wiring is the
named next push, not silently skipped as done).

## Also in this commit

**AGENTS.md — the permanent workflow rule** (review order): branch
and HEAD verification immediately before every commit/push in a
sibling-shared worktree, preferred posture one worktree per active
agent (this beat used its own: `wt-zcode-bnrose-netpart`).

## Boundaries not crossed

One namespace with per-link packet drops is a private segment, not
multi-host WAN physics — veth/multi-host topologies and netem-style
delay/reorder at the packet layer are the named next depth.
Arbitrum/Hive testnet adapters (transaction identity, replay
protection, finality semantics) remain their own qualification — a
locally generated op id guarantees nothing externally. No global
exactly-once claim; no consensus claim. The three boundaries stay
distinct: local exclusion protects a process; destination idempotency
protects an effect; consensus and finality require separate evidence.
