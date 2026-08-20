# RECEIPT — SPEC-ERC20I-MECHANICS-1 §10 resolved: locked records carry FROZEN seeds

**Sources conserved in-tree (acting chief, same day): `docs/receipts/erc20i-s10-sources/` — both Pepi models byte-preserved from the scratchpad, with the Base/ETH naming correction of record in the README and in RECEIPT_GOOSE_PEPI_SEED_UNITS (in place).**

**zbCode (GLM seat), 2026-08-20.** The work order's "single unblock." Method: the census's
own — deployed bytecode read on **two independent RPCs per chain**, byte-equality asserted,
every decisive live call cross-read on both oracles (mismatch = abort, never average),
failed fetches recorded as failures. Read-only throughout: no transaction, no key material.

**Tool:** `docs/receipts/erc20i-s10-locked-seed.mjs` (self-contained Node, re-runnable).
Its keccak-256 is self-gated: official empty/"abc" vectors plus six selectors already
documented in-tree (`balanceOf` `70a08231`, `decimals` `313ce567`,
`mushroomOfOwnerByIndex` `0fd9587e`, `sporesDegree` `a775188a`, `transferItem` `67c65e99`,
`getOwnerItemsPage` `92d2036d`) — the gate caught two real implementation bugs before any
chain read (a transposed rho table; RC[23] `0x0000000080008008` vs canonical
`0x8000000080008008` — a one-bit error the empty-string vector exposed).

## The answer

**A locked record carries a frozen seed.** The collected mushroom (Base) / item (Ethereum
Pepi) stores its own full seed data at collection/mint; the enumeration getters return the
stored struct; transfer moves it verbatim. **Nothing recomputes from the holder.**
The marketplace-existence gate in §10 is therefore open on the art-stability axis.

One boundary travels with the answer: the record's *data* is frozen, but its *existence*
is balance-coupled on Base — outgoing transfers beyond live spores consume mushrooms FIFO
(`_removeSeedCount`, source below), so a Base marketplace must move or verify the backing
balance with the record. The ETH item model moves backing atomically (`_transferItem`
carries `value × tokenUnit` under the same itemId) — the tier-2 distinction of
COMPAT-1 §2.2, now measured at the storage level.

## 1 · Oracles

| chain | oracle A | oracle B | note |
|---|---|---|---|
| Base (0x2105) | `mainnet.base.org` (Coinbase) | `base.publicnode.com` (GatewayFM) | — |
| Ethereum (0x1) | `rpc.mevblocker.io` (Flashbots) | `ethereum-rpc.publicnode.com` (GatewayFM) | `cloudflare-eth.com` persistently rejects `eth_getCode` for the Pepi contract ("Internal error", response-size policy) — recorded as failure, replaced |

## 2 · Bytecode, two-source (eth_getCode, 'latest', byte-equal on both oracles)

| contract | address | bytes | keccak256(runtime) |
|---|---|---|---|
| PEPI Base | `0x28a5e71BFc02723eAC17E39c84c5190415C0de9F` | 21,581 | `1586d5d23e553989b0d0d92099bd380260ada89f04abcdfc5fd66b07130c1e23` | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->
| FUNGI | `0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F` | 16,523 | `72900e2710ec0b0b5139c00f3afdd7f1796484668f1902cb0f0422e988816003` | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->
| JELLI | `0xA1b9d812926a529D8B002E69FCd070c8275eC73c` | 18,602 | `eeba3c06baa4105009259b095a9398f9d0c994a4159776431962f16c75fb4bcb` | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->
| Pepi ETH | `0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51` | 24,341 | `b7e569a3f7e3759aec432eeaa8a93d7e4bac8c1d96ccbd9af38461411b3cf021` | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->

PEPI-ETH bytecode shape confirms the item model before any semantic read: selectors
`92d2036d` (getOwnerItemsPage), `c00ae885` (itemCount), `67c65e99` (transferItem),
`058e7a31` (getSvg 4-word) all present.

## 3 · Disassembly of the enumeration getters (dispatcher-located)

| contract | getter | strict body (own code) | verdict |
|---|---|---|---|
| PEPI Base | `mushroomOfOwnerByIndex` @0x285 | len 135: **SLOAD 3**, SHA3 0, **DIV 0**, CALL/STATICCALL 0 | **STORED-READ** — three SLOADs = the three stored SeedData words; no division, no external read | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->
| FUNGI | `mushroomOfOwnerByIndex` @0x259 | len 194: **SLOAD 5**, SHA3 2, **DIV 0**, CALL/STATICCALL 0 | **STORED-READ** | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->
| Pepi ETH | `getOwnerItemsPage` @0xbe8 | strict body is argument-guard + factored tail (SLOAD 0); jump-closure union: SLOAD 30, SHA3 29, **CALL/STATICCALL 0** | no external read anywhere reachable; the getter cannot consult balanceOf/decimals — corroborated by §4 | <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest -->

A recompute-from-holder getter must divide balance by `10^decimals` (DIV, or an
EXP/STATICCALL path). The strict Base bodies contain none; the ETH union contains DIVs
only in shared helpers (the `3b9aca00` literal is visible there), with zero external
calls — nothing the page getter can execute reads the holder's balance.

## 4 · Live behavior (decisive reads asserted equal on BOTH oracles)

**Base, PEPI (`decimals=9`, 281 holders walked, 8 with records):** 5 of 8 are
counterexamples to any holder-derived recompute. The extreme row:

```
holder 0xb6764607c69c13cc66205bf80eeee1b719a1bda9  mushrooms=5  balanceWhole=437  sporeSeed=0
  rec[0] seed=2  rec[1] seed=5  rec[2] seed=8      ← three distinct stored seeds, one balance
```

Wallet `0x5cceca34…`: record seed **2**, live spore seed **3**, balance floor **7** —
record ≠ spore ≠ balance in one wallet; kills recompute-from-balance and
recompute-from-spore together. COMPAT-1 §2.1's "zero spores and five frozen pieces"
wallet is real: sporeSeed=0 with records present in 7 of 8 rows (zero-balance-with-records:
0 of 8 — the backing tokens stay in the balance, per the source below).

**Base, FUNGI (6,930 holders, 7 with records examined, 2-word records — see flags):**
4 of 7 counterexamples. The extreme row:

```
holder 0x6c7116d0b65dc3de4ad07137d10c7b02adf91389  mushrooms=3  balanceWhole=60250  sporeSeed=34026
  rec[0] seed=18031  rec[1] seed=3998  rec[2] seed=4189   ← five mutually different values in one wallet
```

**Ethereum, Pepi item model (Blockscout holder list + seeded candidates):**

```
0x…dEaD              itemCount=1   item#766  lvl=5 value=8  — getSvg(stored triple) => 1733 B SVG, live
0x36847aD5c0f6…8e71  itemCount=106 items #9610/#9608/#9607, each own seed1/seed2
0x3B881994fE11…3B79  itemCount=70  items #1721–1723, each own seed1/seed2
0x40786445006E…33A6  itemCount=51  items #1429–1431, each own seed1/seed2
```

Globally-sequential itemIds and per-item seed pairs against a single balance per wallet:
stored, not derived. The dead address holds a rendering item — **art frozen in a record,
owner gone, art unchanged.**

## 5 · Source level (both models, founder-scratchpad artifacts)

- **Base `Pepi.sol`** (probe-session scratchpad, MIT; the 344-line / 3-event shape of the
  2026-08-16 correction): `_addTokenToOwnerEnumeration(to, data)` stores the **full
  SeedData copy** taken at collection (`SeedData memory data = _spores[from]`,
  transfer-growing path) or from the stored record (collected path);
  `mushroomOfOwnerByIndex` returns `_ownedTokens[owner][index]` directly. Balance-coupled
  existence: `_removeSeedCount` consumes mushrooms FIFO when outflow exceeds spores.
  Note: RECEIPT_GOOSE_PEPI_SEED_UNITS_2026-08-15 cites this file as "Pepi.sol" — it is
  the **Base** model source; its L75/L141-190 line cites match this file.
- **ETH item model `l1_Pepi.sol`** (same scratchpad): `_mintItem` rolls `seed1`/`seed2`
  **once** and stores `SeedData{lvl, value, seed1, seed2}` under a globally-unique id;
  `getOwnerItemsPage` returns `_ownedTokens[owner][itemId]`; `_transferItem` moves the
  stored struct **verbatim** with `value × tokenUnit` backing, same itemId;
  `_enforceInvariant` burns (INVARIANT) if balance falls below item totals — frozen data,
  self-enforcing existence.

## 6 · Flags raised, not resolved (collision discipline)

1. **JELLI lacks the family enumeration selectors** (`9c216508`/`0fd9587e`/`a775188a`
   absent from bytecode; only its `getSvg` `422b9e23` present; `holdersCount` answers).
   COMPAT-1 §2.1's Base-model enumeration table is not family-universal. JELLI's record
   model needs its own pass — this receipt makes no claim about it.
2. **FUNGI records are 2 words** (seed, seed2) vs PEPI's 3 (seed, seed2, extra). The
   MECHANICS-1 correction table's "Base SeedData = 3 words" holds for PEPI only.
3. PEPI-ETH address `0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51` two-sourced (in-tree
   EXPLORER_SPEC registry + probe scratchpad) and shape-verified on-chain. The census's
   "truncated 37-hex" warning against EXPLORER_SPEC:71 appears stale against the current
   file — flagged, not adjudicated.

## 7 · Downstream consequences

- **§10's marketplace question:** the art in a locked record is stable and renders from
  the record alone — a marketplace/explorer can price and display records without the
  holder's live state. Base escrows must still handle backing balances (dissolution
  coupling); the ETH item model is safe by construction (COMPAT-1 tier 2).
- **bRoSe OFFER (R-2):** the blocking unknown is closed — basket contents render and
  travel intact. The OFFER's own trap shelf (exact-amount approvals, escrow-the-payment)
  stands unchanged.
- **Apiary tier-2 lane / PepiMarketplace prior art:** item-model semantics confirmed at
  storage level — verbatim transfer under stable ids.

**Verdict: §10 bullet 1 RESOLVED — FROZEN, with receipts. Bullets 2 (over/under bug) and
3 (PEPi v1 vs v2) remain open, untouched by this work.**
