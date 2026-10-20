# BNRoSe / x0x shadow measurement — 2026-10-19

Serves L2 bounded coordination and L3 resource evidence. Founder authorized the
shadow adapter, measurement against x0x and completion of security PR #3 checks.
NixOS is the preferred Linux modality for synergy; available execution here is
Ubuntu 26.04 under WSL2, with an independently pinned Nix development shell.

## Delivered candidate

- Adapter PR: https://github.com/loviswaternakamoto/x0x/pull/4 (draft, stacked on #3).
- Adapter code revision: `a062ade943229e7622d0bf168c45d036ad9e26b9`.
- Current adapter head: `e49603a45afef364accf62141b2897fbcf9b5115`.
  Follow-up 86e678e enables `test = true` for ordinary all-feature workspace
  discovery of the six inert example tests; e49603a adds the missing `util-linux`
  package to the Nix shell so lscpu no longer comes from Ubuntu's host PATH.
  Adapter/benchmark source and dependency resolution are byte-identical to a062ade.
- x0x security base: `8aaf9357c76aa4b9762ba253a3128b91e063bb16`.
- BNR core: `49b88d7b294687711b9871f34a74b961f7d5f62a`.
- Source hashes, environment and raw outputs: `docs/receipts/bnrose-x0x-shadow-001/`.
- Architecture remains Proposed: x0x `docs/adr/0108-bnrose-diagnostic-shadow.md`.

`bnrose-shadow` is disabled by default. `ShadowObserver` takes a locally chosen
machine/agent scope and freshness window. `verify_baseline` calls the existing
x0x `announce_v3::IdentityAnnouncementV3::verify` before BNR processing. That
function verifies ML-DSA-65 machine signatures and key/id bindings. The adapter
has no alternate signature algorithm, network task, key store, effect interface,
production receive hook, wallet or central scheduler.

The receiver derives its own zero-amount WB001 observation, whose payload and
nonce bind the exact original wire digest. The source has signed only the x0x
announcement, not the derived envelope. `bnrose_exec_core::admit` returns local
telemetry: no execution, membership, delegation or payment authority. A single
timestamp/version watermark bounds each observer's retained state; it is
ephemeral, not a durable exactly-once ledger. Restarting it clears the watermark.

## Validation already observed

- Six inert adapter test groups pass, 0 failed / ignored / filtered. They cover
  malformed and oversized input, trailing bytes, local opt-out, invalid policy,
  wrong peer, signed freshness, replay, independent observers, signed-field
  tampering, Ed25519-size substitution and mutation agreement with x0x baseline.
- Cargo Audit: zero vulnerabilities. Existing unmaintained/unsound/yanked
  warnings remain reported in `cargo-audit.json`; they were not suppressed.
- Hosted adapter Clippy, formatting, docs, audit and Proposed ADR validation pass.
  These first passed at a062ade; the final-head snapshot identifies rerun state.
  Duplicate local all-feature lint was stopped after this exact-code hosted
  pass to free memory for optimized compilation. It is not a local lint pass.
  Separate dependency-package unit-test selection was rejected by Cargo's
  workspace/feature selection; no standalone core unit-test pass is claimed.
- Pinned Nix shell evaluates for x86_64-linux and aarch64-linux. Shell startup and
  Rust 1.95.0 execution pass on WSL; this is not NixOS-host acceptance or an ARM64
  build. The shell pins packages; Rustup selects 1.95.0 and Cargo.lock pins Rust
  dependencies. It is not a hermetic Nix derivation.
- No live mesh, deployment, payment, user identity or production configuration
  was changed. Review was source inspection and targeted controls; no new
  independent cryptographic audit or Codex review was requested.

## Measurement contract

The release example compares the same synthetic, genuinely ML-DSA-signed x0x
announcements through the real x0x decoder/verifier, with and without the BNR
observer. Key generation/signing are outside timing. Warm-up precedes 32 paired
rounds of 64 operations with alternating execution order. Every operation must
succeed; raw nanoseconds are retained. The 1/2/4 observer runs are same-host
concurrency, not distributed mesh scalability. Results measure added observation
cost, not speedup from avoided execution. There is no queue, journal or fsync.

This shared development host is not a dedicated performance lab. Report latency
percentiles, wall throughput, state size and total process CPU/RSS with that
limit. No confidence interval or production throughput guarantee is inferred.
Do not compare these numbers to the older BNR durable-host benchmark as if they
were the same workload.

## Separate PR #3 validation

Security remediation: https://github.com/loviswaternakamoto/x0x/pull/3.
The corrected extraction rerun passed 14/14; full recovered output is retained.
At exact head `8aaf9357c76aa4b9762ba253a3128b91e063bb16`, hosted Linux suite ran
4,748 tests, all passed, with 326 explicitly skipped. Voice pipeline acceptance
passed 1/1 and the 100k signing acceptance passed 1/1. Windows compiled the
library suite and executed nine instance-lock tests, all passed. All six platform
build jobs, regular integration shards, transport proofs, audit, lint and docs
passed. Final coverage state is recorded with the closing snapshot below.

Closing PR #3 snapshot: 31 successful checks, two skipped scheduled checks,
no failed or pending checks. Coverage is 86.98% (172079/197839 lines), above the
enforced 65.70% floor. Informational WS-2 API/core coverage is 80.99% versus a
90% goal, and WS-5 transport coverage is 82.61% versus an 85% goal; those warnings
remain visible. The PR is ready for review and was not merged. The captured
coverage run executed 4,742 tests, all passed, with 318 explicitly skipped.

The original invitation-convergence failure remains independently identified:
run 39223803733, `non_creator_admin_invite_e2e_converges_through_real_daemons`,
missing base-member snapshot while deriving creator provenance. Scheduled
timing/soak jobs are skipped on these PR triggers. None of these passing checks
re-earns that specific acceptance or repairs the invitation path.

## Adoption constraints

Keep the candidate observational until this Proposed ADR is reviewed. Published
crates.io packaging needs a distribution decision for the two unpublished,
Git-pinned Apache-2.0 BNR core crates. Durable execution, receipt algorithms,
remote idempotency and transport integration would each need separate evidence.
NixOS-host execution remains outstanding. #622 redirects egress measurement to
#504; its receiver/sender per-peer wire measurements are not fulfilled by this
offline experiment. #505 remains field-accepted.

## Measured result

Final-head optimized build succeeded (initial cold build 42m34s; final-head
recheck 12.68s). All six negative-control groups also passed in release mode:
0 failed, ignored or filtered. The binary SHA-256 is in `binary-sha256.txt`.
Three runs used that same binary inside the pinned Nix shell on Ubuntu/WSL.
Each run has 2,048 timed inputs per arm, plus warm-up and concurrency phases.
All three raw files and process-accounting outputs are retained; none discarded.

| Run | Baseline median | Shadow median | Added median latency | Baseline p99 | Shadow p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 380.093 µs | 453.665 µs | 19.36% | 11.310 ms | 11.328 ms |
| 2 | 369.219 µs | 446.656 µs | 20.97% | 11.007 ms | 11.116 ms |
| 3 | 399.146 µs | 488.710 µs | 22.44% | 11.464 ms | 11.505 ms |

Mean overhead was 14.24%, 21.35% and 22.96%. High tail latency is observed in
both arms on this shared host; its cause was not isolated. These are descriptive
measurements, not a dedicated-host latency SLO or a claim about a live mesh.

| Local observer threads | Baseline operations/s range | Shadow operations/s range |
| --- | ---: | ---: |
| 1 | 868–1096 | 737–849 |
| 2 | 1666–1903 | 1278–1544 |
| 4 | 2656–3339 | 2595–2710 |

The signed fixture is 7,415 bytes. Each observer retains 136 bytes; total process
peak RSS was 4,280–4,656 KiB. Process user CPU was 22.78–24.34s per full run,
including fixture setup and all phases; this is not per-arm CPU/op. No network
traffic, queue or journal fsync is introduced by the observer.

**Decision:** keep the experiment opt-in and outside production receive paths.
It demonstrates bounded local state and preservation of the existing signature
boundary, with a measured cost. It does **not** demonstrate a speed improvement.
Only avoided authorized work measured in a real integration could justify that
cost. No signature verification or durability check was removed to improve a
number. NixOS-host, live mesh, memory-under-adversarial-load, durable recovery and
partition acceptance remain separate unexecuted checks.

GitHub connectivity became unreliable during final publication: both the local
CLI and connected GitHub service returned connection errors. PR #3's completed
31-success / 2-skipped snapshot is retained. The final PR #4 head was pushed;
its later CI results must be refreshed, not inferred from the earlier code-head
checks. Publication outcome for this dispatch is recorded in the handoff.

Publication follow-up: connectivity recovered. Receipt commit 2785ed231 was
pushed and its remote branch hash verified. Final-head PR #4 snapshot at
`e49603a45afef364accf62141b2897fbcf9b5115` shows 17 successful checks, 15 in
progress and two scheduled skips, with no failures at capture. See
`pr4-final-head-checks.json`; earlier `pr4-checks.json` remains historical.
No final-head all-CI-green claim is made.

Reproduction limit: the full helper script was syntax-checked but not executed
end-to-end in this Windows-linked worktree. WSL Git cannot resolve its Windows
worktree link. Git provenance was captured with Git-for-Windows; the release
build, tests and three benchmark runs were launched directly under Linux (the
measurements inside the pinned Nix shell). Use a normal Linux clone for the
NixOS helper recipe. Actual NixOS-host execution remains outstanding.
