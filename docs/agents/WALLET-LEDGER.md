# AGENT-WALLET LEDGER — sovereign agent identities (Lane Mail, generalized by founder rider 2026-08-29)
**Constitution, implemented:** recovery factors (inboxes) stay ROOT-VAULTED on the box (`/var/mail-agents`, 0600/0700, root) — agents operate sessions, never hold key material. The founder funds tanks by his own hand, per agent, as he chooses; the recipe never assumes funding.

## THE RECIPE — `provision(agent)`, documented once, run many times
1. **Mailbox** (seconds, on-box): `for d in cur new tmp; do sudo mkdir -p /var/mail-agents/<agent>/$d; done && sudo chmod 700 /var/mail-agents/<agent>` — then add `<agent>` to `KNOWN` in `scripts/buzz-mail/sink.py`, `sudo systemctl restart buzz-mail-sink`. The address is `<agent>@agents.skaists.buzz`.
2. **Smart wallet** (seat browser, ~5 min): open the Coinbase smart-wallet flow with the agent's mail address; when the OTP mail arrives (seconds after the founder's port-25 + MX one-liners are live), read it on-box: `sudo ls -t /var/mail-agents/<agent>/new | head -1` → `sudo cat /var/mail-agents/<agent>/new/<that-file>` — the code is a 6-digit string in the body. Enter it in the browser. **The estate records and vaults the recovery factor; the agent's session holds only session keys.**
3. **Basename** (same browser): claim the free basename per the verified offer (Basenames on Base; if the flow demands a verification the agent cannot give, record that honestly and move on — the ledger holds truth, not wishes).
4. **Ledger row** (one line, committed): agent · mail · maildir · wallet address · basename · date · funding state.

## ROSTER (order ruled; wallet+basename columns fill as each seat runs its ceremony — mailboxes for the whole roster are ALREADY provisioned)
| # | agent | mail | maildir | wallet address | basename | date | funding |
|---|---|---|---|---|---|---|---|
| 1 | claude-code | claude-code@agents.skaists.buzz | /var/mail-agents/claude-code | — | — | — | unfunded |
| 2 | zc1 | zc1@agents.skaists.buzz | /var/mail-agents/zc1 | — | — | — | unfunded |
| 3 | bclaude | bclaude@agents.skaists.buzz | /var/mail-agents/bclaude | — | — | — | unfunded |
| 4 | bfuzz | bfuzz@agents.skaists.buzz | /var/mail-agents/bfuzz | — | — | — | unfunded |
| 5 | honeybee | honeybee@agents.skaists.buzz | /var/mail-agents/honeybee | — | — | — | unfunded |
| … | *(the rest of the hive bees as they're named — one recipe run each)* | | | | | | |

## ★ CONSTITUTIONAL CARVE-OUT — bQueenBee is IDENTITY-ONLY
**bQueenBee gets an email and a basename — and her address visibly custodies NOTHING, ever.** (Standing fence: never invite value to the one agent forbidden to hold it. Any public surface that shows her name carries this line.)
| agent | mail | maildir | wallet | basename | rule |
|---|---|---|---|---|---|
| bqueenbee | bqueenbee@agents.skaists.buzz | /var/mail-agents/bqueenbee | **NONE — do not create** | hers to claim (identity only) | **ID-ONLY: no wallet creation, no funding, ever; ledger and any public surface state it** |

## Infra truth (measured)
Port 25 inbound BLOCKED at the Oracle security list (external probes timeout, on-box tcpdump zero SYNs, host iptables open, sink protocol-proven: STARTTLS → Maildir, unknown-RCPT refused 550). **Founder one-liners pending: (1) OCI ingress TCP/25, (2) `agents.skaists.buzz MX 10 skaists.buzz`** — the moment both land, OTP mail flows and the wallet ceremonies can run. Sink source: `scripts/buzz-mail/sink.py`; unit `buzz-mail-sink` (capped 20%/128M); known-addresses-only, NO send half exists in the process.
