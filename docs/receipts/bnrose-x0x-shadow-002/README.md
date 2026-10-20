# BNRoSe / x0x shadow optimization: NixOS comparison

This receipt compares the original shadow adapter at
`e49603a45afef364accf62141b2897fbcf9b5115` with the optimization at
`85633f6a6dfea44e62a0cad778aa429275fc4604` in x0x PR #4. The PR remains
stacked on security PR #3. The original revision completed 32 successful
checks and two scheduled-only skips; `previous-head-checks.json` records it.

## Change and security boundary

`src/bnrose_shadow.rs::encode_observation` uses the pinned WB001 `offsets`
and `byte_at` definitions for the 335 transmitted bytes. It explicitly zeroes
the rest of the 4,626-byte buffer, avoiding 4,291 redundant padding visits.
It refuses an oversized internal shape before slicing. There is no signature
cache and no new per-peer state.

Authentication still goes through `verify_baseline` and
`announce_v3::IdentityAnnouncementV3::verify` for every input, including
duplicates. Scope and freshness remain receiver-owned; `ShadowObserver::observe`
updates its ephemeral watermark only after the unchanged `bnrose_exec_core::admit`
accepts. The observer remains off by default and disconnected from production
ingress. This receipt does not establish transport or live-mesh performance.

The differential test covers all 4,097 payload lengths with text and integer
boundaries, comparing the entire buffer to the original encoder. A separate
test covers an invalid internal shape at MAX_ENV + 1. The legal field maxima
sum to MAX_ENV exactly: an intermediate explanation incorrectly alleged an
upstream capacity mismatch, and commit 85633f6 corrects it. No upstream core
change was needed. The production code in 7f9eede and 85633f6 is identical;
their difference is tests and documentation.

The final-head WSL release build passed in 7m 38s. The two focused encoder
tests passed (3,962 unrelated library tests filtered), and all six release
negative controls passed with none filtered or ignored. On native NixOS the
same two focused tests passed in 1.30s and all six controls passed in 0.02s.
Logs retain the exact counts; they do not claim the filtered library tests ran.
Extra blank lines at the end of test logs were removed for repository hygiene;
raw benchmark JSON is unchanged.
Superseded local compiles and prior-head CI were deliberately cancelled after
source corrections; their cancellation logs are not test failures or passes.

## Native NixOS execution

Hostinger directly reported NixOS 26.05, kernel 6.18.48, eight KVM vCPUs on
AMD EPYC 9354P, and approximately 32 GiB RAM. Full OS/CPU/kernel evidence is
retained. Oracle timed out during SSH banner exchange through both WSL and
native Windows clients; its current operating system is UNVERIFIED.

Release artifacts were built with Rust 1.95.0 on Ubuntu/WSL and executed on
NixOS with the pinned Nix glibc/GCC runtime named in `run-nixos.sh`. This is
a NixOS runtime validation, not a native NixOS source-build receipt. The Nix
package revision is 09063bd1f2b36fd9fd793c36dfade7bd40a93dfc, matching the
experiment's existing flake lock. No system profile or production service
configuration was changed.

The focused unit-test executable had only its debug sections stripped before
transfer; its NixOS artifact hash is recorded separately. The benchmark and
release negative-control executables were transferred unchanged.

Each process runs under a transient dynamic user with no network, protected
home directories, a read-only system and input directory, no new privileges,
a 256 MiB memory limit, Nice=10 and CPUWeight=10. There is no CPU quota or
affinity. The shared virtual host is not a dedicated performance laboratory.
An initial sandbox launch could not see its input under private /var/tmp;
the corrected runner binds only the experiment directory read-only.

## Measurement contract

`examples/bnrose_shadow.rs` is unchanged between revisions. Each run creates
ephemeral signing fixtures in memory and then alternates baseline/shadow order
over 32 rounds of 64 signed inputs, retaining all 2,048 timings per arm.
Signing is outside the measured region. Each process uses identical input
bytes for both arms; independent processes generate independent fixture keys.
The 1/2/4 observer measurements are local concurrency, not distributed scaling.

The comparison cohort is runs 2 through 6, executed in alternating old/new
order. Preflight runs are retained separately. `summarize.mjs` verifies the
reported summary against every raw sample, checks unchanged wire/state sizes,
and produces `summary.json`. Report both medians and tails; do not interpret
a platform change from WSL to NixOS as an adapter optimization.

## Measured result

| Metric, median across five runs | Original | Optimized |
| --- | ---: | ---: |
| Added p50 latency relative to x0x verification | 21.7603% | 9.0935% |
| Range of per-run p50 overhead | 16.1618–31.2555% | 6.5771–11.5166% |
| Added p50 latency | 44.861 us | 19.421 us |
| Added mean latency | 21.2773% | 7.9204% |
| Retained observer state | 136 B | 136 B |

The median p50 overhead percentage is reduced by **58.2105%**. This is a
reduction in the additional shadow cost, not a 58% increase in total x0x
throughput. Each revision contributes 10,240 timed observations per arm across
the five-run cohort. The original shadow p99 values were 351.811–382.961 us;
the optimized values were 317.102–344.030 us. These are observed ranges on this
host, not tail-latency guarantees. Raw 1/2/4-observer results remain in each
measurement and summary; they do not establish distributed scalability.

## Separate outstanding acceptance

The original scheduled invitation test
`non_creator_admin_invite_e2e_converges_through_real_daemons` failed because
the invite lacked a base-member snapshot for creator provenance. That failure
in run 39223803733 is neither repaired nor re-earned here. Scheduled timing
and soak jobs are skipped on these PR triggers. Successful executed PR checks
do not mean all x0x CI or invitation behavior is green.

Live mesh, durable recovery, partitions, adversarial-load memory behavior and
native NixOS source compilation remain outside this receipt. Crates.io
distribution of the unpublished Git-pinned BNR core crates still needs a
distribution decision. ADR 0108 remains Proposed for human review.
