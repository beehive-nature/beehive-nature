# VPS mail and autonomous agent readiness — 2026-09-07

Read live on oracle at approximately **2026-09-08 02:19–02:29 UTC**
(September 7 evening in America/Denver). This was a status inspection. No mail DATA
was submitted, no queue was flushed, no service restarted, and no task launched.

**Result:** inbound mail is functioning at the box's SMTP boundary. Outbound routing
is stalled. The repo-to-Buzz dispatcher and bClaude harness are running, but model
authentication and recipient routing prevent a demonstrated autonomous build loop.

## Mail: observed now

| Check | Observation | Meaning |
|---|---|---|
| SSH | `wsl -e ssh oracle` connected | The box is reachable from this seat now |
| Inbound service | `buzz-mail-sink.service`: active/running, active since Sep 2 | Receive process is alive |
| SMTP protocol, loopback | EHLO 250; STARTTLS offered; TLSv1.3 / AES-256-GCM negotiated; known `bclaude@agents.skaists.buzz` RCPT 250; nonexistent recipient 550; RSET/QUIT without DATA | Local SMTP and recipient checks work. No fresh external delivery was tested |
| TLS certificate | Subject and issuer both CN=agents.skaists.buzz; validity Aug 29, 2026–Dec 1, 2028 | Self-signed. Diagnostic handshake did not verify a public trust chain; this is not a publicly trusted TLS claim |
| DNS | MX `10 skaists.buzz.`; SPF names the box; DKIM selector has a published public key; DMARC `p=none` | DNS records exist. Existence alone does not prove external inbox placement |
| bClaude mailbox | 3 files under `new`, 0 under `cur`; latest file Aug 29 20:33:41 UTC | No recent arrival in that mailbox. Maildir placement does not prove nobody read a file directly |
| Other mailboxes | bzcode 15, claude-code 3, others empty; only counts/timestamps inspected | No mail bodies, OTPs or private message subjects were read |
| Postfix | `postfix@-.service` is failed, but a separate Postfix master process is running and retrying | Service supervision and actual process state disagree; do not infer all queue processing stopped from the unit alone |
| Queue | One deferred message, created Sep 3 22:34:18 UTC, addressed within the local agents domain | Mail is retained, not delivered. It was not this session's two-order email |
| Deferred route | Mail log repeatedly attempts the box's public MX address on port 25 and times out | Even the queued local-agent delivery is taking a failing public route |
| Direct SMTP egress | Forced IPv4 connection to a Gmail MX on port 25 timed out; connection to smtp.gmail.com:587 succeeded | Direct MX delivery is unavailable in this check; submission-port TCP is reachable, but no authenticated relay was configured or tested |
| DKIM service | opendkim active/running | Signer service is up; no newly signed message or delivery receipt generated |

The old [mailroom receipt](MAILROOM_DESK_2026-08-29.md) attributes outbound port-25
failure to OCI egress policy. That is historical context; this check establishes the
current failed network path, not a fresh inspection of OCI policy. It also corrects
the old certificate expiry year with the live certificate's value.

Receive-code parity: local `scripts/buzz-mail/sink.py` and live
`/opt/buzz-mail/sink.py` have the same SHA-256:
`6573567c473b5ba647c686839259c4f2004583ff27496b19331b4b87e5bf2e2d` — PUBLIC-CONSTANT.
`Sink.handle_DATA` saves mail into `/var/mail-agents/<agent>/new`; it does not invoke
a coding agent, queue a build, or send a reply.

## Agent function: observed now

| Piece | Observation | Remaining boundary |
|---|---|---|
| bClaude harness | `buzz-bclaude` active/running; buzz-acp and claude-agent-acp processes exist | An active wrapper is not a successful inference or build |
| Provider authentication | `claude auth status --json`, as ubuntu: loggedIn=false, authMethod=none; ANTHROPIC_API_KEY empty in config and both running processes | No usable Claude authentication was established. No secret value was printed |
| Answer authority | Live service runs `--respond-to owner-only` | Incoming mail or another agent's signed message is not automatically an authorized owner request |
| Activity | bClaude file log last changed Sep 5 23:19:34 UTC; historical reconnects and channel subscriptions visible | No fresh successful task/result receipt established. Cumulative restart count 727 is historical, not evidence of a current crash loop |
| Dispatcher | ubuntu USER service `bnr-bdispatch-watcher` active; pull timer active | It is a user unit, not a system unit; a system-unit-only search misses it |
| Dispatcher source | `tools/bdispatch/watcher.py::parse` requires FIRST LINE `SEND TO: <seat>`; `main` maps seats and sends NIP-17 DMs | This watches repo Markdown, not SMTP Maildirs. Its relay ledger records transport, not job execution |
| Current recipient map | z2.1, z3.1, z3.2, z3.3 and code MISSING; goose mapped; no bclaude recipient row | Most intended recipients cannot be resolved |
| Delivery evidence | Dispatcher state has 1 row, last modified Sep 3 22:50:28 UTC; latest 150 watcher lines all report missing/holding | The watcher is alive but has no demonstrated current build handoff |
| Box checkout | `/home/ubuntu/beehive-nature`, main at df895c7; one untracked relay.log | The watcher observes this checkout, not this seat's feature branch |
| Pull configuration | Actual user unit runs `git pull --rebase --autostash --quiet`; repo installer describes ff-only | Deployment/configuration drift. No pull behavior was changed in this inspection |

The [two prepared sprint orders](2026-09-07-raid-sprint-handoff.md) are on
`codex/raid-sprint-handoff-2026-09-07`. They begin with Markdown headings and have
recipient prose, not the dispatcher's required first-line envelope. **Prepared and
pushed did not mean sent, acknowledged, or started.** No `RELAYED` or completion
receipt exists for them in this inspection.

## What has advanced, and the next complete proof

Real components exist: private per-agent inbox storage; a signed repo-to-Buzz bridge;
a persistent ACP wrapper; healthy Buzz relay containers; running shared compute,
meter gate and x0x services. The [September 7 G0 receipt](2026-09-07-zcode-g0-integration.md)
and [voice evidence](2026-09-07-zcode-g0-voice-evidence.md) record deployed voice-source
parity and queue checks. Those are useful building blocks, not a receipt for unattended
software delivery.

The next useful implementation milestone is one small authorized job through:

**authorized dispatch → recipient acknowledgment → isolated worktree → actual edit →
relevant tests → commit/PR → result receipt → safe restart/retry without duplicate work.**

Concrete sequence:

1. Establish bClaude's legitimate model authentication on the box through secure login
   or the existing secret-delivery mechanism. Never request credentials in chat.
2. Resolve the real recipient identity and owner/delegation boundary. Use signed,
   attributed job authority; an SMTP From header is not permission to run a command.
3. Give that one job the actual dispatcher envelope, publish it to the watched checkout,
   and obtain an acknowledgment. Preserve the full author/provenance of relayed orders.
4. Complete one bounded documentation/code task with the existing worktree, test and
   secret-scan rules; return a verifiable commit/PR receipt and exercise a retry.
5. Separately repair local-agent mail routing and Postfix supervision, then address
   external egress if external replies are needed. Repairing/flushing the existing queue
   could deliver old mail; no such send was authorized or performed by this status check.

Email-to-agent ingestion needs an explicit authenticated admission boundary if added.
Arbitrary external mail must remain message data, never executable instructions merely
because it arrived in an agent inbox. Reliable acknowledgment, durable job state and
result reporting are needed beyond a relay event ID.

## Correction to this seat's earlier mail explanation

The previous handoff truthfully recorded that Gmail was signed out and no email was
sent. It was too narrow as an account of BNR's delivery options: the box already has
its own working local SMTP receiver. Gmail is not required to reach a local agent
mailbox from the box. Delivery to that mailbox still does not wake a coding agent.

This inspection closes the status question, not the above implementation milestones.
No new permission, provider credential, wallet operation or external communication was
performed. Evidence consists of live service/process status, safe metadata/protocol
probes, selected diagnostics and the cited source functions.
