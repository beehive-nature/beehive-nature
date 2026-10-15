# Fresh-identity replication protocol

Protocol fixed before the new trials on 2026-10-15. This lane repeats the
V3-fixed baseline versus V3-fixed `shed_normal` comparison from #437. It
does not change the daemon, harness, workload, budgets or production policy.

Four matched pairs use eight independent nine-node identity sets. Order is
baseline/shedding, shedding/baseline, shedding/baseline, baseline/shedding.
Run prefixes qva through qvh are assigned in that order. Each run uses a
previously absent directory; startup public agent ID prefixes will be recorded
and checked for uniqueness across all eight runs and the preceding six runs.
Private keys, API tokens and complete daemon logs are never published.

The frozen driver, V3-fixed daemon, 90-second idle window, 45-second sweep,
ten-second store deadline, nine-node topology, subnet 86 and workload match
#437. Binary digests and original build receipts remain in
[the preceding manifest](../pq-net-store-propagation-20261015/manifest.md).
All measurements are sequential and isolated from the public mesh.

Before each leg, require three compiler/linker-free host samples fifteen seconds
apart. Sample compiler/linker processes and host load every five seconds during each
run. A build overlap invalidates the matched pair for the primary summary;
retain the raw run and stop before continuing. Do not stop unrelated work.
Existing wa/wb namespaces are not owned by this lane.

Delivery acceptance requires all intended store pairs on time in every
valid leg, all HTTP puts and sender readbacks accounted for, and no observer
failure or SSE lag. Report every workload matrix and recipient recovery
counter, including failures. A failed delivery gate is a measured result,
not an excuse to discard a valid trial.

For bandwidth, report each pair's mean seven-leaf idle ingress plus egress
in B/min, its percentage difference, and the four-pair mean, median and
range. Report whether savings are positive in every pair; do not assume the
original 3.52 percent repeats. Four pairs on one host cannot establish a
public-mesh or fleet-wide saving, nor justify promoting shedding defaults.


An old idle Cargo parent is not itself an active compiler. The guard samples rustc, rustdoc, cc1, cc1plus, ld.lld, ld and collect2; no unrelated process is stopped.
