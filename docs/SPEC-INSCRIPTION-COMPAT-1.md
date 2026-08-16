# SPEC-INSCRIPTION-COMPAT-1 — what makes a token belong in the ecosystem

**Status: DRAFT, founder-gated.** One document, four consumers. The **Studio** enforces it
before art is accepted, the **LaunchPad** gates on it before deploy, the **Gallery** uses it
for capability detection, and the **Marketplace** uses it for eligibility. If those four
check different things, they are four products; if they check this, they are one system.

Every threshold here was measured on 2026-08-15/16 against live contracts. Receipts:
`docs/SPEC-ERC20I-MECHANICS-1.md`, `docs/receipts/evmcheck.py`,
`surfaces/blight/inscription-explorer.html`.

---

## 0 · The three tiers

| tier | grants | requires |
|---|---|---|
| **1 · viewable** | appears in the Gallery | a readable renderer and readable seeds |
| **2 · tradeable** | appears in the Marketplace | tier 1 + enumeration + a safe transfer primitive |
| **3 · scale-native** | recommended for new deploys | tier 2 + a linear renderer + append-mode upload |

A token may sit at tier 1 forever and still be a first-class citizen of the museum. **Tier 3
is what the LaunchPad emits**, because a token deployed today has no excuse for the defects
the lineage inherited.

---

## 1 · Tier 1 — viewable

### 1.1 A renderer answers

Four `getSvg` shapes exist in the wild. **There is no single ERC-20i interface**; capability
detection is mandatory, not defensive programming.

| selector | signature | seen on |
|---|---|---|
| `0xa435130b` | `getSvg((uint256,uint256,uint256))` | PEPI v1, v2 (Base) |
| `0x422b9e23` | `getSvg((uint256,uint256,uint256))` | FUNGI, FROGGI, JELLI (Base) |
| `0xa62f5b1b` | `getSvg(...)`, third field an **address** | TRUFFI (Base) |
| `0x058e7a31` | `getSvg((uint8,uint256,uint256,uint256))` | PEPi (Ethereum, item model) |

> Two contracts sharing a signature can still have **different selectors** — the shape is not
> the identity. Probe, do not assume.

**A fifth shape is expected.** Detection must degrade to "unknown renderer" rather than
"no art".

### 1.2 Seeds are READ, never derived

`sporesDegree(address)` `0xa775188a` returns the live triple. **Its seed is not
`balance / 10^decimals`.** Measured: a holder with **7 whole tokens returns on-chain seed 3**
— the seed is captured from the transfer that created the spore. Deriving from balance and
passing `seed2 = 0` **reverts**.

Return width varies: **3 words on Base, 4 on Ethereum** (leading `uint8`).

### 1.3 Self-containment

The returned SVG must contain **zero external references** beyond the SVG namespace
declaration. Any `http`, `ipfs://`, or `data:` pointing outward disqualifies tier 1 — a
renderer that needs a server is the failure this ecosystem exists to refute.

Mechanical check: strip `www.w3.org`, then assert no remaining `https?://`.

### 1.4 It actually renders

Storable ≠ viewable. See §3.1. A contract that stores art it cannot serve fails tier 1 **on
chain**, though the art remains recoverable off-chain (§3.2).

### 1.5 The seed-zero trap

`seed = 0` reverts with **panic 0x11** — `seed + nonce − 1` underflows. Any consumer that
iterates addresses hits this. **Guard at the API boundary; start `nonce` at 1.** Report it as
"no inscription", never as an error.

---

## 2 · Tier 2 — tradeable

### 2.1 Enumeration

Viewing needs the live spore. **Trading needs the frozen records**, and a wallet can hold
zero spores and five frozen pieces — that wallet renders nothing without enumeration.

| model | count | enumerate |
|---|---|---|
| Base | `mushroomCount(address)` `0x9c216508` | `mushroomOfOwnerByIndex(address,uint256)` `0x0fd9587e` |
| Ethereum item model | `itemCount(address)` `0xc00ae885` | `getOwnerItemsPage(address,uint256,uint256)` `0x92d2036d` |

**Prefer the paginated form.** Base costs one call per item; Ethereum returns a page. At cart
and gallery scale that is the difference between usable and not.

### 2.2 A safe transfer primitive

This is the axis that separates the two generations, and it is **not retrofittable**.

- **Base-style:** an inscription moves only by transferring an amount whose whole-token floor
  equals the held seed. **Any other amount dissolves inscriptions**, and a **same-seed
  collision silently dissolves the piece being sold plus unrelated ones, without reverting.**
- **Item model:** `transferItem(address,uint256)` `0x67c65e99` moves one inscription **by
  globally-unique id**, carrying exactly its backing tokens, seed data re-added verbatim.

> **Tier 2 requires an id-addressed transfer.** A Base-style token is viewable and
> collectable but **cannot be safely traded by a third-party marketplace**, because every
> settlement path is one arithmetic slip from destroying art.

### 2.3 Custody rules, for any market that escrows

Derived from a live implementation with **8,162 burn events and zero in any marketplace
transaction**:

1. **Items out before any fungible sweep.** Release inscriptions, *then* release ERC-20, then
   destroy the vault. Reversing this dissolves what remains.
2. **An address holding art must never hold fee or treasury balances.** The first sweep
   dissolves its custody.
3. **Escrow may hold multiple items** — the earlier "one inscription per address" rule was an
   artifact of Base's magic-amount semantics and is **withdrawn** for id-addressed tokens.

**Preferred: escrow the payment, never the art.** Delivery is provable by an `eth_call`
(`isOwnerOf`), so no contract need ever custody an inscription.

### 2.4 Pools are sinks

Measured: PEPi v2's pool holds **8,292 whole tokens, 0 inscriptions, and 0 spores.** It is
excluded from inscription accounting entirely. **Transferring an inscription toward a pool
destroys it** — burn reason `TO_SOURCE`, **5,934 occurrences.**

> **A swap button beside an inscription is a delete button wearing a trade label.** Any
> surface offering both must say so.

---

## 3 · Tier 3 — scale-native

### 3.1 The renderer must be linear

`abi.encodePacked` inside a loop is quadratic — Solidity never frees memory, so cost grows as
`e·n²/2`.

| rects | memory | gas |
|---|---|---|
| 2,027 | 117 MB | 2.62 × 10¹⁰ |
| 2,517 | 181 MB | 6.22 × 10¹⁰ |

Public RPCs reject these **even given 500 billion gas**.

| renderer | element ceiling |
|---|---|
| quadratic | **~370** |
| **linear buffer** | thousands, bounded only by response size |

**Emit fewer elements too.** TRUFFI produces 12,641 B from **7 rects, 13 paths and one
`feTurbulence` filter** — instructions, not pixels. That is why it renders where dense
rect art cannot.

### 3.2 …but un-renderable is not unviewable

The quadratic wall is **an EVM memory artifact, not an algorithmic one.** The same
concatenation in JavaScript is milliseconds. Given trait data, published generator logic and
seeds, **any client composes the art locally at no gas.** Tier 3 is about being a good
citizen on-chain, not about whether the art exists.

### 3.3 Upload must append

- `setFile` **replaces**: a second call for the same `(lvl,file)` **wipes the first**.
- `counts[lvl]` is **increment-only and is the selection modulus**. Upload 1, 2, 5 → count 3
  → file 3 renders as `""`, silently. **One out-of-order batch permanently poisons a level.**
  This is how `earsLevelCounts` shipped `[0,0,0,0,0,0]` — a declared layer, empty forever.
- **675 rects per transaction**, bounded by the 2²⁴ gas transaction cap (25,226 gas/rect
  marginal). No candidate BNRi piece fits in one transaction; the smallest is 782 rects.

**Tier 3 requires an append-mode setter and a deterministic upload order.**

### 3.4 No bounds checks exist

`setFile` validates nothing. Out-of-range rects **store silently and are clipped by the
viewport** — data accepted, art lost, no revert. **The Studio must validate; the chain will
not.**

### 3.5 Opcode compatibility

exSat is **Shanghai**. `PUSH0` (`0x5f`) is expected and desirable — it saves one byte and one
gas per zero-push, worth **431 bytes** on a PEPi-sized contract. The cancun trio
`TLOAD`/`TSTORE`/`MCOPY` (`0x5c`–`0x5e`) deploys and then reverts at runtime.

`evm_version = "shanghai"`, `auto_detect_solc = false`. Verify with
`docs/receipts/evmcheck.py`, which walks the instruction stream and strips the CBOR
metadata trailer — **a naive byte scan produces false positives**, since PUSH immediates
contain arbitrary bytes.

---

## 4 · The Studio's pre-flight

Run before a trait is accepted, not after deploy. Every item is mechanical.

| check | why |
|---|---|
| palette ⊆ the locked set | style anchor and palette-index encoding both break otherwise |
| alpha is binary, no soft matte | a soft edge destroys hard-edged pixel art |
| bounding box within the layer region | traits must register across bodies |
| rect count after RLE ≤ 675 | one transaction per trait |
| no long horizontal 1px runs | **measured**: they become zigzags on a flat-top lattice |
| no dithering / checkerboard | **measured**: destroyed by the lattice change |
| ≥ 2px edge margin | device render clips 2px per side at 384 px on a 380 px panel |
| coordinates within `pixelsCount` | no bounds check exists on-chain |
| upload order contiguous from 1 | out-of-order poisons the level permanently |

---

## 5 · Founder gates

| | |
|---|---|
| **C-1** | **Trait taxonomy** — how many layers, how many variants each. Blocks the Studio's layer model, the LaunchPad's schema, and all bulk art. Target: ~30 variants × 6 layers × a colour axis ≈ 30 billion combinations, which holds expected collisions under 0.01 at ~5,000 inscriptions. |
| **C-2** | **Is tier 2 mandatory for LaunchPad output?** Emitting only id-addressed tokens makes every downstream marketplace safe by construction — but diverges from the Base lineage BNRi is patterning. |
| **C-3** | **`pixelsCount`** — a compile-time constant. 48 renders comfortably and is crisp on the panel; 96 is 3.43× the cost in every figure. Frozen at deploy. |

---

*Read-only research throughout. No mainnet transaction and no key material at any point.*
