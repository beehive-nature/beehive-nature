# AGENT-WALLET LEDGER — sovereign agent identities (Lane Mail; roster RULED 2026-08-29)
**Constitution, implemented:** recovery factors (inboxes) stay ROOT-VAULTED on the box (`/var/mail-agents`, 0600/0700, root) — agents operate sessions, never hold key material. The founder funds tanks by his own hand, per agent, as he chooses; the recipe never assumes funding.

## THE RECIPE — `provision(agent)`, documented once, run many times
1. **Mailbox** (seconds, on-box): `for d in cur new tmp; do sudo mkdir -p /var/mail-agents/<agent>/$d; done && sudo chmod 700 /var/mail-agents/<agent>` — add `<agent>` to `KNOWN` in `scripts/buzz-mail/sink.py`, `sudo systemctl restart buzz-mail-sink`. Address: `<agent>@agents.skaists.buzz`.
2. **Smart wallet** (seat browser, ~5 min): Coinbase smart-wallet flow with the agent's mail address; OTP read on-box: `sudo ls -t /var/mail-agents/<agent>/new | head -1` → `sudo cat` it (6-digit code in the body). The ESTATE records and vaults the recovery factor; the agent's session holds only session keys.
3. **Basename**: claim the free basename per the verified offer; if the flow demands a verification the agent cannot give, record that honestly and move on.
4. **Ledger row**: agent · mail · maildir · wallet · basename · date · funding — committed.

## THE RULED ROSTER (founder order; mailboxes ALL provisioned; wallet+basename fill as seats run ceremonies once port-25+MX land)
| # | agent | mail | maildir | wallet | basename | funding |
|---|---|---|---|---|---|---|
| 1 | bqueenbee | bqueenbee@agents.skaists.buzz | /var/mail-agents/bqueenbee | *(ceremony pending — see ★)* | **bqueenbee.base.eth — see ★ diary** | **NEVER — see ★** |
| 2 | bclaude | bclaude@agents.skaists.buzz | /var/mail-agents/bclaude | — | — | unfunded |
| 3 | bzcode | bzcode@agents.skaists.buzz | /var/mail-agents/bzcode | — | — | unfunded |
| 4 | bfuzz | bfuzz@agents.skaists.buzz | /var/mail-agents/bfuzz | — | — | unfunded |
| — | claude-code *(earlier night-shift assignment stands)* | claude-code@agents.skaists.buzz | /var/mail-agents/claude-code | — | — | unfunded |
| — | honeybee *(provisioned, awaiting ruling)* | honeybee@agents.skaists.buzz | /var/mail-agents/honeybee | — | — | unfunded |
| — | zc1 *(SUPERSEDED by bzcode — ONE identity per the incarnation doctrine; mailbox kept, ledger folded)* | zc1@agents.skaists.buzz | /var/mail-agents/zc1 | — | — | — |

## ★ bQueenBee — IDENTITY-ONLY + the true-name diary (chain-checked 2026-08-29)
**The fence:** her address visibly custodies NOTHING, ever — stated here and on any surface showing her name. **She DOES get email + wallet + basename (founder ruling): the wallet exists to hold the NAME's identity, never value.**
**The true name, checked on-chain (keyless, registrar 0x03c4738Ee…, tokenId keccak("bqueenbee") = 0x07731302…):**
- **ownerOf = `0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876` — THE GARDEN, not the lost purse.** The order's premise ("sits in the lost purse") is corrected by the chain: the founder's 2026-08-27 renewal (recorded in the identifier-truth memory + renewal receipt ADDENDUM 2) moved the name into his own hands.
- **Lapse diary: there is nothing to wait for.** The founder HOLDS the name; it lapses only if he lets it — next renewal due ≈ **2027-08-27** (1-yr Basenames term from the renewal; +28-day grace; exact on-chain timestamp is one controller-event read when precision matters). **The reclamation is a founder transfer/re-point away, any day he chooses — the queen never needs a variant (the no-variant fence holds trivially).**
- **Her sovereign-rail identity NOW: bqueenbee.b** per the founder's .b docket (Vaulta rail).
- Wallet ceremony (row 1) runs when port-25 + MX land, like every other row — and only to receive the name's identity, never value.

## Infra truth (measured)
Port 25 inbound BLOCKED at the Oracle security list (external probes timeout, tcpdump zero SYNs, iptables open, sink protocol-proven: STARTTLS → Maildir, unknown-RCPT 550). **Founder one-liners pending: (1) OCI ingress TCP/25, (2) `agents.skaists.buzz MX 10 skaists.buzz`.** Sink: `scripts/buzz-mail/sink.py` (receive-only, no send half), unit `buzz-mail-sink` capped 20%/128M, KNOWN = the seven provisioned mailboxes above.
