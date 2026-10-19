# Commit-to-qualified-PR throughput — 2026-10-18

The founder clarified this lane's goal: improve commit/PR GitHub time,
performance and tests, with GitHub serving as stage-one hosting and
execution before repository hosting and qualification can move to other
providers. This continuation implements the bounded scheduling work left
in [the October 17 CI-speedup dispatch](2026-10-17-ci-speedup.md).

## Measured cause and change

The initial PR #468 head `3776749837e2ca8b73eed440b67446362b639ccc`
created 18 workflow executions: ten PR runs and eight feature-push runs.
Five specialized workflows still qualified the candidate twice. They now
run on PRs, main pushes and manual dispatches, matching the two PQ
workflows' existing policy:

- WB001 SAW proofs
- WB002 SAW equivalence
- WB002 WASM corpus
- BNROSE-RUST-001
- BNROSE-ADAPTERS-REAL

For the same event and path set, this removes five executions, reducing
18 to 13 (28%). This is a trigger-count calculation, not a measured 28%
reduction in elapsed time. Each of the five workflows' complete `jobs:`
body is unchanged. PR qualification and actual-main-merge verification
remain distinct; manual dispatch remains available for a standalone
branch. Main and manual runs retain their unique concurrency group.

A measured duplicate illustrates the runner cost: on PR #466 head
`8ce097e0`, WB001 SAW push run
[39166986891](https://github.com/beehive-nature/beehive-nature/actions/runs/39166986891)
executed from 21:17:39 to 21:41:56 UTC (24m17s), while PR run
[39167003391](https://github.com/beehive-nature/beehive-nature/actions/runs/39167003391)
executed from 21:25:32 to 21:53:20 UTC (27m48s): 52m05s combined.
Removing the feature-push execution would eliminate its 24m17s of runner
work for this example. A PR's synthetic merge checkout can differ from
the pushed head; the PR result is not relabeled as a push result.

On the cache candidate itself, the five completed duplicate push
workflows consumed 2,776 seconds (46m16s) across eight jobs:

| Workflow | Push run | Job-execution seconds |
| --- | --- | ---: |
| WB001 SAW | 39179422708 | 1,798 |
| WB002 SAW | 39179422712 | 50 |
| WB002 WASM | 39179422723 | 202 |
| BNROSE-RUST-001 | 39179422737 | 561 |
| BNROSE-ADAPTERS-REAL | 39179422744 | 165 |

These are summed job durations from completed GitHub jobs, not billed
minutes or elapsed PR time. They quantify the duplicate work targeted by
the scheduling change; its own hosted event set still needs verification.

The full `tests.yml` and `secret-scan.yml` workflows still run on every
push and PR, without workflow-level cancellation. The RB workflow and
path-filtered keychain/release workflows retain their existing policy.
In particular, push identity coverage is not replaced by PR identity
coverage. The earlier report demonstrated that these can disagree.

## Cache correction

The pinned Rust cache action joins each target path to its workspace.
The same repeated-directory defect corrected for x0x in PR #468 also
exists in the bSAFE, x402, ant-writedoor and Plonky3 mappings. Change those
four right-hand paths to `target`. Root caching and the x0x correction
remain intact; action pins, cache-save policy and every workload command
are preserved.

The October 17 dispatch's cache-hit observations are historical evidence
of matching keys, not proof that these four compiled-target directories
were restored. Its claim that the workspace mapping mechanically worked
is not supported by the pinned action's `CacheConfig.new()` path join.
This correction does not erase those measured job timings or infer new
speedups. Corrected target restoration and net timing require fresh
hosted evidence. GitHub also versions caches using their paths, so a new
target path can require a fresh cache even when the visible key matches.

Sources: [pinned cache implementation](https://github.com/Swatinem/rust-cache/blob/6323deb102c322ba6fcbdcafc7e3dddab59af2b6/src/config.ts),
[GitHub cache matching and versioning](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#cache-key-matching).

## Regression checks

The static job gains a dependency-free policy gate. It checks the
repository's canonical event/concurrency blocks and six explicit cache
workspace mappings. Unsupported policy syntax fails for deliberate
review; this is not a general YAML parser.

`node --test e2e/ci-throughput.test.mjs` passes 24 tests, including
mutations that restore duplicate branch qualification, remove main/PR/
manual coverage, allow cancellation of main/manual runs, restrict push
audits, or break/drop a cache path. The original configuration fails
five scheduling and two cache-policy checks; the candidate passes.
`node scripts/lint-ci-shape.mjs` reports 141/141 guarded suite steps.
`git diff --check` passes. A direct comparison confirms that the five
specialized workflow job bodies are unchanged.

These checks do not claim to validate solver outcomes, all YAML syntax,
hosted cache hits, or realized elapsed-time savings. The candidate's own
CI and its actual merge checks must supply those results.

The read-only `scripts/ci-run-receipt.mjs` collector captures GitHub run,
event and attempt identity, job outcomes/timestamps, and the actual full
checkout SHA from each completed job's checkout log. It resolves that
commit's tree and retains the log digest without copying raw logs or
credentials. Missing or ambiguous checkout evidence stays unbound; it
never substitutes the run's PR head for the tested checkout. Six more
tests cover that boundary and prevent queued, failed, cancelled, skipped
or empty observations from becoming successful-run claims (30 tests total).
The live jobs API supplied `started_at` equal to workflow creation for
queued jobs with no steps. The collector therefore requires actual step
activity before timing execution or start delay; queued placeholders and
cancellation before execution remain unknown, rather than zero seconds.

The first live capture is
[`cache-pr-first-observation.json`](../receipts/ci-throughput-2026-10-18/cache-pr-first-observation.json).
It covers only WB002 SAW run `39179441710`, attempt 1: the head is
`377674983`, while the actual checkout is synthetic merge `94ced410`.
Its job took 58 seconds, with 179 seconds from workflow creation to job
start. Dispatch-to-start can include dependency waiting and is not
reported as pure runner queue time. This one-run observation is not full
PR qualification. Receipts are unsigned observations, not attestations;
required workflow/event coverage must be checked separately.

The native-PQ baseline is retained in
[`cache-baseline-main-pq.json`](../receipts/ci-throughput-2026-10-18/cache-baseline-main-pq.json):
run `39175451733` on actual main merge `d472d198`, all seven jobs successful
and bound to their checkout/tree, 737 total job-execution seconds. The
x0x job used 336 seconds, including 177 seconds installing the audit tool,
110 seconds for the native battery, 8 seconds restoring cache and 5 seconds
in the cache post-step. Its
[job log](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451733/job/117817056679)
explicitly lists the repeated `crates/btungsten-x0x-pq/` target path.
The x0x crate and both native controllers compare byte-identical between
this baseline and cache candidate `377674983`.

The completed candidate native-PQ run is retained in
[`cache-pr-pq.json`](../receipts/ci-throughput-2026-10-18/cache-pr-pq.json):
run `39179441927`, all seven jobs successful and bound to synthetic merge
`94ced410`, 701 total job-execution seconds. The corrected x0x job took
312 seconds, including 163 seconds installing the audit tool and 103
seconds for the native battery. Its log explicitly lists
`crates/btungsten-x0x-pq/target` at the repository root, confirming the path
correction. The job started 1,986 seconds (33m06s) after workflow creation;
the final native job started after 3,453 seconds (57m33s). These observed
start delays substantially exceed the short native workloads. The
336-to-312-second x0x comparison is not attributed to the cache correction:
this candidate still installed the audit tool, and warm-cache restoration
must be measured after main seeds the corrected target.

## Stage-one hosting and the next phase

GitHub currently supplies hosting, event scheduling, runners and check
status. The portable contract needs explicit source identity (commit and
tree), authority for a proposed head update, pinned build/test inputs,
artifact digests, and verifiable qualification results with their scope
and assumptions. For GitHub PR evidence, record actual checkout/tree,
head, base, event, run and attempt; a PR head alone does not identify the
tested tree. GitHub documents the synthetic merge behavior in its
[PR event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

The decentralized phase must separate transport/discovery, durable blob
storage, head-update authority and ordering, CPU/RAM/network execution,
and metering/settlement. The founder's x0x/ANT/AR/Hive and other providers
are integration candidates for those roles. Their adapters must reuse
existing estate boundaries and prove retrieval integrity, availability,
authorization, replay handling and qualification independently. A stored
Git repository or a successful CI run alone does not implement those
contracts. No decentralized backend, signed execution attestation, new
identity, payment, or production deployment is added by this CI patch.

## Landing status at preparation

Prepared separately while PR #468 preserves its exact head and hosted
queue position. This follow-up is not yet published or qualified. The
cache PR's merge and verification precede publishing this scheduling
change. End-to-end elapsed time and runner time remain separate metrics;
queue pressure from other lanes is not attributed to this patch.
