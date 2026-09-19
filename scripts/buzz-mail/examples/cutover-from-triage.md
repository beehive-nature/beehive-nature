# cutover-from-triage.md — single-reader switch plan (RUNBOOK EXAMPLE, NOT EXECUTED)

Nothing in this directory runs anywhere today. This is the documented
cutover for the FOUNDER-GATED activation gesture, written now so the
single-reader law survives contact with deployment.

## The law

`mailgate.py` SUPERSEDES the deployed triage reader
(`/opt/buzz-mail/triage.py`, SHA-256 d9ff30d6…, byte-equal to
origin/codex/raid-sprint-handoff-2026-09-07). Exactly ONE reader of any
mailbox may run at any time. The cutover is one atomic gesture, in order:

1. `systemctl disable --now buzz-mail-triage.timer`
2. `systemctl stop buzz-mail-triage.service` — the RUNNING reader must be
   stopped, not just the timer: a mid-flight oneshot still holds the
   worker.lock and can still be inside its claim window (F5, adfb6d9e).
3. import triage state (below)
4. install + enable `buzz-mailgate.timer` (from the examples, into ops/
   and /etc/systemd/system together — ops/ is verbatim box truth)

Never a window where both read, never a mailbox read by two consumers.

## State carryover — every row crosses, nothing reprocessed, nothing dropped

The carryover is now CODE: `scripts/buzz-mail/import_from_triage.py`
(one-shot, offline, digests+state only — no bodies moved, read or
emitted; synthetic proof in `test_import_from_triage.py`). The queue
mapping, exact:

| queue at the boundary | gate row after `import_from_triage.py` |
|---|---|
| CLAIMED, terminal (drafted / sensitive_review / format_review / failed) | status as-is, **notify='legacy_pre_cutover'** — never re-drafted, never backfill-notified |
| CLAIMED, in flight (retry / processing) | status='received', **notify='none'**, `attempts` + `next_attempt` PRESERVED — resumes under the gate's backoff and three-attempt cap |
| UNCLAIMED pre-boundary **bclaude** mail (the old reader checked budget caps BEFORE inserting a claim row, so its queue can hold mail with no ledger row at all) | status='received', **notify='legacy_pre_cutover'** — pending DRAFT work: never discarded as backfill, never retroactively notified |
| pre-boundary mail in the OTHER mailboxes | never that reader's queue — keeps the explicit no-backfill policy (unknown rows stay epoch-skipped) |
| INTERVAL mail (arrived during the pause, mtime >= boundary) | fully eligible — the importer sets the gate's epoch to the boundary |

The boundary timestamp is captured BEFORE the old reader stops. The
current-day budget row carries over unchanged (same-day model calls are
not re-granted). The import is idempotent (INSERT OR IGNORE + epoch set
only if absent): running it twice changes nothing. Exactly one reader
ever runs — this tool is offline bookkeeping between step 2 and step 4.

## Drafting continuity

The ported drafting stage is OFF by default. If drafting is wanted before
activation re-opens network policy, run it manually once with
`--draft-key-file` against the box meter endpoint, or defer to activation.
The port keeps the baseline's claim-then-call order with attempts and
next_attempt backoff (F3).

## zc1

The seventh directory `/var/mail-agents/zc1` is a retired artifact
(coordinator ruling): it stays on disk, gets no roster entry, and the
gate skips any Maildir not in the roster (mailbox-not-provisioned skip).
