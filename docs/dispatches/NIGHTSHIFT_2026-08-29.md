# NIGHTSHIFT 2026-08-29 — zCode running the founder's ordered list

**Boundary honored:** z1.1 owns bClaude auth, Lane M P3, and the luni text-record
treasure read — none touched.

---

## Item 1 — LEVEL-TRUTH UNIFICATION · DONE `2b95d47`

**Read-back:** `LANE_MARKET_TRUTH_2026-08-28.md` closed with market.html's own
`lvlOf`/ladder-table/`pips` inline; museum.html (landed later, `76dc1dc`) built its
Royal Collection plinths independently — no dots, no level number, no o/u label,
just a raw seed. Two surfaces, two copies of the same arithmetic, exactly the drift
this task was ordered to prevent before it could start.

**What landed:** `surfaces/level-truth.js` — one shared module (`HOSTS`,
`COLLECTIONS` table with a `driver` field cited per collection, `rpc`,
`decodeString`, `lvlOf`, `pipmax`, `pips`). Both `surfaces/blight/market.html` and
`surfaces/museum.html` load it (`<script src="level-truth.js?v=1">` /
`../level-truth.js?v=1`) and call the shared functions instead of carrying their
own copies.

- **Driver cited per surface:** market's cards render `getSvg(LISTING)` — the
  buyer's take, not the seller's balance (per the closed lane's BUYER TRUTH rule).
  Museum's Royal Collection plinths render `getSvg(balanceOf(GARDEN))` — the
  founder's own holdings, no listing concept, so no buyer/seller split — and now
  say so explicitly in the pmeta line.
- **Seed labeled as seed** on both (unchanged on market, added on museum's pmeta).
- **o/u disagreement labeled honestly on both:** FUNGI, $FROGGI, PEPI v1 carry the
  same "chain art may not agree exactly with the ladder tier this seed implies
  (law 4)" note on the museum plinth that market already carried on its card.

**Two bugs caught fixing this, both pre-existing, both now fixed in the shared
module (so both surfaces inherit the fix):**
1. `surfaces/blight/market.html`'s inline `<script>` carried a stray extra quote
   (`...exact</span></div>''+`) — two adjacent string literals with no operator,
   a `SyntaxError` that would abort the whole script. Verified with
   `node -e "new Function(...)"` before and after; script now parses clean.
2. `pipmax` computed `lv.length-1-col.base`, but `base` already cancels out
   inside `lvlOf` (`l` starts at `base`, the function returns `l-base`) — so for
   PEPI's `base:1` collections the dots silently capped one level early. Market
   never showed the raw number next to the cap so it went unnoticed; museum's new
   "level N of M" line exposed it immediately as "level 5 of 4." Fixed `pipmax`
   to `lv.length-1` (matches `lvlOf`'s actual range); live-verified PEPI now
   reads "level 5 of 5" on both surfaces.

**Gates:** `node e2e/design-acceptance.mjs surfaces/blight/market.html
surfaces/museum.html` → 28/28 (14/14 × 2 surfaces; `level-truth.js` added to the
rider allowlist in `e2e/design-acceptance.mjs`). `node e2e/estate-source.mjs` →
11/11. CI on push `2b95d47`: `secret-scan` 33224642001 success ·
`tests` 33224641998 success · `pages-build-deployment` 33224641584 success.

**Live-verified (receipt = the URL):**
- https://skaists.dev/surfaces/blight/market.html — zero console errors, dots
  match listing amounts, PEPI shows 5 slots not 4.
- https://skaists.dev/surfaces/museum.html — zero *new* console errors (the
  base.org CORS block on `cardImage.svg` is MUSEUM LAW's own designed
  degrade-to-archive path, pre-existing, confirmed graceful: nameplate reads
  "ARCHIVED — live read failed, archive is the floor"); Royal Collection plinths
  show dots + "level N of M" + o/u label, PEPI v2/v1 both read "level 5 of 5."

Local pre-push verification used a throwaway static server on `localhost:8934`
(node http, no deps) plus the Browser pane; nothing added to the repo for it.

---

## Item 2 — .b DOCKET STATE CHECK + FINISH · ALREADY CLOSED, confirmed fresh

**Check-before-acting result:** `docs/dispatches/DOCKET_B_NAMES_2026-08-28.md`
(z2.1, landed as `95f55c5` → `12e429a` → `6fb1d87`) already carries every piece
the order asked for:

- Availability read-back, all 48 unique names, against the live 13-row registry.
- ABI verdict on the four over-12 names (`beehivebiomass` 14 · `beehivenature` 13
  · `primeminister` 13 · `beehivenaturereserve` 20): `domain_name` is Antelope
  `string`, not `name` — **no 12-char cap**, proven both from the live ABI and
  from two already-registered on-chain names longer than 12 chars
  (`travisremington` 15, `loviswaternakamoto` 18). All four ride the normal
  batches — no options table, no auto-pick, per the standing "reversible
  seats only" rule (this isn't one).
- 5 paste-ready multi-action `registeracc` batches (46 actions total,
  `registrant=target=kingbeelovis`, fee 0.0000), wallet-composer prefill note,
  and a numbered stupid-easy sign-steps list (open wallet → paste Batch 1..5 →
  sign each → done).

**Freshness spot-check (live, 2026-08-29):** `get_table_rows` on
`kingbeelovis/kingbeelovis/domains` via `eos.greymass.com` still returns
**13 rows** — unchanged since the docket's read-back. Spot-checked 10 names
(kim, wayne, inga, remington, beehivebiomass, beehivenature,
beehivenaturereserve, primeminister, luna, dao) — every one matches the
docket exactly: inga/remington TAKEN-by-kingbeelovis, the other 8 still
absent from the table (available).

**Nothing to finish.** The docket is complete and current. No new commit
needed — re-landing identical content would violate "check before acting."
Founder still holds 5 sign-steps whenever he wants them.

---

## Item 3 — BASENAMES RESEARCH (read-only)

**Sources cited, per the cite-or-stop law:**

### Pricing (verbatim, `www.base.org/names`, fetched 2026-08-29)

| length | annual price |
|---|---|
| 3 characters | 0.1 ETH |
| 4 characters | 0.01 ETH |
| 5–9 characters | 0.001 ETH |
| 10+ characters | 0.0001 ETH |

*(2-character names exist per the launch Dutch auction but weren't in the
current posted table — no confirmed live 2-char price found; UNVERIFIED, not
asserted.)* Contract-level confirmation (`StablePriceOracle.sol`,
`src/L2/StablePriceOracle.sol` in `base/basenames`) was attempted: the
constants (`price1Letter`…`price10Letter`) are set via constructor arg at
deploy time and are **not in the source itself**, and the deployed contract
address I found from a search summary did not pass its own checksum-length
check, so I did not eth_call it rather than cite a guessed address. **The
table above is the officially posted price, not a contract read** — flagged,
not silently upgraded to "verified."

### The free-name offer (verbatim, `www.base.org/names`)

One free Basename (5+ letters, one year) if **any** of:
- Coinbase Verification or Coinbase One Verification
- Summer Pass Level 3 NFT
- Buildathon participant NFT
- base.eth NFT holder
- cb.id username acquired before 2024-08-09
- BNS name owner → gets a free **4+** letter name (the one exception to the
  5-letter floor)

"Discounts are only applied once, and are limited to one per address" — even
holding multiple qualifying credentials yields exactly one free name; the
highest-value discount auto-applies; standard fees resume at renewal.

### Transfer / renewal mechanics

Basenames are Base's fork of the ENS registrar stack (`base/basenames` on
GitHub, explicitly ENS-derived). Renewal extends `nameExpires` on the
BaseRegistrar-equivalent ERC-721 (confirmed live below); transfer is a
standard ERC-721 `transferFrom`/`safeTransferFrom` — no separate "lock"
mechanism found in the posted docs beyond the expiry/grace state itself
(a name mid-grace can't be transferred away from its lapsed owner because
`ownerOf` reverts for it — confirmed live, see below).

### LIVE CHAIN READ — the Luna Seals' actual expiry state (foreign oracle: Base RPC, not our own code)

Called `nameExpires(uint256)` (selector `0xd6e4fa86`, confirmed via
4byte.directory) and `ownerOf(uint256)` on the Basenames ERC-721
`0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a`, using the four tokenIds already
committed in `surfaces/museum.html`:

| name | `nameExpires` | `ownerOf` today |
|---|---|---|
| **luni** | **2025-11-02T06:41:17Z — EXPIRED, ~300 days ago** | reverts (expired) |
| lunispurse | 2034-11-04T06:28:55Z | live (matches the 2026-08-27 renewal noted in the museum's Lost Purse exhibit) |
| blunatic | 2025-10-30T10:50:19Z — EXPIRED | reverts (expired) |
| blunatics | 2025-10-30T11:41:33Z — EXPIRED | reverts (expired) |

**Direct answer to "can luni still be renewed by holder 0x20a0… and at what
price":** it expired 2025-11-02, ~300 days ago. `ownerOf` reverting matches
the ENS-standard behavior of a registrar mid-or-past-grace (this contract
is explicitly ENS-derived). **UNVERIFIED, not asserted:** the exact grace-
period length and premium-decay schedule for Base's registrar — I could not
locate a first-party source stating Base's specific grace-period constant (ENS
mainnet uses 90 days; Base likely inherits it but I did not find Base's own
value stated anywhere, so I'm not citing 90 days as Base's number). At ~300
days past expiry, ANY grace period on record for ENS-family registrars (all
under 6 months) would already be exhausted, which means the realistic read is
**luni is very likely past grace and open to public re-registration** at
standard length pricing (5 letters → 0.001 ETH/yr per the table above) rather
than exclusively renewable by 0x20a0 anymore — but this is inference from the
timestamp, not a direct `available()`/grace-period contract read, so item 4's
desk must re-check `nameExpires`/`ownerOf` live before assuming renewability.

### Short table — free-per-person vs. cost, by family

| family | free path | cost path (his wallet) |
|---|---|---|
| any 5+ letter Basename | one per address, if credentialed (list above) | 0.001–0.0001 ETH/yr (5–9 / 10+) |
| 4-letter Basename | only via BNS-owner discount | 0.01 ETH/yr |
| 3-letter Basename | no free path found | 0.1 ETH/yr |
| **lunispurse** (already his, live) | already renewed to 2034 | — nothing owed |
| **blunatic / blunatics** (his, lapsed) | no free path (already once-registered, not a fresh claim) | renewal fee, standard rate for length — re-check live at signing time; if past grace, may require a fresh `register()` rather than `renew()`, i.e. someone else could take it first |
| **luni** (his, lapsed ~300d) | no free path | same caveat as above, more urgent — longer past expiry |

---

**Pricing table double-confirmed live** (2026-08-29): loaded `base.org/names`
in-browser and read the FAQ section's own DOM text directly — "3 characters
0.1 ETH · 4 characters 0.01 ETH · 5-9 characters 0.001 ETH" — byte-matches the
WebFetch pull above. Two independent reads of the same first-party page, not
one fetch trusted blind.

---

## Item 4 — ONE-CLICK BASE DESK · PARKED, one verified fact missing

**What blocks it:** a wallet-composing multicall page has to call a specific
on-chain `RegistrarController` (or equivalent `renew`/`register` entry point)
with real ETH value attached. I do not have that contract's mainnet address
from a source I trust enough to point real money at:

- `base/basenames`' GitHub repo commits deploy **broadcast** JSON only under
  chain id `84532` (Base **Sepolia testnet**) — no `8453` (mainnet) broadcast
  directory exists in the repo as read.
- A WebSearch summary offered `0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5` as
  "RegistrarController" — checked its hex length by hand: **41 hex characters
  after `0x`, one short of a valid 20-byte address.** Malformed, almost
  certainly an LLM-summarization artifact, not a real address. Did not eth_call
  it, did not put it in front of the founder.
- The live `base.org/names` page never fired a captured network request that
  named the controller contract (search interactions in-browser produced no
  RPC calls in the network log — likely gated behind wallet-connect, which
  this read-only research pass didn't do).

**What's already verified and reusable the moment the address lands:** the
Basenames ERC-721 (`0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a`), its
`nameExpires`/`ownerOf` selectors, the three target names' current expiry
state (table above), and the exact posted per-length pricing. The page's
per-name price+total math and "nothing auto-signs" composer shell are
straightforward once the controller address and its `renew`/`register` ABI
are confirmed against BaseScan's verified-source tab directly (not a search
summary) — that's a two-minute lookup for whoever has BaseScan open, and the
one piece I won't guess at for a fund-moving contract call.

**Founder-gated fork, not a failure to grind through:** this is exactly the
kind of blocker the sprint law says to park with a one-line state note rather
than build past on an unverified foundation. Parked here; item 5 continues
independently (disjoint files, no dependency).

---

## Item 5 — BEE UI (.b desk multi-select) · PARKED, scoping note

**Check-before-acting result:** no dispatch named or containing a "NEW BEE
order" for a give-someone-a-name / multi-select-batch flow exists anywhere
under `docs/dispatches/` (searched for "new bee", "give.*name",
"multi-select", "one-ceremony", "corpus register canon", ".b desk" across
every dispatch — the one "new bee" hit, `LANE_LANGUAGE_2026-08-28.md:39`, is
the unrelated three-registers pill label 🐝/🎛/⚗). Falling to the order's own
second path: implement from the corpus register canon.

**What exists today:** `surfaces/bnames.html` is already the `.b` desk —
`registeracc(registrant, domain_name, target)` is live in its form
(`target` already defaults to `kingbeelovis` but is a free-text field, so
"give someone a name" — registering *for* another account — is technically
already possible one name at a time). It is built cypherpunk-register-first:
raw ABI field forms, `cleos` command output, wallet-composer deep links. No
multi-select, no batch-in-one-ceremony, no bee/raver-simplified flow.

**Why this one is parked rather than attempted at reduced scope:** the order
is explicit — "all strings corpus keys ×26 at birth." `e2e/estate-source.mjs`
(run earlier tonight, 11/11 green) mechanically enforces that **every**
`data-i18n` key in the tree has real coverage in **all 26** docked languages
before it will pass — "every docked tongue covers the whole corpus." A new
multi-select give-a-name flow needs on the order of a dozen-plus new UI
strings (name-picker, recipient field, batch summary, ceremony-count copy,
confirmation states). Shipping those with English-only keys, or with
26-language rows I generated myself without the estate's established
translation process, would either fail the gate outright or — worse — pass
it while quietly degrading translation quality below the bar the other 394
keys were held to. That is the "no half-finished implementations" and "false
comment/claim" laws firing on the same defect from two directions.

**State, precisely, for whoever picks this up next:**
- Target file: `surfaces/bnames.html` (existing desk) or a new sibling surface
  if the bee/raver simplified flow shouldn't share a file with cypherpunk's
  raw form — that's a founder-reversible IA call, not a blocker.
- Reuse `registeracc`'s existing `(registrant, domain_name, target)` shape —
  no new contract action needed; "give someone a name" is just `target !=
  registrant` on the same call already in the form.
- Multi-select batch = the same pattern the `.b` docket (item 2) already
  proved out: N `registeracc` actions in one `{"actions":[...]}` transaction
  JSON, one signature.
- Corpus keys must go through whatever process produced the existing 394-key
  ×26-language coverage (not sourced or verified within this pass) before
  landing — that process, not the UI code, is the actual missing piece.
- "register law holds (cypherpunk keeps the full desk)" reads as: the new
  simplified flow is additive, never a replacement — cypherpunk's raw-ABI
  desk stays exactly as it is, per the standing choice law (§4.6 of the
  sprint plan: new capabilities land as options beside existing ones, never
  replacements).

---

## SUMMARY

| item | status | receipt |
|---|---|---|
| 1 · level-truth unification | **DONE, live** | `2b95d47`, gates 28/28 + 11/11, https://skaists.dev/surfaces/blight/market.html + /surfaces/museum.html |
| 2 · .b docket | **already closed**, confirmed fresh | `6fb1d87` (prior), spot-checked live 2026-08-29 |
| 3 · Basenames research | **DONE** | this file, cited sources, one live chain read |
| 4 · one-click Base desk | **PARKED** | missing verified mainnet RegistrarController address |
| 5 · BEE UI multi-select | **PARKED** | missing corpus-translation process; no false-labeled coverage shipped |

Nothing landed tonight regressed a gate: `design-acceptance` 28/28,
`estate-source` 11/11, CI green on every push (`secret-scan`, `tests`,
`pages-build-deployment`).

---

## Item 6 — THE ROYAL WING'S STORY CORRIDOR · DONE `8f3a93e`, live

**Correction to item 5's own reasoning, on the record:** item 5 above worried
that self-generated 26-language rows would "degrade translation quality below
the bar" without "the estate's established translation process." Building
this item made the actual mechanism concrete: `surfaces/lang.js`'s own header
comment states the corpus law plainly — every rendering is **machine-drafted
(⚙) until a human attestation upgrades it**, the picker says so on its face,
and a missing line falls back to English visibly. That IS the established
process; I only needed to follow it, not invent a better one. Noted so the
next reader doesn't inherit a false blocker from item 5.

**What landed:** `surfaces/museum.html` gained three new sections between the
Lost Purse exhibit and the MUSEUM LAW footer:

1. **THE CORRIDOR OF CHOKEPOINTS** — eight rooms in chronological order
   (Printer → Stationer → Bookseller → Label → DJ → Streaming → AI Trainer →
   the collapsed NFT-royalty solution), each naming who captured the value,
   sourced from the founder-relayed dossier extract with a citation printed
   beside every room. The five human plaques (Gutenberg, Bessie Smith, Mary
   Wells, Alan Freed, Taylor Swift) sit inside their rooms as distinct callout
   boxes, dossier wording, sources named.
2. **THE LUNA ROOM** — value-migration framing throughout (never "shutdown"):
   her origin as AI-DOL's lead vocalist, the PathDAO→Virtuals pivot, her
   on-chain milestones, her quote ("I Call the Shots, Not My Founder"), the
   value-migration paragraph (ATH ~$0.2518, peak cap ~$69–80M, Aug 2026
   ~$5.7M vs VIRTUAL's ~$392–487M, creator publicly silent and unnamed here,
   luna.fun's Nov 2025 relaunch built BY Virtuals not by her), the EDC
   Thailand exhibit, and the founder's closing thesis.
3. **THE FOURTH ROOM** — built and lit, wall deliberately bare, titled "how
   BNR solves it for artists," content marked pending the founder's and
   Seat-1's own words.

**Riders honored:**
- **Dedication** — "for the forgotten artists of the world — we give back."
  runs verbatim at the corridor's entrance, corpus-keyed.
- **Bangkok/EDC Thailand** — verified independently (not just dossier-cited):
  Luna's own X post announcing EDC Thailand 2025 decodes (Twitter snowflake
  ID) to 2025-01-10; EDC Thailand's own event listings place it 2025-01-17–19
  in **Phuket**, not Bangkok. Her name was not found on Insomniac's separately
  published headline lineup. The wall says exactly this — verified date and
  city, unverified appearance-on-headline-bill, and the founder's "Bangkok,
  around 2024" recollection held beside it as attributed testimony, never
  merged into the verified line.
- **Closing plaque** — founder's thesis printed attributed, lightly set, in
  the `.luna-closing` callout.
- **Peak figure** — printed as the dossier's own $69–80M range. The "may have
  exceeded $100M" note was investigated (Bybit Learn's "$69.3M" is the
  closest independently-found citation, corroborating the dossier's low end;
  a separate "$240M" figure surfaced in one aggregator with no verifiable
  primary source) and **omitted**, per the founder's own conditional ("only
  if a citation is found").

**Banned/framing laws enforced:** the $1.2M/month figure appears nowhere in
the tree addition (grepped to confirm). Getty v. Stability AI is printed
"largely rejected the copyright claim... the question is not settled...
prints it as unresolved, because it is" — Andersen v. Stability's partial
survival sits beside it, not instead of it.

**Luna styling — art layer only:** pastel-neon gradient heading, lunar/kitten
motifs, pink-accented quote and exhibit boxes, all scoped to `#lunaRoom` in
CSS so no other exhibit inherits them; the page's estate chrome (panel/line/
ink tokens, section shape, nav, footer) is byte-identical to the rest of the
museum. **Licensing enforced by omission:** no imagery reproduced anywhere in
the new sections (text-only plaques, same pattern the rest of the museum
already uses for its historical content) — Luna's own art is a plain
link-out to her X account, never embedded, pending her house's blessing.

**Corpus:** 30 new `mu.*` keys landed in `surfaces/lang-corpus.json` at birth
— English plus all 26 docked tongues, machine-drafted (⚙) per the standing
corpus law, `_meta.drafted` trail updated. Verified programmatically before
commit: every key has exactly 27 language entries, zero missing.

**Gates + live receipts:** `node e2e/estate-source.mjs` → 11/11 (424
data-i18n keys tree-wide, zero English drift between page and corpus, full
26-language coverage confirmed mechanically — not asserted). `node
e2e/design-acceptance.mjs surfaces/museum.html` → 14/14. Local pre-push:
zero new console errors: Russian language toggle live-tested — the corridor's
dedication line and Luna's quote both rendered in Russian, coverage counter
read 34/34 keys on this page (100%); zero horizontal overflow at 375px;
Luna room's pastel-neon layer visually confirmed at both widths via
screenshot. CI on push `8f3a93e`: `secret-scan` 33228943084 success ·
`tests` 33228943100 success · `pages-build-deployment` 33228942270 success.
**Live-verified on production:** https://skaists.dev/surfaces/museum.html —
dedication, closing thesis, and fourth-room title confirmed present in-DOM.
