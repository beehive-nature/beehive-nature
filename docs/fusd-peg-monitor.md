# fUSD Peg Health Monitor

**Owner:** Cowork (research lane) · **Cadence:** weekly · **Consumes:** public data only
**Why this exists:** every escrow denominated in fUSD carries peg risk for its *entire*
duration — from `BuyerFunded` to `BuyerReleased`/`Refunded`. Two independent things can
break an escrow's value, and both are publicly observable, so we watch both on a schedule
rather than on a hunch:

1. **Solvency** — is fUSD still over-collateralized? (collateral reserve ratio)
2. **Exit liquidity** — can an escrow-sized position actually be converted ZANO⇄fUSD
   without punishing slippage? (DEX depth + volume on the ZANO/fUSD pair)

This turns "monitor the peg" from an intention into a mechanism — the same upgrade the
secret scan got.

---

## The two tracked numbers

### 1. Collateral reserve ratio
Definition used here: **audited ZANO reserve value ÷ outstanding fUSD liabilities.**
fUSD is over-collateralized by design (initial buffer cited as >10× at launch), so a ratio
trending toward 1.0 is the solvency danger signal.

**Canonical source, in priority order:**
- **freedomdollar.com** reserve/transparency page — the *auditable reserve wallet* is the
  authoritative figure. Read this first; it overrides everything below.
- On-chain: the public reserve wallet balance in ZANO × ZANO/USD price ÷ fUSD supply.
- Aggregators (CoinGecko / CoinMarketCap) — **fallback only**, and only for price.

> **Baseline flag (2026-07-04):** secondary sources disagree wildly on the current ratio
> — 1.18×, 1.79–1.88×, "2:1", and >10× (launch) all appear in circulation. **Do not
> trust these.** The monitor's first job each week is to pin the single authoritative
> number from the freedomdollar.com reserve page and record it below. If that page ever
> stops publishing the ratio, that opacity is itself an Amber signal.

### 2. DEX liquidity & volume (ZANO ⇄ fUSD)
Escrows must be exitable. Track, from **trade.zano.org** (Zano Trade DEX):
- 24h and 7-day traded volume on the ZANO/fUSD pair.
- Order-book depth: how far price moves to fill an **escrow-sized** order. Define
  "escrow-sized" as the **largest currently-open escrow's fUSD notional** (pull from the
  escrow-engine state; until live, use a $5,000 placeholder matching the demo escrow).

---

## Danger-zone thresholds

| Metric | 🟢 Green | 🟡 Amber (watch) | 🔴 Red (act) |
|---|---|---|---|
| Peg (fUSD/USD) | within ±0.5% of $1 | 0.5%–2% off, or brief excursions | >2% off, sustained >24h |
| Collateral ratio | ≥ 1.5× | 1.2×–1.5×, **or ratio falling >10% week-over-week** | < 1.2×, or reserve page goes dark |
| DEX exit (escrow-sized) | fills within 1% slippage | 1%–2% slippage, **or weekly volume down >40% WoW** | >2% slippage to exit one escrow-sized order |

Any single **Red**, or two simultaneous **Amber**, is a founder-attention flag: pause new
fUSD-denominated escrow creation until it clears. (Existing escrows are already exposed —
this gates *new* risk, it can't unwind old.)

---

## Baseline snapshot — 2026-07-04

| Metric | Reading | Source | State |
|---|---|---|---|
| fUSD price | **$0.9992** | CoinGecko / CoinMarketCap | 🟢 (0.08% off peg) |
| fUSD 24h volume | **~$326,976** | CoinMarketCap | — |
| ZANO price | **$9.18** | CoinMarketCap | — |
| ZANO 24h volume | **~$1,164,085** | CoinMarketCap | — |
| Audited ZANO reserves | **recently passed ~$10M** | freedomdollar.com (secondary report) | 🟡 pending canonical read |
| Collateral ratio | **UNRESOLVED** — sources disagree (1.18×–10×) | needs freedomdollar.com reserve page | 🟡 pin next run |
| ZANO/fUSD DEX depth | not yet measured | trade.zano.org | ⬜ establish next run |

**Read of the baseline:** peg itself is healthy and tight. The open questions are the
*canonical* collateral ratio (the reported 1.18× low end would already sit in Amber/Red,
so confirming the real number is the priority) and a first depth measurement on the DEX
pair. Neither is alarming yet; both are exactly why the weekly mechanism exists.

---

## Weekly log
_Append one row per run. Compare each metric to the prior row; flag any state change or a
>10% move in the ratio / >40% move in weekly volume._

| Date | fUSD price | Collateral ratio (canonical) | ZANO/fUSD 7d vol | Exit slippage (escrow-sized) | Overall | Notes |
|---|---|---|---|---|---|---|
| 2026-07-04 | $0.9992 | unresolved — pin from source | — | — | 🟡 setup | Baseline; secondary ratio sources conflict, canonical read pending |

---

## Methodology (for each weekly run)
1. Read the freedomdollar.com reserve/transparency page → record the **canonical**
   collateral ratio and reserve total. If absent, mark Amber and note it.
2. Read fUSD and ZANO price + 24h/7d volume (CoinGecko/CMC).
3. Read trade.zano.org for ZANO/fUSD depth; estimate slippage to exit one escrow-sized order.
4. Append a row to the Weekly log; compare to prior week; set 🟢/🟡/🔴 per the thresholds.
5. If any Red or double-Amber, surface a founder-attention flag at the top of the run output.

_Not financial advice; this tracks public solvency/liquidity signals to gate operational
risk, not to value the asset._

Sources: [freedomdollar.com — how it works](https://www.freedomdollar.com/en/how-it-works) ·
[Freedom Dollar on CoinGecko](https://www.coingecko.com/en/coins/freedom-dollar) ·
[Freedom Dollar on CoinMarketCap](https://coinmarketcap.com/currencies/freedom-dollar/) ·
[Zano on CoinMarketCap](https://coinmarketcap.com/currencies/zano/) ·
[Zano Trade DEX](https://trade.zano.org/dex) ·
[Zano Trade docs](https://docs.zano.org/docs/use/zano-trade/)
