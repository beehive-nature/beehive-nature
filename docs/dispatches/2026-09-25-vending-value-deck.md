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

**No local server (founder, 2026-09-26): the runner that served the checkout on loopback was deleted; the page lives on skaists.dev, and the mesh card says only that the daemon answers loopback pages, with a field for a pasted session token.**

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

**The chain row** is the one act the page cannot sign. It is not written until
the seat runs `scripts/vending-machine.mjs --row <name> <id>` (fetch, re-hash,
check the item owner on Arweave, refuse a name held by another key, then
mint/update). The page says so; nothing queues it. (Corrected 2026-09-28: an
earlier line here said the row was "queued in the browser" — a localStorage key
nothing read. Deleted, not patched.)

**bPay only (founder law 2026-09-26):** the USDC/PYUSD rails, the EIP-681 link,
the injected-wallet path and their constants are gone from vending.html; one
held bPay row says in words that the seat is not named yet.

**The registers:** vending.html and local-agent/index.html now carry main's
ETERNAL three-product fronts (waves 1-3, merged in), gated at 100% in CI. The
value deck (vending-deck.html) is the one surface in this PR without its own
three fronts — named here, not hidden.

## Not done, said plainly

- No live x0x read (no daemon started, no token held — by law).
- The rooms card is CORS-refused off skaists.dev; that is the relay's pin, kept.
- Messaging-blank in Buzz: not diagnosed here (L2 gate not met); needs an
  in-app evidence packet.
- Translations are machine drafts (⚙) until a human attests them.

## Review round 1 — 2026-09-28 (new owner, independent read-only review)

The PR changed hands with no rebuild. An independent read-only reviewer (Explore,
not the author) read `origin/main...fc4d4ef68` and returned REQUEST CHANGES:
3 blockers, 8 should-fix. Each was checked against the code before fixing.
Branch first brought level with main at `6265de4a4` (clean merge, 49 commits).

| # | finding | fix |
|---|---|---|
| B1 | page said "this page signs nothing" while approve signs; "the row follows"; "nothing partial was kept" after a failed upload | copy says the new key signs, nothing is paid, the row is not written until the seat writes it; a failure at the upload step says the item may be permanent and the key above is its owner |
| B2 | the cypherpunk pipeline still read "transfer · memo-bound … memo vending:" (from main's wave) | replaced by key + certificate in page, certificate on Arweave, row awaits the seat; a test forbids `memo vending:` / `memo-bound` in the page |
| B3 | the CLI generated member keys and kept their seeds in `%LOCALAPPDATA%/skaists-vending/members` | the CLI no longer makes or keeps member keys: a real mint refuses and names the page; `--dry-run` uses a throwaway key in memory; the upload path is deleted |
| 4 | key offered only after ~78 s of read-back | offered right after it is made, before any upload |
| 5 | Escape/outside click said "nothing moved" mid-mint; approve could double-fire | plan cannot close and approve/refuse are disabled while a mint runs |
| 6 | read-back had no clock | "try n of 6 · s" |
| 7 | the resurrection check read FAIL after an in-page mint (no row yet) | says the row waits, checks by id and key, reports two-way instead of three-way |
| 8 | the agent page claimed an owner from a self-consistent record | owner read from Arweave's index: different signer refused, unindexed said plainly (in the page and in the agent's own system turn); gateway fetch timeout; records without answers refused |
| 9 | `--row` could re-point another member's row | refuses when the name is held by another key; refuses unless Arweave's owner equals the certificate's member key |
| 10 | ANS-104 parity with arbundles only ran where the library was installed | a byte-exact fixture signed by `@dha-team/arbundles` is pinned in `e2e/ans104.test.mjs`; CI checks every byte with no install |
| 11 | a test passed only on an unreachable `a-legacy` branch | branch deleted; the test now checks the live mint's truth |
| nit | deck sent the bearer token to any typed door | the door must pass the same literal-loopback law as the origin before any request |

**Found while fixing #10 (outside this PR):** arbundles' `SolanaSigner` reads
its secret as `seed ‖ public`. `contracts/vending/tool/ar-upload.cjs` packs
`public ‖ seed`, which would publish the member's SEED as the item owner. The
fixture proves it: `pub ‖ seed` gave owner = sha256(phrase) = the seed. Arweave
checked as the outside witness: every ed25519 item tagged `skaists-vending`
(`bee`, `bee two`, `bee three`, the in-page mints) has owner = its Member-Key,
and the five older `vendingtest` items are RSA, so nothing leaked. The CLI copy
of that path is deleted here; `ar-upload.cjs` is a separate task.

**Receipts:** vending tests 25/25 (`node --test vending-deck vending-machine
vending-cert ans104`); `vending-eternal` + `local-agent-eternal` 11/11;
`skaists-conformance --only vending.html,local-agent/index.html --min 100`
100% in all three registers; `estate-source` 11/0; `x402-engine-parity` ok;
`polish-i18n` 25/0; headless load of the three pages with every outside request
aborted: zero page errors.
