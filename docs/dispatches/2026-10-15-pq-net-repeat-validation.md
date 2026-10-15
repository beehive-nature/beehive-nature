# PQ-NET fresh-identity replication and upstream adoption — 2026-10-15

## Scope and frozen protocol

Follow-up to #437 and upstream saorsa-gossip #115. Four new matched
nine-node pairs compare the same V3-fixed daemon under baseline and
`shed_normal`. Every leg starts with a new directory and identity set.
The order and acceptance rules were written before measurements in
[the protocol](../evidence/pq-net-repeat-validation-20261015/protocol.md).
The old one-pair 3.52 percent observation is a prior result, not the expected
answer for this replication. No production default is changed.

Refreshed main starts at `8b2cfe606`; the frozen harness and Cargo.lock are
unchanged from the verified #437 merge `4c689a953`. New measurements wait
for unrelated compiler/linker activity to finish and record any overlap.
An old idle Cargo parent is not treated as active compilation. No unrelated
process, namespace or worktree is changed.

## Upstream status and acceptance boundaries

At the opening check, [saorsa-gossip #115](https://github.com/saorsa-labs/saorsa-gossip/pull/115)
remains open at `a9f77b1d6a2cda60c0d44d28aaba066a732fca07`, with no maintainer
review or merge. Upstream main remains `4d41f88`; the fork CI run
[38733182255](https://github.com/saorsa-labs/saorsa-gossip/actions/runs/38733182255)
is `action_required`. The automatic Greptile check reports success; it is
not maintainer approval or CI execution. This account has pull-only access
upstream and cannot approve the run or merge the PR.

Current x0x main pins saorsa-gossip-pubsub `=0.5.88`. That version pin alone
does not contain or establish adoption of this unmerged fix. Adoption needs
upstream merge ancestry, a release containing the change, and an x0x pin
or build demonstrably using that release. The isolated tested backport from
#437 remains separate from a shipped production daemon.

David Irvine's #504 acceptance terms still require per-kind counters and a
same-workload delivered/published capture; default changes require ADR 0078.
The #622 work is consolidated into #504. The latest #505 field acceptance
comment closes the handshake-fragmentation work and separates gossip egress
work into #504. These private nine-node trials do not replace public-mesh
field measurements, revocation exemptions, or named-group delivery gates.

Vaulta, bRUSTvmWALLET, bSigner, x0x, ANT, AR-fractal-anchors,
Hive-fractal-anchors and BCH-fractal-anchors retain the acceptance boundaries
recorded in #437. This experiment supplies transport delivery and traffic
receipts, not signing, payment, anchor broadcast or settlement acceptance.

## Results and delivery

**Store delivery repeated; a consistent bandwidth saving did not.** All eight
primary legs delivered 20/20 store recipient/value pairs within the ten-second
deadline: 160/160 overall. All 80 puts returned HTTP 200 and all 80 sender
readbacks matched. Targeted DMs passed 96/96, group messages 96/96 and probes
4,480/4,480, with no delayed, lost or unknown deliveries in those matrices.

| Pair | Order | Baseline idle B/min | Shedding idle B/min | Saving | Store, each leg |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | baseline, shedding | 1,319,793 | 929,854 | 29.55% | 20/20 |
| 2 | shedding, baseline | 1,133,907 | 841,438 | 25.79% | 20/20 |
| 3 | shedding, baseline | 1,024,049 | 1,278,243 | -24.82% | 20/20 |
| 4 | baseline, shedding | 1,760,370 | 932,962 | 47.00% | 20/20 |

Traffic is mean idle ingress plus egress across seven leaves, measured over
90 seconds per leg. Positive saving means less traffic under shedding.
Three pairs save traffic; pair 3 uses 24.82% more. The mean paired saving is
19.38%, median 27.67%, range -24.82% to 47.00%. The ratio of aggregate means
is 23.97% lower, a different descriptive estimator. Neither average proves
a stable saving. Fresh identities differ between legs, and this single-host
experiment does not identify the source of the traffic variation. The old
3.52% single-pair figure must not be promoted to a general efficiency claim.

Seven of eight legs pass every workload/cost gate. Pair 4's baseline is a
retained valid failure: the constrained leaf measures 2,147,645 B/min against
its 2,097,152 B/min budget. Its delivery gates, CPU and memory gates pass.
No budget is relaxed and no production shedding default is changed.

All 72 new public identity prefixes are distinct from one another, the 54
prior nodes and the nine excluded-trial nodes. All effective leaf byte
policies match their planned leg; workloads and full budget hashes match.
All 72 primary daemon logs have zero SSE lag warnings, and no primary
observer failure invalidates a trial. Both store recipients record zero
recovery queue overflows and zero budget timeouts in every primary leg.

The first attempted baseline, qva, delivered 20/20 but had compiler activity
in three of 27 host samples. It is retained in excluded-trial.json, outside
the primary pairs under the predeclared rule. Replacement IDs and the longer
quiet window were recorded before those replacement runs. A later preflight
detected another btmd namespace before qvd started. No conflicting namespace
remained at the follow-up inventory, so its owner/start time was not inferred.
The resume preserves completed legs and waits for other rigs to clear.

Compiler/linker sampling covers every primary leg with no observed overlap.
An added five-second namespace trace covers the final five legs and records
no foreign-rig overlap during those intervals. The first three legs have
preflight checks, not continuous namespace evidence; no retrospective absence
claim is made. These are bounded private-rig receipts, not an entirely idle
physical host or public-mesh field acceptance. The trial rigs were cleaned
up; the preexisting wa/wb namespaces remain.

[Full trial comparison](../evidence/pq-net-repeat-validation-20261015/comparison.json),
[paired statistics and identities](../evidence/pq-net-repeat-validation-20261015/replication.json),
[receipt digests](../evidence/pq-net-repeat-validation-20261015/manifest.md),
[protocol records](../evidence/pq-net-repeat-validation-20261015/protocol-records.md)
and [namespace coverage](../evidence/pq-net-repeat-validation-20261015/namespace-coverage.json)
provide the audit trail. Scripts validate receipt completeness, identity
uniqueness, effective policy and observer health. Independent aggregation
rechecked all delivery totals and full budget equality. No source change
requires rerunning the already recorded 413-test pubsub suite from #437.

Before delivery, the branch was fast-forwarded to current main `032b0e1aa`;
the harness and Cargo.lock remain byte-unchanged. An hourly follow-up named
"Follow PQ-NET #115 upstream adoption" is active and stays quiet unless there
is a meaningful change. The latest upstream read still has #115 open,
upstream main `4d41f88` and latest release v0.5.88 (2026-10-12). Maintainer
CI approval, merge, release and x0x adoption remain outstanding. This replication does not establish upstream release or production adoption.

