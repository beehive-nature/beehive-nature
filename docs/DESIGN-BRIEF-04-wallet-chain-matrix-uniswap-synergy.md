# DESIGN BRIEF 04 — THE SOVEREIGN WALLET: CHAIN MATRIX × UNISWAP SYNERGY MAP
**Date:** 2026-08-27 (megasprint eve, second brief of the night)
**Founder ruling (verbatim):** *"don't find one way to use a tool find as many ways as you can that is at least symbiotic and hopefully synergetic… we are building our own wallet so we have less exposure risk of 3rd party breakage/dysfunction; of course we reuse all the same protocols and crypto. We already have a good base wallet to build on. I want balances and all pertinent data/function for Vaulta, ARB, ExSAT, BASE, ETH, BTC/LN, Solana, HIVE, zano, bch, zcash, monero, ANT, AR, stables."*
**Companions:** DESIGN-BRIEF-03 (tiers) · RAID_WALLET_SOVEREIGN_LIGHTNING_2026-08-27 (BTC/LN lanes) · RAID_WALLET_PAYMENT_PIPELINE (AR axis) · RULING_DOMAIN_ATLAS (surfaces' homes) · bnri-xbtc-dex-verdict memory (v3-now/v4-later)
**Correction logged:** v4's PositionManager mints **ERC-721** positions per current create-pool docs — v3 AND v4 are both NFT-position-native. The v3-on-exSAT / v4-on-Base verdict rests on license + deployment only, unchanged.

---

## PART 1 — THE BREAKAGE DOCTRINE (how everything below is classified)

Every Uniswap (and generally: every external) touchpoint is one of:
- **PROTOCOL** — on-chain contracts or local libraries we run/compute ourselves (Permit2, Universal Router, Quoter/StateView, v4 PoolManager, TS SDKs). No third party can break these except the chain itself. **Wallet core may depend on these.**
- **SERVICE** — hosted endpoints (Swapping API, LP API, Launchpad app, The Graph hosted queries). Convenience tier: **enhancement with graceful degradation, never a core dependency.** If it dies, the wallet degrades to SDK/local quotes, not to broken.
- **PATTERN** — ideas we reimplement first-party (CCA auction, hook shapes, agent-skill packaging).

This is the founder's "own wallet, less exposure, reuse protocols" expressed as an engineering rule.

## PART 2 — THE UNISWAP SYNERGY MAP (sixteen ways, each labeled)

| # | Way | Class | Where it lands in our estate |
|---|---|---|---|
| 1 | **Custom linking** (`app.uniswap.org/#/swap?…` prefill) | SERVICE (fallback) | wallet.html "advanced swap" escape hatch — zero build cost |
| 2 | **Swapping API** (`/check_approval` → `/quote` → `/swap`) | SERVICE | swap tab v1: hosted routing across v2/v3/v4/X; free key; WE sign and submit ("your app still handles signing and onchain submission") |
| 3 | **TS SDKs** (`@uniswap/v4-sdk` + `sdk-core`, local route/quote computation) | PROTOCOL | the wallet's CORE quote engine — no hosted dep; degrades FROM api TO sdk automatically. (License: sdks monorepo — VERIFY before vendoring; runtime dep is fine) |
| 4 | **On-chain Quoter / StateView via `eth_call`** | PROTOCOL | sovereign quotes with zero API — operator box serves these as a public good |
| 5 | **Subgraphs** (per-version-per-chain; The Graph network, API-key billed) | SERVICE→PROTOCOL | docs themselves: "for production integrations, consider deploying and managing your own subgraph" → **operator runs graph-node + v4-subgraph** (self-hosted data ear) |
| 6 | **LP API** (`/create`, `/increase`, `/decrease`, `/claim_fees` — returns ready-to-sign txs) | SERVICE | ops/treasury lane: manage BNRi + MiDi pools from the ops panel |
| 7 | **v4 pool creation** (`PoolManager.initialize` / `PositionManager.multicall` MINT_POSITION+SETTLE_PAIR, Permit2 approvals, sqrtPriceX96 seed) | PROTOCOL | BNRi pools on Base (fee tiers, our terms); Robinhood Chain also live for the µToken-adjacent fold |
| 8 | **v4 hooks** (`getHookPermissions()` → beforeSwap/afterSwap/…; **OpenZeppelin/uniswap-hooks** bases: BaseDynamicFee, BaseOverrideFee, BaseCustomCurve) | PROTOCOL | the founder-fee hook (1%→treasury) + later the swap-as-generative-act (erc20i fold). OZ bases = secure starting scaffolding. solc 0.8.26 + **Cancun transient storage required** |
| 9 | **Liquidity Launchpad** (Continuous Clearing Auction → auto-seeds v4 pool; permissionless, immutable params, pluggable Liquidity Strategies) | SERVICE + PATTERN | BNRi launch vehicle when its turn comes (v4-only, so Base-class chains); ALSO pattern the CCA for bset/market price discovery |
| 10 | **UniswapX** (intent-based routing; "become a filler") | SERVICE + PROTOCOL | wallet gets gas-smooth intent swaps; operator box gets a FILLER revenue ear (Panel D grows another ear) |
| 11 | **Permit2** (signature allowances, time-bound, one contract) | PROTOCOL | adopt for ALL EVM allowance UX in our wallet — fewer approve txs, better safety — pure protocol reuse, founder's own words |
| 12 | **Universal Router** (unowned, non-upgradeable, composes v2+v3+v4 in one tx) | PROTOCOL | the wallet's swap executor — command-encoding pattern; enforce `amountOutMinimum` slippage always (docs' sandwich warning) |
| 13 | **The Compact** (ownerless ERC-6909 resource locks; async single+multi-chain conditions) | WATCH | cross-chain coordination primitive — candidate pattern for bMesh escrow/coordination lanes |
| 14 | **Smart Wallet "Calibur"** (non-upgradeable EIP-7702 delegation, keep your EOA) | WATCH | custody-tier study: 7702 upgrade path for Tier-1/2 EOAs |
| 15 | **uniswap-ai agent skill** (`npx skills add uniswap/uniswap-ai --skill swap-integration`) | PATTERN + SERVICE | bAigents swap lane: study + reuse; ALSO the packaging pattern for our agent-dock skills |
| 16 | **Subgraph data shapes** (pools/positions/volume entities) | PATTERN | market.html engine + midi.blue pool reads + our explorers consume the same schemas |

**Chain applicability:** everything EVM-side serves ETH(1), ARB(42161), BASE(8453) today — wherever v2/v3/v4 live per the official deployments (18 mainnets v4 / 17 v3). **exSAT has NO canonical Uniswap** → there, our own GPL v3 (bnri-xbtc-dex-verdict).

## PART 3 — THE CHAIN MATRIX (balances + pertinent data + function, per founder's 16)

Legend: **Read** = first-party balance/tx path · **Sign** = custody tier path · **State** = tonight's verified state. Firmware = custom Trezor (bCode) chain list from DESIGN-BRIEF-03.

### EVM family
| chain | Read | Sign | State / notes |
|---|---|---|---|
| **ETH** | public JSON-RPC `eth_getBalance`/`balanceOf` + Multicall3 batching (person-scan lane pattern) | Tier 1/2/3, EIP-1559, Permit2 allowances | proven patterns in-repo |
| **ARB** | same; Arbiscan/Blockscout keyless-OK (memory law) | same | proven |
| **BASE** | same; `mainnet.base.org` keyless-OK | same | proven; MiDi lives here |
| **ExSAT** | same once RPC endpoint verified | same | **VERIFY exSAT public RPC + incumbent DEX** (no canonical Uniswap — see verdict); xBTC = 1:1 staked BTC ~$171M |
| **Vaulta** | Vaulta EVM endpoints + native EOS-line APIs | firmware ✓ (Vaulta in Tier-3 list) | **VERIFY current EVM RPC** (EOS→Vaulta rebrand) |
| **stables** | ERC-20 reads on every EVM chain above + SPL (Solana) + **HBD on HIVE** | per family | spend-view law: shown as token units, never fiat-converted itemization (KISS ruling) |

### Bitcoin family
| chain | Read | Sign | State / notes |
|---|---|---|---|
| **BTC** | Esplora/Blockbook/Electrum protocol (mempool.space API keyless) for UTXOs/balances; operator bitcoind+electrum for sovereignty | firmware ✓; **silent payments receive** (R1 — sp1q default posture) | scanner service covers derivation watch (R3) |
| **LN** | LDK in-process channel state (no third party at all) | LDK keys per tier; BOLT12 offers | operator node 24/7 + filler ear (map #10) |

### Independent chains
| chain | Read | Sign | State / notes |
|---|---|---|---|
| **Solana** | public RPC `getBalance`/`getTokenAccountsByOwner` (rate-limited) → operator RPC node | firmware ✓ (SOL in Tier-3 list) | public RPC = SERVICE class; degrade gracefully |
| **HIVE** | condenser API `getAccounts` → HIVE/HBD/HP + RC (public nodes, keyless) | active-key transfers; firmware ✓ | HP/RC = resource-denominated spend-view native |
| **Zano** | native daemon/API | firmware ✓ | **VERIFY live API surface** (privacy chain — reads may be per-output) |

### The hard tail (the wallet's real differentiators)
| chain | Read | Sign | State / notes |
|---|---|---|---|
| **BCH** | Electrum/Blockbook, cashaddr | **FIRMWARE GAP** (not in Tier-3 list; BCH sighash differs from BTC) | add to firmware lane or Tier-1/2 software signing |
| **Zcash** | t-addr via lightwalletd/insight; **UA/z-addr via VIEW KEY (view-only)** | shielded signing is local-heavy; **FIRMWARE GAP** | view-key watch = same scanner-service shape as silent payments |
| **Monero** | **private by default — balance requires a view-only wallet** (monero-wallet-rpc with the private view key; key NEVER leaves client) | cold-signing files or Tier-1/2 software keys; **FIRMWARE GAP** | heaviest chain; the operator-scanner symmetry (R3) makes it a product, not a blocker |
| **ANT (Autonomi)** | antd/CLI wallet reads | keypair per tier | ⚠ **STANDING LAW: antd REST routes are unpublished upstream — verify against the live daemon, never guess** (midivault lane) |
| **AR (Arweave)** | gateway GraphQL winston balance from JWK address; **multi-gateway fallback, never hard-code arweave.net** (RAID 2026-08-09 law) | native JWK (Tier 1/2), firmware ✓ | balance = winston; tx history via GraphQL pagination |

### Matrix laws
1. **Every Read path has a PROTOCOL-class fallback** (own node/operator service) — public endpoints are the SERVICE tier, never the only path.
2. **The three privacy chains (Zcash-UA, Monero, BTC-silent-payments) all reduce to the same shape:** client-held key, operator-run scanner. One service architecture, three chains — this is the wallet's compounding moat.
3. **Firmware gaps (BCH, Zcash, Monero) route to the firmware lane** — scope decision for the founder: extend bCode's Trezor build, or software-sign these at Tier 1/2 with clear labeling.
4. **Counts stay computed, not hand-written** (atlas law applies here too): the chain matrix is a registry the wallet renders.

## PART 4 — SPRINT-READY SEQUENCE (what this brief unlocks tomorrow)
1. wallet.html base (already 174KB, three tiers per BRIEF-03) + the registry-driven chain matrix (Part 3 as data, not prose)
2. Swap tab v1: SDK-local quotes (core) + Swapping API (enhancement) + Universal Router execution + Permit2 UX
3. BTC/LN per the lightning raid (LDK + offers + sp1q default)
4. BNRi:xBTC on exSAT per the dex verdict (own GPL v3, founder-LP, 1% tier)
5. Operator box grows the data ears: self-hosted subgraph + Quoter service + UniswapX filler (when ready)

---
*zA, acting captain. Sixteen ways counted, every one classed PROTOCOL/SERVICE/PATTERN so breakage risk is visible at a glance. The hard-tail chains are where this wallet earns its name — anyone can do an EVM balance table; view-key scanners across three privacy protocols, few.*
