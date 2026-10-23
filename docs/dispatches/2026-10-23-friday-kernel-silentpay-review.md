# Friday review: BNROSE kernel and bMESHasi / Silent Pay

Review date: 2026-10-23, America/Denver. First review; window October 16–23.
Fetched origin successfully. Inspected main at `e6c698f938c335c97e2df954f4371c522079238c`.
Commit dates below identify repository revisions; dispatch filenames can predate landing.

## Outcome

Material kernel progress landed: compiled-function proof correspondence and stricter proof-result classification, real settlement adapters, evolve/controller qualification, and opt-in transport observations. No new commits in this window touched `docs/handoffs/silentpay-v2`, `crates/bmesh-meter`, or `surfaces/bmeshasi.html`. No new production payment, privacy or community resource-exchange qualification was found in these inspected sources.

## Independently verified during this review

- Git history places SAW PR #443 at `9ad6509b7fa58d0fa486e995314b1215a6a53caf`, adapters #463 at `b829cafcf`, evolve #435 at `38d540aa2dc975b491d4728bff154d2ba2f0f689`, anchor #436 at `663971ee7`, ANT observation #478 at `d0fb5d97a`, and x0x assessment #481 at `aa3feb658` on main.
- GitHub run [39167413227](https://github.com/beehive-nature/beehive-nature/actions/runs/39167413227) is completed/success on exact SAW merge `9ad6509b7`; twin-grid, saw, lane and cryptol-twin all succeeded. Its fetched raw log records composition PROVEN over 16 obligations plus two controls, including `twoDispatchesAtMostOneEffect`, `staleViewsStillOneEffect`, `saturationReuseSingleEffect` and `reconciledGateCloses`. This is independent inspection of hosted evidence, not a fresh solver execution.
- GitHub's exact evolve merge run listing confirms 13 successful workflows, including BNROSE-EVOLVE [39190048516](https://github.com/beehive-nature/beehive-nature/actions/runs/39190048516), plus one cancelled Pages deployment. The historical dispatch identifies supersession by a descendant; cancellation is not counted as a pass. These exact-merge receipts do not establish all-current-main CI green.
- Current fork PR listing: x0x [#3](https://github.com/loviswaternakamoto/x0x/pull/3) security head `8aaf9357c76aa4b9762ba253a3128b91e063bb16`, [#4](https://github.com/loviswaternakamoto/x0x/pull/4) shadow head `85633f6a6dfea44e62a0cad778aa429275fc4604`, and [#5](https://github.com/loviswaternakamoto/x0x/pull/5) invitation-test head `3956274a07958e8b01da34eacf9fb672148e7048` are OPEN and unmerged. Upstream adoption/release is not established by local evidence.

## Reported results inspected, not re-executed

- [SAW dispatch](2026-10-14-bnrose-saw-001.md): saw 1.6 / pinned MIR toolchain proves `saw_attempt == attempt8` for all u8 and `saw_admissible == gateAt` for all flag pairs. Dynamic-length scans remain sampled-grid correspondence. Release u8 wrap at 255 is explicit; callers use nibble domain 0–15. Cross-node uniqueness assumes destination-enforced idempotency. This is function-level correspondence, not whole-system correctness.
- [Adapters](2026-10-17-bnrose-adapters-real.md): 16/16 library, 6/6 Hive wire-mock, 7/7 Anvil devnet tests. Hive historical inclusion/LIB and Arbitrum read/finalized probes are effect-free evidence. Fresh production writes, production idempotency and production partition acceptance remain UNVERIFIED without authorized funded settlement credentials. Anvil finality is not Arbitrum One finality.
- [Evolve landing](2026-10-18-bnrose-evolve-435-landing.md) and anchor commit `fb30f3ff2`: battery 28/28, teeth 17/0, carrier teeth 4/0 and dock claims 8/0 reported at their pinned revision, not re-run on today's tip.
- [x0x shadow](2026-10-19-bnrose-x0x-shadow.md): five same-NixOS-host before/after cohorts reduced median added p50 overhead from 21.7603% to 9.0935%; eight focused controls passed. Reported final head has 32 passing checks and two scheduled skips; Linux 4,756 passed/326 skipped. This is reduced observation cost, not a 58% total throughput gain. Artifacts were WSL-built and NixOS-executed; native NixOS source compilation was not claimed.
- [ANT observation](2026-10-20-ant-bnrose-observation.md): 24 live trials report 150 verified completed reads, 30 deliberate cancellations, zero unexpected failures, 75/75 shadow completions and 12/12 recovery controls. Local adapter cost fell 62.53–63.30%. Live results remain variable: single-read steady median slowdown worsened from +1.61% to +3.04%; churn still +19.77%. Different run windows prevent attributing live differences to the allocation change. No overall live delivery speedup is demonstrated.

## bMESHasi / Silent Pay status and proof boundary

The [banked Sprint 03 corpus](../handoffs/silentpay-v2/docs/SPRINT-03-FUNDED.md) reports authenticated local funding, membership, conservation, claim/change/refund and owner recovery on one disposable Spring runtime. Its reported Groth16 circuit has 352,976 constraints and 18 public inputs, but uses a single-party test setup. Public owners/amounts and known fixture secrets provide no privacy qualification. Usage remains provider-reported; resource admission, hostile-load limits, producer races, external-chain atomicity and EVM-unavailable escape remain unqualified. These are older corpus claims, not new weekly results or fresh verification.

[Ratified dispositions](../RULINGS-2026-09-16.md) retain PLONK/BN254 as the production privacy direction. Groth16/BLS12-381 corpus is qualification evidence; no second BLS12-381 lane is chartered. The [exchange specification](../SPEC-BMESHASI-EXCHANGE-1.md) supplies meter math and gated economics; its historical exists/not-yet table cannot alone prove today's runtime. No new measured-work-to-payment production receipt was found.

## Regressions and unresolved architecture

- SAW checker bugs were repaired before landing: mixed logs, timeout/signals and incomplete proofs must not count as refutations. Final classifier requires rc 1 or 2, Counterexample and Proof failed markers, no goals remaining, and no error veto. See `scripts/bnrose-rust-001/saw-check.sh`; the dispatch records its 23-assertion selftest. Do not infer verdicts from exit code alone.
- Core `crates/bnrose-exec-core/src/lib.rs::{admit,handle_admit}` has no signature authentication. Host authentication remains mandatory. Host Ed25519 receipts cannot replace x0x ML-DSA authority; the shadow adapter preserves the existing verifier and grants telemetry only.
- Local exclusion is not distributed effect uniqueness. Destination idempotency and independently observed finality remain required; died-after-send stays UNKNOWN.
- Evolve workers are bounded/reaped, not sandboxed. Unanchored journal hashes can be consistently rewritten by a store writer. Anchor landing is not by itself evidence of deployed, independently recoverable anchoring.
- Mixed live latency, invitation acceptance, durable transport recovery, Git-pinned unpublished crate distribution and Proposed ADR approval remain distinct adoption constraints.

## David Irvine priority: refreshed upstream record

Read current issue bodies and comments, not just badges. [#622's final ruling](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450) redirects to #504. [#504 acceptance](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5906795696) requires unicast caps/capability-gated bus hedges, consume-only Leaves, then enforced shedding with revocation exemptions; every step passes E-D17 delivered/published evidence, protecting named-group fanout. October 5 triage calls for per-kind counters #1170 and same-workload delivery capture. Per-peer message IDs and timestamps plus a no-disconnect control remain essential.

The [latest inspected embedder report](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-6117979353) reports OS-level idle traffic of 142 MB/min default versus 52 MB/min with shedding on 0.46.0. This is an attributed external report, not independently reproduced here; it still identifies a serious home/mobile adoption risk. It is distinct from serialized send-attempt counters.

[#505 is field-accepted by David](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210), based on the original OCI host with active fragment-tail dropping. That acceptance is verified in the discussion; its original pcaps were not re-read here. Legacy pre-fix senders remain a stated residual risk. No new reply or measurement was posted by this review.

## Next evidence milestones

1. Keep proof receipts tied to exact revisions; extend dynamic-path coverage only when a concrete unsupported domain changes the decision.
2. Obtain upstream review/adoption of the opt-in shadow separately from security fixes and invitation acceptance; preserve authentication and observation-only authority.
3. Measure identical real workloads with per-peer delivered/published IDs, timestamps, wire bytes and controls before egress-default or speed claims.
4. Qualify production settlement only with explicit authorized credentials and effect/finality receipts. Keep payment proof separate from resource delivery/measurement.
5. Close bMESH economics, admission, receipt-dispute and recovery requirements within the ratified privacy architecture; do not promote the archived Groth16 fixture into production architecture.

Validation: fetched refs, inspected committed sources and live GitHub records/logs. No solver, build, payment, deployment or runtime experiment was executed for this read-only review. Documentation whitespace checked before commit. No Codex review or third-party messaging was launched.

Publication tooling: bare `sh` was unavailable in PowerShell. Git-for-Windows `sh.exe` then ran the installer, which refused: `pre-commit exists and was not written by this installer. Inspect it, remove it, then re-run.` The existing shared hook was preserved; no deletion or replacement attempted. The actual commit executed the existing hook and reported `secret-scan: clean` and both §7 checks `ok`. Installer success is not claimed.
