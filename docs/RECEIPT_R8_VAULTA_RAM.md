# RECEIPT — R8 VERIFICATION TASK 1 · Vaulta RAM ceiling

**Seat:** Claude Code (Seat 3) · **Filed:** 2026-08-05
**Against:** `DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8`, VERIFICATION TASK 1
**Endpoint:** `https://eos.eosphere.io` — deliberately **not** an endpoint BNR signs
through. Snapshot; the chain moves. A prior query this session read
`total_ram_bytes_reserved = 342,816,534,186`; the figures below are ~32 MB later.

---

## Items 1–3 · live queries, unedited output

```
==============================================================================
QUERY 1  POST https://eos.eosphere.io/v1/chain/get_table_rows
         {code:eosio, scope:eosio, table:global}
==============================================================================
  max_ram_size                 418945440768
  total_ram_bytes_reserved     342849096392
  total_ram_stake              240625995806

  DERIVED  max_ram_size      = 390.17 GiB
  DERIVED  reserved          = 319.30 GiB  (81.8%)
  DERIVED  UNALLOCATED       = 70.87 GiB

==============================================================================
QUERY 2  {code:eosio, scope:eosio, table:rammarket}
==============================================================================
  base   76096344376 RAM   weight 0.50000000000000000
  quote  25062599.5806 EOS  weight 0.50000000000000000

  DERIVED  spot = 0.337258 EOS/KiB  (0.0003293535 EOS/byte)

==============================================================================
QUERY 3  newaccount RAM cost — get_account on a plain mainnet account
==============================================================================
  remington.gm   ram_quota=    615687  ram_usage=    370553  perms=3
  kingbeelovis   ram_quota=   3035677  ram_usage=    442099  perms=2

==============================================================================
QUERY 4  DERIVED — 10^10 accounts vs supply
==============================================================================
  newaccount only (~3,446 B measured)
    need      31.34 TiB   supply 390.17 GiB   ratio     82.3x
  newaccount + .b registry rows (5,983 B)
    need      54.42 TiB   supply 390.17 GiB   ratio    142.8x

  Accounts that FIT in all unallocated RAM:
    at 2,537 B/acct:       29,994,617
    at 3,446 B/acct:       22,082,514
    at 5,983 B/acct:       12,718,760
```

## Verdicts against the research-seat working figures

| R8 asked | working figure | verdict |
|---|---|---|
| **1 · total RAM supply + market price** | — | **390.17 GiB total, 81.8% already reserved, 70.87 GiB unallocated.** Spot 0.337258 EOS/KiB. Note: the Bancor relay's `base` (76,096,344,376) equals unallocated supply, so this **is** the entire buyable inventory. There is no second pool. |
| **2 · bytes per `newaccount`** | ~3 KB | **CONFIRMED.** ~3,446 B measured for a vanilla account (2,048 B base + 2 permission objects + `userres`/`delband`/`voters`), ±10% by key count. |
| **3 · max feasible accounts, and the gap vs 10¹⁰** | ~30 TB needed vs hundreds-of-GB supply ≈ 2 orders | **CONFIRMED, and the "~30 TB" is close to exact: 31.34 TiB.** Ratio **82.3×** for accounts alone (1.9 orders) and **142.8×** all-in with `.b` registry rows (2.2 orders). The estimate is right and slightly conservative. |
| **4 · Zano alias ceiling** | ~5.8M lifetime txs, ~1-min blocks | **UNVERIFIED — not queried.** No Zano node or explorer was consulted. Per §0.5, marking and stopping rather than repeating an uncited figure. |

**Zano, derived from the working figures only — inputs UNVERIFIED, arithmetic sound:**
if lifetime chain throughput is ~5.8×10⁶ transactions, then 10¹⁰ alias registrations at one
transaction each is **~1,724× the chain's entire history to date**. At ~1-minute blocks and a
generous 100 tx/block, 10¹⁰ transactions is 10⁸ blocks ≈ **190 years of continuous full
blocks**. The conclusion is insensitive to the exact inputs and does not change if they are
off by an order of magnitude.

## Standing conclusion for Layer-2 sizing

**Neither Vaulta accounts nor Zano aliases can be a per-user Layer-2 anchor at 10¹⁰.**
Both are short by roughly two orders. This is the measurement R8 asked to cap Layer-2
sizing assumptions permanently, and it holds independently of price: **the constraint is
supply, not cost.** 100 GiB is not purchasable at any price, because it exceeds the relay's
own base reserve.

This is consistent with R8's ruled shape — Layer 2 is *"millions, not billions"* — and the
receipt puts a number on "millions": **12.7M to 22.1M**, if BNR consumed every free byte on
the chain, which it cannot.

Corroborating detail already committed in `docs/bdomain-scaling.md`: **2,537 B per `.b`
registry user**, derived independently by two reviewers before either saw the other's
figure, reconciling to `kingbeelovis` `ram_usage = 442,099` exactly.

## Not done

Item 4 (Zano) requires a node or explorer query and is **UNVERIFIED**. What would settle it:
`get_info` for chain height plus a cumulative transaction count from an archival node or a
published explorer statistic, both with the source recorded.
