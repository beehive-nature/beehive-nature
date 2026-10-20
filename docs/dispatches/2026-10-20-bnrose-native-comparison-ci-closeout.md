# Native BNRoSe comparison and invitation CI closeout

Measured on 2026-10-20 UTC. This dispatch separates invitation regression
validation, dependency remediation, and observational kernel measurements.

## Invitation PR #5: all checks terminal

[PR #5](https://github.com/loviswaternakamoto/x0x/pull/5) remains open at
`3956274a07958e8b01da34eacf9fb672148e7048`.
Final rollup: **30 success, 2 skipped, 1 failure, zero pending**.
The sole failure is Cargo Audit: the same seven rustls/zip advisories tracked
by separate PR #3. No audit ignore or dependency change belongs to PR #5.

[CI run 39394537880](https://github.com/loviswaternakamoto/x0x/actions/runs/39394537880)
completed successfully at that head. Test Suite passed 4,746 tests with
326 skipped in 451.272 seconds; voice acceptance passed one additional test.
Coverage execution passed 4,740 tests with 318 skipped in 451.153 seconds.
Line coverage is 86.97% (172033/197799), above the unchanged 65.70% floor.
Advisory targets remain unmet: REST/API and Agent core 80.95% against 90%;
network transport 82.65% against 85%. All six platform builds succeeded.
Weekly timing and soak jobs were skipped; a one-hour soak is not claimed.

The earlier native NixOS baseline reproduced the invitation failure, and
the repaired suite passed all seven ignored convergence tests. See the
[invitation dispatch](2026-10-20-invitation-convergence-nixos.md).
Final check JSON and selected job log excerpts are in
[invitation receipts](../receipts/invitation-convergence-20261020/).

## Native Rust baseline versus Rust BNRoSe

Source: PR #4 `85633f6a6dfea44e62a0cad778aa429275fc4604`, kernel pin
`49b88d7b294687711b9871f34a74b961f7d5f62a`.
PR #4 remains open and unmerged. No source optimization was added in this pass.
The previously source-built native release executable was measured five times
on Hostinger NixOS 26.05, x86_64, Rust 1.95.0.

Each process warms both arms, alternates their order over 32 rounds of 64
announcements, and retains raw pairs: 10,240 observations per arm across
five processes. Median of the five per-run p50 overhead ratios is **4.46%**,
range **0.95–10.79%**. Median per-run added p50 is **9.26 microseconds**.
The separate medians of baseline and shadow run p50 values are 219.431 and
231.511 microseconds; their ratio is not the median paired overhead statistic.

| Local observers | Baseline median operations/s | BNRoSe median operations/s |
| --- | ---: | ---: |
| 1 | 4,196 | 4,186 |
| 2 | 8,784 | 7,786 |
| 4 | 16,267 | 14,620 |

These are local signed-announcement verification and observational admission
operations, not network throughput or users. Scaling trials execute baseline
first, then shadow, with 1,024 operations per observer. The VPS is shared;
there is no dedicated CPU isolation. Five runs do not establish a stable
production performance distribution.

The historical 21.76% to 9.09% result compared older and newer Rust revisions
using WSL-built binaries executed on NixOS. This fresh native 4.46% result
is a separate experiment, not evidence of another source optimization.
The adapter still adds work; this does not demonstrate a speed improvement.
No equivalent implementation in another language was measured.

At the pinned x0x source, `src/bnrose_shadow.rs::verify_baseline` calls
`announcement.verify()`; `observe` invokes that baseline before observational
admission, including duplicates. Both benchmark arms retain that verification.
`examples/bnrose_shadow.rs` defines the paired workload. No signature cache,
verification bypass, delegated authority, or production transport change was
introduced. The observer remains opt-in and observational.

Runs used a dynamic user, private network namespace, empty capabilities,
read-only executable bind, no-new-privileges, and a 256 MB memory limit.
The production node was not replaced: final health reported 25 send-ready
peers and zero restarts. Raw measurements, executable checksum, sandbox
receipts, and reproducible analysis are in
[native comparison receipts](../receipts/bnrose-native-comparison-20261020/).

## Decentralized direction and unmeasured boundaries

The founder's intended architecture is self-funded autonomous peers, DAO
governance, and bandwidth supplied directly through WebRTC–ANT/x0x PQ.
Validation must preserve each peer's control over resource contribution and
admission. DAO decisions must not silently grant execution authority over a
peer or bypass its cryptographic verification.

Local funding removes a central fleet funding obligation; it does not establish
capacity under congestion, churn, partitions, or uneven peer resources.
The next useful comparisons must preserve identical verification and policy
while measuring bounded fan-out, memory, bandwidth, overload rejection,
direct delivery, partition recovery, and independently authorized upgrades.
Any language comparison needs the same protocol, crypto, wire data and
resource budget.

Ten billion simultaneous users and thousand-year continuity are long-term
design targets, not measured acceptance results. Version migration,
cryptographic agility, recoverable data, and peer-controlled key rotation
need explicit evidence. This pass runs post-quantum verification on classical
CPUs; quantum-hardware execution, direct WebRTC–ANT/x0x delivery, DAO execution
and live-mesh capacity were not tested here.

Oracle's three-domain A1 capacity blocker remains separate. No Oracle instance
was started or validated in this pass. PR #3 audit fixes remain separate;
PR #4 was not merged.
