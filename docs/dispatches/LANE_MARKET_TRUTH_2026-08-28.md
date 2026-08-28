# LANE MARKET TRUTH — BUYER TRUTH ON THE DEMARKETPLACE · 2026-08-28

**Seat:** z2.1 · **Defect:** founder eye-catch, live market.html — dots, numbers, art disagreeing per card · **Status: CLOSED — landed `aa9ea63`, live-verified at both widths, gates 14/14.**

## 1 · READ-BACK (every input traced, every threshold cited)

**Per card, before this lane:** (a) dots = page-side `lvlOf(SELLER_SEED)`; (b) numbers = seller seed + listing `floor(seed×0.4)`; (c) art = `getSvg(SELLER_SEED)`. Three inputs — and the art/dots pair described the **seller's full-balance level, not the product a buyer receives**. The disagreement the founder saw was real and structural.

**Thresholds verified against CONTRACT SOURCE** — bytecode PUSH-operand census of the five deployed collections on Base (each constant searched as an exact PUSH operand in `eth_getCode`):

| collection | table in market.html | bytecode proof |
|---|---|---|
| FUNGI | 21000 · 525000 · 1050000 · 1575000 · 2100000 | each exactly **1×** in code |
| $FROGGI | 1000 · 3000 · 10000 · 30000 · 60000 · 120000 | all present (1000/3000/120000 1×) |
| JELLI | 1000 · 21000 · 105000 · 420000 · 1050000 | each exactly **1×** |
| PEPI v1/v2 | 11 · 22 · 33 · 44 · 56 (base 1) | present |

**Zero table drift** — market's tables match inscription-explorer's byte-for-byte, and both match the deployed code. Per the rider: where chain art still disagrees with balance-derived level after correct tables, that is the o/u class → labeled per collection. **FROGGI joins the class** (egg-at-high-level = the named disagreement; founder's "6 dots over an egg" was this exact signature).

## 2 · BUYER TRUTH (the rule applied)

- The card renders **`getSvg(LISTING)`** with **dots at `lvlOf(LISTING)`** — one value (the listing amount) drives art, dots, and the listing number.
- Verified live-chain: FROGGI **5 dots at 80,523** (was 6 at seller's 201k), FUNGI **3 dots at 1,060,223** (was 6 at 2.65M — the card no longer sells the seller's level), PEPI v1 **2 dots at 31** (the founder's "seed 79 + 4 dots" card now shows the buyer's truth).
- **o/u labels generalize the PEPI law-4 note:** FROGGI/FUNGI/PEPI v1 → *"representative — exact art rolls on delivery (seed N · level L travel intact)"*; JELLI/PEPI v2 → *"level-true: this art is exactly what N holds at delivery."*
- The preview modal leads with **your level at delivery** and labels the seller's full seed **"not the product."**
- FUNGI tiny-art fixed: uniform 220px card art at both widths.
- Caching: none added, none existed — the surface reads the live chain directly (founder source-confirmation honored).

## 3 · Gates + landing

The surface was brought to the battery (it had never been design-gated): D2 sem tokens, D3 gradient headline, D4 hero = the live listing count, laws in a real section, 600px query, and the RPC hosts **itemized into the rider allowlist by exact host** (`base-rpc.publicnode.com`, `base.drpc.org` — honest live reads, named, never waved through). **14/14 ×5 surfaces** (market, hub, wallet, buzz, design-system). CI green and read to conclusion on lane and main; Pages deployed; **live-verified at 1440 and 390 with shots** (`market-LIVE-*.png`), dots and disclosures confirmed in-DOM on the production URL.
