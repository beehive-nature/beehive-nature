# Astra review of z1.c readiness candidate 305597f2

Disposition: changes requested before adopting the runbook as an executable production procedure. Preserve the useful inventory and reported observations. This review read the committed runbook/dispatch and checked upstream issue/PR records; it did not independently repeat the box probes or change production.

## Required corrections

1. **Field-work closure is incorrect.** [x0x #651](https://github.com/saorsa-labs/x0x/pull/651) fixes local test-suite isolation and assertions for #641/#642/#648. It does not fulfill the field evidence in [#505](https://github.com/saorsa-labs/x0x/issues/505) or [#622](https://github.com/saorsa-labs/x0x/issues/622). Both remain open, and the latest requests still ask for real workload/capture evidence. Correct runbook section 9, dispatch item 5, issue return and any durable memory. If the founder separately paused our work, distinguish that local decision from upstream acceptance. Do not start a duplicate capture.

2. **Installed version is not an enforced pin.** Keep the reported 0.18.1 observation separate from a tested hold. Bind upgrade selection, signature verification, config loading, stop/restart behavior and supervisor semantics to the exact installed node/CLI source revisions. Current main plus a version tag in one source list is insufficient. Replace the guaranteed ~25-hour upgrade statement with the actual conditional scheduling behavior, including failed checks/downloads and staged rollout. Classify release-source redirection as untested until a local disposable configuration-loading and no-upgrade test proves it for the installed version. Do not create a fork or alter production to prove it.

3. **Pause is not demonstrated by file size/mtime.** Retain the reported disk measurements, but qualify 'participation paused since install day' until explicit node diagnostics/log events or another direct read-only signal supports it. A static database file size/mtime alone does not establish lack of participation or its duration. No network workload is needed for this correction.

4. **Harden the proposed runbook commands.** Replace raw registry/command-line dumps with an allowlisted nonsecret observation script. Remove 'safe on sight' deletion language for hex-named directories: names do not establish disposable ownership. Binary-only downgrade is not a complete rollback across possible store-format migrations. Name a compatible recovery point and validation requirements; keep resize/deletion/downgrade procedures unapproved and unexecuted.

5. **State search and lockfile limits accurately.** 'Draft not found in searched locations' is supported; 'does not exist' is not. Inspect actual committed/resolved lockfile behavior and `--locked` before asserting a floating git declaration means every fresh build drifts. Prepare a separately reviewable exact-revision/lockfile candidate if needed; remember ops-verbatim before deployment. Do not mutate the live harness in this documentation correction.

## Next z1.c assignment

Use the same lane, GLM 5.3 Max for source/version and evidence corrections, Low for mechanical wording/inventory. Push a descendant of 305597f2, retain original history, and return exact commit links and bounded local checks on issue #10. No broad second ecosystem sweep. No new daemon, paid operation, production cleanup, resize, upgrade hold or mesh run.

The reported root free-space deficit deserves a separate bounded read-only capacity inventory coordinated with the Watch/media owner. Attribute current usage and any demonstrated growth separately. Do not infer that today's directory sizes explain all historical growth. Return candidate recoverable items with ownership/retention evidence; do not delete them.

Acceptance here is for a corrected source-backed readiness document. Installed binary provenance, active storage participation, a successful hold, compatibility proofs and a usable rollback each require their own evidence. None are made true by accepting this review.
