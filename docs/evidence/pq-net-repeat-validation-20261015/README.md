# PQ-NET fresh-identity replication

**Delivery held across all eight primary legs. Bandwidth savings were not
consistent across the four pairs.** See the
[dispatch](../../dispatches/2026-10-15-pq-net-repeat-validation.md) for the
result table, failed cost gate and adoption status.

| File | Receipt |
| --- | --- |
| [comparison.json](comparison.json) | All eight primary trial matrices, per-node costs, HTTP puts/readbacks, observer status and recovery counters |
| [replication.json](replication.json) | Four paired bandwidth calculations, 72 public identity prefixes and host sampling summaries |
| [protocol.md](protocol.md) | Protocol written before measurements |
| [protocol-amendment-1.md](protocol-amendment-1.md) | Compiler-overlap exclusion and replacement pair, declared before replacement runs |
| [excluded-trial.json](excluded-trial.json) | Original baseline retained outside primary comparison because of observed compiler overlap |
| [preflight-resume.md](preflight-resume.md) | Rig preflight interruption and bounded resume |
| [protocol-records.md](protocol-records.md) | Timestamped original, amendment and resume records with verified source digests |
| [namespace-coverage.json](namespace-coverage.json) | Timings and explicit runtime namespace-watch coverage; final five legs only |
| [manifest.md](manifest.md) | Raw receipt, frozen driver/daemon, source, host-sample and namespace-trace digests |

All primary legs use the identical V3-fixed x0x v0.47.1 backport executable
and #433 driver from [the preceding build record](../pq-net-store-propagation-20261015/README.md).
No rebuild or protocol-default change is part of this replication. The
harness source and Cargo.lock are unchanged through BNR main `032b0e1aa`.
Raw trial directories are `/home/travi/btmd/pq-net-repeat-runs` on this host.
No private identity files, API tokens or complete daemon logs are published.

For each leg, mean leaf idle traffic is the sum of ingress plus egress B/min
for nodes n1 through n7 divided by seven. Pair saving is
`100 * (baseline_mean - shedding_mean) / baseline_mean`.
The primary descriptive average is the arithmetic mean of those four
percentages (19.38%); the ratio of means (23.97%) is a separate estimator.
The range includes a 24.82% increase under shedding, so neither positive
average establishes a stable saving or supports changing defaults.

Four independent pairs on one host are a bounded replication. Identities
are fresh in every leg, not reused within a pair. Only workload, budgets,
binaries, topology size and policy order are matched. These receipts do not
isolate the cause of traffic variance, prove public-mesh performance, or
establish upstream release/production adoption. All delivery conclusions
refer to the recorded observation deadlines.
