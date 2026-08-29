# LIVE RECEIPT — USDC-on-Base rail: engine merged, basepoll built, Rust conformance, box deployed (2026-08-29)

**Founder ruling:** USDC-on-Base is the second voucher funding door; A (Vaulta) stays the unit of account. **The rider, confirmed received and implemented as standing law:**

## THE RIDER — where each line lives
- **A/VAULTA rail = GASLESS, memo-native, NO binding table** → `voucher_escrow.py deposit(voucher, amount, vaulta_tx, sender, memo)` — sender + memo are first-class optional fields on the event, looked up from NOTHING (no table exists for this rail); the P4 header in `meter.py` carries the full rider text so the law rides the code. Nothing Base-shaped imports into it — `cmd_chainpoll` untouched.
- **USDC/BASE rail = gas, no memo → binding table stands** → `meter.py basebind/basebindings` (key ↔ 0x address, same shape as P3's pubkey bindings) + `basepoll` resolving senders through it.
- **Rate honesty:** no live A/USDC market exists; the citable source is the estate rate card (`usdc_a_rate` + `usdc_a_rate_ref` in keys.json.meta, founder-set, versioned). The same seam reads a market pair the day one exists. Every credit carries rate + rate_ref on the event.

## What landed (tree, `398fab4`)
1. **Engine** — Seat-1's `deposit_usdc()` merged onto the spec-enum base: USDC→A at explicit cited rate, dust refused, mixed rails sum to ONE A balance, tithe unchanged. Battery **16/16** in-tree.
2. **basepoll** — USDC Transfer logs (canonical topic `0xddf252ad…`, native USDC `0x8335…2913` PUBLIC-CONSTANTs) to the designated estate address via keyless Base RPC; 10k-block chunks; tx-dedupe checkpoint; **unbound senders never auto-credit** — they route to founder-word settlement instructions. ALL config (address, rate, rate_ref) fillable at flip-time; **basepoll idles unconfigured (paid lane HOLD)** — proven on the box: *"basepoll: … unset in keys.json.meta — CONFIG fillable at flip-time (paid lane HOLD); idling."*
3. **Rust conformance** — `crates/voucher-escrow`: pure u128 fixed-point (zero new deps beyond serde_json+sha2), ALL 16 proofs ported 1:1, same numbers, same laws. Both batteries in CI (python step + `cargo test --workspace`).

## Box deployment (md5-verified path, same as the live deploy)
- `meter.py` (`9075727c…`) + `voucher_escrow.py` (`ed1b937c…`) — md5-identical tree↔box.
- Services restarted and healthy: meter · gate · mail-sink · bClaude all **active**; journal clean.

## HERMETIC USDC ROUND-TRIP — live on the box ledger, test key `baseproof-1` (bound ↔ `0x907F…5738` = bzCode's wallet, the proof binding)
| step | result |
|---|---|
| USDC deposit | **12.000000 USDC @ 2.5 → 30.0000 A credited**, `rate_ref estate-rate-card@v1-hermetic` on the event — event `7b4d3b04c04edeba…` |
| dust refused | 0.00001 USDC → credits 0.0000 A → **refused** on the live ledger |
| charge + tithe | **0.6600 A total incl. DISTINCT tithe 0.0600 A** on the USDC-funded balance — event `ae62d58a2e1616b6…` |
| refuse-before-write | 148.5000 A charge **REFUSED, ledger byte-identical** (residual 29.3400) |
| chain | **6 events green · tip `ae62d58a2e1616b6ed62eaf454c4085ecbe89edcd4db28cf7ef8d369000b904a`** (PUBLIC-CONSTANT) |

## State
Paid lane stays **HOLD** — armed but dormant. To flip: set `base_receive_address` + `usdc_a_rate` + `usdc_a_rate_ref` in keys.json.meta, bind payer addresses (`basebind`), run `basepoll` (or timer it like chainpoll). The A rail needs nothing — it is already the simpler thing.
