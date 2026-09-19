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

The deployed triage state (`/var/lib/buzz-mail-triage/triage.sqlite3`)
rows are `digest PRIMARY KEY` (bclaude only) with statuses drafted /
sensitive_review / format_review / failed / retry / processing. The gate's
schema keys on `(mailbox, digest)`. One-shot import before the first gate
run:

| triage row (digest, status) | gate row (mailbox='bclaude', digest, …) |
|---|---|
| drafted / sensitive_review / format_review / failed | status mapped as-is, **notify='legacy_pre_cutover'** — finished or held work: the gate never re-drafts it and never backfills a notification |
| retry / processing (IN FLIGHT) | status='received', **notify='none'** — the gate RESUMES these as incomplete rows (crash-law path: re-derived, re-notified if a binding is verified, drafted under budget caps) |

- Finished mail is never re-drafted: `legacy_pre_cutover` is a terminal
  notify state in the scanner, and drafting is additionally gated on
  classification status.
- In-flight work is not lost: retry/processing rows cross as incomplete
  and complete under the gate's own claim/backoff laws.
- The mail row's `epoch` marker: after the import, allow the gate's
  first-run epoch to stand — the import above covers the triage-visible
  corpus explicitly; anything older than epoch is skipped as backfill.
- Triage's model outputs (`result` JSON) stay in the OLD db; the gate does
  not copy draft text into its own state (the no-content-in-db law).

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
