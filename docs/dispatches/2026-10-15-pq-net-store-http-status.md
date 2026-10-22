# PQ-NET store HTTP status and nine-node comparison — 2026-10-15

## Change and evidence boundary

Follow-up to merged #432, starting from main `8cb952f51`. The prior nine-node
candidate had 6/20 store observations but no put HTTP receipts. Its ten
`Published` events were emitted before status checking, so that run cannot
establish whether the absent values were API refusals or propagation failures.

`workload.rs::record_store_put_result` now journals every put response or
client error before returning. `Published` requires HTTP 200 with a valid
acceptance body. HTTP 202, other statuses, malformed acceptance and no complete
response preserve UNKNOWN delivery until actual recipient evidence arrives.
The response excerpt is bounded to 512 Unicode characters, with an explicit
truncation flag and full-response digest. No authorization headers are stored.
The fixed workload continues after failed puts without adding retries.

Pinned x0x v0.47.1 `src/server/routes/stores.rs::put_kv_value` returns 200
`ok:true` after publication; 202 persists locally with `published:false` and
may attempt direct delivery. A 5xx is an API failure response, not proof that
no mutation occurred. The battery records existing recipient read HTTP
statuses, exact-envelope matches and read errors. It gives unresolved writes
the full 45-second sweep and performs sender readback only after the workload
and idle cost windows. Sender readback never counts as recipient delivery.

## Verification and matched experiment

36 tests pass on native Windows and WSL Linux. HTTP fixtures cover 200, 202,
403, 500, malformed/contradictory 200 and disconnect. They verify no false
publication, UNKNOWN preservation, subsequent recipient evidence resolving
UNKNOWN, and journal serialization. Unicode truncation is explicit and safe.
Formatting, diff whitespace and hook wiring checks pass. The first test build
failed with Rust E0308 (String supplied where NodeClient::new needs &str);
borrowing the address fixed it before either measured leg. Existing compiler
warnings remain; no unrelated warning cleanup is claimed.

Both legs use one frozen driver, pinned x0x v0.47.1, nine isolated WSL nodes,
subnet 85, fresh run IDs qsb/qsc, and unchanged budgets: 12 DMs, six group
messages, ten 512-byte store puts, 40 Bulk and 40 Normal probes, 90-second
idle window. Baseline and shed_normal run sequentially with teardown checked
between them. These are private rig wire counters and application evidence,
not public-mesh or fleet measurements. No default route to the public mesh is
introduced. Existing wa/wb namespaces belong to other work and are preserved.

Results and raw receipt hashes are in
[comparison.json](../evidence/pq-net-store-status-20261015/comparison.json) and
[manifest.md](../evidence/pq-net-store-status-20261015/manifest.md).

## Upstream and estate scope

Rechecked #409 and #430: OPEN at `de7c5d18b` and `ada2cb863`. David Irvine's
[#504 request](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
remains the governing measurement request; #1170 remains open. #622's last
comment moves its work back to #504; #505's September field acceptance is
historical. This lane does not supply missing upstream per-kind counters,
reset provenance, authenticated transport IDs (#869), or new public-mesh data.
No upstream message is sent. SSE collector failures invalidate a trial; server
lag-warning checks do not prove sequence continuity when upstream sends no gap
marker. One matched pair cannot establish a reliable policy improvement.

Vaulta, bRUSTvmWALLET, bSigner, x0x, ANT, AR-fractal-anchors,
Hive-fractal-anchors and BCH-fractal-anchors remain in the acceptance scope
mapped in [the prior reconciliation](2026-10-14-pq-net-bounded-observer.md).
This change instruments the x0x seam only. The bRUSTvmWALLET name remains a
user scope label mapped to wallet-relay/BNROSE seams, not a separately verified
component. No signing, payment, anchor broadcast, settlement, or end-to-end PQ
qualification follows from these measurements. Production defaults are unchanged.

## Measured result: accepted writes missing at recipients

| Nine-node leg | Put HTTP 200 | Sender matches | Store on-time pairs | Mean leaf idle B/min | Gates |
|---|---:|---:|---:|---:|---|
| baseline | 10/10 | 10/10 | 20/20 | 976,932 | PASS |
| shed_normal | 10/10 | 10/10 | 4/20 | 977,482 | FAIL |

All twenty puts returned `{"evicted_keys":[],"ok":true}`. There were no
202 responses, refusals, client errors or truncated put responses. Baseline
recipients read every value. Candidate recipients n1 and n2 read k0/k1;
each returned HTTP 404 on all 16 checks for each of k2 through k9. All ten
sender readbacks returned 200 and matched the original envelope bytes.
Thus the candidate's sixteen absent recipient pairs are accepted-and-stored
writes not observed remotely within the sweep, not PUT API refusal. The
reads were completed 404s rather than transport/read errors. This narrows
the failure to propagation/recipient availability after API acceptance;
it does not locate the internal gossip/direct-delivery/application cause,
prove permanent loss, or retrospectively classify the prior statusless run.

Mean leaf idle traffic increased about 0.056% in this pair, effectively flat;
no bandwidth benefit is established. Per-node ingress/egress, seed/relay
burden, workload-phase costs and failed gates remain in comparison.json.
Both collectors report no failures, and all eighteen node logs contain zero
matching SSE lag warnings. Both owned rigs fully tore down; wa/wb remain.
The failed policy gate is a measured result to retain, not a failing harness
test to suppress. No shedding default is promoted.

DM delivery was 12/12, group 12/12 and probe 560/560 in both legs. No store
join-pending note was emitted. Those complete matrices do not erase the
candidate store failure or qualify shedding across the estate rails.
