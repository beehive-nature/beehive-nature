# SPEC-ERC20I-MECHANICS-1 — the standard, decoded

**Status: REFERENCE, not governing.** This is a decoded description of how ERC-20i works in
the wild, written so BNRi can fork it deliberately rather than by imitation. Founder
direction, 2026-08-15: *"we steal every part from this because it is me showing respect with
my fork."*

Every claim is cited or marked **UNVERIFIED**. Numbers carry their derivation. Where this
document and the contracts disagree, the contracts win.

---

## ⚠ CORRECTION 2026-08-16 — THIS DOCUMENT CONFLATES TWO STANDARDS

**Base and Ethereum are two different standards sharing a name.** Line numbers cited
throughout §3, §5 and §6 below — `Pepi.sol:174-202`, `:255-277`, `:286-293`, `:429-467` —
are **Ethereum-only**. They do not describe Base.

Measured: the **Base** source is **344 lines**, declares exactly three events
(`OnMushroomTransfer`, `OnSporesGrow`, `OnSporesShrink`), and
`grep -c 'OnItemBurn\|transferItem'` returns **0** across all four Base contract files.

| | **Base** | **Ethereum** |
|---|---|---|
| identity | **seed value**, unique per owner | **globally-unique item id** |
| moving one inscription | transfer an amount whose whole-token floor equals the held seed | `transferItem(address,uint256)` |
| burn reasons | none declared | `TO_SOURCE`, `PARTIAL_ROE`, `INVARIANT`, `SOURCE_SANITIZE` |
| enumeration | `mushroomOfOwnerByIndex` | `getOwnerItemsPage` (paginated) |
| `SeedData` | 3 words | 4 words (leading `uint8`) |

**A wallet built to one model will mis-render the other.** Read every section below as
describing the **Ethereum** deployment unless it says otherwise; the Base behaviour needs
its own pass against the Base source, which has not been done.

`SPEC-INSCRIPTION-COMPAT-1` is the safe reference in the meantime — it was written from
measurements of both and does not inherit this defect.

## 0 · The family

Five canonical tokens on Base. Registry double-sourced from `fungiblesxyz/generator-app`
`tokens.json` and `fungibles-functions` `tokens.ts`.

| token | address | `getSvg` selector |
|---|---|---|
| FUNGI | `0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F` | `0x422b9e23` |
| FROGGI | `0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE` | `0x422b9e23` |
| PEPI | `0x28a5e71BFc02723eAC17E39c84c5190415C0de9F` | `0xa435130b` |
| TRUFFI | `0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38` | `0xa62f5b1b` |
| JELLI | `0xA1b9d812926a529D8B002E69FCd070c8275eC73c` | `0x422b9e23` |

**There is no single ABI.** Three shapes exist across five tokens — PEPi and the `0x422b9e23`
group take a seed triple; TRUFFI takes an `address` as its third field. Any explorer needs
**capability detection from the first commit**, not an assumed interface.

All five: `owner()` is the zero address, zero ABI entries match `/uri/i`, zero `selfdestruct`
and zero `delegatecall`. **The art cannot be changed by anyone, including its authors.**

## 1 · Seed derivation

```solidity
uint seed = amount / (10 ** decimals());     // Pepi.sol:75
```

Whole tokens. The fractional part **can never affect art** — useful, since it means a
supply's decimal tail is free signature (BNRi's `133,770.69`: the `.69` is permanently
inert and permanently visible).

**PEPi measured live:** `decimals()` = 9, `totalSupply()` = 13,370 whole tokens
(**not** 13,377 — that figure circulated and is wrong), `mushroomsTotalCount()` = 167.

### Levels

`levelsCount = 6`, thresholds **11 / 22 / 33 / 44 / 56** on `seed` alone
(`Generator.sol:6-13`). L1 = 1–10, L2 = 11–21, … L6 = 56+.

Five thresholds, six bands. A ladder of N rungs yields N+1 levels.

## 2 · Two RNG streams — the idea worth stealing

| stream | source | drives |
|---|---|---|
| `next()` | `keccak(seed + nonce − 1, extra)` | **every trait index** |
| `next2()` | `keccak(seed2 + nonce2 − 1)` | **background colour and body colour only** |

`seed` = balance in whole tokens. `seed2` = block randomness captured when spores first go
non-zero. `extra` = `keccak256(account, nonce)`.

**Shape from what you hold; palette from when you got it.** A second independent axis of
variation at zero storage cost. Two wallets at the same balance render the same *form* in
different *colours*, and that difference is permanent and unforgeable.

### TRAP — draw accounting is asymmetric

A **failed** presence gate consumes **1** draw. A **passed** gate consumes **2**.
Any off-chain replay must model this exactly or every downstream trait desyncs. This is the
single most likely defect in a third-party renderer, and it fails *silently* — the art is
wrong, not absent.

### TRAP — `seed = 0` reverts

`seed + nonce++ − 1` underflows at `seed = 0`, panic **0x11**. Harmless inside the token
(nobody holds zero and renders); a live trap for an explorer or marketplace that iterates
addresses. **Guard `seed = 0` at the API boundary and start `nonce` at 1.**

Founder testimony, 2026-08-15: *"fungi and pepi v1 both had the same over under bug."*
Recorded as testimony; the precise defect is under verification.

## 3 · Trait selection

**Presence gates are Bernoulli integers**, then uniform selection within the layer:
cloth 60% (`:653`), accessory 37% (`:672`), hat 37% (`:679`), ears 3% (`:686`).
Body, eyes and mouth are unconditional.

> **Do not duplicate array entries to express rarity.** A 1-in-100 trait is one integer,
> not a hundred on-chain slots.

**Z-order is hardcoded, not data-driven** (`Generator.sol:775-786`):
`background → body → cloth → ears → mouth → eyes → accessory → hat`.

**PEPi's actual trait census** — 973 sparse files of 3–44 rects each:

| layer | per level (L1…L6) |
|---|---|
| bodies | 6, 14, 1, 1, 1, 1 |
| cloths | 0, 0, 74, 80, 92, 117 |
| eyes | 0, 12, 12, 12, 12, 12 |
| mouths | 0, 11, 11, 11, 11, 11 |
| accessories | 0, 13, 20, 30, 44, 80 |
| hats | 0, 28, 51, 57, 73, 75 |
| **ears** | **0, 0, 0, 0, 0, 0** ← declared layer, shipped empty, unfixable after renounce |

## 4 · Why no two are alike — the arithmetic

Level 6, with gates adding an "absent" state and a 42-entry body-colour draw:

```
1 body × 118 cloth × 12 eyes × 11 mouth × 81 accessory × 76 hat × 42 colour
  ≈ 4.03 billion combinations
```

Against 167 inscriptions, expected collisions = `167² / (2 × 4.03e9)` ≈ **3.5 × 10⁻⁶**.

**The property is engineered, not lucky.** To reproduce it, size combinations against
expected supply by the birthday bound `k² / 2N`. For ~5,000 inscriptions at under 0.01
expected collisions, **N > 1.25 billion** — reached by roughly **30 variants across 6
layers (729M) times a colour axis**.

## 5 · Storage and upload

`FileData{uint lvl; uint file; Rect[]}` for bodies;
`FileDataColored{uint lvl; uint file; RectColored[]}` for the other six.

- `Rect{uint8 x,y,width,height}` — **4 B, no colour**
- `RectColored{uint8 x,y,width,height; uint24 color}` — 7 B, one storage slot

Setters, all `external onlyOwner`, all batching: `setBodies` `d6875752`, `setCloths`
`997d54f5`, `setEyes` `9eb63de6`, `setMouths` `8ab4598e`, `setAccessories` `6c835c4a`,
`setHats` `36a6c7bc`, `setEars` `86169143`.

### TRAP — `setFile` replaces, it does not append

`if (storageFile.length > 0) delete rects[lvl-1][file-1]; else ++counts[lvl-1];`
A second call for the same `(lvl,file)` **wipes the first**.

### TRAP — `counts[]` is increment-only and is the selection modulus

Upload files 1, 2, 5 → `count` = 3 → file 3 is an empty array that renders as `""`,
**silently, without reverting**. One out-of-order batch **permanently poisons a level**.
This is how `earsLevelCounts` shipped as all zeros.

> **Upload order is a deploy-day gate.** Rehearse on testnet.

### The transaction ceiling

Binding limit is not calldata (128 KB → 817 `RectColored`) but the **2²⁴ = 16,777,216 gas
transaction cap**, measured by binary search at **675 rects/tx** (676 over-caps; 25,226 gas
per rect marginal). **BNRi must ship an append-mode setter** — none of the seven candidate
pieces fits in one transaction, the smallest being 782 rects.

## 6 · The renderer will not run at scale

`RectLib.toSvg` concatenates inside a loop — `res = abi.encodePacked(res, …)`
(`Generator.sol:328`, also `:306`, `:318`) — and Solidity never frees memory. Cost is
**quadratic**: cumulative ≈ `e·n²/2`.

| rects | memory | gas (`3w + w²/512`) |
|---|---|---|
| 2,027 | 117.1 MB | 2.62 × 10¹⁰ |
| 2,517 | 180.6 MB | 6.22 × 10¹⁰ |

All three public Base RPCs reject an `eth_call` at those levels **even when handed 500
billion gas**. **Storable ≠ viewable**, and this — not EIP-170 — is the real ceiling.

Fixes, both needed: **a linear output buffer** instead of quadratic concatenation, and
**fewer emitted elements**.

## 7 · Bodies carry no colour

`bodySvg` calls the single-colour overload —
`bodies[lvl-1][body-1].toSvg(data.bodyColor)` (`:801`) — where `bodyColor` is drawn from a
hardcoded 42-entry `skin_colors` array (`:647`). **Verified live: every body rect in a real
render carries the identical `fill='#538234'`.**

A PEPi body is a **monochrome silhouette with a runtime-random fill.** Keep `Rect` for
bodies and a multi-colour palette collapses to one colour on that layer.

**For BNRi this is a feature, not a loss.** Body colour is chitin colour; the HD types are
already defined as chitin tints. The body-colour draw **is** the type, and the rarity split
is a weighted selection over that array — the rarest identity axis for zero storage.

## 8 · Divergence: TRUFFI is built differently

Rendered live from chain, holder `0x07339c13…`, seed 5528 → **12,641 B SVG**:

| | PEPi | TRUFFI |
|---|---|---|
| viewBox | `0 0 32 32` | **`0 0 220 220`** |
| elements | thousands of rects | **7 rects + 13 paths** |
| texture | stored per pixel | **`<feTurbulence fractalNoise>`** — synthesised by the renderer |
| output | 806–8,848 B | 12,641 B |

Solaris stores **instructions, not pixels**. That is why TRUFFI renders where a dense
rect-based piece cannot — it never approaches the quadratic wall. `feTurbulence` buys grain
and shimmer for a few hundred bytes that would cost thousands of cells to store.

`sporesDegree` and `mushroomCount` **revert** on TRUFFI. Confirmed: no shared ABI.

## 9 · Smaller sharp edges

- **Hex case is inconsistent.** The `uint24` path emits **uppercase**; hardcoded palettes
  are lowercase literals. Same RGB, two spellings in one document — normalise before any
  dedupe or diff.
- `pixelsCount = 32` is a **compile-time constant** (`Generator.sol:8`), no setter. `setFile`
  performs **no bounds checks**, so out-of-range rects store silently and are clipped by the
  viewport — data accepted, art lost, no revert.
- PEPi's art code is `SPDX-License-Identifier: MIT` (`Generator.sol:1`). **The ABI and struct
  layout are lawful to reuse; the trait rectangles are not** — no licence covers the artwork
  (see `SPEC-BNRI-INSCRIPTION-1.md:191`).

## 10 · Open

- **Locked inscriptions** — whether a locked record carries a frozen seed (making it
  transferable art) or recomputes from the holder. Decides whether a marketplace can exist.
  Under verification.
- **The over/under bug** — founder reports FUNGI and PEPi v1 share it. Precise defect and
  visible effect under verification.
- **PEPi v1 vs v2** — three contracts share the PEPI symbol; which deployment is which is
  unsettled.

---

*Read-only research. No mainnet transaction, no key material, at any point.*
