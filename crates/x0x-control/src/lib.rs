//! x0x-control — the box-control agent that retires SSH.
//!
//! An order arrives as an ML-KEM-768 sealed envelope (see envelope.rs),
//! is opened with the agent's KEM seed, checked against a local scope
//! policy (default deny), bracketed by state probes that must pass
//! before and after execution, and answered with a full verbatim
//! receipt: every stdout/stderr byte and exit code, plus SHA3-256
//! state fingerprints of the probe outputs.
//!
//! Laws held by construction:
//! - No shell, ever. Orders carry argv; execution is execve-shaped.
//! - No order runs outside its granted scope; unknown scope = refuse.
//! - Expired orders and replayed nonces are refused before any probe.
//! - Crypto is borrowed, never written: ML-KEM-768 from bsigner::pq,
//!   AES-256-GCM keyed by HKDF-SHA-256 over the KEM shared secret,
//!   receipt signatures (optional) via the frozen bsigner CLI only.
//! - Secrets come from files/env named on the command line; key
//!   material is never printed by any subcommand.

pub mod bridge;
pub mod envelope;
pub mod exec;
pub mod order;

pub use envelope::{open_order, seal_order, KemIdentity, SealedEnvelope};
pub use exec::{execute_order, ExecOutcome};
pub use order::{CommandRule, Order, Policy, Probe, Receipt, Verdict};
