# Private local mail triage on the box

The first autonomous mail worker reads **only bClaude's inbox**, calls the existing
box-local Qwen model through the meter gate, and stores private suggested replies.
It is not yet a Buzz room participant or an autonomous coding executor.

Source: `scripts/buzz-mail/triage.py` → `/opt/buzz-mail/triage.py`.
The two systemd files in this directory are the deployed units verbatim.

## Behavior and boundaries

- Scan `new` and `cur` under `/var/mail-agents/bclaude` every two minutes after
  the previous run ends. Do not move, mark read, delete or rewrite messages.
- Key drafts by the SHA-256 of the original message. Byte-identical duplicates and
  Maildir moves reuse one record. Messages with different transport headers are
  different byte sequences and can create separate drafts.
- State is `/var/lib/buzz-mail-triage/triage.sqlite3`, directory 0700, database 0600.
  Store classifications, draft text, model token usage, retry state and daily budget
  privately. Journal output is counts and fixed status names only.
- No SMTP send, shell tools, URL following, attachment execution or coding dispatch
  exists in the worker. The model is not an authorization mechanism; every draft
  is marked `untrusted_email` / `draft_only` by code.
- Plain-text bodies only, no attachments, 256 KiB maximum input file, bounded prompt
  and response. A narrow credential-message keyword check holds likely OTP/reset
  mail for review without inference; this is not comprehensive secret detection.
  HTML-only and unparseable messages are also held for review.
- At most two model calls per run, 24 per UTC day, three attempts per message,
  five-minute retry delay. Claims and budget are committed before inference.
  A crash may repeat inference after the delay; it cannot send mail or duplicate a
  draft row. This is not an exactly-once distributed execution claim.
- Local endpoint is fixed to `http://172.18.0.1:8091/v1/chat/completions` (the meter
  gate), model `qwen2.5-3b-instruct`. Proxies and HTTP redirects are disabled.
- Dedicated existing-ledger identity: `bclaude-mail-local-1`, **free tier**.
  Its bearer is `/etc/buzz-mail-triage/api.key` (root 0600 inside a 0700 directory),
  never in the repository or command line. No paid balance or settlement changes.

The service runs as root to read the existing root-owned 0600 Maildir; the SMTP sink
continues creating mail with that ownership. The unit removes capabilities, makes
the filesystem read-only except private state, hides the other five inboxes, and
restricts IP access to the box's bridge address. This is a narrow data processor,
not a root coding agent. A future executor must run as a separate unprivileged user
with explicit job authority and an isolated worktree.

## Operate

On the box:

```sh
sudo systemctl status buzz-mail-triage.timer
sudo systemctl show buzz-mail-triage.service -p Result -p ExecMainStatus
sudo python3 /opt/buzz-mail/triage.py --status
```

These reveal counts/status, not email or drafts. Authorized review of individual
private drafts happens on the box; never publish the database in Git or dump all
inbox contents into a task log.

Install the script at the path above and the units under `/etc/systemd/system`,
after provisioning the dedicated free key through the existing meter's `newkey`
operation as its ledger-owning `ubuntu` user. Capture the secret privately; the
meter CLI normally prints it. Preserve ledger ownership. Validate the units with
`systemd-analyze verify`, run one successful `systemctl start buzz-mail-triage`,
then `systemctl enable --now buzz-mail-triage.timer`.

Pause without losing inbox or processing state:

```sh
sudo systemctl disable --now buzz-mail-triage.timer
sudo systemctl stop buzz-mail-triage.service
```

## Validation

`python3 scripts/buzz-mail/test_triage.py` on Linux/WSL tests duplicate delivery,
Maildir movement, credential/HTML holds, attachment exclusion, hostile email's
non-authoritative status, schema rejection, file limits, error redaction, persistent
budget, crash recovery and private-state modes. These tests establish code
boundaries; they do not establish model accuracy or general prompt-injection
resistance. The live synthetic probe and deployment results are in the dated
dispatch.
