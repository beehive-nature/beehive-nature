# Zano escrow-primitive findings (source-verified)

Answers brief §8's open questions — time-locks/timeouts AND the multisig
co-signing surface — against `hyle-team/zano` `master` (checked 2026-07-03).
Staked file/line citations per the STATUS rules for "Done" claims.

## ⚠ REFUTED: "DRO signs via standard `sign_multisig_proposal` RPC"

Brief §8 records this as confirmed. **Per current master it is not**: the
wallet RPC dispatch (`wallet_rpc_server.cpp`) contains **no**
`sign_multisig_proposal`, and no raw N-of-M multisig methods at all
(`grep sign_multisig` = 0 hits). What the wallet RPC actually exposes is
the built-in two-party escrow-contract flow: `contracts_send_proposal`,
`contracts_accept_proposal`, `contracts_get_all`, `contracts_release`,
`contracts_request_cancel`, `contracts_accept_cancel`
(`wallet_rpc_server.cpp:1226–1277`).

Two further constraints on those built-in contracts:
- **Two-party only.** `contract_private_details` has `a_addr` (buyer) /
  `b_addr` (seller) and pledges — no third-party arbiter slot
  (`bc_escrow_service.h:25-33`).
- **ZANO-only.** `amount_to_pay` / pledges are bare `uint64` — **no
  `asset_id` field**, so they cannot carry fUSD.

**What still stands:** consensus fully supports raw N-of-M multisig outputs
(`txout_multisig { minimum_sigs, keys[] }`, `currency_basic.h:310`), and
the wallet C++ layer builds and spends them internally
(`wallet2.h:135` `m_multisig_transfers`, `wallet2.h:542` transfer-with-
multisig_id, `wallet2.h:558` `build_escrow_release_templates`). The
capability exists; the *stock RPC surface* for an external co-signer does
not.

**Consequences for the DRO design** (decision needed, not tonight):
1. Integrate at the wallet2 C++ API layer (link the wallet lib) — heavier,
   but the host is already a tx-building coordinator under proto v0.3;
2. construct/co-sign multisig spends with our own tx code (consistent with
   the Trezor-native architecture, most work);
3. contribute a raw-multisig RPC upstream to Zano;
4. NOT an option: the built-in contracts (two-party, ZANO-only).

## The three native mechanisms

**1. Per-output time-locks — `unlock_time` / `unlock_time2`.**
`currency_basic.h:997` (`etc_tx_details_unlock_time`, one value per tx) and
`currency_basic.h:1007` (`etc_tx_details_unlock_time2`,
`unlock_time_array[i]` per output index). Source comment: *"spend this tx
not early then block/time."* Applies to any output — including
`txout_multisig` (`currency_basic.h:310`: `{ minimum_sigs, keys[] }`).
Semantics: **delays spendability. It is a lock, not an expiry — it never
auto-refunds anyone.**

**2. Transaction expiration — `etc_tx_details_expiration_time`
(`currency_basic.h:1015`), consensus-enforced at both gates:**
- tx pool: rejected on entry if expired — `tx_pool.cpp:158`
- block inclusion: `CHECK_AND_ASSERT_MES(!is_tx_expired(tx), …)` —
  `blockchain_storage.cpp:5531`

Validity condition (`currency_format_utils_transactions.cpp:543`):
`expiration_time − TX_EXPIRATION_MEDIAN_SHIFT > median(last 20 block
timestamps)`, with `TX_EXPIRATION_MEDIAN_SHIFT = 10 × DIFFICULTY_TOTAL_TARGET`
(`currency_config.h:99-100`) — i.e. the effective deadline sits one
median-shift *before* the stated timestamp; build margins accordingly.

**3. Multisig spend "proposals" are off-chain objects.** A partially signed
multisig spend is just bytes passed between parties; the chain never sees
it until broadcast. **There is no on-chain proposal object and therefore no
proposal-level timeout** — nothing exists for consensus to expire. (Zano's
built-in escrow *contract templates* are a different, higher-level flow the
Beehive design does not use.)

## Consequences for escrow-core (§9.1 assumptions)

- **The state machine's off-chain timeout model stands and remains
  required.** Nothing on-chain moves funds at time T; `Timeout` events stay
  engine-driven with DRO co-signed refunds/releases. escrow-core is built
  on exactly this assumption — now verified rather than assumed.
- **Hardening option unlocked — expiring pre-signed transactions.** Any
  co-signed release/refund tx can carry `expiration_time`, making stale
  proposals *unbroadcastable* after the state machine has moved on. Example:
  a buyer-co-signed release expiring at the dispute deadline cannot be
  replayed after an auto-refund. This kills a race class at the adapter
  layer with zero state-machine changes. Design note for the future Zano
  action adapter; not current work.
- **`unlock_time` is not useful as an escrow timeout** (it delays, never
  reverts) — do not reach for it when wiring timeouts.

## Fee-buffer half of the checklist (status)

Already a **confirmed constraint** (brief §8, §9.2 amendment): a multisig
wallet cannot spend an asset without holding native ZANO for the fee;
escrow funding = `amount + fee_buffer_zano`; the DRO never needs a balance.
Still open on the testnet track: re-run the §1.7 asset-multisig flow **with
the fUSD asset id specifically**. Requires a synced testnet daemon plus
faucet-funded wallets (testnet build v2.2.0.489 verified by SHA256 against
docs.zano.org and syncing as of this writing; faucet step needs a human).
