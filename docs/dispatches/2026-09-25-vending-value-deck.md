# THE VALUE DECK — what a minted agent carries, every card a door asked live

**Seat:** Seat 3 (Claude Code, Fable 5.1). **Date:** 2026-09-25. **Branch:**
`claude-LoVis/baigentic-vending-value-deck-d5885e`.
**Founder order (verbatim):** *"we need to stack the value deck for our bAiGenTic
vending machines. https://github.com/aayushch/laya/blob/main/laya.gif in sync with a
fully featured functional x0x buzz communities. the workspace, repose and messaging
in buzz still just blank"*

## What laya is, and what was taken from it

aayushch/laya (Apache-2.0) is a local-first notification command center: events
from many tools become a stack of action cards, each with its source, its state
and one action, and a briefing strip above the stack. The **shape** was taken —
a stack of cards, each one a source the page just asked, a derived briefing on
top — and nothing else: no code, no dependency, no server. The deck is one page,
vanilla, tokens-only, in the skaists three-register system.

## The surface

`surfaces/vending-deck.html` (+ `vending-deck.js`, the pure core). Seven cards,
each one a value a minted bAiGenTic agent carries and each one a **door the page
asks at load**. A card is never silent: it is `answering`, `asking` (with a clock
and "stop waiting"), `not answering, and why`, or `not ready yet, and why` — the
last two always carry their reason in words. The briefing ("{n} of {m} doors
answering", "asked {n} seconds ago") is derived from the cards every time, never
stored. Doors re-ask every minute while the page is visible; "ask every door
again" asks now. The one primary is "mint one" → vending.html.

| card | door (cited) | what it answered from a loopback origin, 2026-09-25 |
|---|---|---|
| 1 · the agent you keep | jungle4 `bnrapolltest` `certs` (SPEC-VENDING-2 §certificate) | 2 of 7,776 minted · latest `vendingtest2` |
| 3 · the meter and the law | same door, `rates` `tithe` `config` | 0.6000 A · tithe 10.00% → kingbeelovis · head block live |
| 2 · the working memory | none — gated by SPEC-VENDING-2 §memory | not ready yet: the funded write waits on the ANT custody review; ~0.085 ANT/chunk + gas at last reading, never $0 (R3) |
| ⬡ · the hive on the mesh | x0x daemon REST `/health` `/groups` `/groups/:id/members` `/groups/:id/messages` | not ready yet: no session token (see §x0x) |
| ♡ · the rooms | `relay.skaists.dev/hive/public/index.json` + `<channel>.json` | not answering: CORS pinned to skaists.dev — said on the card; answers on the live page |
| ✚ · the workspace | `raw.githubusercontent.com/block/buzz/main/preview-features.json` | 5 preview switches, 0 on by default (see §buzz) |
| ‡ · the repositories | `api.github.com/repos/<owner>/<name>` `pushed_at` | all three answered once the owner was read from GitHub itself: LOVErnment-DAO lives under `skaists`, not `beehive-nature` (the first draft 404'd there — caught by the door, fixed in the core) |

Facts behind every card sit in a `details data-reg-disclose` (open for
cypherpunk, one tap away for new bee and raver — the comprehension law).
Message text from any door is set as text, never markup; only the estate's
own links are links.

## §x0x — why the mesh card needs a local run, and how (the honest map)

Read at source (saorsa-labs/x0x `6cc4085c`, `src/server/mod.rs`, `src/server/auth.rs`):

- the daemon's `CorsLayer` admits **literal loopback IP origins only**
  (`is_allowed_loopback_origin_str`: `127.0.0.0/8`, `[::1]`; the `localhost`
  hostname is rejected on purpose; `file://` has no origin it admits);
- **every route sits behind a bearer** (`auth_middleware`); `POST /auth/session`
  turns the durable token (`data_dir/api-token`) into a **ten-minute session
  token**, and a session bearer cannot mint sessions.

So a page on skaists.dev can never ask the daemon, and the card says exactly
that, with the one line to run it locally. `vending-deck.js` mirrors the CORS
predicate (`originMayAsk`) so the page refuses **before** asking.

`scripts/vending-deck-local.mjs` (zero dependencies) serves the checkout from
`http://127.0.0.1:8842/` (the page at `/surfaces/vending-deck.html`, the riders
resolve `/surfaces/` by law) and, **only when a token file is named**
(`--token-file <data_dir>/api-token`), answers `GET /x0x/session` by minting a
session from it — read at request time, never kept, never printed. The page
holds the short token in a closure; nothing touches storage (asserted). Without
the flag the card asks for a pasted session token (password field, cleared once
taken). The daemon door defaults to `127.0.0.1:12700` (`ops/x0x/x0xd-laptop.toml`);
the laptop→box tunnel `127.0.0.1:18080` works the same way. It refuses loudly on
a non-loopback door, an unreadable token file, a privileged port, an unknown flag.

**Not proven here:** a live x0x read. The laptop daemon is on-demand (the wifi
law) and this seat does not start daemons or hold tokens. The card's wire-shape
handling is tested against the source structs (`GroupPublicMessage`: `body`,
`author_agent_id`, `kind`, `timestamp`, `signature`; `/groups`: `group_id`,
`name`, `member_count`; `/health`: `status`, `version`, `peers`).

## §buzz — "workspace, repos and messaging still just blank"

Read at source, not from memory (two trees: `buzz-src` at `e1035672`
2026-09-07, and the installed desktop's own tree `wt-zcode-nip42-r1` at
`5031a703` 2026-09-18 — the same five entries in both):

- `preview-features.json` lists **workflows, projects, pulse, forum,
  agentManagedProfiles**; `desktop/src/shared/features/resolveEnabled.ts`
  resolves `overrides[id] ?? false` — **preview features start OFF**. Projects
  is "Git repository browser and collaboration"; Workflows is "YAML-defined
  automations with approval gates". The switch is Buzz → settings →
  Experiments → Features (`ExperimentalFeaturesCard.tsx`).
- That is the Workspace and Repos answer: **empty by design until the switch is
  flipped**, not a fault, not a relay problem. The deck's workspace card says
  so, from the live manifest.
- **Messaging blank is a different symptom** and this seat did not open the
  app (surgeon SOP: below L2 the Workbench owns it). The feature map (2026-09-18)
  has messaging shipped; a blank channel list on the founder's install is
  most likely membership/relay-side (the relay is members-only at the door,
  `restricted: not a relay member` for an unknown key — the read-a-buzz-message
  lane measured it). It needs a Buzz-side evidence packet, not a page.
- What the estate CAN show a stranger of the community today, it does: the
  relay's open channels and their recent messages (the rooms card, live on
  skaists.dev), and the mesh community when run beside a daemon.

## Gates (receipts)

```
node --test e2e/vending-deck.test.mjs            → 13 pass, 0 fail
front-door suite (atlas, agent-dock, lang-coverage, register, social-arrival,
  first-click, social-three-view, buzz-directory-views, no-dead-host, bnamesday)
                                                 → 133 pass, 0 fail
node scripts/build-atlas.mjs                     → 104 counted · 113 listed
node scripts/estate-check.mjs                    → PASS (hub static + embed in sync)
node e2e/door-counts.mjs                         → 9 passed
node scripts/r5-surface-audit.mjs                → 122 scanned, ZERO human-gas asks
node e2e/dock-claims.mjs                         → 8 passed
node e2e/estate-source.mjs (after the commit)    → 11 passed, 0 failed
  (10/11 on the first pass: the tree scanner read a querySelector string
   built with the data-i18n prefix as a key — fixed, second commit)
```

Rendered from `http://127.0.0.1:8842` in the in-app browser: new bee, raver
and cypherpunk all paint; the briefing reads "3 of 7 doors answering"; the
language picker's corpus fetch resolves `/surfaces/lang-corpus.json` (the
runner now serves the checkout root for exactly that reason). Corpus: 58
`deck.*` keys docked in en + 28 tongues, all ⚙ machine-drafted, inserted
textually after the `read.*` block (layout untouched; slots verified per
tongue). Registered as `vending-deck` (104 counted). CI list gained the test.

## Round 2 — "imagine that none of it works" (founder, same night)

Traced and true: **the vending page could not mint.** `vending.cpp` has no
token-receipt path — `mint` is its only writer and wants the owner's own
signature — so "send A with memo vending:<name>, the poller will catch your
mint" never minted anything; the approve button signed nothing; and the
history door the poller read (`jungle4.greymass.com/v1/history/get_actions`)
answers HTTP 500. The two receipted mints came from `tool/mint.mjs` with the
seat key in `BNRAPOLL_WIF`, over SSH to the box for the upload.

What landed:
- `scripts/vending-machine.mjs` — the mint as a machine, one line: canonical
  name → member ed25519 key (vault under `%LOCALAPPDATA%\skaists-vending\
  members`, never returned) → a1 genesis → certificate + hash → Arweave via
  Turbo **from this machine** (both doors answer 200 here; no SSH) with the
  member key as owner → pointer row on jungle4 signed with the seat key from
  `BNRAPOLL_WIF`. Every step is a named row; without the key it **refuses at
  `sign` before any upload**; `--dry-run` proves everything up to the hash.
  Dry-run receipt: `bee test` → 3231 B, hash `69e357c3…5035dc`.
- the page's rail-A approve now tells the truth and names the line, then
  watches the chain's `certs` table for the row (the part of the chain that
  answers).
- `e2e/vending-machine.test.mjs` (4 tests) — in the CI front-door list.

Not done: a loopback HTTP door from the page into the machine was refused by
this seat's own action classifier (a signing surface on a local server), so
the page names the line instead of pressing it. A live jungle4 mint was not
run: the seat key is not in this environment and this seat holds no keys.

## Round 3 — the agentic vending machine (founder: "just give me something to hand a real agent")

**Approve mints, in the page, with no server.** The member's ed25519 key is
made in the browser (WebCrypto); the a1 genesis and the birth certificate are
composed by `surfaces/vending-cert.js` (held byte-for-byte to `tool/cert.mjs`
in `e2e/vending-cert.test.mjs`); the certificate is signed as an ANS-104 item
with the member key as OWNER by `surfaces/ans104.js` (no library; held to
`@dha-team/arbundles` in `e2e/ans104.test.mjs`) and uploaded through Turbo's
free door (`upload.ardrive.io/v1/tx`, CORS `*`, free ≤ 107,520 B). The door's
status is read (CONFIRMED within seconds) and a gateway read-back is re-hashed
when it seeds (arweave.net took longer than 15 minutes for both items tonight —
said on the card, never faked). The member gets their key as a file and their
agent: `local-agent/index.html?agent=<name>&cert=<id>` reads the certificate
(the copy the mint left in this browser first, then the permaweb), refuses
unless it hashes true, wears it as the system turn, and keeps every exchange
as a memory row in the browser.

**Receipts (in-app browser, 2026-09-26):** `bee` →
`ar://efqq-z8zkh3D7TbJLXgQK2187Yxl8x4-rTgXDo6loFU` · `bee two` →
`ar://QpwCYL3F5m9xZ50mLxCy46kZrmMCR-CwU5Z26jvrceY` — both `CONFIRMED` at the
door, winc 0, owner = member key.

**The chain row** is the one act the page cannot sign; it is queued in the
browser and `scripts/vending-machine.mjs --row <name> <id>` writes it from the
seat (fetch, re-hash, refuse on mismatch, then mint/update).

**bPay only (founder law 2026-09-26):** the USDC/PYUSD rails, the EIP-681 link,
the injected-wallet path and their constants are gone from vending.html; one
held bPay row says in words that the seat is not named yet.

**The registers:** vending.html is still a single dark presentation; the
raver and new bee readings the founder demands on every surface are not yet
authored for it — named here, not hidden.

## Not done, said plainly

- No live x0x read (no daemon started, no token held — by law).
- The rooms card is CORS-refused off skaists.dev; that is the relay's pin, kept.
- Messaging-blank in Buzz: not diagnosed here (L2 gate not met); needs an
  in-app evidence packet.
- Translations are machine drafts (⚙) until a human attests them.
