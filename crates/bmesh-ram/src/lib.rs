//! # bmesh-ram — the Vaulta RAM↔core market, modeled from the pinned source
//!
//! **What this is:** the STOCK-resource pricing model of the bMesh lane — the sibling
//! of `bmesh-meter` (which models the flow-resource POWERUP market). Where POWERUP
//! prices utilization of CPU/NET over time, the RAM market is a 50/50 Bancor relay —
//! algebraically a constant-product AMM — trading bytes against the core token
//! ("A" in Vaulta naming; the live table rows still carry the historical "EOS"
//! symbol, chain `aca376f2…`; same unit, same 4-decimal precision — recorded so
//! nobody "corrects" it wrongly later).
//!
//! **Pinned source** (read in full before any code existed — law 3):
//! `AntelopeIO/reference-contracts @ c526479a48370981a1e9f0ac6b3bb0e4f737afa2`
//! — `contracts/eosio.system/src/exchange_state.cpp` (the whole Bancor math, 110 lines),
//! `…/include/eosio.system/exchange_state.hpp` (the `rammarket` table struct),
//! `contracts/eosio.system/src/delegate_bandwidth.cpp` (`buyram`/`buyrambytes`/`sellram`),
//! `contracts/eosio.system/src/eosio.system.cpp` (relay init: quote seeded from
//! `token_supply/1000` — the never-deposited virtual component).
//!
//! **Facts the source forced on us** (all encoded, none assumed):
//! 1. The deployed path is `direct_convert`, whose `get_bancor_output` is
//!    **`double` arithmetic with a truncating cast** — `int64(in·ob/(ib+in))`
//!    (exchange_state.cpp:81-94). Not uint128, not rounding. The source accepts the
//!    IEEE-754 band; this crate mirrors it bit-for-bit (same promotions, same order)
//!    and the test suite measures the exact-vs-double deviation on the live corpus.
//! 2. The 0.5% fee is **integer ceil** — `(x + 199) / 200` (delegate_bandwidth.cpp:60,140)
//!    — and it **leaves the curve**: reserves move only by the fee-net amount, so the
//!    fee never re-enters pricing.
//! 3. `buyrambytes` takes the fee **twice** in approximation: `cost / 0.995` as a
//!    double, truncated to int64 (:30), then `buyram` applies its own ceil'd 0.5% on
//!    top. Consequence, measured live 2026-08-22: at state base=75,800,886,740 /
//!    quote=25,160,289.4241, `buyrambytes(4096)` yields **4095 bytes** — the deployed
//!    "exact bytes" action undershoots by one byte. Encoded as a conformance vector.
//! 4. Genesis seeds quote with `system_token_supply.amount / 1000` and nothing is ever
//!    deposited for it; buys/sells move quote and `total_ram_stake` in lockstep, so
//!    `quote − total_ram_stake` is an exact invariant (= 10,000,000,000 raw units =
//!    1,000,000.0000 core, verified live 2026-08-16 and 2026-08-22).
//!
//! **Fences** (same as bmesh-meter, R-2):
//! - no `b`-denominated amount in any identifier (S-1 grep applies);
//! - no voucher / bTiMe / workerbee primitive — none exists here;
//! - **no priced constants in `src/`** — all live numbers live in `tests/` as
//!   conformance vectors; the mechanism is parameterized by its state;
//! - no provider calls, no chain I/O, no clock — state in, state out.
//!
//! Stub law §0.7: no `#[allow(dead_code)]`, no underscore-silencing. The pow-based
//! general-weight Bancor functions (`convert_to_exchange`/`convert_from_exchange`)
//! are NOT on the RAM market's path and are therefore absent here, not silenced.

pub mod market;

pub use market::{
    bancor_input, bancor_output, RamError, RamMarket, Trade, MIN_BYTES, MIN_CORE_UNITS,
};
