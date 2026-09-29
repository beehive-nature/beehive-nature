# bMaiL RAID — RULE-vs-SERVER SORT — 2026-09-20

Reading half of the bMaiL raid (bFaBLe5.1, wide seat). Cut by the bee-laborer in
SKAISTS CORE SPRINT 001, event `cb817424`, 2026-09-20 21:04Z. Nothing was built; every
row below names a fact at a pinned commit or a fetched page, or is marked UNVERIFIED.

**The question this raid answers.** One inbox, addressed by a wallet address / `.a` /
`.b` name, in which **humans and agents** send mail, messages **and payments** — on the
estate's own rails. Six outside targets were read for the shape; the estate's own pieces
were mapped for what already connects and what is missing.

**Sort rule** (verbatim from `X402-SORT-2026-09-01.md`, reused, not re-derived): RULE =
runs with no seller-operated box (pure library, on-chain contract or ledger record,
client-side logic, static data/schema, protocol text, CLI that only talks to a public
chain). SERVER = needs an operator-run process/host (API server, facilitator, DB, cron,
hosted web, relayer). "Client-side, user-run" processes count as RULE — the seller's
disappearance does not take them down. The founder's own question — *what happens the day
the hosting stops* — is the SERVER column read aloud.

**Assertion language.** "Page P states X" / "file F:line asserts X". Vendor pages are
tier-4 sources (VERIFIED-FACTS hierarchy); code and protocol text at a pinned HEAD are
tier 1–2. Where a vendor page and code disagree, the code line is cited and the page is
noted as lagging.

## 0 · Pins (read 2026-09-20, 21:10–21:40Z)

| target | repo / page | HEAD read | licence receipt |
|---|---|---|---|
| Blockscan Chat | `chat.blockscan.com` (service, closed) + `blockscan/blockscanchat-sdk` | `376398c5` (`main`, 2023-10-26) | SDK MIT — A90 |
| XMTP | `xmtp/xmtpd`, `xmtp/libxmtp`, `xmtp/xmtp-js`, `docs.xmtp.org`, `xmtp.org/decentralization`, XIP-54 / XIP-57 / XIP-69 | `822ddc95` · `cc878025` · `8993ef24` | MIT — A91 |
| Mailchain | `mailchain.com` + `mailchain/mailchain-sdk-js` | `1787a34d` (`main`, 2023-12-15) | Apache-2.0 — A93 |
| Push Chat | `comms.push.org/docs/chat/` + `pushchain/push-notifications-sdk` (cloned as `push-protocol/push-sdk`; GitHub redirects the renamed org) | `bdcdb994` (`main`, 2025-05-29) | BSL-1.1 text / `MIT` field — A94 |
| Nostr | `nostr-protocol/nips` — NIP-05, NIP-17, NIP-44, NIP-57, NIP-59, NIP-61 | `46f8e950` (`master`, 2026-09-20) | public domain — A95 |
| BIP-353 | `bitcoin/bips` `bip-0353.mediawiki` | `e71448c8` (`master`, 2026-09-18) | CC0-1.0 — A96 |
| the estate | `beehive-nature` `origin/main` | `420c05f3` (2026-09-20, merge of #161) | — |

Licence hashes live only in `docs/VERIFIED-FACTS.md` rows A90–A96 (one hash per line,
`PUBLIC-CONSTANT`-marked); this file cites the row numbers.

---

## 1 · Blockscan Chat (Etherscan) — address = identity, hosted server, closed source

| component | RULE or SERVER | what it does | what breaks the day the hosting stops |
|---|---|---|---|
| `chat.blockscan.com` web app | SERVER (closed) | "Made by the Etherscan Team"; sign-in "via MetaMask, Wallet Connect, Coinbase or Phantom" (FAQ); identity = wallet address / ENS | Everything. Terms §1: "We make no guarantees as to the continuous availability of the Service or of any specific feature(s)" |
| `chatapi.blockscan.com/v1/api` | SERVER | API-key access for bots/apps; SDK default `src/index.js:44` `this._apiUrl = "https://chatapi.blockscan.com/v1/api"` | Every SDK call fails; the SDK is a thin HTTP client with no other transport |
| `blockscan/blockscanchat-sdk` | RULE (thin client, MIT — A90) | `getMessages`, `sendMessage` wrappers over the API | Useless alone — nothing to talk to |
| message storage | SERVER, undisclosed | Terms §8: undelivered messages are stored on servers "for up to 5 days"; FAQ: after termination "Blockscan Chat will retain your data for approximately 14 days … After the 14 days period, your data shall be irretrievably deleted from our systems" | The inbox is gone with the box; there is no export path named on either page |
| encryption | UNVERIFIED mechanism | Site: "All messages are encrypted once both addresses have signed in to Blockscan Chat, **with the exception of addresses that hold an API key and Safe multisig addresses**"; Terms §6 claims "End-to-end encryption (E2EE) for all messages" but "is explicitly exempted for messages exchanged between the user account and any bots" | How keys are derived or where they are held is stated nowhere read; recorded as UNVERIFIED, not assumed |
| content licence | — | Terms §8: the user grants "a worldwide, non-exclusive, royalty-free, sub-licensable and transferable license to use, reproduce, distribute, create derivative works of, display and perform the information" | The operator holds a licence to the mail |
| cost | — | "There is no cost! Messages are sent and received for free as they are done off-chain" | Free because hosted; hosted because free |

**Verdict: LEAVE the service. TAKE two patterns, one as a rule and one as a warning.**
The rule: *sign in with the key you already hold* — a wallet signature is the whole account,
no email, no password, no OTP. The warning: **the API-key exemption**. The moment an
*agent* reads the inbox through an operator API key, E2E is switched off for that
address. An estate inbox in which agents are first-class must give the agent its **own**
key (the estate already does: every seat has a bzDiD-derived wallet and a mailbox on the
box), never an operator key that silently downgrades the mailbox.

## 2 · XMTP — open protocol, curated network, paid retention

| component | RULE or SERVER | what it does | what breaks the day the hosting stops |
|---|---|---|---|
| `xmtp/libxmtp` (Rust core), `xmtp/xmtp-js` SDKs | RULE (MIT — A91) | MLS ("Messaging Layer Security") client: identity = "an inbox ID and its associated identities and installations", authenticated by "verifiable cryptographic signatures" (`docs.xmtp.org/protocol/overview`) | Library keeps working; nothing to publish to |
| `xmtp/xmtpd` node software | RULE as code (MIT — A91), SERVER as run | Go daemon + Postgres; README at `822ddc95`: "`xmtpd` … is an experimental version of XMTP node software. It is **not** the node software that currently forms the XMTP network" | An outsider can run the binary, but cannot join the network without admission (next row) |
| node operator set | SERVER (curated) | FAQ (`docs.xmtp.org/chat-apps/intro/faq`): "Messages are stored off-chain on the XMTP network, with all nodes currently hosted by XMTP Labs." Decentralization page: XMTP Labs is "currently in the process of vetting and selecting a total of 7 permissioned nodes"; Security Council "initially composed of XMTP Labs leadership"; "No more than 3 node operators can be headquartered in the same legal jurisdiction". XIP-54 (Living): "The committee is currently administered by Ephemera, the company stewarding the development and adoption of XMTP"; "XMTP Mainnet will begin with a limit of 7 node operators". Run-a-node page: apply through a Google form | If the steward stops, the operator set has no admission path; 7 boxes vetted by one company are the network. Phase 3 "open participation … no approval required" is a plan, not a shipped state — UNVERIFIED as live |
| message retention | SERVER (paid parameter) | Decentralization page: "All messages expire from the network after a default 60-day retention period." XIP-69 (Living): "the system can safely delete chat messages after 30 days. However, this retention period is not rigid"; "The responsibility for message storage duration lies with the payer, who can extend or reduce this period"; cap 365 days, floor 24 h; "When a group chat message is deleted before a user has had a chance to read it, that message becomes permanently inaccessible to that user" | The inbox on the network is a cache with a fuse; the durable copy is whatever the client persisted. (The two pages disagree on 30 vs 60 days; both are vendor text — recorded as-is) |
| fees / payer | SERVER + on-chain | XIP-57 (Final): "The Payer Registry smart contract is the canonical source for the confirmed balances of each user of the network (typically applications paying on behalf of many users)"; balances "in USDC"; fee = per-message + "per-byte-day of storage" + congestion. Decentralization page: "approximately $5 per 100,000 messages"; settlement on an "L3 appchain that settles to Base" | The app, not the reader, pays the relay. When the payer wallet is dry the originator rejects the message (XIP-57 balance rule) |

**Verdict: LEAVE the network (same dependency class as Blockscan, longer fuse, one
steward). TAKE three shapes.** (1) *One inbox, many installations* — the inbox ID is the
address, each device is an installation with its own key, revocable; the estate's
`.a`/`.b` name plays the inbox-ID role and the browser `bzdid-key` is an installation.
(2) *The sender's side pays for storage per byte-day* — retention is a priced parameter,
not a promise; the estate already has the meter (`crates/bmesh-meter`, `scripts/buzz-meter`)
to price exactly that. (3) *Expiry is explicit* — a relay copy has a fuse; the owner's
copy is the record. Security language for anything lifted: "isolated by design", never
stronger.

## 3 · Mailchain — the live specimen of "the day the hosting stops"

| component | RULE or SERVER | what it does | what broke on the day |
|---|---|---|---|
| `mailchain/mailchain-sdk-js` | RULE as code (Apache-2.0 — A93) | Address = `0x…@ethereum.mailchain.com`, `alice.eth@ens.mailchain.com` (`packages/addressing/src/nameServiceAddress.ts:4-5`); E2E encryption to keys derived from the wallet; `README.md:15` "Try sending your first message … `0xbb56…@ethereum.mailchain.com`" | Library still compiles. Every mailbox operation is an HTTP call to one host |
| `packages/internal/src/configuration.ts:8` | SERVER (hard-wired) | `apiPath: 'https://api.mailchain.com'` — consumed by `identityKeys.ts:21`, `mailbox/mailboxOperations.ts:143`, `mailbox/payloadStorage/mailchainPayloadStorage.ts:18`, `messageSync/previousMessageSync.ts:35`: identity keys, mailbox, payload storage and sync all go through the company's API | All four paths dead |
| the service | SERVER — **GONE** | `mailchain.com`, fetched 2026-09-20: "The Mailchain service was permanently discontinued on 5 May 2026." "All user data has been permanently deleted following a prior notice period provided to account holders." | The inboxes — ciphertext included — were deleted with the company's storage. E2E did not save one message |

**Verdict: LEAVE. PATTERN only, and the pattern is the negative one.** The addressing
shape (`name@protocol.domain`) is the estate's own shape (`bfable@agents.skaists.buzz`,
`bfable.a`) — but Mailchain owned the domain, the API and the storage, so the address
died with the company. The rule the estate keeps: **the inbox's bytes live where the
owner holds them** — today the Maildir on the estate's own box (`scripts/buzz-mail/sink.py`
`MAILROOT = Path("/var/mail-agents")`, root-owned 0600), tomorrow member-held storage —
never only on a relay. Encryption is not custody.

## 4 · Push Chat — key escrow on the network, product pivoted away

| component | RULE or SERVER | what it does | what breaks the day the hosting stops |
|---|---|---|---|
| `pushchain/push-notifications-sdk` (was `push-protocol/push-sdk`) | RULE as code — licence CONTRADICTED (A94) | `license-v1.md` is Business Source License 1.1, "Licensor: Push Org", "Change Date: 2023-11-11", "Change License: GNU General Public License v2.0 or later" — the change date has passed, so the BSL text itself now grants GPL-2.0-or-later; the root `package.json:4` says `"license": "MIT"`. Two licence signals in one repo; **no lift under either until the maintainer states which** | Last push 2025-06-04 (15 months at read time); org renamed to `pushchain` |
| PGP keys | SERVER (escrow) | `comms.push.org/docs/chat/concepts/encryption-version-in-push-chat/`: each profile "has a PGP key that is created locally"; the private key is encrypted with a key derived from "a random nonce, salt, and an EIP-712-based signature" (V2) / EIP-191 (V3); the encrypted keys are "stored encrypted on Push nodes" | A new device recovers the key with one wallet signature — as long as the nodes still serve the blob |
| messages | SERVER | `comms.push.org/docs/chat/`: messages are "signed and validated by a set of nodes, which are together called Push Network" and are "secure, encrypted, stored on IPFS" | IPFS pins are the operator's; the validating nodes are the operator's |
| comms node software | UNVERIFIED | Scoped negative: of the 26 public repos under `pushchain` on 2026-09-20, none is a Push *comms* node (`push-chain-node` is the new L1 validator; `push-comms-website` is a site). Who runs the chat nodes cannot be read from code | — |
| the company | — | Active repos in Sept 2026 are all `push-chain-*` (new L1); the chat SDK is stale. A product the maintainer has walked away from is a Mailchain with a longer notice period | — |

**Verdict: LEAVE. PATTERN: portable inbox key by escrow — the estate does NOT need it.**
The estate's keys derive from the soul (WebAuthn PRF → `bzdid-key`, `docs/agents/WALLET-LEDGER.md`
recipe step 2: "keys derive from the soul (WebAuthn PRF)"), so a new device re-derives
instead of downloading; no escrow blob, no node to lose it.

## 5 · Nostr NIP-17 / NIP-05 / NIP-57 / NIP-61 — the estate's own message rail, read as protocol text

All NIPs are public domain (`nips/README.md:359`, A95). Read at `46f8e950`.

| NIP | RULE or SERVER | the rule, as written | what breaks the day a relay stops |
|---|---|---|---|
| NIP-17 Private Direct Messages (`17.md`) | RULE (protocol) + relay | `:11` "`kind 14` direct messages, `kind 15` file messages … may be sent to an encrypted chat"; `:23` "the **unsigned** chat messages must be sealed (`kind:13`) and then gift-wrapped (`kind:1059`) to each receiver and the sender individually"; `:63` "Kind `10050` indicates the user's preferred relays to receive DMs"; `:77` "Clients MUST only publish events to the relays listed in the recipient's kind 10050 event. If such a list is not found that indicates the user is not ready to receive messages"; `:103` "Messages can flow through public relays without loss of privacy" | Nothing in the protocol; the recipient's `10050` list names 1–3 inbox relays and any relay will do. `:110` warns the wrapper keys defeat pubkey-reputation anti-spam — a naive inbox "is an spam target" |
| NIP-05 (`05.md`) | RULE (a static file on a domain the owner controls) | `:11` client splits `name@domain` and GETs `https://<domain>/.well-known/nostr.json?name=<local-part>`; `:53` the reply may carry `"relays"` per pubkey | The domain's owner serves one JSON file; if the estate's domain dies, so does every estate name — same class as DNS itself |
| NIP-57 Lightning Zaps (`57.md`) | SERVER on the recipient side | `:9` `9734` zap request / `9735` zap receipt; `:29` the request "is _not_ published to relays, but is instead sent to a recipient's lnurl pay `callback` url. This event's `content` MAY be an optional message to send along with the payment"; `:22` the recipient's LNURL server "MUST generate a `zap receipt` … and publish it to the `relays`" | The recipient must run (or rent) an LNURL server; no server, no zap. Payment-with-message, but the message rides a box |
| NIP-61 Nutzaps (`61.md`) | RULE on the recipient side; SERVER = the mint | `:9` "A Nutzap is a P2PK Cashu token in which the payment itself is the receipt"; `:15-17` sender reads the recipient's `kind:10019` (mints + P2PK pubkey), mints a locked token, "publishes a `kind:9321` event to the relays Bob indicated with the proofs"; `:39` "Clients SHOULD not send money on mints not listed here or risk burning their money" | The recipient needs no server: the payment IS an inbox event. The mint is the custodian — the SERVER class moves from the recipient's box to a third party's |

**Verdict: TAKE — this is the rail the estate already runs.** NIP-17 is the message
envelope (the Buzz relay carries kind 14 today or does not — see §7). NIP-05 is the
`name → key` door the estate can serve from its own domain for `.b`/`.a` names. NIP-61's
*shape* — "the payment itself is the receipt", delivered as an event to the recipient's
relays, no recipient server — is the correct inbox shape for payments, but the estate's
payment rail is Vaulta, not Cashu: **a Vaulta transfer with a memo is already that shape**
(§7, `surfaces/vending.html:727`). Nothing is lifted from Cashu; the mint custody class is
exactly what the estate's own-chain rail avoids.

## 6 · BIP-353 DNS Payment Instructions — pattern check only

`bip-0353.mediawiki` at `e71448c8`: "Status: Complete", "License: CC0-1.0" (A96); abstract:
"a standard format for encoding BIP 21 URI schemes in DNS TXT records" — `user@domain`
resolves through DNSSEC to payment instructions the domain owner published.

**Verdict: TAKE nothing; the pattern confirms the estate's design.** The estate's
registry already stores per-name cross-chain addresses on-chain
(`docs/specs/SPEC-A-NAMES-1.md` §RESOLUTION: query `kingbeelovis/domains`, read `owner`,
read `chainaddrs` scoped to `domain_id`), so the payment-instruction record is a
contract row, not a DNS record, and needs no DNSSEC. The one thing BIP-353 does that the
registry does not is *human-readable in every wallet* — that is a client-adoption fact,
not a mechanism.

---

## 7 · THE ESTATE'S OWN PIECES — what already connects, read at `420c05f3`

Every row: the piece, the identity it keys on, where its bytes live, and the ONE line where a
message or payment enters or leaves it. Branch-only facts are prefixed with the branch.

| piece | keys on | bytes live | RULE or SERVER | the one line |
|---|---|---|---|---|
| **bMAIL sink** `scripts/buzz-mail/sink.py` | email local-part `@agents.skaists.buzz` — `:19` `DOMAIN = "agents.skaists.buzz"`, `:21` `KNOWN = {…("claude-code", "bzcode", "bclaude", "bfuzz", "honeybee", "bqueenbee")}` (a hard-coded set, the single source of address truth) | `:20` `MAILROOT = Path("/var/mail-agents")`, `:12` "Inboxes never leave the box (the fence)" | SERVER (the estate's own box, `buzz-mail-sink` unit) | IN: `:50` `return "250 Message accepted for delivery"`. OUT: none — `:9-10` "THERE IS NO SEND HALF — no relay, no outbound, no submission port; the process could not send mail if it wanted to." Door: `:27-28` unknown RCPT → `550 no such agent here`. Live defect `:29` `if not envelope.rcpt_tos:` records only the FIRST recipient of a multi-RCPT mail (fixed only on the candidate branch) |
| **bMAIL send half** | — | the box, not this repo: `docs/dispatches/MAILROOM_DESK_2026-08-29.md:2` "the send half is now BUILT on the box (postfix 3.8.6 queue + opendkim 2.11.0 signing, verified) and gated by exactly one measured fact: OCI blocks outbound :25" | SERVER, blocked by the cloud provider | none versioned here; the door is the founder's (`§1:8` of that dispatch), named not raised |
| **bMAIL reader + Buzz doorbell** (unmerged) `origin/zcode/bmailroom-candidate-02`, 3 commits, 26 files, +3387 | `(mailbox, sha256)` per row; `roster.json:3` "A binding is only usable for notification when its status is a cited 'verified:<receipt>' AND an npub is present" | sqlite on the box (digests + status, "raw bytes never enter the db") | SERVER (box) | `mailgate.py:2` "the bMAILroom single mailbox reader (candidate)"; `notify.py:15` "the candidate ships the seam EXPLICITLY DISABLED: no service key is provisioned"; `notify.py:23-24` "OPACITY — the notification payload is a fixed whitelist of fields (version, type, mailbox, sha256 …)" — a doorbell, never content; `notify-transport.mjs:45` `NATIVE_KIND = 9`, `:179` `tags: [["h", channel.id], ["p", recipientHex]]`, `:6-8` native Buzz kind 9 is "PLAINTEXT content — there is no NIP-44 step"; `outbound.py:110-113` `send_draft` **raises** `OutboundDisabled`; `roster.json:5-10` all six `"npub": null, "binding": "unverified"` |
| **bMAIL on the profile** (unmerged) `origin/zcode/bmailroom-profile-01` tip `b6e2ec81` | mail address + raw hex Buzz pubkey side by side | — | — | `surfaces/profile.html:444` `href="buzz://message?channel=79212683-…"` "Open bMAILroom in Buzz" — the only "open my inbox" door in the estate, and it deep-links to a **public** room (`:447` "This is a public coordination room. Keep email contents, codes and private keys out of it."); `:463` "Email identity binding not verified"; `:483` "A Buzz identity is not proof of a registered .a name." On main today: `surfaces/profile.html:700` "✉ (no mailbox yet — claim a name to get one)" — the promise is written, nothing implements it |
| **bDISPATCH** `tools/bdispatch/watcher.py` — the one working addressed-message path | seat name → pubkey via `docs/dispatches/SEAT-PUBKEYS.md` | git file as outbox, receipt written back into the file | SERVER (box, one shared estate key `:27` `/opt/buzz-bclaude/bclaude.nsec`) | `:2-8` "publishes the file body as a NIP-17 private DM to each addressee's pubkey signed by bclaude, then appends `RELAYED <utc-iso> <event-id>`"; OUT: `:89` `out = await client.send_private_msg(pk, msg, [])`; `:94` `RELAYED {stamp} {eid} to={seat}`; `:121` "relay down: hold, retry next tick, never mark RELAYED". Roster: `SEAT-PUBKEYS.md:8-14` **six of seven rows MISSING**, only `goose` (bFUzZ) resolves |
| **bPaY / wallet** `surfaces/wallet.html` | bzDiD (`:196` "your bzDiD is the wallet"); Vaulta account name on the A rail (`:2435` "your account name receives A directly — memo optional") | browser; chain | RULE (client) | **OUT — the payment that is already a message:** `:629` `<input id="sv-memo" placeholder="memo (optional)">` → `:4408` `memo=$('sv-memo').value` → `:4421-4422` `serializeAction(…,'eosio.token','transfer',…,{from:SOUL,to:to,quantity:q,memo:memo||''}`. Memo as routing key is already estate law: `:781` "memo-native binding on the A rail (memo = meter key, no binding table)", `:805-806` "the memo IS the binding — no memo, no credit, money lost". The browser can already mint an npub from the soul (`:1755` `npubFromSeed`) and already publishes a signed kind-30078 event to relays (`:2848`) — on third-party relays (`:2912` damus / nos.lol / snort), not `skaists.buzz` |
| **bPaY invoice** `surfaces/bpay-invoice.js` | artifact sha, audience | browser + local bridge `:23` `BRIDGE_DEFAULT = 'http://127.0.0.1:8807'` | RULE (user-run) | `:12-13` "nothing can spend; there is NO authorization route on this panel"; `:71` `'Selected people', false, … 'Sharing with people you pick is not ready.' … 'recipient capability/key granting not yet qualified'` — **send-to-a-person is a disabled button with its reason written**. `docs/agents/BPAY-ECONOMIC-LIFECYCLE.md:16-29` QUOTE → PRICING COMMITMENT → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION: no stage delivers to a recipient |
| **MY SPACE** `surfaces/myspace.js` + `myspace-adapter-blossom.js` | a bare browser-local secp key (`myspace.js:37` `SK_KEY = 'myspace.device-secret.v1'`, `:68`), deliberately NOT the bzDiD (`:59-61` "a stranger who just wants to keep a file should not be marched through" a ceremony) | private = encrypted in this browser (`:20-21`); public = estate Blossom rail (`myspace.html:177`; `blossom.js:34` `RELAY = 'https://skaists.buzz'`) | RULE (client) + estate blob store | OUT: `blossom.js:350-355` `fetch(RELAY + '/upload', {method:'PUT', headers:{Authorization: authHeader(rec.ev, sig), 'x-sha-256': rec.sha}` under a kind:24242 **authorization** event (`:236`) — a signed capability to PUT a blob, not a message. The seam law `:16-19` "begin* → the adapter builds the unsigned request and returns a DIGEST / (shell) → the device key signs that digest, in the page, never here" is the pattern any inbox write must reuse (`adapter-seam.js:13` names the wallet's inline shell as the original) |
| **`.a` / `.b` registry** | a suffixless string in `kingbeelovis/domains` on Vaulta | chain (mainnet), read keyless from public RPC | RULE (on-chain) — "operator-trusted, not trustless" (`surfaces/bnames.html:102`) | RESOLVE: `surfaces/profile.html:1031` `get_table_rows {code:'kingbeelovis', scope:'kingbeelovis', table:'domains', limit:500}`; `:1041` `var rail=/\.a$/i.test(asTyped)?'a':'b'` — the suffix is display only; `:1052-1053` a held name yields `owner` · `resolves → account` · expires — **no npub, no mailbox, no address**. Algorithm `docs/specs/SPEC-A-NAMES-1.md:24-28` steps 1-4; step 3 `chainaddrs` is the extension point and is **empty today** (`surfaces/blight/vaulta-reader.html:97` "chainaddrs at the registry scope is legitimately empty"; `workbench.html:331` "registered + current, but no EVM address row in chainaddrs"). `SPEC-A-NAMES-1.md:69` the `requires_memo` field on `chainaddrs` already anticipates memo-addressed deposits. MINT: `surfaces/bnames.html:312` hands `kingbeelovis:registeracc` to the wallet to sign; the `.a` vending mint is **testnet only** (`surfaces/vending.html:370-371` jungle4 · `bnrapolltest`), and its rehearsal payment already carries a name in the memo (`:727` memo `vending:<name>`). Open: `SPEC-A-NAMES-1.md:68` "how do clients distinguish `.b` from `.a` rows?" |
| **browser `bzdid-key`** `surfaces/onboarding/bzdid-key.js` | passkey PRF → master key → Ed25519 / secp256k1 | the device | RULE | consumers: `onboarding/index.html:376`, `review.html:562` (`:641` signs human text with the key — the nearest thing to composing a signed message), `recover.html:5`; a device-to-device identity handoff message type already exists (`onboarding/receive.html:1668` `'bnr-bzdid-handoff'`). Architecture: `docs/bzdid-architecture-decision.md:61` "a native Vaulta account is ~2,996 B of chain RAM … Free-tier users get **no native Vaulta account**" — an inbox keyed on a Vaulta account excludes the free tier by arithmetic; `:85` "3.3 Writing an address record" and `:97` "3.4 What a wallet does at send time — `alice.b → address`" are **decision text, not code** — the live registry is the flat `domains` table |
| **Buzz / Nostr relay** | npub; NIP-42 AUTH; NIP-29 rooms | the relay (`wss://skaists.buzz` / `relay.skaists.dev`) | SERVER (estate-run) | the live wire: `docs/dispatches/2026-09-04-buzz-join-by-address.md:33-34` "the NIP-29 wire (kind 9, `#h` = channel UUID): history, live subscription, composer"; `:13-15` join-by-address "paste `wss://relay.skaists.dev` → … the key is made on the phone → the room opens". Architecture: `docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:8-10` "The relay is the single source of truth … no peer-to-peer event exchange, no gossip, no replication". Plan: `dockets/DOCKET_BUZZ_SOVEREIGN_RELAY_1.md:4` "drafted (not built)"; `:12` "Buzz relay = hot signed-event log → Arweave = permanent mirror → Autonomi = the heavy/private content"; `:19` "Arweave — cold, permanent, append-only"; `:31` route budget includes "NIP-11/NIP-05 metadata". **Negative:** `crates/wallet-relay/src/buzz.rs:1` is "Buzz mesh heartbeat — minimal b-metered presence", one route `:7` `GET /v1/mesh/heartbeat` — not a message rail. Public-relay ACL fact: `tools/ln-rail/README.md:12` NWC "kind 4" publishes refused by getalby relays; the estate's own relays are invite-gated for writes |
| **NIP-05 door** | `name@domain` | — | RULE (a static file) | drawn, not served: `surfaces/keys/addresses.html:61` shows `name@beehive.nature`, `:104` is string concatenation in the browser; the only real mapping file `docs/dispatches/nip05-bclaude.json:1` says "serve verbatim at https://skaists.dev/.well-known/nostr.json" and is parked in `docs/dispatches/`; `find . -name nostr.json` and `-name .well-known` at `420c05f3` (node_modules pruned) → **0 and 0** |
| **x402 door / b-meter** | agent name + a ceiling signed once (`RECEIPT_VENDING_X402_METER_2026-09-04.md:8` "agent vendingtest2, rail vaulta @ basis 0.6000 A + tithe 1000 bp, ceiling 5.0000 A") | box | SERVER (box, loopback) + RULE (auditor) | `ops/x402-door/src/main.rs:2-4` "bind loopback (Caddy fronts the same-origin door on the box; this binary never binds a public interface)", `:6-7` "There is deliberately no production path in this binary"; `surfaces/x402-meter.js:1` "THE METER-SESSION AUDITOR, in your page" — the browser recomputes, it does not open a door; `crates/bmesh-meter/src/lib.rs:4-5` "A pure library: no I/O, no chain access … every parameter is injected" — the priced-retention engine XMTP charges for already exists here as a callee |
| **the DM payload law** | — | — | RULE | `surfaces/kandi.html:733-734` "the DM payload law: a message is a POINTER, never content. PTR is loaded from blight/pointers.js so every surface keeps one grammar"; `:164` "No DM transport, no relay, no inbox, no video: open, not built, and said plainly." — the estate has already said four times that it has no inbox, and already fixed what a message may carry |

**The three privacy laws the inbox must sit inside** (`docs/RULINGS-2026-09-16.md`):
`:26-29` R1.1 "no permanent mapping between a human identity and any wallet or stored object
may appear in public settlement data or public receipts"; `:30-34` R1.2 agents "MAY hold
public chain accounts … Nothing may make such a public mapping a REQUIRED payment mechanism";
`:39` "(1) is never relaxed to resolve a conflict with (2)"; `:63-66` R4 "a wallet-local
plan/intent identifier is never published to a provider, rail, or public receipt as-is".
`docs/SPEC-SPEND-RECEIPT-1.md:110` "A new bzDiD starts `private`." And the mailroom's own:
`sink.py:12` "Inboxes never leave the box (the fence)". Against them, the relay docket's
`:19` Arweave "permanent, append-only" mirror: **an inbox on the planned Buzz rail is
permanent by architecture; an inbox in the Maildir is box-local by law. No text in the
tree reconciles the two — that reconciliation is slice S0 below, and it is a spec line,
not code.** (Scoped negative: `grep -rn "never on public\|public permanent\|permanent rail"
docs/RULINGS-*.md docs/CONSTITUTION.md` → nothing; the governing text is R1/R4 above.)

## 8 · WHAT IS MISSING — the slices, named, none built

Read left to right: the fact that proves the gap, then the slice. Owners follow the standing
lanes: the mailroom is ZcODe5.3max's (founder-delegated); wallet/bPay is bOPus5's after
MY SPACE; surfaces per the GUX lane; every slice is bFUzZ-proven. Sequence: **all behind
MY SPACE**; S0 first because every other slice reads it.

| # | the gap (fact) | the slice (one sentence, no design) | owner |
|---|---|---|---|
| S0 | R1.1 + `sink.py:12` vs docket `:19` (above): no text says which rail an inbox event may touch | **INBOX-PRIVACY-1 spec line**: an inbox event is a *pointer* (kandi `:733-734` law) whose content lives box-local or member-held; only the pointer may ride the relay; nothing addressed to a human is ever mirrored to Arweave. One paragraph in `docs/specs/`, ratified like R1 | bee-laborer cuts, Fable drafts (spec text is long-context work), bFUzZ proves the paragraph against R1/R4 |
| S1 | `roster.json:5-10` six null bindings; `SEAT-PUBKEYS.md:8-14` 6/7 MISSING; `profile-01:483` "A Buzz identity is not proof of a registered .a name" | **NAME→KEY BINDING**: one signed receipt per seat that joins mailbox local-part ↔ npub ↔ `.a` string, produced by the seat's own key (the bdispatch shape: file in git, `RELAYED` line back). Fills the roster the candidate branch already validates | ZcODe (mailroom), each seat signs its own row |
| S2 | `find -name nostr.json` → 0; `nip05-bclaude.json:1` parked; `addresses.html:104` fakes it | **NIP-05 served**: `/.well-known/nostr.json` generated from the S1 receipts, served from the estate domain, one row per verified binding. Static file, no server logic; the docket's `:31` route budget already lists NIP-05 | ZcODe (box), gate = fetch the file and match S1 |
| S3 | `sink.py:29` first-recipient-only defect; `mailgate.py:2` reader unmerged; `notify.py:15` seam disabled | **CANDIDATE-02 lands**: the multi-RCPT fix + the single reader + the opaque doorbell, as already built and Astra-reviewed on `origin/zcode/bmailroom-candidate-02`. The raid adds nothing to it; it names it as the first mail slice because every later slice reads Maildirs through it | ZcODe; PROVE already routed (Astra/bFUzZ); deploy = box cutover per `mailgate.py:10` |
| S4 | `profile.html:1052-1053` resolves to owner/account only; `vaulta-reader.html:97` `chainaddrs` empty; `SPEC-A-NAMES-1.md:69` `requires_memo` exists unused | **ADDRESS RECORD ROW**: one `chainaddrs` row per `.a` seat carrying the inbox pointer (npub or mailbox) so `alice.a → where to write` resolves from the chain, keyless, exactly as `SPEC-A-NAMES-1.md:24-28` step 3 says. Agents only (R1.2); humans never (R1.1) | bOPus5 (wallet compose path `bnames.html:312` already signs `kingbeelovis:*` actions) — after MY SPACE |
| S5 | `wallet.html:4422` memo transfer exists; `bpay-invoice.js:71` "Selected people … not ready"; lifecycle `:16-29` has no delivery stage | **PAY-TO-NAME**: the send form takes a `.b`/`.a` name, resolves it (S4), and the memo is the message — reuse `:4408-4422` unchanged, add resolution in front. A payment that is also a message, on the estate's own rail, no server (the NIP-61 shape without a mint) | bOPus5 — after MY SPACE |
| S6 | `wallet.html:2848` publishes signed events only to third-party relays (`:2912`); NIP-17 sender exists only box-side (`watcher.py:89`) | **BROWSER INBOX WRITE**: the wallet publishes a NIP-17 gift-wrap (kind 1059) to the recipient's inbox relay list, signed in-page under the adapter seam law (`blossom.js:16-19`), first target `wss://skaists.buzz`. Content = pointer only (S0). No new key: `npubFromSeed` `:1755` | bOPus5 / GUX — after S0, S1 |
| S7 | `sink.py:9-10` no send half; `outbound.py:110-113` raises; `MAILROOM_DESK:2` OCI blocks :25 | **OUTBOUND MAIL** — named, not raised: it is the founder's door (his tenancy or his smarthost money, `MAILROOM_DESK_2026-08-29.md §1`). The raid records that no code slice unblocks it | founder, when he chooses; nobody @-mentions him for it |
| S8 | no surface reads an inbox (`grep -rliE inbox surfaces/*.html` → only `kandi.html`, which refuses one) | **THE INBOX PAGE**: one surface, three registers, that lists a name's inbox events (mail doorbells from S3, pointer DMs from S6, memo payments from S5) — every row a pointer, content opened on the owner's device. Built last; it renders what S1–S6 produce | GUX lane (ZcODe writes, BgrOKbot eye, bFUzZ proves) |

**What the raid does NOT propose:** no second registry, no second relay, no third mailroom
reader, no XMTP/Push/Blockscan dependency, no Cashu mint, no DNS record scheme, no new
identity scheme (the estate already has five: bzDiD, Vaulta account, mailbox local-part,
npub, MY SPACE device key — S1 joins three of them with receipts; it does not add a sixth).

## 9 · RULES → estate seats

Mechanisms travel, files do not. Seat key as in X402-SORT: **z3.1** = bSigner / wallet ·
**z3.2** = surfaces · **z3.3** = meter · **mailroom** = ZcODe5.3max · **spec** = bee-laborer.

| RULE row (source) | lands in | the rule, one line |
|---|---|---|
| Blockscan FAQ: E2E "with the exception of addresses that hold an API key" | mailroom, z3.1 | An agent reads its inbox with its **own** key, never an operator API key; any path that needs an operator key is not an inbox, it is a log |
| Blockscan sign-in "via MetaMask, Wallet Connect, Coinbase or Phantom" | z3.2 | The account IS the signature — no email, no password, no OTP for a member's own inbox |
| Mailchain `configuration.ts:8` + "permanently discontinued … All user data has been permanently deleted" | spec (S0) | The inbox's bytes live where the owner holds them; a relay copy is a cache, never the record; encryption is not custody |
| XMTP "inbox ID and its associated identities and installations" | z3.1 | One name, many installations: each device key is revocable without changing the address |
| XMTP XIP-69 "The responsibility for message storage duration lies with the payer" | z3.3 | Relay retention is a priced parameter (byte-days) charged to the sender's side by the meter, never a free promise |
| XMTP XIP-69 "deleted before a user has had a chance to read it … permanently inaccessible" | spec (S0), z3.2 | Expiry is explicit on every inbox event; the surface shows the fuse |
| Push "stored encrypted on Push nodes" | z3.1 (negative) | No key escrow on the network; the estate re-derives from the soul (`bzdid-key`), so there is no blob to lose |
| NIP-17 `:23` sealed `kind:13` + gift-wrapped `kind:1059`, `:77` publish only to the recipient's `10050` relays | z3.1 (S6) | A private message is wrapped to each receiver and the sender, and goes only where the receiver said it would read |
| NIP-17 `:110` wrapper keys defeat pubkey-reputation anti-spam | mailroom, z3.3 | The inbox's spam fence is the meter (a byte-day price) and the invite-gated write ACL, not sender reputation |
| NIP-05 `:11` `name@domain → /.well-known/nostr.json` | mailroom (S2) | Name-to-key is a static file the estate serves for its own names; no lookup server |
| NIP-61 `:9` "the payment itself is the receipt" delivered as an event to the recipient's relays | z3.1 (S5) | On the estate's rail the Vaulta transfer memo already is that event: pay-to-name = resolve the name, sign one transfer, memo = the message |
| NIP-57 `:29` zap request "sent to a recipient's lnurl pay `callback` url" (recipient runs a server) | — (LEAVE) | No recipient-side server is ever required to receive a payment or a message |
| BIP-353 "encoding BIP 21 URI schemes in DNS TXT records" | — (confirms S4) | The payment-instruction record is the registry's `chainaddrs` row, not DNS |
| estate `kandi.html:733-734` "a message is a POINTER, never content" | spec (S0), z3.2 (S8) | Already law; the inbox inherits it unchanged |
| estate R1.1 / R4 (`RULINGS-2026-09-16.md:26-29, :63-66`) | spec (S0), z3.1 | Humans are never publicly and permanently mapped to a wallet by their inbox address; agents may be (S4 is agents-only); no inbox address doubles as a cross-rail correlator |

## What is NOT lifted (SERVER class — the dependency the estate replaces)

Recorded as boarding fact: Blockscan's closed web app + `chatapi.blockscan.com` + its 5-day
server store + its content licence; XMTP's curated 7-node network (one steward, a Google
form, a USDC payer registry on an L3) and its 30/60-day fuse; Mailchain's `api.mailchain.com`
(gone, with every inbox); Push's node-held key escrow + IPFS pins under a pivoted company;
NIP-57's recipient-side LNURL server; NIP-61's mint custody. The one honest structural
residue: **someone must hold the inbox bytes.** On the estate that someone is the owner's
device and the estate's own box (`sink.py:12`), and the relay carries pointers.
