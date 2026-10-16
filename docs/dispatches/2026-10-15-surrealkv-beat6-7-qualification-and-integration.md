# 2026-10-15 — SKV beats 6–7: qualification recorded, integration corrected — the in-tree record

Beats 6–7 of the SurrealKV storage-adapter lane are coordination beats;
this dispatch is their in-tree record (documentation precision, founder
beat 7: GitHub retains a PR body after merge, but the body does not
enter main's Git tree — the committed dispatch is what preserves the
evidence there; beats 1–5 have theirs, this completes the chain).

## Qualification (founder, beat 6, independently verified)

#422 is qualified at the eight-job `tests` workflow gate: **8/8 on both
recorded runs at `55e0f9df2`** (test, static, eternal, formal,
formal-cryptol-leg, wallet, node, meter). PR #422 is open and
mergeable. The head's check inventory: 52 successful, 7 skipped
(workflow-scoped), 1 queued.

## The queued RB leg — resolved, policy not waived

`rb04-daedalus` belongs to the separate bTunGsTeN RB workflow, queued
since 19:03Z on the estate-wide runner backlog (that workflow's three
newer runs queue behind the same wall). `main` is not branch-protected
(404), so the leg is not a MECHANICAL merge blocker — but per the
founder that "does not waive the project's own exact-head
qualification policy": the estate's gates stay the estate's gates.

## Coordination correction (founder, beat 7 — my redundancy withdrawn)

The #435 controller seat had ALREADY integrated the storage head before
my beat-6 handoff posted: merge commit `47cf4bfce` has `55e0f9df2` as a
parent, the branch was requalified locally and pushed as `7efd9a385`,
and the SKV-5 dispatch rides that branch explicitly retaining the +14%
limitation and the three-way recovery distinction. My handoff
instruction to "incorporate `55e0f9df2`" was therefore duplicative and
is WITHDRAWN on the record (PR #435 comment 6202874132). The
controller seat's remaining task is solely the required CI verdict on
the integrated tree — its BNROSE-EVOLVE workflow is already green on
that head; the broader `tests` workflow was still running/queued at
read. Lesson banked: read the target seat's existing integration record
before posting incorporation instructions — the record precedes the
request.

## Disposition (founder, verbatim substance)

- #422 proceeds through its established eight-job acceptance and merge
  process; the unrelated queued RB leg is not a mandatory
  branch-protection requirement.
- #435 continues its existing integrated-head qualification — no
  duplicate merge.
- After both land, #436 receives the qualified dependency stack with
  fresh checks. #441 stays independent.
- aarch64, six-service independence, and power-loss fault injection
  remain separate future qualifications, never retroactive blockers.

## Standing limitation (carried in-tree, unchanged)

SurrealKV 1.0's measured **+14% post-prune physical growth** (tombstone
materialization; no manual leveled-compaction trigger in 1.0) is an
UNRESOLVED longevity limitation. Logical pruning and migration passed;
sustained physical reclamation, power-loss durability, and
independent-peer recovery are separate claims. Process-crash recovery ≠
power-loss durability ≠ sovereign recovery across independent peers —
on every qualification receipt family; power-loss awaits its own
fault-injection experiment and is never inferred from SIGKILL.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13.
