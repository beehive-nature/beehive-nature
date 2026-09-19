//! bpay-sign library surface — the pieces shared between the signing
//! cockpit service (`src/main.rs`) and the Safe 7 preflight binary
//! (`src/bin/safe7_preflight.rs`).
//!
//! - [`suite_mcp`] — the Trezor Suite 26.9.2 experimental MCP transport
//!   adapter, installed/runtime-verified 2026-09-19 (see the module docs
//!   for the evidence pins). It implements the SAME
//!   [`watchpay::connect::ConnectTransport`] boundary the hot testnet key
//!   implements; nothing above the boundary changes.
//! - [`rlp`] — the minimal 1559 RLP encoder used by the hot-key transport
//!   (the device path needs no local RLP: the device/Connect side
//!   serializes).

pub mod rlp;
pub mod suite_mcp;
