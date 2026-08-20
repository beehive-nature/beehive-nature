# BNRi Explorer — Design Spec

> pepi.sh/pepiscan-inspired explorer with 80s/90s cypherpunk-raver aesthetic.
> Multi-chain: supports select ERC-20i tokens from Vaulta EVM, Base, and Ethereum.

## 1. Design Theme — 80s/90s Cypherpunk Raver

### Visual palette

| Role | Color | Hex |
|---|---|---|
| Background (primary) | Deep black | `#0A0A0F` |
| Background (panels) | Dark violet | `#1A1A2A` |
| Text (primary) | CRT green | `#00FF41` |
| Text (secondary) | Cyan | `#00E5FF` |
| Accent (raver) | Hot pink | `#FF3DB0` |
| Accent (raver) | Electric purple | `#A24BFF` |
| Accent (raver) | Lime | `#9FFF3D` |
| Accent (warning) | Amber | `#FF8C00` |
| Accent (success) | Magenta | `#FF2D95` |
| Borders | Neon glow | `#00E5FF` with `box-shadow: 0 0 10px` |

### Typography

| Use | Font | Style |
|---|---|---|
| Headings | "VT323" or "Press Start 2P" | Pixelated, retro terminal |
| Body | "IBM Plex Mono" or "Fira Code" | Monospace, CRT-style |
| Numbers/data | "Share Tech Mono" | Tabular, scanline feel |
| Logo | Custom hexcomb pixel font | Bee-themed |

### Aesthetic elements

- **Scanlines overlay** — subtle horizontal lines across entire UI (CRT monitor effect)
- **VHS glitch** — occasional horizontal glitch animation on page transitions
- **Neon glow** — all borders and text have `text-shadow` / `box-shadow` glow
- **Hex grid background** — faint hexcomb pattern behind content (the BNRi hive metaphor)
- **Loading animation** — spinning hexagon with "DECODING INSCRIPTION..." text
- **Cursor** — custom hex-shaped cursor on desktop

### UI components (80s/90s references)

| Component | Style | Inspiration |
|---|---|---|
| Header bar | Black with neon cyan border, blinking cursor | BBS terminals, The Matrix |
| Nav menu | ASCII-art style tabs, hot pink hover | BBS menus, IRC clients |
| Data tables | Green text on black, monospace, scanline overlay | Vintage terminal emulators |
| Buttons | Beveled 3D borders (Windows 95 style) with neon glow | Windows 95 + cyberpunk |
| Inspectable cards | "Diskette" shape with label slot showing bee info | Floppy disks |
| Loading bars | Cassette tape spool animation | 80s mixtapes |
| Error messages | Glitching red text with "SIGNAL LOST" | VHS tracking errors |
| Success messages | "CONNECTION ESTABLISHED" with handshake pixel art | Modem handshake |

## 2. Multi-Chain Architecture

### Supported chains

| Chain | Status | RPC | Explorer URL pattern |
|---|---|---|---|
| **Vaulta EVM** (primary) | Native | `https://api.vaulta.com/rpc` | `bnri.sh/scan/vaulta/...` |
| **Base** | Supported | `https://mainnet.base.org` | `bnri.sh/scan/base/...` |
| **Ethereum** | Supported | `https://eth.llamarpc.com` | `bnri.sh/scan/eth/...` |

### Curated ERC-20i registry

The explorer shows **select** ERC-20i tokens — not every token, just the curated list:

| Token | Chain | Contract | Status |
|---|---|---|---|
| **BNRi** | Vaulta EVM | (TBD — your deployment) | Featured |
| **PEPI** | Ethereum | `0x3103cd1602d5fa8f4b9283f9d5a7fa2290795d51` | Featured (reference) |
| **PEPI** | Base | `0x28a5e71bfc02723eac17e39c84c5190415c0de9f` | Featured (reference) |
| **FUNGI** | Base | (search Basescan) | Listed (historical reference) |
| Future ERC-20i tokens | Any chain | — | Apply via governance |

### Chain switcher UI

Top-right corner, BBS-style menu:

```
┌─────────────────────────────┐
│  SELECT NETWORK             │
│  ─────────────────────────  │
│  > VAULTA EVM  ◉ active     │
│    BASE        ○            │
│    ETHEREUM    ○            │
│  ─────────────────────────  │
│  [ESC to close]             │
└─────────────────────────────┘
```

## 3. Page Structure (pepi.sh-inspired)

### Home page (`bnri.sh/`)

```
┌──────────────────────────────────────────────────────────────┐
│  ░███░███░███  BNRi SCAN  ░███░███░███  [VAULTA EVM ▼]  ░░░  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  > TOTAL SUPPLY:     133,701.69 BNRi                        │
│  > LP LOCKED:        420 YEARS (expires year 2446) 🔒       │
│  > GARDENER REWARDS: $12,847 distributed                    │
│  > BURNED:           1,247 BNRi (0.93% of supply) 🔥        │
│  > HOLDERS:          2,341                                  │
│  > INSCRIPTIONS:     8,742 minted                           │
│                                                              │
│  ┌─[ SEARCH INSCRIPTION / ADDRESS / TX ]──────────────────┐  │
│  │  > _                                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─[ FEATURED INSCRIPTIONS ]─────────────────────────────┐   │
│  │  [hex-pixel render]  [hex-pixel render]  [hex-pixel]  │   │
│  │  Reflector QG        Generator QG        Caffeine      │   │
│  │  Level 5 / 2% rare   Level 5 / 36%       Level 7 / 1of1│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Inscription detail page (`bnri.sh/inscription/42`)

```
┌──────────────────────────────────────────────────────────────┐
│  INSCRIPTION #0042                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  LEVEL:        Queen's Guard (Level 5)    │
│  │              │  HD TYPE:      Manifestor (8% rare)       │
│  │  [hex-pixel  │  AURA:         Red #E63946                │
│  │   bee art    │  ACCESSORIES:  5 slots                    │
│  │   96x96]     │    - Gold ring (legendary, 15%)           │
│  │              │    - Candy-pink gem (MYTHIC, 3%)          │
│  │              │    - Common × 3                            │
│  └──────────────┘  LOCK STATUS:  🔒 LOCKED                  │
│                    SEALED:       80 BNRi (8000 raw units)   │
│                    OWNER:        0x1a2b...3c4d              │
│                    MINTED:       Block 18,234,567           │
│                    SEED:         0xabc123...                │
│                                                              │
│  > TRANSFER HISTORY                                          │
│    Block 18,234,567  MINTED     → 0x1a2b...3c4d             │
│    Block 18,567,890  LOCKED     (80 BNRi sealed)            │
│                                                              │
│  > OTC LISTINGS                                              │
│    Not listed                                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Gardener dashboard (`bnri.sh/garden`)

```
┌──────────────────────────────────────────────────────────────┐
│  GARDENER DASHBOARD                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  > YOUR POSITION                                             │
│    LP tokens staked:    1,250 LP                             │
│    Lock duration:       90 days (47 days remaining)         │
│    Multiplier:          1.5×                                 │
│    Pool share:          2.3%                                 │
│                                                              │
│  > REWARDS                                                   │
│    Pending:              $12.45 (claimable now)             │
│    Lifetime earned:      $234.10                            │
│    APY (estimated):      34.2%                              │
│                                                              │
│  > POOL STATS                                                │
│    Total gardeners:      156                                 │
│    Total LP locked:      54,231 LP                          │
│    24h fees generated:   $187.30                            │
│    24h gardener share:   $149.84 (80%)                      │
│                                                              │
│  [ CLAIM REWARDS ]  [ ADD LIQUIDITY ]  [ UNSTAKE ]          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### LP lock page (`bnri.sh/lp-lock`)

```
┌──────────────────────────────────────────────────────────────┐
│  LIQUIDITY POOL — 420 YEAR PERMA-LOCK                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─[ 🔒 PERMANENTLY LOCKED ]─────────────────────────────┐   │
│  │                                                       │   │
│  │  Lock duration:    420 YEARS                          │   │
│  │  Lock expiry:      YEAR 2446                          │   │
│  │  Countdown:        151,199,873,640 seconds            │   │
│  │                                                       │   │
│  │  Principal locked:                                   │   │
│  │    50,000 BNRi  ($25,000 USD)                        │   │
│  │    31,250 A     ($25,000 USD)                        │   │
│  │    Total:       $50,000 (FOREVER ILLIQUID)           │   │
│  │                                                       │   │
│  │  Contract: 0xABC...DEF (verify on Vaulta scan)       │   │
│  │  Locker:   BNRiPermaLock.sol                         │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  > FEE DISTRIBUTION (ALL TIME)                               │
│    Total fees generated:   $12,847.32                       │
│    Gardeners (80%):        $10,277.86  → 156 gardeners      │
│    Team treasury (15%):    $1,927.10   → multisig           │
│    Burned (5%):            $642.37     → deflationary       │
│                                                              │
│  > RUG-PROOF VERIFICATION                                   │
│    ✓ Principal lock verified on-chain                       │
│    ✓ Lock duration > 100 years                              │
│    ✓ Fee split hardcoded in contract                        │
│    ✓ No admin withdrawal function                           │
│    ✓ Multi-sig on team treasury                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 4. Cross-Chain ERC-20i Registry

### How the explorer handles multiple chains

```typescript
// Curated registry of supported ERC-20i tokens
const ERC20I_REGISTRY = {
  vaulta: [
    {
      address: "0x...BNRi",
      symbol: "BNRi",
      name: "Bee N Raver Inscription",
      featured: true,
      explorerPath: "/vaulta/bnri"
    }
  ],
  base: [
    {
      address: "0x28a5e71bfc02723eac17e39c84c5190415c0de9f",
      symbol: "PEPI",
      name: "Pepi Inscriptions",
      featured: true,
      explorerPath: "/base/pepi"
    }
  ],
  ethereum: [
    {
      address: "0x3103cd1602d5fa8f4b9283f9d5a7fa2290795d51",
      symbol: "PEPI",
      name: "Pepe Inscriptions",
      featured: true,
      explorerPath: "/eth/pepi"
    }
  ]
};

// Each token's ABI must implement the ERC-20i interface:
// - balanceOf(address) → uint256
// - sporesDegree(address) → uint256 (locked balance)
// - mushroomOfOwnerByIndex(address, uint256) → uint256 (inscription enumeration)
// - getItemData(uint256) → ItemData (layer data for SVG rendering)
// - totalSupply() → uint256
```

### Render pipeline for cross-chain inscriptions

```
User visits bnri.sh/inscription/42?chain=vaulta
  ↓
Explorer queries Vaulta EVM RPC for BNRi contract
  ↓
Calls getItemData(42) → returns ItemData struct
  ↓
Explorer's SVG renderer (JavaScript port of HexLib) builds hex-polygon SVG
  ↓
SVG rendered inline in browser (no IPFS dependency)
  ↓
Displayed with 80s/90s cypherpunk-raver UI theme
```

The SVG renderer must be implemented in JavaScript (port of the Solidity HexLib) so the explorer can render any ERC-20i inscription client-side. This is the same approach pepi.sh uses.

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React 18, App Router) |
| Styling | Tailwind CSS + custom CRT/scanline CSS |
| Fonts | Google Fonts: VT323, Press Start 2P, IBM Plex Mono, Share Tech Mono |
| Charts | Custom SVG (no chart library — keeps retro feel) |
| State | Zustand (lightweight, no Redux overhead) |
| Data fetching | TanStack Query (caching, polling) |
| Multi-chain | viem + wagmi (EVM-compatible, supports Vaulta/Base/Ethereum) |
| Backend | None — pure frontend, reads directly from RPC nodes |
| Hosting | Vercel or Cloudflare Pages (static + edge functions) |
| Domain | `bnri.sh` (matching pepi.sh convention) |

## 6. Unique BNRi Explorer Features (vs pepi.sh)

| Feature | pepi.sh | BNRi scan |
|---|---|---|
| Multi-chain | Ethereum only | Vaulta + Base + Ethereum |
| LP lock display | None | 420-year perma-lock badge on every page |
| Gardener dashboard | None | Live rewards, lock multipliers, claim interface |
| Burn counter | None | Real-time deflation tracking |
| Bee visual rendering | Pepi (square pixels) | BNRi (hex pixels) — custom HexLib JS port |
| Accessory rarity display | Trait list | Per-slot rarity badges (common/rare/epic/legendary/mythic) |
| Lock status | Hidden as "spores" | Explicit 🔒/🔓 icon + sealed token count |
| OTC marketplace integration | Basic | Live listings + bid/ask |
| Theme | Clean modern | 80s/90s cypherpunk raver (scanlines, neon, CRT) |

## 7. Development Roadmap

| Phase | Duration | Deliverable |
|---|---|---|
| **1. MVP** | 4 weeks | Vaulta EVM only, BNRi token + inscription rendering, basic pages |
| **2. Multi-chain** | 2 weeks | Add Base + Ethereum support, curated registry |
| **3. Gardener dashboard** | 2 weeks | LP staking UI, rewards tracking, claim interface |
| **4. OTC marketplace** | 3 weeks | List/buy/offer inscriptions, escrow contract |
| **5. Polish** | 2 weeks | Animations, sound effects (optional), mobile responsive |
| **Total** | ~13 weeks | Full explorer launch |

## 8. Sound Design (optional, toggleable)

For full 80s/90s immersion, the explorer can include toggleable sound effects:

| Action | Sound |
|---|---|
| Page load | Modem handshake (56k dial-up) |
| Button click | Mechanical keyboard clack |
| Inscription render | Cassette tape loading |
| Lock status change | Vault door closing |
| Reward claim | Coin insert (arcade) |
| Error | VHS tracking glitch |
| New block | Subtle bass kick (rave) |

Default: OFF (respecting users). Toggle in settings: "ENABLE IMMERSIVE AUDIO 🔊"

## 9. Mobile Experience

The 80s/90s theme adapts to mobile:

- **Scanlines** stay (subtle, doesn't hurt readability)
- **Neon glow** stays (looks great on OLED)
- **Pixel fonts** scale down for mobile (VT323 at 14px)
- **Tables** become cards on narrow screens
- **Touch targets** enlarged (44px min, mobile-friendly)
- **No hover effects** on touch — replaced with active states
- **Cursor** hidden on mobile (no cursor)
