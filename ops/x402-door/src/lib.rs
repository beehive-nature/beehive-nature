//! # x402-door — the box's self-hosted x402 facilitator door
//!
//! Wraps [`x402_facilitator_local`] (reused, never forked) behind a
//! reserve→settle journal carrying watchpay's proven reservation/recovery
//! laws, with R4 per-leg unlinkability enforced structurally (one journal
//! directory per chain; logs carry one chain per line).
//!
//! Scope (chartered 2026-09-16): Base + EIP-3009 `exact` + `upto`; local/
//! testnet only; no production deployment, no 4337, no swaps, no LN
//! coupling, no extra schemes.
//!
//! Layout: [`journal`] (the ledger + its laws), [`orchestrator`] (the door
//! flow + the replaceable facilitator seam), [`wire`] (leg extraction, R4
//! logging, the HTTP surface).

pub mod config;
pub mod journal;
pub mod orchestrator;
pub mod wire;

pub use journal::{
    HumanGate, JResult, Journal, JournalError, LegKey, Reservation, ReservationState,
    SettleEvidence,
};
pub use orchestrator::{
    Door, DoorConfig, DoorError, FacilitatorSettle, SettlementFacilitator, VerifyOutcome,
};
pub use wire::extract_leg;
