# Zano time-lock / expiration findings (source-verified)

Answers brief §8's open question — *"still unverified whether Zano supports
native unlock_time/timeout on multisig proposals"* — against
`hyle-team/zano` `master` (checked 2026-07-03). Staked file/line citations
per the STATUS rules for "Done" claims.

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
