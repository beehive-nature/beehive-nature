# LIVE RECEIPT — the merged voucher/escrow engine deployed to the box till (2026-08-29)

**Founder ruling:** deploy the merged engine to the live box till — the balance authority lands beside the chainpoll oracle and the NIP-42 identity layer. **bClaude's paid lane stays on HOLD** (founder's business gate): the till deploys armed but dormant until he flips it.

## Deployment
- Shipped `meter.py` (27,240 B) + `voucher_escrow.py` (9,203 B) via ssh pipe — **md5-verified byte-identical** to the tree (`13659864…` / `1ac6ae62…`), both parse on box Python 3.12.
- Backup: `/opt/buzz-meter/meter.py.pre-merge.bak`. Pre-migration snapshot: `keys.json.pre-migration` (600, ubuntu).
- Services restarted: `buzz-meter.service` (now running the merged `--watch`), `buzz-meter-gate.service`.

## The seed — one-time, hash-chained, cited
| key | pre-migration balance_A | escrow deposit | event hash |
|---|---|---|---|
| bclau-paid-1 | 1.0 | 1.0000 A @ `migration-from-keys.json` | `06fba017a22ad287…` |
| p3-test-key | 0.5 | 0.5000 A @ `migration-from-keys.json` | `f73efd24a420f52e…` |

Zero-balance keys need no deposit (they derive to 0.0000 by construction). The stored-balance era is over: `keys.json` keeps secrets/tier/revoked only; balances live in the chain.

## PROOF — live, on the box
**PROOF-1 balance parity — PASS (exact, all five keys):**
| key | pre | derived | |
|---|---|---|---|
| estate-compute-key-1 | 0.0 | 0.0000 | MATCH |
| newkey (revoked) | 0.0 | 0.0000 | MATCH |
| guest-demo-2 | 0.0 | 0.0000 | MATCH |
| bclau-paid-1 | 1.0 | 1.0000 | MATCH |
| p3-test-key | 0.5 | 0.5000 | MATCH |

**PROOF-2 chain verifies — PASS.**

**PROOF-3 hermetic round-trip on test key `live-proof-test-1` — PASS:**
- deposit 2.0000 A (cited `live-proof-roundtrip`)
- charge at posted basis: **total 0.6600 A incl. DISTINCT tithe line 0.0600 A** (0.6 basis + 10%) — event `79ba9fbf3e07cf37…`
- over-balance 148.5000 A charge **REFUSED, ledger byte-identical** (refuse-before-write proven on live disk)
- residual 1.3400 A on the test voucher; chain green throughout

**Final chain: 4 events · tip `79ba9fbf3e07cf375265694233dce3146bbe4aa0a9cec794ac2a91db6ceab163`** (PUBLIC-CONSTANT)

## Box health after restart
`buzz-meter` active (merged engine, watch loop clean journal) · `buzz-meter-gate` active · `buzz-meter-chain.timer` active · `buzz-mail-sink` active · `buzz-bclaude` active · docker: caddy + both relay stacks + albyhub **all Up (healthy)**. The caddy systemd unit reads inactive by design — caddy runs containerized (`buzz-prod-caddy-1: Up 15 hours`).

## The test voucher
`live-proof-test-1` retains 1.3400 A in its voucher — append-only means the proof stays readable in the chain forever; the amount is test-lane dust. `pool_A` 3.5 untouched in keys.json.meta (pool is chainpoll's domain, not voucher balances).
