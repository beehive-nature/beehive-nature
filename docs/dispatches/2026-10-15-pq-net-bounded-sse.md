# PQ-NET: bounded SSE evidence and matched delivery/bandwidth measurement

Owner: Codex, isolated `404d/wt-pq-net`, branch `codex/pq-net-bounded-sse`.
Base: `3ac8bdf3c34d12afb6499d9ad37e950e8d3676cb`, merged #431.
Work began October 14 America/Denver; this dispatch closes on October 15.

## What changed

`crates/btungsten-meshdep/src/sse.rs::reader` replaces the unbounded SSE
line buffer and reconnect loop. Each node has 128 queued frames, bounded
64 KiB event/line state, a 16 KiB header cap, and a 128-byte chunk-size
line cap. Declared chunk sizes do not allocate buffers. Connect/write
timeouts are five seconds each; header reads have a ten-second total
deadline. Idle reads check cancellation every 200 ms. The parser supports
chunked streaming, split UTF-8, LF/CRLF/CR lines, BOM, multiline data, and
blank-line dispatch. Unsupported framing/encoding fails closed.

`client.rs::CollectorSet` waits for each stream's valid response before
returning. It uses nonblocking bounded sends and sticky failures stored
outside the data queue. Overflow, disconnect, malformed JSON/base64,
oversized frames, and thread panic cannot become a successful observation.
No reconnect asserts continuity without a replay contract. Each drain
handles at most 128 frames per node. Workload loops drain between sends.

`CollectorSet::finish` joins producers before the final drain, retaining
accepted matching evidence in the ledger. `battery.rs::trial_body` writes
the ledger and observation receipt even if workload execution fails.
Invalid observations return an error before delivery/cost verdict creation;
`run_trial` writes `invalid-trial.json`. A fresh run ID is required, so a
failed retry cannot inherit an old successful verdict file. Flood uses
the same final drain and validity gate. Drop joins early-exit readers.

These are observer memory/content bounds, not process RSS guarantees or
daemon forwarding changes. Queue overflow is explicit invalid evidence,
not a claim that the network lost an operation.

## Verification

- 34 crate tests pass on native Windows and WSL Linux, including live TCP
  tests for overflow, final evidence drain, chunk fragmentation, disconnect,
  idle cancellation, malformed JSON, HTTP error status, unsupported encoding,
  header/event bounds, split UTF-8, BOM, and multiline/CR events.
- `cargo fmt -p btungsten-meshdep --check` and `git diff --check` pass.
- `e2e/hooks-installed.test.sh` passes: absent-hook mutation detected,
  installed hook blocks the secret vector, marked public constants and clean
  content commit. Existing managed hook wiring is preserved.
- A deliberate duplicate run ID returns `refusing existing trial receipts;
  use a fresh run_id` before touching the rig.
- Existing unrelated compiler warnings remain; this is not a warning-free
  workspace or whole-workspace Clippy claim.

## Matched experiment contract

Final driver: `~/btmd/pq-net-sse-final-target/debug/btmd`, built from this
source with `cargo build -p btungsten-meshdep --locked` in WSL. Raw roots:
`/home/travi/btmd/pq-net-sse-final-runs` and separately retained preliminary
`/home/travi/btmd/pq-net-sse-runs`. Full binary/source/receipt digests are in
[the manifest](../evidence/pq-net-sse-20261015/manifest.md).

The v0.47.1 archive passes its published `.sha256`; the extracted `x0xd`
matches the archive member. Both legs use that identical daemon. No claim
is made about v0.48.0 or the public mesh. Namespaces and two bridges use
unused subnet third octets 83 (scales three/six) and 84 (nine), separate API/mesh paths, explicit private
bootstrap/network IDs, no mDNS, no port mapping, and updates disabled.
Existing `wa`/`wb` namespaces are untouched.

```sh
BTMD_RIG=1 ~/btmd/pq-net-sse-final-target/debug/btmd p2 \
  --run-id pqnet-final-20261014 --subnet-third 83 --scales 3,6,9 \
  --rounds 1 --version v0.47.1 --binaries-root /home/travi/btmd/pins \
  --work-root /home/travi/btmd/pq-net-sse-final-runs
```

The initial final-driver scale-nine setup exited 1 before workload:
`ip link add bm83-seed ...: RTNETLINK answers: File exists`. On inspection
the veth had disappeared; only the newly created empty `btmd-pqn-seed`
namespace remained (no processes, loopback only). That owned namespace
was removed. No foreign namespace/process was altered. The failed setup's
spec, workload, and captured-error receipt remain in the manifest and JSON.
Both scale-nine legs were rerun with `trial --scale 9 --subnet-third 84`,
fresh IDs `qnb-s9-20261015` / `qnc-s9-20261015`, labels `baseline` /
`shed_normal`, and only the latter adds `--gossip byte_policy=shed_normal`.
Cleanup is checked between legs. This is a rig setup failure, not a
delivery failure; no result is manufactured for the interrupted attempt.

One sequential baseline/`byte_policy=shed_normal` pair at each scale;
no overlapping rigs. The committed budgets are unchanged. Workload files
bind identical defaults: 12 DMs (256 bytes), six group messages, ten store
puts (512 bytes), 40 Bulk probes (1024 bytes), 40 Normal probes (256 bytes),
and 90 seconds idle. Default 45-second observation sweep is unchanged.
Readiness, calibration, and group/store setup precede the measured phase.
Cost is kernel veth accounting; API polling uses the other plane.

DM matrix cells include durable API ACKs under the existing ledger contract;
group/store evidence comes from recipient reads, and probes from SSE
envelope observations. Topic-level probe published/observed counts are
included separately. Whole-workload byte totals include settlement time;
they are not normalized per-message wire costs. Per-node rows retain seed
and relay burden, as well as every leaf's ingress and egress.

Results: see [the matched table](../evidence/pq-net-sse-20261015/summary.md)
and [machine-readable receipts](../evidence/pq-net-sse-20261015/comparison.json).
All six final observations are valid, with no collector failures or matching
server SSE lag warnings. Five final trials pass the frozen gates. The
nine-node `shed_normal` trial fails: store delivery is 6/20 versus baseline
20/20; 14 pairs remain unobserved. Mean leaf idle traffic is 1,340,226 versus
1,135,096 B/min (about 18.1% higher). At three nodes the mean drops about
1.0%; at six it drops about 22.6%, with all their final delivery gates passing.
DM/group/probe matrices are complete in all six final trials. Both probe
topics have 40 published operations per trial, with all intended SSE pairs
observed. No store-join-pending note was emitted. These results do not
qualify `shed_normal` as a general improvement; production defaults remain
unchanged. All owned experiment namespaces/bridges are gone after teardown;
the pre-existing `wa` and `wb` namespaces remain.

Preliminary runs predate final protocol/error-path hardening, remain in a
separate section, and are never pooled with the final build. Their six-node
candidate already recorded 17/20 on-time store observations and three late
ones; its nine-node leg recorded 18/20 and two unobserved pairs. Those gate
failures are retained, not averaged away. A ledger `lost` row means absent
from this harness's bounded observation, not proof of permanent network
loss. This P2 run does not repeat the separate revocation/recovery drills.

## Upstream acceptance and limits

Rechecked #409 and #430: both remain open at unchanged heads `de7c5d18b`
and `ada2cb863`. This follow-up depends only on merged #431/current main.
The [prior reconciliation](2026-10-14-pq-net-bounded-observer.md) remains
the detailed rail mapping and upstream handoff. David Irvine's
[#504 request](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
and open [#1170](https://github.com/saorsa-labs/x0x/issues/1170) still call
for per-kind verify/bus/delivery/publish counters and reset provenance.
#622 moved back to #504; #505's historical field acceptance is not a new run.

Pinned x0x `src/server/sse.rs::events_sse` logs `RecvError::Lagged` without
sending a gap marker. Node logs are checked for its exact lag warning;
absence of that warning does not invent an upstream sequence/replay proof.
Our operation digest remains the canonical WB001 envelope identity, not
the stable authenticated transport message ID requested in #869. One pair
per scale cannot establish a statistically reliable bandwidth improvement.
No upstream comment or public-mesh capture is sent by this lane.

## Estate surfaces remain in the acceptance boundary

Vaulta anchor identity/epoch binding (`bzdid::anchor::Anchor::{verify,binds}`),
bRUSTvmWALLET's concrete wallet-relay/BNROSE runtime seams, bSigner's frozen
contract, x0x transport, ANT preservation, AR fractal anchors, Hive fractal
anchors, and BCH fractal anchors all remain included as mapped in the prior
dispatch. No payment, signing, anchor broadcast, settlement, or end-to-end
PQ qualification is inferred from these transport measurements. The literal
bRUSTvmWALLET name is still a user scope label, not a separately verified
component found in this checkout. No daemon or production rail defaults
change in this patch.
