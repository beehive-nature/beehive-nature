//! The two clock representations and the 2106 boundary, executable.
//!
//! The 2026 wire (specimen-era Antelope): `expiration` is `uint32_t`
//! seconds since 1970 (Spring v1.2.2 libfc/include/fc/time.hpp:87-99,
//! `utc_seconds` is a `uint32_t`; `maximum()` is `u32::MAX`). The
//! successor representation (what must exist before the boundary):
//! 64-bit seconds. Before the boundary the encoder FAILS CLOSED on
//! unrepresentable targets; the naive truncating encoder is kept beside
//! it as the TEETH artifact — it wraps far-future intents into
//! valid-looking past/near-future dates (semantic time travel).

/// 2^32 - 1 seconds after 1970-01-01T00:00:00Z.
pub const U32_HORIZON: u64 = 4_294_967_295;

/// The successor horizon: 2^64 - 1 seconds (u64 wire) — never crossed in
/// any plausible operational model; named so nobody mistakes the second
/// representation for the last one.
pub const U64_HORIZON: u64 = u64::MAX;

/// Which wire the execution layer is currently speaking.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TimeRep {
    /// 2026-era Antelope: expiration must fit `uint32_t`.
    U32,
    /// The successor: 64-bit seconds.
    U64,
}

impl TimeRep {
    pub fn horizon(self) -> u64 {
        match self {
            TimeRep::U32 => U32_HORIZON,
            TimeRep::U64 => U64_HORIZON,
        }
    }
}

/// The fail-closed encoder (law L4): a target the current wire cannot
/// represent is REFUSED, never truncated.
pub fn encode_expiration(rep: TimeRep, target_unix: u64) -> R<u64> {
    if target_unix > rep.horizon() {
        return refuse(
            "bt-wb004:unrepresentable",
            format!(
                "expiration {target_unix} exceeds the {} wire's representable horizon {}; \
                 refuse rather than truncate — migrate the time representation first",
                match rep {
                    TimeRep::U32 => "u32",
                    TimeRep::U64 => "u64",
                },
                rep.horizon()
            ),
        );
    }
    Ok(target_unix)
}

/// The naive truncating encoder — the TEETH artifact, never used by the
/// engine. `(target as u32)` silently wraps: a 2200-era intent becomes a
/// valid-looking 2070s date. Convicted by name in the battery.
pub fn encode_expiration_naive(target_unix: u64) -> u32 {
    target_unix as u32
}

/// What a naive-truncated target actually decodes to (the time-travel
/// witness): the wrapped value.
pub fn wrapped_target(target_unix: u64) -> u64 {
    (target_unix as u32) as u64
}

/// The largest TTL representable on the wire at `now` — the compression
/// toward the horizon. As `now` approaches the boundary, every proposal
/// must shorten; migration is not optional.
pub fn max_ttl(rep: TimeRep, now: u64) -> u64 {
    rep.horizon().saturating_sub(now)
}

/// days since 1970-01-01 → (y, m, d) proleptic Gregorian (Hinnant's
/// civil_from_days) — so the battery can assert the horizon's civil date
/// without an external time crate.
pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// (y, m, d, h, mi, s) of a unix timestamp — for receipts and asserts.
pub fn civil(unix: u64) -> (i64, u32, u32, u32, u32, u32) {
    let days = (unix / 86_400) as i64;
    let rem = unix % 86_400;
    let (y, m, d) = civil_from_days(days);
    (
        y,
        m,
        d,
        (rem / 3600) as u32,
        ((rem % 3600) / 60) as u32,
        (rem % 60) as u32,
    )
}

use crate::{refuse, R};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_horizon_is_2106_02_07_062815() {
        let (y, m, d, h, mi, s) = civil(U32_HORIZON);
        assert_eq!((y, m, d, h, mi, s), (2106, 2, 7, 6, 28, 15));
    }

    #[test]
    fn u32_refuses_the_far_future_u64_does_not() {
        assert!(encode_expiration(TimeRep::U32, U32_HORIZON + 1).is_err());
        assert_eq!(
            encode_expiration(TimeRep::U64, 18_000_000_000).unwrap(),
            18_000_000_000
        );
    }
}
