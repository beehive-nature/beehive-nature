//! bTunGsTeN WB004 — the time-extinction specimen: governance across the
//! extinction of its own time representation (SPEC-BTUNGSTEN-1 §laws
//! L1-L4, founder order 2026-10-09).
//!
//! Specimen: msig.app/jungle + eosio.msig frozen at `c526479a`
//! (scripts/btungsten/wb004-specimen/, MIT, preserved verbatim — never
//! built, never linked). The attacked boundary, verified first-hand:
//! an Antelope transaction's `expiration` is a `time_point_sec` whose
//! sole storage is `uint32_t` seconds since 1970 (Spring v1.2.2
//! `libraries/libfc/include/fc/time.hpp:87-99`), so the wire format's
//! maximum representable expiration is 2106-02-07 06:28:15 UTC —
//! seventy years short of the horizon. The reference contract gates
//! both propose and exec on it (`src/eosio.msig.cpp:56,218`).
//!
//! The four laws this workbench instantiates:
//! - L1 Millennium Authority Continuity: 10B unique ACTIVE sovereigns,
//!   continuously, across the whole horizon; authority changes only
//!   through the currently authorized sovereign action.
//! - L2 Epochal governance: what lasts 1,000 years is authority
//!   continuity, never a serialized transaction — proposals are
//!   short-lived by law; a millennium proposal is a violation.
//! - L3 The execution layer is bounded: population-scale authorization
//!   lives in uniqueness/liveness proofs and aggregation; eosio.msig's
//!   per-proposal approval vectors (specimen `eosio.msig.hpp:124-146`)
//!   receive a compact verifiable aggregate, never N rows.
//! - L4 Time-representation extinction is a boundary, not an assumption:
//!   fail closed before it (no silent wraparound), migrate across it
//!   with authority continuity intact.
//!
//! Scale honesty: the model runs at 2^16 sovereigns (sampled). The 10B
//! claim here is STRUCTURAL — per-layer counts as functions of
//! population — plus the named open physical-scale legs. Unique-human
//! proofs themselves are SK001/PQ-lane territory; this crate models
//! their interface (registration refuses duplicates), not their
//! cryptography.

pub mod authority;
pub mod epoch;
pub mod msig;
pub mod time;

use sha2::{Digest, Sha256};

/// sha256 hex of bytes — the crate's commitment idiom.
pub fn sha_hex(bytes: &[u8]) -> String {
    let d = Sha256::digest(bytes);
    d.iter().map(|b| format!("{b:02x}")).collect()
}

/// Canonical (deterministic) serialization input: sorted fields as
/// `key\x1fvalue` lines joined by `\x1e` — no ambiguity, no whitespace.
pub fn canon(pairs: &[(&str, String)]) -> String {
    let mut v: Vec<&(&str, String)> = pairs.iter().collect();
    v.sort_by_key(|(k, _)| *k);
    v.iter()
        .map(|(k, val)| format!("{k}\u{1f}{val}"))
        .collect::<Vec<_>>()
        .join("\u{1e}")
}

/// A refusal: code + reason, the estate's refusal idiom.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Refusal {
    pub code: &'static str,
    pub msg: String,
}

pub type R<T> = Result<T, Refusal>;

pub fn refuse<T>(code: &'static str, msg: impl Into<String>) -> R<T> {
    Err(Refusal {
        code,
        msg: msg.into(),
    })
}
