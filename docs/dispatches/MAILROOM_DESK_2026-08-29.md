# MAIL ROOM DESK — first digest + send-half build (2026-08-29)
**Standing role:** z1 runs the Mail Room — agents.skaists.buzz is the desk. Receive-only was the old truth; the send half is now BUILT on the box (postfix 3.8.6 queue + opendkim 2.11.0 signing, verified) and gated by exactly one measured fact: **OCI blocks outbound :25 (Errno 101, kernel-level)** — see Measurements.

## 1 · SEND-HALF BUILD STATE (all on the box, skaists.buzz = 129.153.202.144)
- **postfix 3.8.6** — outbound queue mode, loopback-only (the sink owns :25; postfix binds nothing public). Local scripts submit via the `sendmail` binary → pickup → DKIM signing → queue → internet MX (**currently held** by the OCI egress block; queue is durable, mail waits).
- **opendkim 2.11.0** — :8891, selector `mail`, key `/etc/opendkim/keys/agents/mail.private` (0600). **Signing verified live**: a queued test message carries `DKIM-Signature: v=1; a=rsa-sha256; c=simple/simple; d=agents.skaists.buzz`.
- **Inbound STARTTLS — ALREADY HARDENED (updates the morning note):** the sink advertises `250-STARTTLS` and completes **TLSv1.3 / AES-256-GCM**; cert CN=agents.skaists.buzz, valid 2026-08-29 → 2026-12-01. Verified on-box (my line cannot see :25 — home ISP blocks client :25 AND SNI-filters .buzz). Opportunistic plaintext is retained by design (OTP one-time codes must never bounce).
- **The gate:** outbound :25 from the box = `Network is unreachable` (OCI blocks SMTP egress on new tenancies). Two doors, founder's pick: **(a)** file the OCI support request to lift the port-25 egress block (legitimate-mail justification; text drafted in the tree); **(b)** relay outbound through a smarthost on submission port 587 (NOT blocked by OCI) — a vendor credential ruling, costs sats/dollars. Until either door opens, outbound mail queues and waits — by design, never lost.

## 2 · DNS RECORDS — the founder's registrar paste (agents.skaists.buzz zone)
```
; SPF — only this box may send as @agents.skaists.buzz
agents.skaists.buzz.        IN TXT  "v=spf1 ip4:129.153.202.144 -all"

; DKIM — selector mail (key generated on the box 2026-08-29)
mail._domainkey.agents.skaists.buzz. IN TXT "v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn+21trflfrqMMN6Dj3EqYqzxFzgaavQEKyYC0BkAbNxeaP3ltRgJKYSQEzLn9JTsnRVsEQmX6FK2nUMl/COE3BGjaPYSUvjpRH3XO9HxMiWGyvKSc2nPdqto7c3yADB5wuTTi8++XGf0+Gj2fqmKn5fonmwCtxQ4CDxsJpLVwjEROzlcpKcezHNvl1NAC5qpfpi0ulqCerdvfj6VOoXk3PLO1zE9bLARosCO47CLbuJrVpKNaGPGlezLAuOxi3J3RB6QUqT2E/eXrZIc5hm5Fg1d5dic0CfUHonOJnGUVoMGHeawIkFBtMrFUSY5ftj9tl2mRzBKWPLRogKvy3BE9QIDAQAB"

; DMARC — monitor first (p=none); reports land on my desk; tighten to quarantine/reject after placement data
_dmarc.agents.skaists.buzz. IN TXT  "v=DMARC1; p=none; rua=mailto:bzcode@agents.skaists.buzz; fo=1"
```
(MX is already correct: `agents.skaists.buzz → 10 skaists.buzz`. If .dev becomes the sending identity later, the same three records publish under the .dev zone with the DKIM key reused.)

## 3 · DELIVERABILITY MEASUREMENTS (honest state)
- **SURBL:** skaists.buzz + agents.skaists.buzz = **clean** (no listing).
- **Spamhaus DBL: UNMEASURABLE from OCI** — every query returns 127.255.255.254 (Spamhaus refuses OCI resolver ranges regardless of domain). Needs Spamhaus DQS registration (free tier, founder gesture) to query properly.
- **Real inbox/spam placement (Gmail/Outlook/Proton/corporate): BLOCKED at the OCI egress gate** — cannot send a single test mail until (a) or (b) above opens. The TLD-penalty question stays **open, measured-later** — proposing the .dev switch before a single measured send would violate the measure-first law. The build supports both: the same DKIM key and SPF pattern publish under whatever sending zone is ruled.
- **Placed on record:** the .buzz SNI-filter hits the founder's line for WEB browsing; mail on the box egresses from OCI (no SNI issue) — the mail TLD-penalty risk is about RECEIVING servers' TLD reputation, which is exactly what the blocked measurement will answer.

## 4 · THE DESK — first triage (7 boxes, headers read, nothing consumed)
| box | mail | triage |
|---|---|---|
| **bclaude** | **the founder's letter** (loviswater44@gmail.com → bCLauDe@, "Go ahead and reply back when you can.") + 2 older | **LEAVE — bClaude's to answer when its lane unpauses.** Not mine to answer. |
| bfuzz/bqueenbee | **12 Coinbase Base login codes** (seat-wallet OTPs, 05:19–06:22) | ephemeral OTPs — all stale by now; no action; expect a stream whenever a seat wallet logs in |
| claude-code | 2 lane-mail e2e proofs + **my question to cc1** (jungle4 method, founder-directed) | proofs = receipts, keep; cc1's answer owed — chase at next desk day |
| honeybee | empty | — |
| zc1 | empty | my desk box, waiting |
- **Desk law holding:** drafts never auto-send; the estate speaks in public only after the founder's word.

## 5 · SCRIPTS & LANGUAGE DRAFTING
- Reply drafting runs in the sender's language where I can draft natively (ES/RU/UK/DE/FR/ZH/JA/KO + the CJK/RTL depth the desk was built for); where a tongue is beyond confident drafting, the draft says so in the draft — uncertain prose never ships (the desk law, applied to language).
- Digest cadence: per-arrival into the tree at desk days (this file's descendants).
EOF
echo written