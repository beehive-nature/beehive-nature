# First supervised coding loop: laptop + VPS + Buzz — 2026-09-07

Founder direction: "is x0x involved with this. lets go full speed on this".
Work ran September 8 UTC / September 7 evening in Denver.

**Achieved:** an authorized repository job was acknowledged in the owner's private
Buzz DM, prepared by the VPS, leased to this laptop, tested and committed in an
isolated worktree, returned to the VPS, and independently verified there. Codex
reviewed the returned diff. The final fix was supplied by Codex after the small
local model failed; that distinction is retained in the job and commit.

## Actual job and receipts

Job: `mail-attachment-boundary-20260908`.
Base: `63fd9680`. Worker return: **`881bfc5c`** (preserved by fast-forward in this
seat's own branch, not rewritten as a different author's work).

The previous mail parser used `message.walk()`, which descended into attached
emails and attached multipart containers. Their inner text could enter the model
prompt despite the attachment-exclusion rule. The repair prunes those subtrees,
keeps ordinary inline text in order, and preserves the rest of `extract`'s behavior.
No actual email body was used as a test fixture or printed during this lane.

Evidence:

- Independent regression against the old source: **2 failures / 3 checks** — both
  attached email and attached multipart text leaked; inline alternative text passed.
- Laptop patched source: **11 existing mail tests + 3 attachment checks passed**.
- Laptop boundary probes confirmed a hidden host canary/credentials, a cleared
  inherited environment, a different network namespace, read-only source and refusal
  of nested user namespaces. CPU/memory/session limits came from its user-systemd unit.
- Successful laptop run: **7.044 seconds wall**, **5.118 seconds CPU**, **118.6M peak
  memory**, as reported by the unit journal. Session stopped after returning the job.
- Both Git hooks ran for the worker's commit. The broker imported its bundle only
  after checking the parent, single changed path and exact proposed replacement.
- The VPS independently passed the same **11 + 3 checks** under its service limits,
  and moved the job to `verified` before publication was allowed.
- Broker boundary suite: **13 tests** after final hardening (WSL and VPS validation
  recorded at closeout). Coverage includes scope, leases, stale/expired tokens,
  required checks, outbox persistence/retry, supervisor provenance, publication gating
  and result retry after independent verification.

## Failures retained, not relabeled as success

The local Qwen model's first two proposals were not valid JSON. Source inspection of
the deployed llama.cpp parser showed that the schema must be supplied under
`response_format.json_schema.schema`; an empty generic schema did not constrain
this chat path as expected. The adapter now sends the explicit nonempty schema.

The third proposal fit the schema but was incorrect: it kept the attachment traversal
and changed strings into bytes. The laptop tests rejected it. Codex supplied the
repair through the broker's explicit supervisor path. The private job retains the
failed proposal, prior error, attempts and authoring provenance. **This is evidence
for the supervised loop, not evidence that Qwen2.5-3B is a reliable coding agent.**

The existing private bClaude room's roster did not include its configured owner,
so it was not used. A new owner/bClaude DM was created and its two-member roster and
private visibility were verified. The broker repeats those checks before sending.
Acknowledgment, failure/supervision, result, verification and publication are signed
Buzz messages; event IDs are read back. No messages go to a public room or outside
the founder/agent relationship.

The VPS sandbox initially failed with AppArmor denials for namespace setup. The
dedicated root-owned sandbox binary and application profile were installed and
validated under the real unprivileged service settings. Global restrictions remain
enabled; nested namespaces in worker children are disabled. The package install
also reported an already-pending kernel update; no reboot was performed. Unit
verification repeated existing OCI monitoring-file permission warnings, unrelated
to this lane.

## What is live, and the exact boundary

- VPS broker, VPS worker and independent verifier timers run persistently. The
  existing local mail-triage service keeps its private draft-only behavior.
- Laptop sharing is now demonstrated and reusable through
  `tools/bbuild/share.ps1 up|status|down`. It is an explicit maximum ten-minute
  session, one job, 1.5-core CPU quota, 2 GiB memory cap. It stops after the job.
- Only one reviewed coding recipe exists in this version. Jobs are admitted through
  authenticated operator SSH; Codex supervises them here. Ordinary email/room text
  cannot create arbitrary shell work. The dormant Claude provider login was not fixed.
- The x0x node was **connected, 30 peers / 30 send-ready**, version 0.41.3. Its remote
  exec diagnostic showed `enabled=false`, `acl_missing`, zero allowed command entries.
  **x0x is not carrying this job.** Buzz carries room receipts and SSH carries the
  laptop worker lease/result; public peer traffic stays on the VPS.
- No GPU pooling, native mesh-LLM desktop offer, provider payout, new price, wallet
  operation, SMTP send or mail-queue flush was performed.

Implementation and operations: [coding worker guide](../../ops/bbuild/README.md).
The publication/deployment closeout below names the live state after the final push.

## Publication and deployment closeout

- **`881bfc5c` pushed** on `codex/raid-sprint-handoff-2026-09-07`. The broker fetched
  that exact commit from the public repository, checked source equality, marked
  the job **published**, and posted/read back the private publication receipt.
- The mail-parser fix is deployed at `/opt/buzz-mail/triage.py`; local/deployed
  SHA-256 prefix **`d9ff30d681811cb9`** agrees. The live mail service completed with
  `Result=success`, `ExecMainStatus=0` after deployment.
- All **13 broker tests** passed both in WSL and on oracle after final hardening.
  All seven deployed build Python files, six systemd units and the AppArmor profile
  were compared against this worktree; every hash agreed. Independent validator
  prefix: **`c76d1b80727d06cb`**.
- A real replay of the laptop's saved return after publication returned
  `published`, **the same commit**, and **unchanged outbox event IDs**. It did not
  import another commit or send another result notification.
- The six private outbox phases — ack, failed, supervised, result, verified,
  published — all show delivered. Broker, VPS worker, independent verifier and
  mail-triage timers are active; x0x is active. The laptop session has ended.
- The accompanying infrastructure and operating guide are committed/pushed on the
  same branch. Shared checkout work and other seats' worktrees were untouched.
