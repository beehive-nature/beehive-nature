# RECEIPT · the storage cost debate, measured — HDD vs cloud vs Autonomi, honest in every direction

**Provenance:** founder-relayed Discord debate (Shu's amortization vs Flying Shroom's
HDD case), 2026-08-22. Fleet: 6 agents + adversarial verify, 138 source fetches
(wf_67fe2827-4fc). Every number below is vendor-published or chain-derived, dated
2026-08-22 unless noted. **The estate's stake is declared up front: we build on
Autonomi AND Arweave — and this receipt corrects the pro-Autonomi numbers first.**

## 1 · The corrections, both directions (the diligence section)

- **Shu's "~20 ANT (~$0.80)/GB" is the ANT-store component only.** All-in with
  Arbitrum gas: **$1.27–1.50/GB** (ant.report header badge, 7-day/1-hr windows) —
  roughly **1.8–2× the quoted figure**. His $956 all-time figure is confirmed but is
  *USD-when-paid*, not current value ($683 at today's ANT).
- **Flying Shroom's "$820/TB" is therefore also low** — all-in is ~$1,270–1,500/TB
  today. But his **"$100 HDD ≈ forever" fails its own manufacturers' datasheets**
  (§3): the comparison is real, the "forever" is not.
- **The network's price is not static:** cost/GB climbed from an all-time average of
  5.91 ANT to ~19.7 ANT — the documented quadratic fullness term
  (`BASELINE + K × (n/D)²`). Empty nodes joining pushes it DOWN; fullness pushes it
  UP. Any single number without a date is already wrong.
- **Replication discrepancy, unresolved and named:** official docs say close-group
  size **5**; ant.report divides raw bytes by **7**. We assert no single number.

## 2 · Cloud, vendor-published (all verified against live pages / AWS Price List API)

| lane | store | the catch |
|---|---|---|
| S3 Standard (us-east-1) | **$0.023/GB-mo** ($23.55/TB-mo) | **unchanged since 2016-12-01** — ~10 years without a headline cut while raw disk fell severalfold |
| S3 Glacier Deep Archive | **$0.00099/GB-mo** ($1/TB-mo) | 180-day minimum charge · retrieval $0.02/GB (12 h) or $0.0025/GB (48 h) · **egress $0.09/GB** — a modeled full-PB exit ≈ **$73k** (LeanOps 2026-04) |
| Backblaze B2 | $6.95/TB-mo | egress free to 3× stored, then $0.01/GB |
| Cloudflare R2 | $15/TB-mo (Std) / $10 (IA) | **zero egress**, vendor-published; per-op fees |

10-year 100 GB, storage only: S3 Standard **$276** · Deep Archive **$11.88** (+
retrieval/egress whenever you touch it) · B2 **$83** · R2 **$120–180**.

## 3 · The hard drive, taken seriously (its own vendors' receipts)

- Street price: cheapest genuinely-NEW 3.5" HDDs cluster **$20.00–23.80/TB**
  (2026-08 aggregator snapshots; the verify pass caught and corrected a
  renewed-drive listing masquerading as the floor).
- **Consumer drives are not rated for the job**: Seagate BarraCuda datasheet —
  2-yr warranty, **2,400 power-on hours/year**, 55 TB/yr workload. 24/7 duty needs
  enterprise (Exos: 8,760 h/yr, 5-yr warranty) at higher $/TB.
- **Cold storage is not "forever" either**: Seagate's own manual caps unpowered
  storage at **180 days packaged / 60 days unpackaged** (1 yr under optimal
  conditions). The US Library of Congress: two+ copies, sites far apart, **new
  media copies every five years**.
- Failure: Backblaze fleet AFR **1.24–1.36%/yr** (2025–Q1 2026, 340k+ drives) — in
  a climate-controlled datacenter with monitoring; a closet is worse.
- Power: a spinning drive alone ≈ **$7–12/yr** at $0.15/kWh (excl. host machine).
- So the honest 10-yr DIY 3-site model is: 3 enterprise drives ≈ $75–90/TB up
  front, **re-bought ~every 5 years** (LOC), powered or refresh-cycled, plus the
  labor nobody prices (the one published model that prices labor puts the
  DIY-vs-managed crossover near 7 TB). **Cheapest custody you can hold — and it is
  a part-time job, not a purchase.**

## 4 · Autonomi, chain-derived (ant.report + our own 150-tx receipt, convergent)

- All-in today ≈ **$1.27–1.50/GB one-time** → 10-yr 100 GB ≈ **$127–150 once**,
  amortized **$1.06–1.25/mo** — vs S3 Standard $2.30/mo forever. Deep Archive
  beats it on price and loses on access (12–48 h restores, egress tolls) and on
  custody. Downloads: free, keyless, no egress meter — the structural difference.
- **The honest risk column, from the network's own docs:** the promise is
  "lifetime of the Network," not "forever." Node income today = upload payments
  only — **emissions PAUSED since January 2026** (233M of 240M pool remains), and
  total network storage revenue since genesis is **16,563 ANT ≈ $683–956**. This
  is an early network whose sustainability model is still proving itself. Anyone
  quoting pay-once-forever without this paragraph is selling, not measuring.

## 5 · The estate's verdict (already canon: the price-break law)

No single rail wins. That is why this estate ROUTES: browser-resolvable and
<256 KiB → **Arweave**; bigger or private → **Autonomi**; and the founder's own
substrate doc carries the measured crossovers (`docs/storage-substrate-split.md`,
corrected 2026-08-21 on-chain). The skeptic is right that a self-managed drive is
the cheapest custody — and its vendors' own datasheets say it is a maintenance
discipline, not a purchase. The believer is right that pay-once-networked is
structurally different from rent — and the network's own docs say the promise is
conditional on the network living. **Both truths fit on one receipt. Quote a date,
a size, and an access pattern with any number you repeat.**
