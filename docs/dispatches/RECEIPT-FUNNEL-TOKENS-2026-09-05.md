# RECEIPT — z3.3: the founder's testnet tokens — identified, read, and the tithe moved on-chain (2026-09-05)

Founder word: "I also sent you other testnet tokens to test" — 5 transfers into
`0xb43b…37af` from `0x8fddcc0c…dc5c`. All identified AT THE CONTRACTS
(keyless eth_call: name/symbol/decimals/totalSupply/balanceOf):

| token | identified as | received | still on the key |
|---|---|---|---|
| `0x036cbd53…cf7e` | **USDC** (Circle testnet, 6 dec) | 1.0 | 0.9 |
| `0xcbb7c000…b8a4a` | **cbBTC** (Coinbase Wrapped BTC testnet, 8 dec) | 0.0003 (3× drips) | 0.0003 |
| `0x80845665…359f` | **EURC** (Circle testnet, 6 dec) | 1.0 | 1.0 |

## Test 1 — the receive call sees REAL token arrivals

The wallet's own getLogs shape (topics pinned to Transfer, `to` = the
address) run against the real Circle USDC on Base Sepolia: **1 row — 1.0 USDC
from `0x8fddcc0c…dc5c`, block 46413639, tx `0x0xdf1429fa…`**. Honest
difference stated: the MAINNET call pins `from` = OrchestratorV3; Sepolia has
no orchestrator, so this test unpinned `from`. First non-empty read of the
receive path on any chain.

## Test 2 — the tithe moved on the real token (ONE ERC-20 transfer)

`broadcast.mjs --tithe-token` (new mode, same guards: tithe file, balance,
gas; amount = EXACTLY balance/10 — the 10 % law computed, never typed):

```
tx:      0x141c4441f8188222513b6f03573240020d0e2a9fb2e4436354ea6af6e291ade1  <!-- PUBLIC-CONSTANT: funnel tithe-token testnet tx hash, Base Sepolia 84532 -->
link:    https://sepolia.basescan.org/tx/0x141c4441f8188222513b6f03573240020d0e2a9fb2e4436354ea6af6e291ade1  <!-- PUBLIC-CONSTANT: same tx, explorer link -->
chain:   Base Sepolia 84532 · block 46414244 · status 0x1 · gasUsed 45,059
call:    transfer(0x8fD7252A29FB759755E30A15E966932EaAD91b75, 100000)  — selector 0xa9059cbb
log:     Transfer · from 0xb43b…37af · to 0x8fD7…1b75 · value 100000 (0.1 USDC = exactly 10 %)
```

Balances after: funnel key **0.9 USDC** (the seller share) · tithe address
**1.1 USDC** (0.1 from this tx + 1.0 the founder had sent it directly) and
0.0001 cbBTC. EURC and cbBTC stay on the key untouched — the funnel
denominates USDC; the other tokens are the founder's test material, received
and reported, not spent.

## Trap receipted

First submission of the SAME signed raw was refused by sepolia.base.org with
`Invalid params` (exit 1, nothing sent); identical bytes submitted minutes
later were ACCEPTED (same tx hash 0x141c…) and "already known" on drpc +
publicnode — a transient node-side refusal, banked: on Invalid params, retry
before diagnosing.

## Housekeeping

The key's remaining state: ~0.0011 ETH · 0.9 USDC · 0.0003 cbBTC · 1.0 EURC —
all testnet, all held for future funnel proofs.
