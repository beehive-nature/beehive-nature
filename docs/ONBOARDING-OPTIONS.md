# USER ONBOARDING OPTIONS — the full menu, priced
### Every route a person can take onto the BNR surface, with measured costs and gates

Date: 2026-07-26. Reads with `VERIFIED-FACTS.md` (A38 especially) and
`ROADMAP-RESET-2026-07-26.md` §1.

**Price basis used throughout:** HIVE ≈ **$0.049** (CoinGecko/CMC spot,
2026-07-26 — volatile, secondary source, refresh before any budgeting).
`account_creation_fee` = **3 HIVE ≈ $0.15/account** — stated by the official
Hive developer portal's account-creation recipe; the fee is a witness-voted
median parameter, so confirm from live config before committing budget:

```bash
curl -s -X POST https://api.hive.blog -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"condenser_api.get_chain_properties","params":[],"id":1}'
# → .result.account_creation_fee
```

(The Cowork sandbox proxy 403s Hive API nodes — this must run from a seat with
chain access. The code seat has it; `rc_api.get_rc_stats` ran from there.)

---

## The five options

### Option 1 — Sponsored, fee-paid: `account_create` at 3 HIVE
**Available today. The practical default.**

Treasury pays 3 HIVE (≈ $0.15) per account via `account_create`. Linear cost,
no stake requirement, works at 383 HP.

- 10 users ≈ 30 HIVE ≈ $1.47 · 100 users ≈ 300 HIVE ≈ $14.70 · 1,000 users ≈ 3,000 HIVE ≈ $147
- Requires **Active** authority → route it through the **hopper**, exactly like
  power-ups: pipeline delivers HIVE to `@hopper`, hopper pays creation fees.
  The treasury Active key stays cold. Same float-only blast radius.
- **Fee mechanics (closed 2026-07-26, tier-1 — A41–A43):** the fee is confirmed
  `"3.000 HIVE"` from live chain config. It is **burned** to `@null` — Option 1
  is a cost, not a transfer — but its value converts into the new account's
  `max_rc_creation_adjustment`, a built-in RC floor the account keeps. So
  fee-created accounts arrive already able to transact; the `delegate_rc`
  top-up (Posting key, A5) becomes optional headroom, not a prerequisite.
- **Daemon requirement (A43):** post-HF20 the fee must be **exact** — over- or
  under-payment fails the transaction, and the fee is a witness-voted median
  that can move. The hopper must read `get_chain_properties` before every
  `account_create`. Never hardcode 3 HIVE.

### Option 2 — Sponsored, RC-paid: ACT claims
**Dead at current stake. Alive at ~6,560 HP, and only as a drip.**

A38: one `claim_account` = ~10.6T RC ≈ 17× the treasury's entire bar at 383 HP.
At ~6,560 HP (~6,180 more HIVE ≈ **$303** at spot) you afford ~1 claim per
regen cycle. Break-even vs Option 1: **~2,060 accounts** — and Option 1's spend
is pay-as-you-grow while this is capital up front.

Not a near-term route. But note the stake compounds with everything else HP
does (RC for anchors, governance weight, curation), so HP accumulated for other
reasons drifts this option toward viability for free. Revisit at each pipeline
top-up, don't pursue directly.

### Option 3 — Externally created account + treasury RC delegation
**Cheapest sponsored-adjacent route. Near-zero marginal cost.**

User gets their account from an existing free onboarding service (hiveonboard,
Ecency, Peakd's flows — they spend their own ACTs), then BNR delegates RC via
`delegate_rc`:

- Posting-key operation (A5) — no Active key, no hopper, no funds moved
- `delegatees` is a set (A8) — provision a whole cohort in one broadcast
- Cost: custom_json RC only. Effectively free at any scale
- Trade-offs: dependency on third-party onboarding UX (a fence-friendly one —
  BNR never touches the account creation), and users arrive with keys already
  in hand, which is *better* for the custody story
- A40 discipline applies: query delegation state before any revoke

### Option 4 — Bring-your-own-account
**Free. Zero-cost tier for existing Hive users.**

Existing Hive users connect via Keychain. No treasury cost, no creation, no
delegation unless their RC is thin (then Option 3 tops them up). The surface
work is pure client-side: Keychain auth + posting flows. Should exist in any
scenario as the baseline tier.

### Option 5 — Lite accounts (no on-chain account)
**Free per user. The up-to-the-fence custodial pattern.**

Users interact through the BNR surface without an on-chain account; their
actions post through a BNR community account with per-user attribution in
`custom_json` payloads (A24: 32-char id, 8KB — ample). Later, "graduate" a lite
user to a real account via Options 1 or 3, migrating attribution.

- Zero marginal chain cost; smoothest first-touch UX (no keys day one)
- **bACCORD check:** this is custody of *identity*, not funds — but it's the
  closest option to the fence. If lite accounts ever hold value (b-token
  balances?), it crosses into custodial territory. Rule on it before shipping,
  not after.

---

## The decision shape

These aren't competitors — they're **tiers of one funnel**:

```
visitor ──▶ Option 5 (lite, instant, keyless)
                │  graduates when they want keys/value
                ▼
        Option 3 (external create + RC delegation)   ← default graduation path
        Option 1 (fee-paid create via hopper)        ← when hand-holding matters
                │
                ▼
        Option 4 (BYO — power users arrive here directly)

        Option 2 (ACT) — dormant; auto-revisit as HP grows past ~6.5k
```

The funnel needs, in build order: Keychain auth (serves 3+4), the lite-account
attribution schema (serves 5), and hopper-routed `account_create` (serves 1 —
reuses D-06 plumbing wholesale).

**What this costs at plausible scale:** first 100 users ≈ $15 worst case (all
Option 1), ≈ $0 if Options 3/5 carry most of it. Onboarding cost is not a
constraint at any scale below thousands — **the constraint is build effort on
the surface, which is exactly where the effort should go.**

---

## Ledger deltas from this document

- ~~3 HIVE fee: corroborated tier-4~~ **Promoted** — A41 (live config,
  single-node read), A42 (burn + RC floor, evaluator source), A43 (exact-fee
  requirement). B16/B17 closed by the code seat.
- HIVE spot ≈ $0.049 (secondary, volatile — never an A-row, always a footnote).
- **B3 (Coinbase LN API): still unresolved.** Targeted search found Strike and
  ZeroHash BOLT11 API docs but nothing Coinbase-specific. Next step is
  Coinbase's own developer docs, authenticated. Leg 2 stays manual.
- **B4 (v4v.app API): probe failed** — `api.v4v.app` unreachable from this
  sandbox (blocked or absent). Unchanged action: ask `@brianoflondon`.
- New open item: destination of the 3 HIVE `account_create` fee (Option 1).

## Sources

- [Hive Developer Portal — account creation process](https://developers.hive.io/tutorials-recipes/account-creation-process.html)
- [CoinGecko — HIVE](https://www.coingecko.com/en/coins/hive) · [CoinMarketCap — HIVE](https://coinmarketcap.com/currencies/hive-blockchain/)
- `VERIFIED-FACTS.md` A5, A8, A24, A38–A40
