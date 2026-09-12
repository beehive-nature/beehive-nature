# z1.c dispatch r2 — readiness corrections per Astra review (2026-09-12)

> Historical observation receipt. Its script was subsequently hardened in
> r3 and r4; use the current runbook and script, not this revision's commands.

**Lane:** same readiness lane; this pass is bounded to the five corrections
in [Astra's review](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647564848)
of candidate 305597f2. **Session/effort:** zCode GLM 5.3, Max for
source/version/evidence corrections, Low for wording. Descendant of
305597f2 on `zcode/autonomi-fence-readiness-2026-09-12`; original history
retained. No production change, no fork, no capture, no mesh run.

## Corrections, each with its new evidence

1. **#505/#622 closure retracted and corrected.** Primary sources re-read:
   #505's latest comment (dirvine, 2026-09-11T14:39Z) explicitly asks the
   founder to re-run the OCI workload — "that field result is what closes
   this; the dependency fix alone is not accepted as proof." #622 remains
   gated on a live Leaf capture; the founder's 00:16Z reply states
   preparation intent. #651 (merged 16:30Z) fixed LOCAL test suites only.
   Runbook §9, this dispatch, the #10 return, and both durable memory files
   now state: upstream requests OUTSTANDING; the estate's lane pause was a
   local decision, distinguished from upstream acceptance. No capture
   started.

2. **Installed version ≠ enforced pin; all behavior re-cited at installed
   revisions.** Every source claim re-verified at ant-node tag v0.18.1
   (= 5fb04fd) — UpgradeConfig/defaults, rc-rejection (monitor.rs:182-185),
   ADR-0010 present at tag, README:1023 "always enabled", RESTART_EXIT_CODE
   + rollback-on-failed-apply (apply.rs), jittered check loop + RolledBack
   arm + ≥1-interval backoff (node.rs), release workflow (tarball ships
   ant-node + bootstrap_peers.toml only). Supervisor bound to the installed
   manager: `ant` 0.3.6 = ant-cli crate @ ant-client; release tag
   ant-cli-v0.3.6 → dbc01ce8; behavior verified at rev 969ed008 (exit-code
   0-or-100 + on-disk version-drift confirmation + "the daemon always sets
   --stop-on-upgrade"). The "~25h" guarantee is REPLACED by the conditional
   formula (≤1h jittered poll + per-node rollout delay ∈ 24h window + apply,
   each step failure-slippable; failed applies self-rollback and back off).
   Release-source redirection is now classified UNTESTED with its exact
   v0.18.1 reachability: `github_repo` has NO CLI arg/env at this tag —
   `--config` file only, and the daemon passes no `--config` today;
   disposable no-upgrade test protocol written (runbook §3B), not executed.

3. **Participation re-based on direct diagnostics.** "Paused since install
   day" retracted. Today's logs carry recurring
   `storage::disk_precheck: Rejecting PUT … Insufficient disk space: 0.40
   GiB available, 0.49 GiB reserve required` (receipt window 16:33–17:38Z);
   rejections ABSENT in 09-04/05 logs (onset unbounded). Simultaneously the
   node shows daily replication-verification/audit activity with nonzero
   ingress totals and `capacity_deferred_*=0` — it serves and verifies
   while refusing NEW chunks. data.mdb size/mtime retained as measurement
   only, explicitly not a participation signal.

4. **Commands hardened.** New allowlisted nonsecret script
   `docs/runbooks/autonomi-observe.sh` (bash -n clean; receipted against
   the box: registry via jq without rewards_address, processes redacted,
   chunk addrs truncated, monitor view, PUT-refusal lines, replication
   totals, /health, disk floors) replaces raw dumps in §5. "Safe on sight"
   deletion language removed (§8: names do not establish ownership).
   Rollback rewritten: binary-only downgrade is incomplete across possible
   store-format migrations; named compatible recovery point = owner-taken
   pre-upgrade copy of fence data (none exists today); validation
   requirements listed; resize/deletion/downgrade remain UNAPPROVED and
   UNEXECUTED.

5. **Search and lockfile limits stated accurately.** "Does not exist" →
   "not found in the searched locations" (locations listed). Lockfile
   behavior inspected with receipts: in-tree harness has NO Cargo.lock —
   `cargo build` floats ant-core at ant-client HEAD (drifted 969ed008 →
   c63ca687), and `cargo metadata --locked` FAILS ("cannot create the lock
   file … because --locked was passed") — plus a separate in-tree defect:
   the copy sits under the repo workspace without membership. The BOX copy
   passes `--locked` (exit 0) — reproducible there only. Separately
   reviewable fix candidate documented (rev pin + committed lockfile +
   workspace fix), NOT applied; ops-verbatim law noted.

## Bonus verification this pass (provenance — was UNVERIFIED in r1)

Both installed production binaries now have digest-proven provenance: the
box's running ant-node sha256 equals the official v0.18.1 linux-arm64
release asset, and the box's `ant` 0.3.6 equals the official ant-cli-v0.3.6
aarch64-musl asset (tarballs downloaded and hashed locally; nothing
executed). Also observed: antd is supervised by an existing watchdog shell
loop (pgrep/setsid) — documented in §1/§8.

## Bounded checks run this pass

`bash -n` + box run of autonomi-observe.sh (read-only); cargo 1.98.1
`metadata --locked` in workspace-free in-tree copy (expected fail, quoted)
and on the box harness copy (exit 0); GitHub API tag/release/issue reads;
tarball downloads + sha256 (ant-node v0.18.1 arm64; ant-cli v0.3.6
aarch64-musl). Skips: LocalDevnet proof (unchanged trigger), any hold-test
execution, capacity attribution (separate lane per review).

## Return

To Astra on #10 with the commit link. Open items for owner/Astra: the §3B
disposable hold-test, the §6 rev-pin candidate, the fence resize decision,
the separate capacity inventory (Watch/media coordination), and the
founder's response to dirvine's #505 re-run request (that lane's owner).
