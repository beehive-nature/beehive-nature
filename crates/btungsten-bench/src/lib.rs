//! bTunGsTeN RB lanes: measured Rust execution and assurance with pinned
//! Galois tools (scripts/btungsten/README.md §RB).
//!
//! - RB01: Swanky popsicle circuit-PSI cardinality, in-process and as two
//!   processes, with refusal/abort/timeout rows (`lanes::rb01`).
//! - RB02: the RustCrypto AES-256 software-backend proof of
//!   GaloisInc/rustcrypto-verification, reproduced and scoped against BNR's
//!   resolved `aes` (`lanes::rb02`).
//! - RB03: Crux-MIR properties of the actual `ops/ant-extsig` budget
//!   arithmetic (`lanes::rb03`).
//! - RB04: a Daedalus-generated Rust parser of the WB001 intent envelope
//!   against BNR's own decoder, with planted-fault TEETH (`lanes::rb04`).
//!
//! The library is the harness: subprocess measurement, host and toolchain
//! identity, verdict recognition, receipts. The `rbench` binary runs a lane.

pub mod digest;
pub mod host;
pub mod measure;
pub mod psi;
pub mod receipt;
pub mod recognize;
pub mod relay;
pub mod stats;
pub mod upstream;

pub mod lanes {
    pub mod rb01;
    pub mod rb02;
    pub mod rb03;
    pub mod rb04;
}
