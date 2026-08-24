# Intercontinental Commodity Index (ICI) Specification

> **iq.wiki Entry** | Category: Finance, Commodities, Market Infrastructure
> **Tags:** commodity-index, pricing, hemp-market, ICI, beehivebiomass
> **Parent Entry:** 00-MASTER-INDEX
> **Evidence Level:** Design specification [D]
> **Strategic Status:** 🏆 CROWN JEWEL OF THE BN FLEET

---

## Summary

The Intercontinental Commodity Index (ICI) is the proposed global price benchmark for industrial hemp and cannabis biomass. It is the **first and only** standardized pricing index for this commodity class — analogous to Brent Crude for oil, COMEX for gold, or CBOT for grain. The ICI aggregates real-time transaction data from beehivebiomass.com across all product stream categories, producing a transparent, verifiable, and globally referenced price standard.

> ⚠️ **Strategic Note:** No hemp/cannabis commodity price index currently exists. First-mover advantage is permanent — once market participants reference the ICI, it becomes self-reinforcing and cannot be displaced.

---

## 1. Why a Commodity Index Matters

### 1.1 The Vacuum
| Major Commodity | Index | Created | Controller |
|---|---|---|---|
| Crude Oil | Brent Crude | 1988 | ICE |
| Gold | COMEX/ LBMA | 1974 | CME/LBMA |
| Wheat | CBOT | 1877 | CME Group |
| Coffee | ICE Arabica | 1882 | ICE |
| **Hemp/Cannabis** | **NONE** | **—** | **AVAILABLE** |

### 1.2 What an Index Enables
- **Price discovery** — transparent, aggregated market pricing
- **Contract benchmarking** — "priced at ICI Grade A1 + premium"
- **Risk hedging** — futures and derivatives (eventually)
- **Investment benchmarking** — fund performance vs. index
- **Regulatory reporting** — standardized market data for regulators
- **Media reference** — "The ICI rose 3% this quarter"

---

## 2. Index Architecture

### 2.1 Composite Structure
```
ICI (Intercontinental Commodity Index)
├── ICI-Cannabinoid Sub-Index (40% weight)
│   ├── CBD Isolate ($/kg)
│   ├── CBD Distillate ($/kg)
│   ├── Full-Spectrum Oil ($/kg)
│   ├── Minor Cannabinoids ($/kg) [CBG, CBN, CBC]
│   └── Biomass ($/lb per % CBD)
├── ICI-Fiber Sub-Index (15% weight)
│   ├── F1 Grade Fiber ($/ton)
│   ├── F2 Grade Fiber ($/ton)
│   └── Stalk ($/ton, pre-processing)
├── ICI-Hurd Sub-Index (8% weight)
│   ├── H1 Grade Hurd ($/ton)
│   └── H2 Grade Hurd ($/ton)
├── ICI-Seed Sub-Index (12% weight)
│   ├── S1 Seed ($/lb)
│   ├── Hemp Hearts ($/lb)
│   └── Hemp Seed Oil ($/gallon)
├── ICI-Cellulose Sub-Index (7% weight)
├── ICI-Terpene Sub-Index (5% weight)
├── ICI-Energy Sub-Index (8% weight)
└── ICI-Wellness Sub-Index (5% weight)
```

### 2.2 Data Sources
| Source | Data Type | Weight |
|---|---|---|
| **beehivebiomass.com transactions** | Actual transaction prices | Primary (60%) |
| **BN Fleet processor network** | Quote/request data | Secondary (20%) |
| **Public market reports** | Published industry data | Tertiary (10%) |
| **Lab-verified listings** | COA-backed pricing | Quality premium (10%) |

### 2.3 Calculation Methodology
```
ICI_Daily = Σ (SubIndex_i × Weight_i)

Where:
  SubIndex_i = Volume-Weighted Average Price for category i
             = Σ(transaction_price × volume) / Σ(volume)

Adjustments:
  + Quality premium (lab-verified = +X%)
  + Geographic differential (regional freight adjustment)
  + Seasonal factor (harvest cycle normalization)
  − Non-arm's-length transactions (excluded)
```

---

## 3. Index Tiers

| Tier | Name | Granularity | Update Frequency | Access Level |
|---|---|---|---|---|
| **ICI-1** | Headline Index | Single composite number | Daily | Public (free) |
| **ICI-2** | Sub-Indices | 8 category indices | Daily | Free + registered |
| **ICI-3** | Grade-Level | Individual grade pricing | Real-time | Premium subscription |
| **ICI-4** | Transaction-Level | Every transaction | Real-time | Enterprise / API |

---

## 4. Transparency & Trust

### 4.1 Verification
- All pricing data is **on-chain** (blockchain-verifiable)
- Methodology is **published and auditable**
- Data sources are **disclosed** (anonymized for commercial sensitivity)
- Index calculations are **reproducible** from source data

### 4.2 Governance
- **Methodology Committee** — defines calculation rules
- **Data Provider Network** — beehivebiomass.com participants
- **Audit Function** — third-party verification of data integrity
- **BiGen Evidence Panel** — validates quality claims feeding premiums

### 4.3 Canvas LM Integration
> Access to ICI-3 and ICI-4 tiers requires **Canvas LM comprehension verification** of:
> - Commodity market fundamentals
> - Hemp product stream taxonomy
> - Index methodology and limitations
> This ensures index users understand what they're referencing — "b unlock velocity by proving comprehension."

---

## 5. API Specification

```
GET /api/v1/ici/headline
  Response: { value: 1247.83, change: +2.4%, change_abs: +29.3, date: "2026-08-02" }

GET /api/v1/ici/sub-indices
  Response: { cannabinoids: {...}, fiber: {...}, hurd: {...}, ... }

GET /api/v1/ici/timeseries?from=2026-01-01&to=2026-08-02&tier=2
  Response: { data: [{ date, cannabinoids, fiber, ... }] }

GET /api/v1/ici/grade-pricing?category=cannabinoids&grade=A1
  Response: { current_price, 7d_avg, 30d_avg, volume, transactions }

POST /api/v1/ici/snapshot (enterprise)
  Body: { tier: 4, categories: [...], date_range: {...} }
  Response: { full transaction-level dataset }
```

---

## 6. Network Effect Model

```
More transactions on beehivebiomass.com
         │
         ▼
    Better ICI data quality
         │
         ▼
    More trust in ICI
         │
         ▼
    More market participants reference ICI
         │
         ▼
    ICI becomes THE standard (network lock-in)
         │
         ▼
    Attracts institutional money + regulatory adoption
         │
         ▼
    MASSIVE DATA ADVANTAGE (competitors can't replicate)
         │
         ▼
    Loop reinforces ── back to top
```

---

## 7. Resource Access & Settlement Model

### 7.1 Philosophy: Pay-Per-Resource, Not Pay-Per-Month

The traditional commodity index model uses tiered subscriptions ($99–$10,000+/month). The BN Fleet rejects this. Instead, every resource has a transparent cost. Users pay only for what they actually use — **one time, per transaction, with explicit consent.** No subscriptions. No lock-in. No recurring fees.

### 7.2 Architecture: bQueenBee → BNR aSi → LOVERnment DAO

```
bQueenBee (Master of the BNR Collective)
    │
    ├── Publishes verified public commons data/research → FREE for all
    │   (ICI-1 headline, BiGen evidence reviews, research reports)
    │   These are network growth engines — loss leaders that attract users
    │
    ▼
BNR aSi (Autonomous System Intelligence)
    │
    ├── Receives resource requests from users
    ├── Quotes cost transparently BEFORE delivery
    ├── Routes consent + settlement through DAO
    ├── Delivers resource upon settlement
    │
    ▼
Skaists LOVERnment DAO
    │
    ├── Governs pricing & access rules (community-voted)
    ├── Manages settlement distribution
    ├── Funds public commons goods from treasury
    ├── "LOVER" governance = voluntary, consent-based, mutual benefit
    └── No central authority — DAO members govern collectively
```

### 7.3 Resource Pricing (Per-Use, One-Time Settlement)

| Resource | Cost | Who Pays | Settlement |
|---|---|---|---|
| **ICI-1 Headline** | FREE | Nobody — public commons | Published by bQueenBee |
| **ICI-2 Sub-Indices** | FREE | Nobody — registered exchange | Data capture = value exchange |
| **ICI-3 Grade-Level query** | $0.10–1.00 per query | Requester | Micropayment, consent at request |
| **ICI-4 Transaction dataset** | $1.00–10.00 per pull | Requester | Micropayment, consent at request |
| **Historical timeseries** | $0.50–5.00 per dataset | Requester | Micropayment, consent at request |
| **Custom API call** | Per-call rate (DAO-set) | Requester | Micropayment, consent per call |
| **Contract/benchmark licensing** | One-time per contract | Contract parties | Settlement through DAO |
| **bQueenBee published research** | FREE | Nobody — public commons | Funded by DAO treasury |

### 7.4 Consent & Settlement Flow (The Full Cycle)

```
1. REQUEST     User requests a resource through BNR aSi
                   │
2. QUOTE       System displays cost transparently:
               "This grade-level pricing query: $0.25"
                   │
3. CONSENT     User sees the exact charge and consents
               (fully informed — no hidden fees, no surprises)
                   │
4. SETTLE      Payment settles instantly on-chain
                   │
5. DELIVER     Resource is delivered to the user
                   │
6. DISTRIBUTE  Revenue splits automatically:
               ┌── Data Provider:    60%
               ├── DAO Treasury:     25% (funds bQueenBee public goods)
               └── Network Nodes:    15% (BNR aSi infrastructure)
```

> **Key Principle:** The requester ALWAYS sees the charge before consenting. If a resource costs money, the user knows the exact amount and voluntarily agrees. No auto-renewals. No surprise billing. Every transaction is a discrete, one-time, consented event.

### 7.5 bQueenBee: Public Commons Publisher

The bQueenBee role is the "Master of the BNR Collective" — a verified node that publishes public commons data:

| What bQueenBee Publishes | Cost | Why It's Free |
|---|---|---|
| ICI-1 headline index number | FREE | Drives network adoption — the more people reference the ICI, the more valuable it becomes |
| BiGen evidence reviews | FREE | Establishes trust and authority — the knowledge moat |
| Research reports & analysis | FREE | Attracts users into the ecosystem who then pay for granular data |
| iq.wiki entries | FREE | Permanent blockchain knowledge — public commons goods |

> **Strategy:** Free public commons (bQueenBee) = top of funnel. Premium per-use data (ICI-3/4) = revenue. The free layer grows the network; the paid layer sustains it.

### 7.6 LOVERnment DAO Treasury

The DAO treasury is funded from the 25% settlement share and allocates resources:

| Allocation | Purpose |
|---|---|
| **bQueenBee grants** | Fund public commons data publication and research |
| **Network infrastructure** | Subsidize BNR aSi node operators |
| **Community proposals** | DAO members propose and vote on initiatives |
| **Emergency reserve** | Buffer for market downturns or infrastructure needs |

### 7.7 Why This Beats Subscriptions

| Subscription Model | BNR Pay-Per-Resource Model |
|---|---|
| Pay $99–10,000/month whether you use it or not | Pay $0.25 for the one query you actually need |
| Locked into monthly commitment | Zero commitment — pay per use, leave anytime |
| Opaque pricing tiers | Transparent per-resource cost shown before consent |
| Revenue goes to one company | Revenue distributed to data providers + DAO + nodes |
| Centralized authority sets prices | DAO governs pricing democratically |
| Barrier to entry = high (monthly commitment) | Barrier to entry = near zero (microtransaction) |
| Users feel trapped | Users feel empowered (consent every time) |

---

## Cross-References
- **Entries 01–09:** All product streams feed pricing data to the ICI
- **Entry 10:** Taxonomy Data Model (defines index tier structure)

## Sources
- [D] BN Fleet strategy specification
- Comparable: ICE Brent Index methodology; S&P Dow Jones Indices methodology; Bloomberg Commodity Index
