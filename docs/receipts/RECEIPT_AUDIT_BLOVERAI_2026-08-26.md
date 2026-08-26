# CORRECTION — 2026-08-26, founder-confirmed, same day

**The order that produced this audit named the wrong identifier.** The identifiers were:

- `bloverai.base.eth` / `0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876` — **THE FOUNDER'S GARDEN.
  Safely controlled.** Every repoint below was executed correctly against the wrong target,
  and has been **reverted**.
- `bqueenbee.base.eth` — **LOST. One device carried both the phone and the wallet.** The real
  fix landed where it was always needed: the profile surface's example names the founder's
  garden, and the museum carries the record as **Exhibit 10 · A name that went with the phone**.

The false statements this document made ("lost", "its wallet's key is gone", "not the founder's
any more") were untrue and went live for under an hour. They are struck by this correction, not
erased — the text below stands as the record of what was said and why it was wrong. The method
notes that survive untouched: the reference-hunting itself (name → address → every file), the
list-before-change discipline, and the exclusions (the bLOVErAi agent concept is not the name;
nothing here ever touched the bQueenBee agent surface).

---

# RECEIPT — the bloverai.base.eth audit: every reference, categorized, before anything changed

**Audit ordered 2026-08-26.** The name `bloverai.base.eth` resolves to a smart wallet whose
passkey/device is gone. It is not dormant and it is not the founder's any more. `bqueenbee.base.eth`
is live and untouched by this audit (verified: zero references to it in any file touched here).

The name resolves to **`0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876`** — established from the
gallery's own history: the hardcoded default `start('0xfbd20147…',"the founder's garden · base")`
predates the name-resolution rewrite, and `e2e/wallet-fund.mjs` records its MOCK hex as the
"live-resolved hex" of the name at test-writing time. (The domains API itself is unreachable from
this box — TLS edge rejection on every client — so the on-file evidence is the record.)

## The full reference list

**LIVE CODE — presents the address as the founder's or the estate's. Repointed.**

| # | file : line | what it does | ruling |
|---|---|---|---|
| 1 | `surfaces/blight/gallery.html:238` | `start('0xfbd20147…',"the founder's garden · base")` — the gallery's DEFAULT WING reads a live seed from that balance and labels it the founder's | repoint to the example collector; relabel |
| 2 | `surfaces/blight/gallery.html:75` | header comment: "Default wing: the founder's garden — bloverai.base.eth" | relabel (comment is documentation of behavior) |
| 3 | `surfaces/blight/gallery.html:201` | empty-state hint: "try bloverai.base.eth, or any 0x… address" | repoint hint to neutral wording |
| 4 | `surfaces/blight/inscription-explorer.html:119` | quick-button `data-a="0xfbd20147…"` labeled "the founder's garden" | repoint + relabel |
| 5 | `surfaces/blight/inscription-explorer.html:345` | `HOLDERS_LADDER=[['0xfbd20147…','the founder'], …]` | repoint + relabel |
| 6 | `surfaces/blight/market.html:103` | `const LOV='0xfbd20147…'` — the Apiary's whole inventory/stalls exhibit reads this wallet's balances and presents the pieces as ours | repoint |
| 7 | `surfaces/blight/farmers.html:132` | `const LOV='0xfbd20147…'` — the farm's stalls, same pattern | repoint |
| 8 | `e2e/wallet-fund.mjs:155,164,177` | MOCK hex = the address ("live-resolved hex of the probe"), two test fills type the name; CI runs this | neutral mock hex + neutral example name; relabel comments |

**RECORDS — history of what happened. Relabelled where they present it as founder's, never deleted.**

| # | where | what | ruling |
|---|---|---|---|
| 9 | git history of all files above | the hardcoded address and name in past commits | untouched — history stays |
| 10 | `.claude/worktrees/*` stale copies | same live-code refs in two detached old worktrees | not published, not served; left alone (worktree hygiene is their owner's) |
| 11 | this receipt | the list itself | the record |

**NOT the name — verified and excluded:** every `bLOVErAi` reference in `docs/` (CD-29, SPEC-BLOVERAI-BZDID-BONDING-1, dispatches) and in `~/LOVErnment-DAO` (specs, audits) is the **agent/companion concept**, not the base.eth name; none of them resolve or reference the name or the address. `agent-dock.js`'s bloverai chip is the agent handoff. The mirror vault (`beehive-mirror/`) carries no hit. `bqueenbee.base.eth`: zero references in any touched file.

## The repoint target

`0x8e4cECd53bf2025ea0C8e69784355446C6355eBE` — FUNGI's #3 holder (3,006,251 whole tokens — an
L5 seed), verified live on two independent Base RPCs during the 2026-08-26 census work. A real
garden with real art, labeled everywhere as **"a collector's garden — example, not ours"**. No
founder or estate claim travels with it. (bqueenbee.base.eth deliberately NOT used — the order
forbids touching it, and repointing TO it would be touching.)

## What may no longer happen

Nothing in the estate may present `0xfbd20147…` or `bloverai.base.eth` as the founder's or the
estate's. After this audit: the gallery, explorer, market and farm read the example collector;
the wallet-fund test mocks a neutral hex. The historical commits keep their bytes and their
moment — that is what actually happened, and history stays.
