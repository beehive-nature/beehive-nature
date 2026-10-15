# PQ-NET V3 recovery identity and store propagation — 2026-10-15

## Diagnosis and bounded change

Follow-up to #433, starting from main `7106ea332`. Its matched nine-node
candidate accepted all ten puts (HTTP 200), retained all ten at the sender,
and returned 404 for sixteen of twenty intended recipient/value pairs.
Those receipts distinguish recipient availability from API refusal.
The delivery branch was later fast-forwarded to refreshed main `8e7a16f9d`
(#410/#434); the harness and Cargo.lock are byte-unchanged across that move.

The diagnostic run `qtd-s9-20261015` used the same pinned x0x v0.47.1 and
driver with KV/pubsub debug logging. It observed 10/20 store pairs on time,
all ten puts accepted, no collector failures, and repeated `serialized
PubSub recovery-intent limit reached` warnings. Later store snapshots show
that the deadline misses cannot be described as permanent data loss.
This logging run is diagnostic evidence, not a matched bandwidth leg.

`saorsa-gossip-pubsub::PlumtreePubSub::recovery_intent_key` only parsed the
legacy `GossipMessage` layout. Negotiated key-cache V3 Full/Ref frames fell
back to hashing the complete wire bytes. IHAVE/IWANT retries re-sign the
same batch, so fresh signatures created fresh recovery intents instead of
continuing the retained intent and its accumulated credit. The focused
negative control reproduces eight intents for one batch. The failing live
legs have active Full/Ref traffic, not just a hypothetical V3 configuration.

The fix decodes the existing V3 envelope for semantic identity, excludes
the signature from that identity, and binds the V3 format and serialized
length to the operation. Full/Ref transitions therefore retain a family
while replacing the differently sized operation through the existing credit
accounting path. Malformed frames retain the byte-hash fallback. Wire
encoding, signature acceptance, queue bounds and byte budgets are unchanged.

The companion `handle_ihave_admitted` repair addresses replacement of a
same-peer outstanding request even when `retry_pending` says the bounded
flush queue already owns it. Repeated advertisements can therefore repeat
serialization/admission and renew the outstanding request age. The repair
coalesces that case. It preserves the existing queue bounds, byte budgets,
expiry, failed-send backoff, sent-request retries and alternative-source
behavior. No topic is promoted to Critical and no shedding default changes.

The #433 end-of-run recovery counters further locate pressure at the two
recipients: n1/n2 report 10,548/15,954 `queue_overflow` events under shedding,
versus zero in the baseline. These aggregate events are not a count of lost
store messages. The reproduced repeated-advertisement defect is a bounded
repair in that path; its contribution to the observed 404s must be assessed
by the daemon experiment, not inferred from those counters alone.

That companion regression extends `byte_deferred_iwant_retries_once_and_recovers_local_origin_payload`:
eight repeated advertisements must preserve demand and request age; after
credit refills, the queued request must still recover the exact payload.

The guard alone was insufficient in the source-built matched comparison:
both baselines delivered 20/20 store pairs, but shedding delivered 11/20
unpatched and 7/20 with only the guard. Mean leaf idle traffic was 1,060,929 /
1,188,498 B/min for the control baseline/shedding pair and 1,028,691 /
1,406,499 B/min for the guard-only baseline/shedding pair. These negative
results remain in the evidence. They do not establish a causal regression
from a single pair, and they do not support a propagation or bandwidth
benefit from the guard alone.

## Upstream and estate scope

Rechecked #409 and #430: both remain OPEN at `de7c5d18b` and `ada2cb863`.
Their keychain and prepared-key proof work is not subsumed by this transport
repair.

David Irvine's [#504 measurement request](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
remains governing; #622 redirected its work there. This private nine-node
rig does not supply public-mesh field evidence or the outstanding per-kind
transport counters. Synthetic request counts are not recipient delivery.

Vaulta, bRUSTvmWALLET, bSigner, x0x, ANT, AR-fractal-anchors,
Hive-fractal-anchors and BCH-fractal-anchors remain in the acceptance scope
mapped in [the reconciliation](2026-10-14-pq-net-bounded-observer.md).
This repair concerns x0x's gossip recovery dependency. It establishes no
signing, payment, anchor broadcast, settlement or estate-wide PQ acceptance.

## Verification and delivery

The fix is submitted as [saorsa-gossip #115](https://github.com/saorsa-labs/saorsa-gossip/pull/115).
The final V3-aware source is `a9f77b1d6a2cda60c0d44d28aaba066a732fca07`.
Its two new tests pass for re-signed IHAVE/IWANT Full/Ref frames, refill
completion, size transitions, payload separation and malformed frames.
The latest full library run passes **413 tests, zero failures, one ignored**.
Package Clippy across all features and targets with warnings denied, and
formatting, also pass. Earlier failures below are retained as earlier
observations, not the final suite result.

The companion regression fails without the guard: IWANT demand becomes 48,609 bytes
instead of 5,401 after eight repeated announcements. With the guard all 31
IWANT tests pass, including exact payload recovery after credit refill.
Formatting, diff-whitespace and package Clippy checks with warnings denied
pass. [Local verification receipts](../evidence/pq-net-store-propagation-20261015/verification.md)
preserve the exact results and raw-log digests.

The earlier guard-only library suite reported 409 passed, two failed, one ignored.
`deferred_eager_reply_custody_is_bounded_and_cache_authorized` and
`partial_budget_ihave_flush_preserves_each_recipient_exactly_once` also fail
in the unpatched full suite. The latter passes on an isolated patched rerun;
the former fails in isolation with the guard and passes without it, but both
full-suite variants fail it. Its assertion measures a cache with a one-second
lifetime while filling 1,024 entries; the patched function is not on that
test's call path. These are retained failures, not a green full-suite claim.
The unpatched full suite finishes with 407 passed, three failed, one ignored
and the new regression excluded. Its additional failure is
`peer_scoring_populated_by_real_handle_eager_path` (timing-sensitive score
0.98637 versus the test's approximately-one expectation).

Upstream [CI run 38733182255](https://github.com/saorsa-labs/saorsa-gossip/actions/runs/38733182255)
requires maintainer approval for the fork. No upstream CI success or merge is
claimed. The upstream pre-commit wrapper was not installed because its
additional tool dependencies are absent; the named verification commands
were run directly. This is separate from BNR's installed hook checks.

The published crate alone cannot compile its tests because its
unpublished legacy compatibility fixture is omitted. Adding that fixture to
the registry package also produces incompatible identity-version resolution;
verification therefore uses the upstream workspace, where the fixture and
workspace path dependencies are available. Initial workspace invocations
needed an ignored lockfile and an explicit `@0.5.88` package selector because
the compatibility fixture also imports version 0.5.66. These setup failures
are not regression-test results.

## Matched nine-node result

| Source | Policy | Store on-time / expected | Mean leaf idle B/min | Gates |
| --- | --- | --- | ---: | --- |
| Control | baseline | 20/20 | 1,060,929 | PASS |
| Control | shed_normal | 11/20 | 1,188,498 | FAIL |
| Guard only | baseline | 20/20 | 1,028,691 | PASS |
| Guard only | shed_normal | 7/20 | 1,406,499 | FAIL |
| V3 fix + guard | baseline | 20/20 | 1,121,953 | PASS |
| V3 fix + guard | shed_normal | 20/20 | 1,082,447 | PASS |

All sixty puts returned HTTP 200 and all sixty sender readbacks matched.
Each run delivered 12/12 targeted DMs, 12/12 group messages and 560/560
probes. No observer failures or SSE lag warnings invalidated these trials.
The final shedding run recorded zero recovery queue overflows and zero
budget timeouts at both store recipients. Its store matrix has no delayed,
lost or unknown pairs. Negotiated V3 Full/Ref traffic remained active.

This supports a bounded propagation cause, not API refusal: retries under
V3 lost their semantic identity and accumulated recovery credit. The fixed
pair restores on-time store delivery while measuring about 3.52% lower mean
leaf idle ingress plus egress under shedding. This single pair is not a
fleet estimate and does not justify changing the production default.

[Comparison receipts](../evidence/pq-net-store-propagation-20261015/comparison.json),
[build and workload contract](../evidence/pq-net-store-propagation-20261015/README.md),
[raw receipt digests](../evidence/pq-net-store-propagation-20261015/manifest.md)
and [test receipts](../evidence/pq-net-store-propagation-20261015/verification.md)
preserve all six runs, including the unsuccessful guard-only candidate.
The evidence directory contains the final production backport and complete
upstream patch. These are tested source and isolated-runtime receipts;
upstream release adoption and production deployment remain outstanding.
