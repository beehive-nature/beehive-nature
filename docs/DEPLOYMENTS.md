# DEPLOYMENTS — the authoritative inventory (RULINGS-2026-09-16 R2)

Every contract this estate deploys to a shared network (testnet or mainnet) gets a row here,
written **at deployment, not reconstructed later**. Fields: account · network/chainId ·
code sha256 · deploy txids (PUBLIC-CONSTANT) · state · authority path · receipt.

| account / artifact | network · chainId | code sha256 | deploy txids | state | authority | receipt |
|---|---|---|---|---|---|---|
| `bnrapolltest` — vending + x402 meter contract | Jungle4 · `73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d` PUBLIC-CONSTANT | per receipt (cert hash + Arweave URI banked there) | per receipt | **LIVE** (testnet; x402 session 42 fully landed) | single-key founder-held | `docs/dispatches/RECEIPT_VENDING_MINT_2026-09-01.md`, `RECEIPT_VENDING_X402_METER_2026-09-04.md` |
| `bcodexjungle` — Silent Pay v2 corpus native contract | Jungle4 · same chainId | `53cb0c7d9b48c927bfee7e9b5862b1fce9a4f6628b569d9e12888b5cdccdfead` PUBLIC-CONSTANT (39,754 B WASM) | setcode `2893570ff01672496faec10fd2c50a3b7dec36bf8d88faea68d7fc23d834e21f` PUBLIC-CONSTANT (blk 285887764) · init `ea95757bdc6b779cc72a35dab34e2373d3a729d28528383448419597aac64dbf` PUBLIC-CONSTANT (blk 285888378, corrected) | **PAUSED** — deposits disabled, zero escrow (deliberate) | Codex seat (paused by its receipts) | `docs/handoffs/silentpay-v2/docs/IMPLEMENTATION.md` |
| `banchor22222` — bdomain2 testbed | Jungle4 · same chainId | — | staged | **STAGED** | seat lane | bdomain2 lane receipts |
| `noteacct4` — privacy private-note (M3) | rehearsal: local Spring v1.2.2 (not a shared network) | — | §m3 receipts | **rehearsal** | privacy lane | `docs/specs/SPEC-PRIVACY-1.md` §m3 |
| `plonknote11` — circuit-backed PLONK verifier (M4) | rehearsal: local Spring v1.2.2 | `1ed34e44…356343` PUBLIC-CONSTANT (see §m4 for full hash) | §m4 receipts | **rehearsal** | privacy lane | `docs/specs/SPEC-PRIVACY-1.md` §m4 |
| box-side escrow + b-meter + voucher bridge (services, not contracts) | OCI box — `relay.skaists.dev/voucher/…` same-origin door | md5-verified deploys per receipts | — | **LIVE** | root on box | `RECEIPT-LIVE-DEPLOY-ESCROW-2026-08-29.md`, `RECEIPT-USDC-RAIL-DEPLOY-2026-08-29.md` |

*Seed inventory compiled 2026-09-16 from banked receipts (RULINGS-2026-09-16 D3 provenance);
new rows are appended at deployment time from here on.*
