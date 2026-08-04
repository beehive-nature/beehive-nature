# .b registry scaling — 10k to 1B users

<!-- 9 agents. 2,537 B/user derived independently by two reviewers before
     seeing the claim; reconciles to kingbeelovis ram_usage=442,099 exactly. -->

# `.b` Identity Registry — Scaling Analysis

**Chain state as measured:** Vaulta/EOS mainnet, chain_id `aca376f2…f0e906`, head ≈ block 513,122,163, 2026‑08‑04 ~19:20 UTC. Token price **$0.06499/A** (CoinGecko — external, volatile, and the only number here that is not chain data).

---

## 1. The one number

**2,537 bytes of RAM per user** — one `.b` domain plus 11 chain addresses, the exact shape live on chain today (`remington`, L=9, 11 addresses).

```
domain row       (273 + L, L=9)                      282 B
chainaddrs table_id_object (fresh scope per domain)  112 B
11 × chain_addr rows (136 + Lk + Lt + La + Lm)     2,143 B
                                                   -------
                                                   2,537 B
```

**Cross-check result: both independent reviewers derived 2,537 before seeing the claim. Zero disagreement, zero residual.** The whole-account model reconciles to `kingbeelovis` `ram_usage = 442,099` exactly — 428,690 setcode (42,869 wasm × 10, SHA256 verified byte-identical to the local file) + 1,626 setabi/abihash + 7,968 contract tables + 3,815 account base and system rows. The 7,968 was verified twice: analytically, and by summing every Hyperion RAM delta on the contract's own actions (registeracc 3,762 + setchain 2,255 + addchainkey 1,698 + init 253). No range to report. Use 2,537.

Three things that change the multiplier, all real:

| variant | bytes/user |
|---|---:|
| **Lean user** — 3 chains (BTC/ETH/SOL) | **965 – 1,020** |
| **Live shape** — 11 chains | **2,537** |
| Worst case — `MAX_CHAINS_PER_DOMAIN` = 32 | ~6,600 |

**The number that actually matters for onboarding is bigger than 2,537.** `registeracc` calls `require_auth(registrant)` — a `.b` user must already *be* an Antelope account. A brand-new user therefore also pays for account creation: **≈ 3,450 bytes** (2,048 base overhead + 2 permission objects + `userres`/`delband`/`voters` rows; measured at 3,446 on a vanilla mainnet account, ±10% depending on key count and whether they ever hold a token balance).

> **All-in cost of one genuinely new user: ≈ 5,983 bytes ≈ 6.0 KB.**

Everything below is computed both ways. The 2,537 column is what BNR's registry adds; the 5,983 column is what the world actually has to buy.

Two derivation nits worth carrying forward, neither of which changes any number: `index64_object` is `24 + 3×32 = 120` *then* aligned up to 128 (not `24+8+3×32`); and a secondary index shares the primary `table_id_object` only because `domains` has exactly **one** index — a second index would cost +112 one-time and +128 per row. Do not add a second secondary index casually.

---

## 2. Who pays today

**The contract does not subsidize anyone. Every row is billed to the account that authorized the action.** There is exactly one `get_self()` payer in 408 lines, and it is the singleton config row.

| Table | Action | RAM payer | Line |
|---|---|---|---|
| `domains` | `registeracc` | **`registrant`** | `bdomain.cpp:86` — `domains.emplace(registrant, [&](auto &d) {` |
| `chainaddrs` | `setchain` | **`owner`** | `bdomain.cpp:248` — `addrs.emplace(owner, [&](auto &row) {` |
| `chainkeys` | `addchainkey` | **`admin_user`** | `bdomain.cpp:291` — `keys.emplace(admin_user, [&](auto &row) {` |
| `config` | `init` | **`get_self()`** (kingbeelovis) | `bdomain.cpp:349` — `cfg.emplace(get_self(), [&](auto &c) {` |

All seven `modify()` calls re-bill to the authorizing account or `same_payer`. None migrates a row onto the contract. `release`, `delchain`, `rmchainkey`, and the permissionless `cleanup` all refund to the original payer.

**Why the live chain looks like a subsidy and isn't.** `show_payer:true` returns `"payer":"kingbeelovis"` for all 13 domains rows, all 11 chainaddrs rows, all 11 chainkeys rows. That is because kingbeelovis is simultaneously registrant, owner, and admin for every row that exists. `registrant == owner == admin == get_self()` collapses to one name. The first third-party `registeracc` will show that registrant as payer. **No code change is needed to shift cost to the user — the code already does it.**

**What IS required, and it is not a code change:** the user must arrive with an Antelope account that has ≥2,537 bytes of free `ram_quota`. At today's price that is ~0.84 A (~$0.055) of RAM on top of ~1.15 A (~$0.075) for the account itself. If the user's quota is short, `registeracc` does not fail with a `check()` message — it aborts with `ram_usage_exceeded` from `apply_context`. Budget for that error surfacing in your onboarding UX.

**Three defects that do create unintended subsidy or free-riding. Fix all three before public registration opens:**

1. **`transfer` leaves the RAM bill with the old owner.** `bdomain.cpp:108` — `domains.modify(itr, from, [&](auto &d) { d.owner = to; });`. `to` never signs and never assumes the cost. The transferee gets a domain the transferor keeps paying for. **Fix:** add `require_auth(to)` (or a two-step propose/accept) and change the payer argument to `to`.
2. **Registration is free and uncapped.** `registration_fee` is written by `init` (`bdomain.cpp:351`, live value `0.0000 EOS`) and **read nowhere**. `registeracc` checks name validity and expiry and nothing else — no fee, no global cap, no rate limit. Today that is invisible at 13 names; the day registration opens it is an unbounded RAM-allocation vector. **Fix:** either wire an `on_notify` transfer handler that requires payment, or delete the dead field and say out loud that registration is free.
3. **`cleanup` cannot reclaim at scale.** It takes one name per action and `domains` has **no `by_expires` index** — there is no on-chain way to enumerate what lapsed. Reclaiming RAM from millions of expired names requires an off-chain indexer feeding names back in one at a time.

---

## 3. The scaling table

Bancor, exact, not linear. From `exchange_state.cpp` / `delegate_bandwidth.cpp`:

$$\text{cost}(b)=\frac{R_q\cdot b}{R_b-b},\qquad \text{paid}=\frac{\text{cost}(b)}{0.995}$$

with **Rb = 76,128,906,582 free bytes** and **Rq = 25,051,879.5431 A**. Note the denominator: cost → ∞ as b → Rb. The `rammarket` base balance exactly equals `max_ram_size − total_ram_bytes_reserved`, so this is the entire buyable inventory. There is no second pool.

Registration time assumes a full onboarding bundle at **≈ 5.0 ms CPU** (measured account creation mean 1,755 µs + estimated ~400 µs `registeracc` + 11 × ~250 µs `setchain` — the last two are **estimates**, not measured; `registeracc` CPU has not been benchmarked) running against a rented **10% of chain CPU = 3,456 CPU‑s/day ≈ 809 A/day ≈ $53/day** → 691,200 registrations/day = 8.0/s.

### A. Registry rows only — 2,537 B/user (user already has an Antelope account)

| users | total RAM | % of chain's **entire** RAM supply | Bancor cost (incl. 0.5% fee) | USD | reg. time @8/s | avg per user |
|---|---:|---:|---:|---:|---:|---:|
| **10k** | 25.4 MB | 0.006% | 8,393 A | $546 | 21 min | 0.84 A / $0.055 |
| **1M** | 2.54 GB | 0.61% | 867,976 A | $56,400 | 1.4 days | 0.87 A / $0.056 |
| **10M** | 25.4 GB | 6.06% | 12,584,191 A | $818,000 | 14.5 days | 1.26 A / $0.082 |
| **100M** | 254 GB | 60.6% | **IMPOSSIBLE** | — | (145 days) | — |
| **1B** | 2.54 TB | 606% | **IMPOSSIBLE** | — | (4.0 yr) | — |

### B. All-in per genuinely new user — 5,983 B (registry + their Antelope account)

| users | total RAM | % of entire supply | Bancor cost (incl. fee) | USD | avg per user |
|---|---:|---:|---:|---:|---:|
| **10k** | 59.8 MB | 0.014% | 19,803 A | $1,287 | 1.98 A / $0.129 |
| **1M** | 5.98 GB | 1.43% | 2,147,504 A | $139,600 | 2.15 A / $0.140 |
| **10M** | 59.8 GB | 14.3% | **92,422,513 A** | **$6.01M** | 9.24 A / $0.601 |
| **100M** | 598 GB | 143% | **IMPOSSIBLE** | — | — |
| **1B** | 5.98 TB | 1,428% | **IMPOSSIBLE** | — | — |

**Read the IMPOSSIBLE rows literally.** 100M users needs 254 GB (or 598 GB all-in) of RAM; **76.13 GB exists to be bought, total, for everyone on the chain**. 100M is 3.3× the entire free pool; 1B is 33×. These are not expensive — the bytes do not exist at any price. Spending the *entire* 2,100,000,000 A token supply buys 75,226,979,221 bytes = 98.82% of the pool and no more; the last 1.18% is unpurchasable by anyone, ever, at current reserves.

Note also what row B/10M means: 92.4M A is **3.7× the entire quote reserve** and 4.4% of all A in existence. That trade would roughly quintuple the RAM price for the whole chain. It is arithmetically legal and economically a market-break.

CPU never appears in any of this as a constraint. At the measured chain state (2.78% PowerUp utilization, 0.8% block CPU fill, ~99% idle), 1B registrations × 5 ms = 5.0M CPU-seconds ≈ 145 days of a 10%-of-chain rental at ~$53/day ≈ **$7,700 total**. NET is 10× further from binding than CPU. **RAM binds roughly 80× before CPU does.**

---

## 4. Where the wall is

**RAM supply binds first, and it binds at ~12.7 million all-in users — not 100M, not 1B.** 76,128,906,582 free bytes ÷ 5,983 B = **12,724,536 users**, and that is the arithmetic ceiling at infinite price; the whole-token-supply ceiling is 12,573,788. Counting registry rows only (users who already hold Antelope accounts) the ceiling is 30,007,452. But the *price* wall arrives far earlier than the *supply* wall: at 10M all-in users you have consumed 78.6% of the free pool and the marginal byte costs ~28× what it costs today. The practical planning ceiling is **~1–3M users**, where cost stays under ~$150k–$500k and the pool stays under 8% consumed. Three facts make this worse rather than better: (a) `new_ram_per_block = 0` — a single `eosio::setramrate` at block 347,215,548 on 17 Dec 2023 switched RAM inflation off, so supply has been **frozen for 2.5 years** and there is no organic growth to wait for; (b) raising `max_ram_size` requires a **15-of-21 block producer multisig** (`eosio@active` → `eosio.prods@active`, threshold 15, verified on chain) with no schedule and no token-holder path; (c) even if BPs voted, the historic drip rate was 1,024 B/block ≈ 64.6 GB/year, so minting the 2.54 TB that 1B users need would take **39 years**, and the resulting 2.88 TB `max_ram_size` would have to be held in physical memory by every one of the 21 producers, because Antelope state is a `chainbase` mmap. WAX said this out loud in its 2024 roadmap — a billion accounts is "pivotal" work on the resource model, not a RAM purchase. **The answer to "can we buy our way to 1B?" is no, and the constraint is residency, not money.**

---

## 5. What "users pay to deploy" actually costs them

At today's price, per user: **$0.055** for the registry rows, **$0.129** all-in with a fresh account. Add CPU/NET via PowerUp: ~0.0007 A ≈ **$0.00005**. Call it **13 cents to onboard**, mostly account creation, not `.b`.

That number does not hold. The Bancor curve means **the price per byte rises monotonically as the pool is consumed, and every user pays the price set by everyone before them.**

Marginal cost of the same 2,537-byte registry footprint, as a function of how much of the pool has already been taken:

| the user registering at position… | marginal RAM price (A/byte) | their 2,537 B costs | vs. user #1 |
|---|---:|---:|---:|
| #1 | 0.00032907 | 0.839 A / **$0.055** | 1.00× |
| #10,000 | 0.00032929 | 0.840 A / $0.055 | 1.00× |
| #1,000,000 | 0.00035215 | 0.898 A / **$0.058** | 1.07× |
| #10,000,000 | 0.00074023 | 1.887 A / **$0.123** | **2.25×** |
| #20,000,000 | 0.0029587 | 7.545 A / **$0.490** | **9.0×** |
| #29,000,000 | 0.29194 | 740.6 A / **$48.13** | **877×** |
| #30,007,452 | ∞ | — | ∞ |

**State this plainly, because it is a fairness problem and not a rounding error.** In a fixed-supply Bancor market, early adopters buy a scarce good cheap and late adopters buy the same good dear, for identical utility. The last million users before the wall pay two to three orders of magnitude more than the first million for the same `.b` name and the same eleven addresses. Under a strict "no subsidy, users pay" rule, this is not a policy choice you make — it is the automatic consequence of the resource model, and it is regressive against exactly the users you most want (the late, mainstream ones).

Worse, the price is not yours to control. It moves with *total chain* consumption, not `.b` consumption. `total_ram_bytes_reserved` is already at **81.83% of `max_ram_size`**. If any other application consumes the remaining 18% before you do, `.b` registration price goes vertical without a single `.b` name being registered. You do not own your cost curve.

The known experiment on the other side is WAX: a 5 WAXP account-creation fee introduced in Q1 2022 produced an ~81–85% YoY collapse in new addresses, from ~10,000/day to ~4,000/day, and it never recovered. A price gate on account creation cost them essentially all of their growth. That is the risk of a strict user-pays model at the price point above, and it gets more acute as the price rises.

Two honest mitigations, neither of which is a subsidy: **shrink the footprint** (below), and **decouple the price from the pool** by not holding per-user rows on chain at all.

---

## 6. The architecture that reaches 1B

**Recommended: hybrid — on-chain ownership tier + CCIP-Read-style off-chain resolution with owner-signed responses.**

Rejected, one line each:

- **Buy RAM, change nothing** — zero code change, and physically impossible past ~12.7M users; the bytes do not exist and cannot be minted at the required rate.
- **Merkle commitment + Arweave/Autonomi/IPFS** — cheapest on-chain, but Merkle inclusion cannot prove *deletion*: a stolen or corrected address keeps proving valid for a full epoch, which for a fund-routing registry is a loss class, not an inconvenience. Also breaks live `expires` and moves first-come name allocation to a censorable off-chain sequencer.
- **Off-chain everything, no on-chain tier** — reaches any scale and forfeits `require_auth(owner)`, which is the contract.

**The recommended shape:**

- **Tier 1 (on-chain, paid):** the `domains` row stays. Ownership, expiry, first-come allocation, and `release`/`transfer` remain enforced by `require_auth`. Cost after the trims below: **~155 B/user** → ~490M theoretical, ~1–3M practical at sane RAM prices. This is the premium/anchor tier.
- **Tier 2 (off-chain, free):** address records move behind a `resolvers` table — `{uint32 resolver_id; std::string gateway_url; public_key signer; uint32 ttl;}` — with a `uint32 resolver_id` on `domain`. The gateway returns `{domain, chain_key, address, addr_type, memo_tag, issued_at, expires_at, nonce}` plus a K1/R1 signature; the client verifies against the on-chain pubkey. A few dozen resolver rows serve unbounded users. **Marginal on-chain cost per Tier-2 record: 0 bytes.**

Why this and not the Merkle option: **freshness is native.** Signed responses carry timestamp and nonce, deletion is instant (the gateway stops signing), revocation and mid-epoch correction work. That is exactly the set of properties commitments break, and exactly why ENS landed here.

Two things you lose, stated honestly. First, trust moves from a hash to a live hot key — the gateway can sign any address for any name it serves. Mitigation is structural and must be designed in from day one: `resolver_id` and `signer` settable **only** under `require_auth(owner)`, never admin, or you violate I‑2 ("the registry cannot mutate a user's records"), which is currently `[LIVE]`. Second, the `requires_memo` guard at `bdomain.cpp:205-208` — the only structural defense against the XRP/XLM destination-tag silent-loss class — becomes *promised* rather than *enforced* for Tier 2. Keep `chainkeys` on chain as the policy source and make the client library check it, but do not claim it is enforced when it is not.

**Even so: 1B users does not mean 1B Antelope accounts.** 1B × 3,450 B = 3.45 TB = 8.2× `max_ram_size`. The only architecture that reaches a billion is one where a `.b` identity is **a keypair, not an account** — the vast majority of users never hold an on-chain account, and only those who anchor or pay take a row. This is precisely the ENS outcome: ~2.8M paid L1 names alongside ~5M+ free off-chain names (Basenames ~2.7M, uni.eth >2M) — split by unit economics, not by count. Plan for that split explicitly.

**Does the deployed contract evolve or get replaced? It evolves.** `domains`, `config`, the auth machinery, collision guards, expiry, and `cleanup` all survive. The `chainaddrs` half is replaced — `setchain`, `delchain`, `chain_addr_table`, `MAX_CHAINS_PER_DOMAIN`, and all four drain loops (`bdomain.cpp:70-73, 114-117, 171-174, 400-403`) become dead, along with six `chain_addr_table` construction sites (69, 113, 170, 219, 331, 399). Roughly **60% of `bdomain.cpp` is reusable**.

**What happens to the 13 names already registered: nothing bad, and this is the window.** Adding `resolver_id` to the `domain` struct changes the serialized row layout — existing rows will not deserialize against a longer struct. That is a migration. **At 13 rows the migration is a handful of actions and costs under a dollar. At 13,000 rows it is a project. At 13 million it is not possible.** The 13 names stay live as Tier 1, get re-emplaced with the new struct, and never notice.

---

## 7. What to do now

Ordered by cost-of-delay, not by importance.

1. **Do the schema migration this week, while there are 13 rows.** This is the only item with a hard expiry. In one change:
   - add `uint32 resolver_id` to `domain`
   - **drop the `byowner` secondary index** (`bdomain.hpp:117-121`) — **128 B/user, 45% of the domains row**, for a reverse lookup that is an indexer's job
   - **drop `chain_addr::domain_id`** (`bdomain.hpp:161`) — 8 B × 11 = 88 B/user storing a value that *is* the table scope
   - **replace `chain_addr::chain_key` (string) with a `uint16` ordinal** into the 11-row `chainkeys` table — ~132 B/user spent defending a 64-bit FNV-1a collision that an ordinal eliminates outright
   - delete the dead `chain_addr::by_domain()` (`bdomain.hpp:169`, never passed to the multi_index template — costs 0 bytes, but it is a trap)

   Combined saving: **~348 B/user, 13.7% off 2,537** — and ~128 B/user off the Tier-1 row, taking it from 283 to 155. Free today; unbuyable later.

2. **Before public registration opens — close the two economic holes.** Decide whether registration costs money: either wire `registration_fee` to an `on_notify` transfer handler, or delete the dead field and state that registration is free. Add a `max_domains` cap in `config` with a check in `registeracc`. Right now there is no fee, no cap, and no rate limit; the day third parties can call `registeracc` is the day RAM exhaustion becomes an attack, not a metric.

3. **Fix `transfer`.** `bdomain.cpp:108` re-bills the domain row to `from`. Require `to`'s auth (or add propose/accept) and make `to` the payer. Currently a transferee never assumes the cost of the domain they now control.

4. **Seed `requires_memo` correctly.** The live `chainkeys` rows have `requires_memo = 0` for **both** `slip44:144` (XRP) and `slip44:148` (XLM). The memo guard at `bdomain.cpp:205-208` is therefore inert for exactly the destination-tag chains it was written to protect, and both live address rows carry `memo_tag = ""`. This is a data-seeding bug in `addchainkey`, not a modeling error, and it is a live funds-loss exposure today at 13 names. Fix it before you fix anything about scale.

5. **Add a `by_expires` index to `domains` — decide now, because it costs 128 B/row and a second `table_id_object` (+112 one-time).** Without it, `cleanup` can never reclaim at scale; with it, every domain row grows. At Tier-1-only volumes (~1–3M) the index is affordable and the reclamation is worth it. At mass volumes it is not, and you rely on an off-chain indexer. This is a real trade and it should be made deliberately, not by omission.

6. **Buy nothing per user, ever.** BNR funds only the contract's own footprint: currently 442,099 bytes used against a 3,035,677-byte quota — 2.59 MB of headroom, ~7× the contract, no purchase needed. Rent CPU via PowerUp: 10% of the entire chain is **809 A/day ≈ $53/day**, which is more than `.b` will ever need. CPU and NET are, economically, free on this chain and should not appear in any budget conversation.

7. **Then build Tier 2.** Resolver contract, gateway, signing scheme, client verification library, and the `chainkeys` policy check on the client side. This is the only work that changes the ceiling; everything above just stops the ceiling from arriving early.

**The honest expectation, in one line:** on the deployed architecture, `.b` comfortably serves **1 million** users for ~$56k of RAM, painfully serves **10 million** for ~$818k while consuming a third of all purchasable RAM on the chain, and **cannot serve 100 million or 1 billion at any price** — not because it is expensive but because roughly 76 GB is all the RAM that exists to be bought, the supply has been frozen since December 2023, and unfreezing it requires 15 of 21 block producers to vote to make every one of their machines hold terabytes in memory.
