//! # bmesh-meter — the utilization-pricing engine
//!
//! Lane R-2 (`DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16` §5). A pure library:
//! no I/O, no chain access, no provider calls, no clock reads — time is injected,
//! every parameter is injected.
//!
//! ## Provenance — semantics are derived from pinned source, not from prose
//!
//! Every behavior in this crate mirrors
//! `AntelopeIO/reference-contracts @ c526479a48370981a1e9f0ac6b3bb0e4f737afa2`:
//!
//! - `contracts/eosio.system/src/powerup.cpp:262-315` — `calc_powerup_fee`:
//!   the price function, the price-integral fee, the flat-below-watermark rule,
//!   and the single `ceil` at the end.
//! - `contracts/eosio.system/src/powerup.cpp:105-117` — `update_utilization`:
//!   the adjusted-utilization ratchet with exponential decay.
//! - `contracts/eosio.system/src/powerup.cpp:203-212` — `cfgpowerup` guards:
//!   `exponent >= 1.0`, `decay_secs >= 1`, price bounds, and the
//!   `exponent == 1.0 => min_price == max_price` coupling.
//! - `contracts/eosio.system/include/eosio.system/eosio.system.hpp:721-755` —
//!   `powerup_state_resource` field types (`exponent: double`,
//!   `decay_secs: uint32_t`, `utilization`/`adjusted_utilization`/`weight`:
//!   `int64_t`).
//!
//! Where the source and any prose description disagree, the source wins. Two
//! consequences worth stating up front, both encoded here:
//!
//! 1. **The fee path is `double` arithmetic with one `ceil` at the end** — not
//!    integer arithmetic with intermediate rounding. The pinned source computes
//!    the price integral in `double` and calls `std::ceil` once
//!    (powerup.cpp:300-314). This crate does the same in `f64`. As in the
//!    source, `exp`/`pow` results may differ in the last ulp across platforms;
//!    the conformance vectors in `tests/live_conformance.rs` are chosen off
//!    integer boundaries, where that ulp cannot move the `ceil`.
//! 2. **At `exponent == 1.0` the price is flat at `max_price`**, not `min_price`
//!    (powerup.cpp:290-292 handles `exponent - 1.0 <= 0.0` by returning
//!    `max_price`), and configuration then *requires* `min_price == max_price`
//!    (powerup.cpp:210-211), which is why flat-at-max is consistent.
//!
//! ## No priced constants
//!
//! This crate contains **no default parameter values**. Curve parameter values
//! (min/max price, exponent, decay) are a founder gate — economics that no seat
//! may design (ORDERS-1:61). The live mainnet numbers appear only inside test
//! files, as captured conformance vectors.
//!
//! ## Not in scope, by fence
//!
//! No voucher struct, no primitive named voucher/bTiMe/workerbee
//! (`CONCEPT_B_COMPUTE_BID_WORKERBEE` is FILED, NOT SPECCED; the fence is named
//! in the staging dispatch §4). No on-chain reads or writes. Nothing denominated
//! in b — the S-1 grep applies to this crate.

mod curve;
mod market;
mod params;

pub use market::{FeeError, ResourceMarket, StateError};
pub use params::{ParamError, PriceCurveParams};
