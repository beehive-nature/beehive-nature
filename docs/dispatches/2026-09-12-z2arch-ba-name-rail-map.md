# Z2.ARCH — the .b/.a name rail: the actual contracts, routes, identity rules, failure states

> Order: **z2.arch (Medium / fresh)** — "map the actual .b and .a contracts, routes,
> identity rules and failure states. No code." Read-only lane: no code touched, no
> transaction signed, no name registered. Every chain fact below was re-read LIVE
> this seat, 2026-09-12, through `eos.api.eosnation.io` (fallback-verified through
> `eos.greymass.com`); every tree fact reads `origin/main @ 8019be29`.
>
> **STALE-TREE FLAG for every seat:** the shared checkout (`main @ 856e5c09`) is
> BEHIND origin — its `surfaces/bnames.html` still carries the pre-heal HOSTS list
> with dead `api.eosn.io` first. The rail's truth today is #67+#68-merged origin.
> Read `origin/main`, not the shared tree, for anything RPC-host-shaped.

---

## 1 · The one-contract fact (the ground everything stands on)

There is **ONE registry**. `.b` and `.a` are not two systems — they are two
conventions over one table.

- Contract: **`kingbeelovis`** on Vaulta mainnet, chain `aca376f2…f0e906`
  (fresh head `519,909,753` via greymass `get_info`, this seat).
- Live ABI, re-verified today: `registeracc(registrant → name, domain_name →
  string, target → name)`. **`domain_name` is a STRING** — no TLD constraint,
  no suffix enforcement, no 12-char `name` cap (on-chain proof: 15- and
  18-char rows live).
- All 13 live rows are stored **suffixless** (`king`, not `king.b`). The `.b` /
  `.a` distinction is applied **at the display/resolution layer by clients** —
  same row, same contract, same `registeracc`.
- Consequence (SPEC-A-NAMES-1 §THE FINDING, `docs/specs/SPEC-A-NAMES-1.md`):
  **`.a` needs no sibling registry** — the same action serves it today.

## 2 · Contract A — `kingbeelovis`, LIVE (fresh `get_abi`, 2026-09-12)

**14 actions / 4 tables**, read live this seat:

| action | live signature | class |
|---|---|---|
| `registeracc` | `(registrant:name, domain_name:string, target:name)` | lifecycle — the register action is NOT "register" |
| `transfer` | `(from:name, domain_name:string, to:name)` | lifecycle — carries the payer bug (F3) |
| `renew` | `(owner:name, domain_name:string, days:uint16)` | lifecycle |
| `release` | `(owner:name, domain_name:string)` | lifecycle |
| `setaccount` | `(owner, domain_name, target)` | re-point without moving ownership |
| `setchain` | `(owner, domain_name, chain_key:string, address:string, addr_type:string, memo_tag:string)` | cross-chain resolution |
| `delchain` | `(owner, domain_name, chain_key:string)` | cross-chain |
| `cleanup` | `(domain_name:string)` | permissionless reclamation, one name per call |
| `init` / `updateconfig` / `setadmin` | config singleton, term days | admin |
| `addchainkey` / `rmchainkey` | `(admin, chain_key, label, requires_memo)` | admin — chainkeys |

Tables: `domains`, `config`, `chainaddrs`, `chainkeys`.

**Row shapes (raw, live):**

- `domains` = `{ id, domain_name, owner, account, registered, expires }` —
  registeracc's `target` lands in the `account` field.
- `chainaddrs` scope = **the domain's uint64 id** (name-encoded in UIs:
  `fva5q53rzb53e` = `remington`'s `6830934878284532282`).

**Live state, fresh this seat:**

- `config`: admin `kingbeelovis` · `registration_fee 0.0000 EOS` (**read
  nowhere in the contract — dead field**, F2) · `registration_days 365` ·
  initialized.
- **13 names**, every one `owner: kingbeelovis`, every one registered
  `2026-08-01T01:37:15`, every one expiring **`2027-08-01T01:37:15`** (one
  cliff, F4): amanda, inga, isabella, king, lacee, lovis, loviswater,
  loviswaternakamoto, oliver, queen, remington, travis, travisremington.
- `chainkeys`: **11 rows, ALL `requires_memo: 0`** — including `slip44:144`
  (XRP) and `slip44:148` (XLM/Stellar). F1 live.
- `chainaddrs`: **11 rows, all on `remington`** (one address per chain: BTC,
  ETH, ARB, exSat, XRP, BCH, XLM, ZEC, Vaulta, Zano, SOL) — **all `memo_tag:
  ""`**. Cross-chain name→address resolution exists for exactly **one of the
  13 names** today; the other twelve have zero addresses attached.
- Account `kingbeelovis`: **active = threshold 1 over THREE weight-1 keys** —
  K1 `EOS5xauX…`, K1 `EOS63Ce1q…` (**new since the 2026-08-22 two-key
  record**), WebAuthn `PUB_WA_35GjS2…`; owner = single K1 `EOS7omyg…`.
  RAM `quota 1,442,174 / usage 442,608` (headroom ≈ 1.0 MB; quota is DOWN
  from 3,035,677 measured 2026-08-04 — ~1.6 MB sold/unstaked since).

## 3 · Contract B — `bdomain2`, COMPILED, NOT DEPLOYED

`contracts/bdomain2/` (src + `bdomain2.wasm` 45,251 B + abi) — **13 actions /
6 tables** (`domains`, `resolvers`, `chainkeys`, `chainaddrs`, `prepaids`,
`config`). Every §7 urgency from `docs/bdomain-scaling.md` is closed in
compilable C++, none of it is on any chain:

- **Fee wired**: prepay via `[[eosio::on_notify("core.vaulta::transfer")]]`,
  memo = the name, excess auto-refunded, `prepaids` table; zero-fee era
  behavior unchanged.
- **Cap**: `init` gains `max_domains` with maintained count (closes F2).
- **`transfer` repaired**: `require_auth(to)` + row re-billed to transferee
  (closes F3).
- **Memo law**: `seedmemo()` heals the chainkeys flags; `setchain` rejects
  empty memos on requires-memo chains (closes F1).
- **Tier-1 trims**: `byowner` index dropped, `domain_id` dropped (scope IS the
  id), `chain_key` string → `uint16` ordinal into `chainkeys` — row ~155 B.
- **Tier-2**: new `setresolver` + `resolvers` table (owner-set
  signer/gateway/TTL, `resolver_id` on domain) — the signed off-chain
  resolution lane that makes 10B users = keypairs, not accounts.

**Deploy gates, in order** (unchanged): local-nodeos conformance (compile ≠
behavior) → key custody → founder word. Jungle4 kit captured (chain ID, faucet
law 100/6h, Hyperion endpoints, bed `banchor22222`). Deploy budget honesty:
setcode ≈ 452 KB billed; on the Jungle bed that was ~13.5 KB short of free —
on **mainnet** kingbeelovis today there is ≈ 1.0 MB free quota (fresh), so the
bytes exist; the gates are process, not RAM.

## 4 · Routes — what actually touches the rail today

| route | role | state |
|---|---|---|
| `surfaces/bnames.html` | **the name desk** — keyless reads (search, stats), real-ABI composer cards (registeracc/transfer/renew/setaccount/setchain/release), informed-consent flow, download-Tx JSON envelope + OPEN-IN-UNICOVE deep link. Zero writes from the page — compose-only. | LIVE; post-#67/#68 RPC rail = exactly `['https://eos.api.eosnation.io','https://eos.greymass.com']` (origin/main :298), both fresh-2xx this seat |
| `surfaces/blight/vaulta-reader.html` | generic table reader (code/scope/table), presets the .b registry; per-domain chainaddrs scope law documented in-page; round-robin `vidx` over the two-host rail | LIVE |
| `surfaces/profile.html` | **the .a houses, rendered** — `bClaude.a` card: root = skaists .b bDiD, bounded authority ($1/24h chain cap + linkauth one action), wallet "pending CREATE2 grind", succession "designed, not yet deployed"; beside it `北方國王bclaude.base.eth` (chartered Basename, deed King-held) | LIVE (display tier) |
| `r/index.html` | **the bnr:// resolver** — LAYER-2 adapter map of NINE estate DOMAINS (`skaists.dev`→hub, etc.); honest refusal on unknown names ("the resolver refuses rather than guess") | LIVE — but see F6: it resolves **domains**, never queries kingbeelovis |
| hub footer (`surfaces/index.html:725`) | `web+bnr` protocol registration button + `bnr://skaists.dev` | LIVE |
| Unicove deep-link | `unicove.com/en/vaulta/contract/kingbeelovis/registeracc?…` pre-filled action builder | open door; leaves our page (first-party tension, known) |
| cleos (WSL) / bloks.io+Anchor | terminal / third-party signing doors | founder-REJECTED ("not a fucking terminal doc"; bloks door rejected per first-party-only law — never offer again) |

**RPC endpoints (the rail's read path):** `eos.api.eosnation.io` (the reliable
pin; CORS-OK even from `file://`) and `eos.greymass.com` (fresh 200, head
519,909,753). `api.eosn.io` = **NXDOMAIN at Cloudflare AND Google (fresh this
seat)** — swept from all seven browser-side sites by #67 (`2c8afcce`) + #68
(`61091bc4`, merged `8019be29`).

**Pending routes (dispatched, not built):** the new-bee one-field flow
("make it real" → wallet.html composer prefilled) — interrupted 2026-08-28,
never started; the wallet-ladder bee copy for registeracc with it.

## 5 · Identity rules — the ruled laws, and where each one actually lives

| # | rule | enforced where | status |
|---|---|---|---|
| 1 | `.b` = beings, `.a` = agents | client display convention only | live convention |
| 2 | names stored suffixless; full charset of the 27 corpus tongues; `ī` macron transcription law (`0xC4 0xAB`) | contract accepts any string; charset is client-side | live |
| 3 | canonical name normalization (reject zero-width/NBSP → NFC → trim/collapse → lowercase per tongue → one canonical form) | `canonicalName()` shipped on vending; rail-wide = **PROPOSAL pending founder word** | proposed |
| 4 | one .b per bzDiD per unique human; rule-followers rewarded (LOVErnment standing) | the informed-consent card on bnames — covenant, not chain code | client-side |
| 5 | users pay their own way | **chain**: `require_auth(registrant)` + row emplaced on registrant (RAM ~0.84 A one-time, resellable; fee 0.0000; CPU/NET ≈ free) | live, verified in source |
| 6 | term 365 days; annual renewal = the annual merge checkpoint; grace period on expiry | term on chain; **merge-checkpoint + grace = ruled UI promises, zero chain machinery** (F4) | half-live |
| 7 | deed always King-held | dynasty schema (`king: 蜂王 LOViS`); chartered Basenames §naming | in-tree law |
| 8 | every `.a` roots under a being's `.b` bDiD, root shown on every .a profile | profile rendering; not on chain | display tier |
| 9 | agent authority bounded: linkauth to one action + $1/24h genesis spend cap on Base | the chain enforces the cap once the agent wallet exists | designed; wallet un-ground (F7) |
| 10 | dynasty append-only: holder snapshots written AT transfer, never edited/deleted, stored in-tree not on-chain | `docs/dynasty/SCHEMA.md` + practice | live practice |
| 11 | a lost key is permanent; a lost name is a lease running out | consequence of the ground | live truth |
| 12 | bot protection = the human hand on the signing tool (manual wallet import kept deliberately; no CAPTCHA) | the download-Tx gap | live by design |
| 13 | CREATE2 vanity from the SALT, never the key (profanity-class EOA grinders forbidden) | spec law | ruled |
| 14 | stack ruling: names on .a/.b (our charset, our cost); addresses/settlement on Base/ETH | architecture | ruled |

## 6 · Failure states

### Live now (each with fresh evidence, this seat)

- **F1 — XRP/XLM funds-loss exposure, TODAY.** All 11 `chainkeys` rows read
  `requires_memo: 0`, including `slip44:144` (XRP) and `slip44:148` (XLM);
  remington's live `xrp`/`xlm` rows carry `memo_tag: ""`. The memo guard is
  inert for exactly the destination-tag chains it was written for. A send
  today relying on name resolution can lose funds silently. (Fixed only in
  undeployed bdomain2: `seedmemo` + setchain rejection.)
- **F2 — uncapped free registration.** `registration_fee` is written by
  `init` and read nowhere; no cap, no rate limit. Invisible at 13 names; the
  day third parties can register it is an unbounded RAM-allocation vector.
- **F3 — `transfer` never bills the transferee.** `to` never signs and never
  assumes the row's RAM; the transferor keeps paying for a name they gave
  away.
- **F4 — single expiry cliff, no reclamation path.** All 13 names expire
  `2027-08-01T01:37:15` together; no `by_expires` index exists, `cleanup`
  takes one name per action, and the promised grace period is UI copy, not
  chain law — on-chain, expiry is hard.
- **F5 — single-sig crown.** Active = threshold 1 over THREE weight-1 keys
  (any one — including the newest K1 — moves all 13 names and the admin
  actions); owner is a single key. No multisig anywhere on the registry
  identity. The WebAuthn key is the 10-billion tier and also the widest
  attack surface on a threshold-1 permission.
- **F6 — the resolver gap.** SPEC-A-NAMES-1's name-resolution path
  (`bnr://name` → `domains` row → `chainaddrs`) is spec'd, not built: `r/`
  resolves estate DOMAINS via a nine-entry adapter map only. Today .b/.a
  name resolution exists only as bnames/vaulta-reader table reads. Unknown
  name → honest refusal page (correct behavior; missing capability).
- **F7 — the .a rail is not instantiated on-chain.** Zero agent rows exist;
  `bClaude.a` is a tree-rendered card (root, bounded authority, dynasty
  succession all displayed), the CREATE2 agent wallet is un-ground, the
  succession board role is drafted-not-deployed. The contract would accept
  the row today (string law) — nothing registers it. No client currently
  distinguishes `.b` from `.a` rows (SPEC open question: convention vs
  `type` field).
- **F8 — the docket window stays open.** 46 composed names + `k`/`q` still
  unregistered (fresh: 13 rows only). Every latecomer pays the Bancor curve
  the earlier crowd set — RAM is a frozen-supply market and the price per
  user rises with total pool consumption (~9× by the 20-millionth all-in
  user). Squatter risk on the family short-names is real.
- **F9 — bdomain2 undeployed = F1–F4 stay live.** Migration-window law:
  schema evolution costs <$1 at 13 rows, is a project at 13k, impossible at
  13M. Gates unchanged: conformance → custody → founder word.

### Healed (context, kept so the map is honest)

- **H1 — `api.eosn.io` dead.** NXDOMAIN measured 2026-09-12 (edu-i18n
  acceptance), swept from all seven browser-side sites same day (#67
  `2c8afcce` heals bnames HOSTS; #68 `61091bc4` removes the literal
  everywhere; merged `8019be29`; fresh NXDOMAIN re-receipt this seat at
  1.1.1.1 + 8.8.8.8).
- **H2 — Anchor Desktop import saga.** Bare args failed, action-envelope
  failed — wallets want full transaction objects; produced the Unicove door,
  the ESR lane, and finally the ruling: **the bzDiD IS the wallet**.
- **H3 — the hidden limit-10 lie.** vaulta-reader's first single-shot hid
  rows the table actually had; auto-pagination now. Lesson standing: hidden
  limits are silent lies when tables grow.
- **H4 — the RAM ceiling (a law of the ground, not a defect).** ≈ 76.13 GB
  buyable, total, for everyone; ~12.7M all-in users is the arithmetic wall;
  practical planning ceiling 1–3M; supply frozen since 2023-12 (unfreezing =
  15-of-21 BP msig + terabytes resident in producer memory). The only
  architecture past it is Tier-2 (bdomain2's resolvers): 1B users means
  keypairs, not accounts.

## 7 · Fresh receipts (2026-09-12, this seat, read-only)

```
POST eos.api.eosnation.io /v1/chain/get_table_rows  code=kingbeelovis table=domains
  → 13 rows; sample raw: {"id":"1290493407545538554","domain_name":"oliver",
     "owner":"kingbeelovis","account":"kingbeelovis",
     "registered":"2026-08-01T01:37:15","expires":"2027-08-01T01:37:15"}
POST … table=config   → {"admin":"kingbeelovis","registration_fee":"0.0000 EOS",
     "registration_days":365,"initialized":1}
POST … table=chainkeys → 11 rows, requires_memo:0 on ALL (incl. slip44:144, slip44:148)
POST … table=chainaddrs scope=6830934878284532282 (remington) → 11 rows, memo_tag:"" on ALL
POST … /v1/chain/get_abi account_name=kingbeelovis → 14 actions / 4 tables (§2)
POST … /v1/chain/get_account → active thr=1 ×3 weight-1 keys (K1, K1-new, PUB_WA);
     owner single K1; ram_quota 1,442,174 / ram_usage 442,608
POST eos.greymass.com /v1/chain/get_info → head_block_num 519,909,753, chain aca376f2…
DNS api.eosn.io → NXDOMAIN @1.1.1.1 and @8.8.8.8
git: origin/main 8019be29; shared checkout STALE at 856e5c09 (pre-#67 bnames bytes)
```

## 8 · Deltas vs the seat record (what moved since the memories were written)

1. Active permission: **2 keys → 3** (new K1 `EOS63Ce1q…` joined K1 + WebAuthn).
2. RAM quota **3,035,677 → 1,442,174** (usage 442,099 → 442,608) — ~1.6 MB
   released; headroom still ≈ 2.3× usage.
3. PR #68 **merged** (record said awaiting Astra) — origin/main `8019be29`.
4. Unchanged: 13 names, docket + k/q unexecuted, bdomain2 undeployed, F1–F4
   all still live on the contract that matters.

— zCode (z2.arch), 2026-09-12. No code, no keys, no transactions. Map only. 🐝
