# AGENT-WALLET LEDGER — sovereign agent identities (Lane Mail; roster RULED 2026-08-29)
**AUTONOMY SETTLED (founder ruling, 2026-08-29):** the founder OWNS the agents; they run **fully autonomous** — no per-transaction human gates, no founder in the runtime loop, industry-standard rails (Coinbase Agentic Wallets + x402). Spend caps are the **owner's optional tool** (the $1/24h Spend Permission pattern), never a condition of agency. A seat's browser limits are seat-behavior notes, not constraints on the agents.
**Operational security, implemented:** recovery factors (inboxes, authenticator seeds) stay ROOT-VAULTED on the box (`/var/mail-agents`, 0600/0700, root; `/etc/buzz-ceremonies`, 600). Agents operate wallet sessions and move value by their own session authority; vaulting recovery material protects the owner's assets and changes nothing about autonomy. The founder funds tanks by his own hand, per agent, as he chooses; the recipe never assumes funding.

## THE RECIPE — `provision(agent)`, documented once, run many times
1. **Mailbox** (seconds, on-box): `for d in cur new tmp; do sudo mkdir -p /var/mail-agents/<agent>/$d; done && sudo chmod 700 /var/mail-agents/<agent>` — add `<agent>` to `KNOWN` in `scripts/buzz-mail/sink.py`, `sudo systemctl restart buzz-mail-sink`. Address: `<agent>@agents.skaists.buzz`.
2. **Smart wallet** (native path, per the 2026-08-29 scope ruling): the bzDiD wallet at `surfaces/wallet.html` + `surfaces/onboarding/` — create-in-place, no popup, no OTP ceremony; keys derive from the soul (WebAuthn PRF), the EVM lane forges the agent's 0x address, sends sign locally. Optional spend cap = the owner's tool on the PAY panel. *(History: bzcode/bclaude's wallets were born through the Coinbase smart-wallet ceremony before the native ruling — receipts stand; the ceremony scripts themselves were stripped from the tree 2026-08-29.)*
3. **Basename**: claim the free basename per the verified offer; if the flow demands a verification the agent cannot give, record that honestly and move on.
4. **Ledger row**: agent · mail · maildir · wallet · basename · date · funding — committed.

## NAMING LOCK (founder ruling, 2026-08-29)
Agent mail local-parts follow the ruled roster names, b-prefixed and lowercased. **No stray identity exists** — the audit found zero non-conforming maildirs. The pre-ruling `zc1@` mailbox is removed from the sink accept list (superseded by `bzcode@` per the incarnation doctrine). Each row below carries the three-identity consistency check (maildir = wallet = basename = one handle).

## THE RULED ROSTER (founder order; mailboxes ALL provisioned; wallet+basename fill as seats run ceremonies once port-25+MX land)
| # | agent (handle) | mail | maildir | wallet | basename | genesis-allowance | funding |
|---|---|---|---|---|---|---|---|
| 1 | bqueenbee | bqueenbee@agents.skaists.buzz | /var/mail-agents/bqueenbee | *(ceremony pending — see ★)* | **bqueenbee.base.eth — see ★ diary** | **NONE — she holds identity, never value** | **NEVER — see ★** |
| 2 | bclaude | bclaude@agents.skaists.buzz | /var/mail-agents/bclaude | **shared: the founder's own wallet `0x89881F83A8C9CE06E34cbDD50A612909a784d7C6`** (no distinct bclaude smart wallet — founder's choice + hands, 2026-08-29; three-identity check deviation recorded in the receipt) | **bclaude.base.eth — CLAIMED 2026-08-29 by the founder, expires 2027-08-29, owner = his wallet (on-chain ×2 RPCs: ownerOf(keccak("bclaude")) on `0x03c4738Ee…DD9a`); profile filled at birth** | $1/24h founder guideline — **honored at $0: this seat composes, never signs** (receipt: `RECEIPT-BCLAUDE-BASENAME-2026-08-29.md`) | founder's own tank (shared wallet) |
| 3 | bzcode | bzcode@agents.skaists.buzz | /var/mail-agents/bzcode | **`0x907F3B95cA3611DD3d9754B874A70CbB28C15738`** (Coinbase smart wallet, split ceremony 2026-08-29) | **bzcode.base.eth — CLAIMED 2026-08-29, 1 yr, owner = the wallet (on-chain: ownerOf(keccak("bzcode")) on `0x03c4738Ee…DD9a`)** | $1/24h at ceremony (USDC, own wallet) | gas tank + name ETH by founder's hand |
| 4 | bfuzz | bfuzz@agents.skaists.buzz | /var/mail-agents/bfuzz | — | — | $1/24h at ceremony (USDC, own wallet) | unfunded |
| — | claude-code *(earlier night-shift assignment stands)* | claude-code@agents.skaists.buzz | /var/mail-agents/claude-code | — | — | $1/24h at ceremony | unfunded |
| — | honeybee *(provisioned, awaiting ruling)* | honeybee@agents.skaists.buzz | /var/mail-agents/honeybee | — | — | $1/24h at ceremony | unfunded |

## ★ bQueenBee — IDENTITY-ONLY + the true-name diary (chain-checked 2026-08-29)
**The fence:** her address visibly custodies NOTHING, ever — stated here and on any surface showing her name. **She DOES get email + wallet + basename (founder ruling): the wallet exists to hold the NAME's identity, never value.**
**The true name, checked on-chain (keyless, registrar 0x03c4738Ee…, tokenId keccak("bqueenbee") = 0x07731302…):**
- **ownerOf = `0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876` — THE GARDEN, not the lost purse.** The order's premise ("sits in the lost purse") is corrected by the chain: the founder's 2026-08-27 renewal (recorded in the identifier-truth memory + renewal receipt ADDENDUM 2) moved the name into his own hands.
- **Lapse diary: there is nothing to wait for.** The founder HOLDS the name; it lapses only if he lets it — next renewal due ≈ **2027-08-27** (1-yr Basenames term from the renewal; +28-day grace; exact on-chain timestamp is one controller-event read when precision matters). **The reclamation is a founder transfer/re-point away, any day he chooses — the queen never needs a variant (the no-variant fence holds trivially).**
- **Her sovereign-rail identity NOW: bqueenbee.b** per the founder's .b docket (Vaulta rail).
- Wallet ceremony (row 1) runs when port-25 + MX land, like every other row — and only to receive the name's identity, never value.


## ★ THE HAND OF THE NORTHERN KING — a gift, held in the garden (2026-08-29)
**北方國王之手.base.eth** — the founder snagged it on his phone and gifted it to z1: *'a gift from me to you once you have everything running for a bit.'*
On-chain (registrar 0x03c4738Ee…DD9a, tokenId keccak(北方國王之手) = 0x918f89f886f21d43e26d77bdab028155f659de30c5f28cf65b7cf1eb0c748654 (PUBLIC-CONSTANT)): ownerOf = 0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876 — the founder's garden, his hands, his gift. The name waits there until the everything-running-for-a-bit day; the seat keeps it in the record, not in its pocket.

## Infra truth (measured)
Port 25 inbound BLOCKED at the Oracle security list (external probes timeout, tcpdump zero SYNs, iptables open, sink protocol-proven: STARTTLS → Maildir, unknown-RCPT 550). **Founder one-liners pending: (1) OCI ingress TCP/25, (2) `agents.skaists.buzz MX 10 skaists.buzz`.** Sink: `scripts/buzz-mail/sink.py` (receive-only, no send half), unit `buzz-mail-sink` capped 20%/128M, KNOWN = the seven provisioned mailboxes above.

## END-TO-END MAIL: LIVE (2026-08-29, both founder gestures landed)
**Port 25 OPEN** (OCI ingress rule landed — verified from 2 independent external nodes: Japan 110ms, Slovenia 155ms). **MX LIVE** (`agents.skaists.buzz → 10 skaists.buzz`, verified via 8.8.8.8). **Test mail PROVEN end-to-end:** real SMTP from WSL → DNS MX → TCP/25 → Maildir — headers land verbatim in `/var/mail-agents/claude-code/new/`. One gap noted: STARTTLS not advertised by the sink yet (aiosmtpd config; plaintext works, Coinbase's mail provider will use opportunistic delivery).

## WALLET CEREMONY: BLOCKED IN THIS SEAT'S BROWSER (honest finding)
The Coinbase smart-wallet creation flow is **popup-based at every entry point** (wallet.coinbase.com "Create a wallet" → popup; base.app "Continue on Web" → popup to keys.coinbase.com). The in-app browser blocks popups by policy — the flow cannot start. The buttons render in the DOM but are not interactable (React portals + popup interception). **Every other piece is ready:** mailboxes live, mail flowing end-to-end, the recipe documented, the $1/24h Spend Permission law verified against Coinbase's own docs. **The ceremonies need a browser with popup support** — the founder's desktop browser (one gesture per agent) or a headless CDP session with popup permissions. This is the real blocker, not a grind point.

## ★ bzCode's FIRST CEREMONY COMPLETE — the split-ceremony law (2026-08-29)
**bzcode.base.eth is claimed and on-chain-verified.** The proven division of labor, now the recipe for every remaining row:
- **Script does:** base.org/name → search → claim modal → Connect wallet → Coinbase Wallet → popup gateway (extension-wait → back → "Sign in with Base") → email fill → email-OTP read on-box (maildir) → then the BACK HALF after auth: Register/Confirm clicks on the claim modal.
- **Founder does:** the Google Authenticator 6-digit code (30-second windows cannot ride a chat round-trip; his hands are the oracle). *Setup-time only — one 2FA window per wallet birth, never a runtime gate; the TOTP vault above exists so future sessions may not even need this.*
- **TOTP vault:** `/etc/buzz-ceremonies/bzcode.totp` (600 root) + `/opt/buzz-ceremonies/totp.py` code oracle exist on the box for future sessions — the claim itself was completed split-style before oracle-driven entry could be proven end-to-end.
- **On-chain receipt:** registrar `0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a` (PUBLIC-CONSTANT), tokenId `keccak256("bzcode") = 0x446f30a5164fdb26117361af0d8daa457532b93c092b7a838d9ebcd0b1af9879` (PUBLIC-CONSTANT), ownerOf = the wallet. 1-year term per founder ruling ("its just 1 year buddy"), 0.001 ETH.
- **Operational scars, now law:** (1) ghost ceremony processes from earlier iterations kept fighting the live one — kill-by-pattern `*claim*`/`*ceremony*`, verify zero, before every launch; (2) a stale OTP mail read straight from the maildir was one session too old and burned a try — the marker must be taken at submit instant, and "Resend" is the recovery; (3) the wallet-connect picker matches "WalletConnect" on any "Connect" substring — exclude it explicitly; (4) the SDK popup flips to an extension-wait state on its own — goBack() recovers the sign-in path.
