# cutover-from-triage.md — single-reader switch plan (RUNBOOK EXAMPLE, NOT EXECUTED)

Nothing in this directory runs anywhere today. This is the documented
cutover for the FOUNDER-GATED activation gesture, written now so the
single-reader law survives contact with deployment:

## The law

`mailgate.py` SUPERSEDES the deployed triage reader
(`/opt/buzz-mail/triage.py`, SHA-256 d9ff30d6…, byte-equal to
origin/codex/raid-sprint-handoff-2026-09-07). Exactly ONE reader of any
mailbox may run at any time. The cutover is one atomic gesture:

1. `systemctl disable --now buzz-mail-triage.timer`
2. import triage state (below)
3. install + enable `buzz-mailgate.timer` (from the examples, into ops/
   and /etc/systemd/system together — ops/ is verbatim box truth)

Never a window where both read, never a mailbox read by two consumers.

## State carryover (mail is neither silently reprocessed nor dropped)

The deployed triage state (`/var/lib/buzz-mail-triage/triage.sqlite3`)
rows are `digest PRIMARY KEY` with statuses drafted / sensitive_review /
format_review / failed / retry / processing. The gate's schema keys on
`(mailbox, digest)` and starts notify-side state at `none`.

Import mapping (one-shot, at cutover, before the first gate run):

| triage row (digest, status) | gate row (mailbox, digest, status, notify) |
|---|---|
| any digest already recorded | `('bclaude', digest, status→received/held_*, notify='legacy_pre_cutover')` |

- Every triage digest becomes a gate row with `notify='legacy_pre_cutover'`
  so the gate's dedupe recognizes pre-cutover mail (it will NOT re-notify
  or re-draft it) — no silent reprocessing.
- `notify='legacy_pre_cutover'` is a durable hold like the others: a human
  can later decide, per digest, whether a notification is owed for mail
  that arrived before the notification service existed. Nothing is dropped.
- Triage's model outputs (`result` JSON) stay in the OLD db; the gate does
  not copy draft text into its own state (the no-content-in-db law).
- The `epoch` marker: after the import, allow the gate's first-run epoch to
  stand (it suppresses backfill notification for un-imported old mail);
  the import above covers the triage-visible corpus explicitly.

## Drafting continuity

The ported drafting stage is OFF by default. If drafting is wanted before
activation re-opens network policy, run it manually once with
`--draft-key-file` against the box meter endpoint, or defer to activation.
The port keeps the same claim/budget crash laws as the baseline.

## zc1

The seventh directory `/var/mail-agents/zc1` is a retired artifact
(coordinator ruling): it stays on disk, gets no roster entry, and the
gate skips any Maildir not in the roster (mailbox-not-provisioned skip).
