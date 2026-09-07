# Genesis sprint — lead docket for zCode

**Founder instruction, 2026-09-06:** Astra is promoted to lead; seek fixes
that reinforce one another, delegate to zCode, and state agent effort/session
type. The founder remains the attending surgeon and constitutional authority.
This docket records working ownership, not a kernel amendment or a change to
any tokenomics, cryptographic policy, or cloud/funding gate.

**Handoff:** GitHub issues on `beehive-nature/beehive-nature` are the claim and
completion channel. zCode reads them at the next founder-opened turn. No
direct injection into the founder-driven GLM session is attempted. A published
issue means **ready to claim**, not evidence that the agent has started.
Commits and dispatches remain the persistent receipt. Secrets never cross it.

## Sprint order and agent settings

Effort below is the requested/recommended reasoning setting, not an estimate
of elapsed time. This file does not silently change app settings or spawn
workers. Fresh means a new bounded coding/review session with its own worktree;
continuing means use the session already holding the relevant review context.

| Lane | Owner / model | Effort | Session type | Start condition |
|---|---|---|---|---|
| G0 — reconcile and integrate | zCode / GLM-5.3 | Max, preserve founder's current setting | Continuing review; use existing zCode review context | Claim issue, fetch final PR heads |
| G1 — recover bootstrap capacity with verified state ownership | zCode / GLM-5.3 | Max | Fresh implementation session, own `wt-zcode-*`; one writer | G0 merged and receipt checked |
| G2 — durable receipt/replay boundary | Astra / GPT-6 Astra | Max recommended for design/review; retain actual configured setting until changed by user | Continuing lead analysis; fresh isolated implementation session after design is bounded | Can analyze in parallel with G0/G1; no production write |
| G3 — independent negative review of G1/G2 | zCode / GLM-5.3 | Max | Fresh read-only review, separate from the build session | A pinned candidate and reproducible tests exist |

Start with **two working seats**, not a swarm. Keep one production writer and
one integration owner per issue. Additional bounded readers may run only with
explicit assignment; report actual model/effort rather than relabeling one
provider's agent as another. Native Codex subagents inherit model/effort unless
configured; that does not provide a GLM session transport. Official reference:
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Daily capacity discipline

The founder funds both an existing GLM MAX subscription and a finite Codex
subscription. Neither is treated as unlimited compute. Keep personal billing
amounts and account identifiers out of public dispatches.

- zCode is the primary implementation seat. Preserve Max for the current
  consequential review/recovery lanes. For later mechanical tasks, recommend
  a lower effort explicitly instead of quietly changing the founder's setting.
- Astra owns design, risk ranking, acceptance criteria and final synthesis.
  Use bounded reads and compact receipts; do not duplicate an entire audit
  that another seat already proved. Independently reproduce critical claims.
- At the beginning and end of each founder-opened work session, inspect
  available usage windows. Rate-limit percentages are shared account usage,
  not a dollar or token count. Compare daily use against time until reset.
- Initial operating target: retain **25% of the weekly Codex allowance** as
  incident/review reserve; budget normal remaining work across days to reset.
  This is a working allocation, not an account-enforced spending limit.
  If approaching reserve, finish the current safe checkpoint and hand routine
  implementation to the queued GLM lane. Do not drop validation to save quota.
- One morning/start-of-session claim, one bounded build, one review/receipt
  handoff. Keep only one build lane per writer. End with a compact next-session
  packet: exact ref, open issue, owned paths, next command, known blockers.
- Use local targeted tests during iteration and the full required checks on
  the final candidate. Rerun broad suites when new changes or failures justify
  them; avoid repeated unchanged CI polling and speculative agent swarms.
- No credit purchases, reset redemption, new API-funded runtime, or unattended
  daily run is implied by this budgeting plan. The existing founder-controlled
  turn/issue handoff remains the daily operating channel.

## G0 — immediate order to zCode

Read [Astra's reconciliation](2026-09-06-astra-zcode-reconciliation.md), the
[change receipt](2026-09-06-astra-change-receipt.md), and the final PR diff.
The handoff issue pins the actual final heads; stale hashes are not approval.

1. Verify the **one call chain**: PowerShell → WSL Bash → scoped SSH master.
   `_watch` owns the deadline. Both entry points cap a lease at 600 seconds;
   `up` explicitly renews it. Run the five offline lifecycle checks. Inspect
   Windows parameter validation and installed-byte equality. Do not start a
   laptop mesh daemon or recreate the shared-router outage.
2. Verify **nostr-tools 2.25.2 before and after** using only version fields
   from the saved original lockfile, current lock and installed package. Read
   the existing synthetic Russian STT receipt. No new dependency migration or
   voice service restart is needed to prove already identical bytes.
3. Verify **governance formatting**: each changed Rust file equals rustfmt of
   its base bytes; the only non-Rust change is the dispatch. Check PR #1 CI.
4. After current-head CI and these gates pass, promote and merge the two PRs.
   Own integration for this issue; Astra will not race a merge. Preserve the
   estate's founder-author/seat-committer/co-author rules; do not forge a DCO
   sign-off or bypass protection. If the platform-generated merge identity
   cannot satisfy the existing checks, prepare a correct descendant merge
   in your own clean worktree, never force history.
5. Fetch main and compare all five installed voice files with the **main
   blobs**, plus both laptop helper files. Check voice health and empty queue;
   record any active workload before making a claim about the spool. Leave the
   tunnel down. File a merge receipt and close the issue only on evidence.

If any gate fails, report the exact failing command and scoped finding. Do not
drop a gate to make the issue green. A raw grep miss is not a call-chain review.

## G1 — first implementation order after G0

**Problem:** the box is both a bootstrap provider and a concentration of
state. Last audit: 93% root disk use, about 3.5 GiB free, failed bitcoind;
the six-GiB Autonomi fence does not cap other workloads. Deleting caches by
name could erase the restart path for an active development relay.

**Deliver a reusable recovery inventory and an evidence-backed capacity fix.**
Start read-only against a fresh census. For each known service/state root,
record owner, deployed source/binary digest, observed disk footprint, restart
dependency, and classification: authoritative state, reproducible artifact,
rebuildable index/cache, or secret reference. Secret entries contain only
location, permission and recovery owner; never values or object/customer names.
Read declared roots, not arbitrary customer payloads. Unknown is explicit.

Use that inventory to propose and execute the smallest recoverable capacity
change within existing authorization. Preserve the executable of any running
process whose original file was deleted before touching its build tree. Check
active build ownership. Preserve original bytes off the pressured volume and
verify retrieval before removing source material. If no verified recovery
target is accessible, deliver a concrete recovery-target requirement; never
manufacture a "backup exists" result or purchase capacity silently.

Owned paths: new `scripts/ops/recovery-inventory.py`, its isolated fixture tests
under `e2e/`, and the lane's own dispatch. Claim additional operational files
in the issue before editing so Astra does not assign another writer there.
Avoid changes to canonical events, archive wire format, root key handling,
invite production dry-run, OCI exception, or another seat's working tree.

**Acceptance:** machine-readable, secret-free inventory; a test detects a
missing/unknown recovery dependency; exact before/after disk measurement;
the ten-GB reserve required by `ops/ant-node/fence.md` restored if achievable
without losing recovery material; services and restart paths checked. Bitcoin
recovery requires its own database-preservation and rollback record, followed
by observed block progress. If a required operation cannot be completed,
keep that acceptance item open and return the specific remaining dependency.

**Why this compounds:** the same service/state inventory supports disk repair,
deployment drift detection, disaster recovery, provider migration and resource
admission. Keep provider names in adapters; inventory facts never become
constitutional authority.

## G2 — Astra's parallel lane

Trace the existing `event-bus`, `composition`, `voucher-escrow`, `banchor`
replay, and `bnr-archive` boundaries before adding a second ledger. Select one
existing receipt path for a narrow durable-append/cursor recovery proof.
The acceptance model includes process death before/after append and ack,
duplicate delivery, truncation, corruption, consumer lag and exhausted disk.
No result may imply history is complete when a gap is known. State
reconstruction must not re-execute historical payments or expired intents.

Resource admission and recovery use the same observed facts: sufficient disk
for append/repair, a bounded backlog, and a named stop reason when evidence or
capacity is absent. Learning proposes changes as Evidence/Intent, with
authority checked before effects; it does not rewrite kernel rules or trust
its own confidence as permission.

First output is a source-cited, bounded implementation docket plus a failing
reproduction against the chosen seam. A ratified epoch schema, new identity
method, universal score, consensus protocol or all-service rewrite is outside
this lane. Review the negative test before building the solution.

## Return contract

Issue comment, at most 150 words: **CLAIM/owner → exact head → tests →
deployment/main comparison → receipt link → unresolved acceptance items**.
Close with evidence, not a narrative promise. Explicitly state whether the
box changed and whether a recovery rehearsal actually ran. For each next
session, state model, effort, fresh/continuing, owned files and stop condition.

End of docket.
