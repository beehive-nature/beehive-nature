# AGENT-WALLET LEDGER — the estate's sovereign agent identities (Lane Mail genesis, 2026-08-29)
**Constitution fence (founder, standing):** the ESTATE holds recovery factors; agents operate sessions. Inboxes live only on the box (`/var/mail-agents`, root 0600) and never leave it. Founder funds tanks by his own hand as he chooses.

| agent | mail | maildir | wallet address | basename | status |
|---|---|---|---|---|---|
| claude-code | claude-code@agents.skaists.buzz | /var/mail-agents/claude-code (Maildir, root 0600) | — | — | **READY — night-shift seat's turn**: create Coinbase smart wallet via email-OTP (OTP read from the maildir), claim free basename per the verified offer |
| zc1 | zc1@agents.skaists.buzz | /var/mail-agents/zc1 (Maildir, root 0600) | — | — | PROVISIONED — onboards when zCode's turn is called |

## Onboarding kit (per agent, one path)
1. Prereq live: the sink answers SMTP on the box for known addresses only; STARTTLS offered; unknown RCPT refused (550).
2. In the seat's browser: begin the Coinbase smart-wallet flow with the agent's `@agents.skaists.buzz` address; the OTP mail lands in the agent's maildir (typically <30s once DNS+security-list are live).
3. Read OTP on-box: `sudo ls -t /var/mail-agents/<agent>/new | head -1` then `sudo cat` it — code is a 6-digit string in the body.
4. Record here: address, wallet type, basename, maildir path — commit. The estate holds the recovery factors per the constitution; the agent holds only session keys.

## Mail infra truth (measured, not assumed)
- **Port 25 inbound: BLOCKED at the Oracle security-list level.** Independent external nodes (check-host.net, Iran + Japan) both time out; on-box tcpdump sees zero SYNs; host iptables has the accept as rule #1; the sink is listening on 0.0.0.0:25 and fully proven at protocol level (STARTTLS → message → Maildir, unknown-RCPT refused). Local "open" readings from the seat's WSL are a local-proxy artifact — SMTP through an HTTP proxy stalls after connect.
- **Funder gestures pending (two one-liners, then mail flows):** (1) Oracle console → VCN → Security List → Add Ingress Rule: source 0.0.0.0/0, TCP, dest port 25. (2) DNS: `agents.skaists.buzz MX 10 skaists.buzz`.
- Sink: `scripts/buzz-mail/sink.py` (aiosmtpd 1.4.6, receive-only — no send half exists in the process), systemd `buzz-mail-sink` capped CPUQuota 20%/128M. Door under mail presence: 200 @ 120 ms (within the evening's 37–120 ms band; hives keep priority).
