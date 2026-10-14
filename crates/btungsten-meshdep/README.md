# bTunGsTeN Mesh Dependability — `crates/btungsten-meshdep` (BT-MESH-DEPENDABILITY-001)

The Rust-driven battery that tests x0x mesh **transport cost, useful
delivery, and recovery together**, against pinned upstream release
binaries. Lane dispatch: `docs/dispatches/2026-10-12-btmd-mesh-dependability.md`.

This lane owns exactly this crate. It reuses — never competes with —
BNROSE-RUST-001: operation identities are the WB001 `Intent`
(`btungsten-wb001-core`, SAW-proven, unchanged), and the WB004 handoff's
persistence law is carried at transport level (UNKNOWN preserved;
rebroadcast-identical-only; automatic replacement refused).

## The layering

| Module | Owns |
|---|---|
| `budget` | hash-bound budgets + verdict math (a changed budget is a new file and a re-run) |
| `identity` | canonical operation identities (WB001 Intents; fresh nonce = new identity, never silent) |
| `ledger` | delivered/acked/lost/duplicated/delayed/replayed/**UNKNOWN** classification — pure over an append-only journal; a ready peer is not delivery evidence |
| `client` | hand-rolled HTTP/1.1 + SSE (no HTTP dependency); `CollectorSet` drains frames into ledger events by envelope digest |
| `rig` | netns/veth topology (mesh + management planes), pinned binaries, kernel veth accounting, scoped teardown |
| `workload` | DM / group / KV-store / revocation / discovery / class-probe operations, each a canonical Intent |
| `battery` | matched trial runner: calibration probe, identical workload shape, recipient-side sweep, per-second idle samples, verdicts |
| `bin/btmd` | `budgets` \| `trial` \| `p1` \| `p2` \| `recovery` \| `continuity` |

**Verdict-source law:** cost verdicts compute from kernel veth counters
and `/proc`; the daemon's own diagnostics are recorded (labeled
application-level) and are never verdict sources. A node's MESH EGRESS is
the root-side mesh-veth `rx_bytes` (calibrated by a known-size publish
every run; see `calibration.jsonl`).

## Environment laws (convicted live, now code-enforced)

1. **Docker's FORWARD drop.** On a docker host with `br_netfilter`,
   bridged IP packets traverse iptables FORWARD where the default-DROP
   policy kills them — the rig inserts (and removes at teardown) a scoped
   FORWARD ACCEPT for its OWN two bridges only.
2. **Hermetic configs.** Every generated `x0xd.toml` carries an explicit
   `bootstrap_peers` (the absent key resolves to the embedded GLOBAL
   bootstrap list — never acceptable here), `mdns_enabled = false`,
   `port_mapping_enabled = false`, a unique `network_id` plane, and
   `[update] enabled = false`.
3. **Two bridges.** API polling rides a management plane so it never
   pollutes the mesh-plane counters being measured.

## Reproducing a run

Pinned binaries: fetch the release tarballs (`v0.45.0`, `v0.46.0`,
`v0.46.6`, `v0.47.1` — digests in the dispatch closeout), verify each
against its release `.sha256`, extract under
`~/btmd/pins/<version>/x0x-linux-x64-gnu/`. Then, in WSL as root
(namespaces are required — `BTMD_RIG=1` is the deliberate-act gate):

```sh
cargo build -p btungsten-meshdep                       # any checkout
export BTMD_RIG=1
btmd p1        --run-id p1 --subnet-third 71           # acceptance sanity
btmd p2        --run-id p2 --subnet-third 74 --scales 3,6,9   # cost A/B, interleaved
btmd recovery  --run-id rec --subnet-third 75          # kill/partition/corrupt/bootstrap-removal/UNKNOWN
btmd continuity --run-id con --subnet-third 76         # 0.46.0 -> 0.47.1 -> 0.45.0 fail-closed probe
```

Raw receipts land in `<work-root>/<run-id>/receipts/` (spec, budget hash,
per-second samples, ledger journal, diagnostics, verdict). Distill the
committable evidence with `node scripts/btmd/distill.mjs --runs <dir>
--out <evidence-dir>` — no 64-hex identity rides the distilled output.

## What this rig does NOT measure

The public-mesh absolute idle bill (the #504/#622 capture) — that is the
staged `scripts/x0x-622` packet's job, not this lane's. Local-rig numbers
are mechanism evidence under a controlled workload; they are never
extrapolated to fleet scale.

## Management response bounds (PQ-NET-001)

`NodeClient::request` reads at most 8 MiB of encoded HTTP response, with
at most 16 KiB of headers and a 30-second total response-read deadline.
Incoming bytes do not renew that deadline. The limit includes chunk
framing; it is an observer limit, not a gossip payload or network budget.
Buffers are bounded by these limits, but 8 MiB is not a process RSS claim:
chunk decoding, UTF-8 conversion, and JSON parsing have additional costs.

Responses must be complete: exact Content-Length, or valid chunk sizes,
CRLFs and an empty terminating trailer section, or EOF-delimited bodies.
Conflicting framing, unsupported transfer encodings/trailers, invalid UTF-8,
and oversized/truncated responses return errors. Errors never authorize a
retry or become successful JSON. HTTP error statuses such as 504 still
reach the existing workload's UNKNOWN handling when their framing is valid.
The read deadline starts after the request is written; it does not bound
DNS/connect/write time or the separate SSE collector.

No daemon forwarding defaults change. The SSE collector remains a separate
unbounded queue/line-buffer follow-up; this change does not qualify the whole
observer against hostile ingress. The new tests run in the existing
`cargo test --workspace --locked` CI gate. Local reproduction:

```sh
cargo test -p btungsten-meshdep --locked
cargo fmt -p btungsten-meshdep --check
```
