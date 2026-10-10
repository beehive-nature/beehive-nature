//! Boot readiness for the WASM corpus harness: when may the first
//! transaction go to a fresh nodeos?
//!
//! cleos stamps every transaction expiration = head_block_time + 30s (its
//! default -x), reading get_info anew per invocation (TAPOS and expiry are
//! re-fetched per transaction). The failure this guards (push run
//! 37713028801, job 113103087283): the harness answered at head 1, the 2018
//! genesis block, so the tx carried "expiration 2018-06-01T12:00:30.000"
//! and died at "block time 2026-10-08T01:28:06.000".
//!
//! Ready means all three:
//!   1. past genesis   head_block_num >= 2 (head 1 carries genesis time)
//!   2. producing      the head advanced since the previous poll
//!   3. fresh          |now - head time| under half the expiry window

pub const CLEOS_EXPIRY_S: i64 = 30;
pub const FRESH_MS: i64 = CLEOS_EXPIRY_S * 1000 / 2;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Head {
    pub num: u64,
    /// cleos's head_block_time, e.g. "2026-10-08T01:28:05.500" (UTC, maybe no Z)
    pub time: String,
}

/// Milliseconds since the Unix epoch of an ISO-8601 UTC timestamp
/// ("YYYY-MM-DDTHH:MM:SS[.fff][Z]"). `None` if it does not parse.
pub fn iso_ms(t: &str) -> Option<i64> {
    let t = t.strip_suffix('Z').unwrap_or(t);
    let (date, time) = t.split_once('T')?;
    let mut d = date.split('-').map(|x| x.parse::<i64>());
    let (y, mo, da) = (d.next()?.ok()?, d.next()?.ok()?, d.next()?.ok()?);
    let (hms, frac) = time.split_once('.').unwrap_or((time, "0"));
    let mut h = hms.split(':').map(|x| x.parse::<i64>());
    let (hh, mm, ss) = (h.next()?.ok()?, h.next()?.ok()?, h.next()?.ok()?);
    let ms: i64 = format!("{:0<3}", &frac[..frac.len().min(3)]).parse().ok()?;
    // days from civil (Howard Hinnant's algorithm)
    let y2 = if mo <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * (mo + if mo > 2 { -3 } else { 9 }) + 2) / 5 + da - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some(((days * 24 + hh) * 60 + mm) * 60_000 + ss * 1000 + ms)
}

/// The reason the chain is NOT ready, or `None` when it is.
pub fn not_ready_reason(prev: Option<&Head>, info: &Head, now_ms: i64) -> Option<String> {
    if info.num < 2 {
        return Some(format!("head {} is genesis", info.num));
    }
    match prev {
        Some(p) if info.num > p.num => {}
        _ => {
            return Some(format!(
                "head {} has not advanced since the last poll",
                info.num
            ))
        }
    }
    let Some(t) = iso_ms(&info.time) else {
        return Some(format!("unparsed head_block_time {}", info.time));
    };
    let skew = now_ms - t;
    if skew.abs() >= FRESH_MS {
        return Some(format!(
            "head time {} is {skew}ms from now (bound {FRESH_MS}ms)",
            info.time
        ));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> i64 {
        iso_ms("2026-10-08T01:28:05.551Z").unwrap()
    }
    fn at(num: u64, ms: i64) -> Head {
        let secs = ms.div_euclid(1000);
        let days = secs.div_euclid(86_400);
        let rem = secs.rem_euclid(86_400);
        // civil from days (inverse of iso_ms)
        let z = days + 719_468;
        let era = z.div_euclid(146_097);
        let doe = z - era * 146_097;
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let m = if mp < 10 { mp + 3 } else { mp - 9 };
        let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
        Head {
            num,
            time: format!(
                "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}",
                rem / 3600,
                rem % 3600 / 60,
                rem % 60,
                ms.rem_euclid(1000)
            ),
        }
    }

    #[test]
    fn the_failing_run_head_1_at_genesis_is_not_ready() {
        let g = Head {
            num: 1,
            time: "2018-06-01T12:00:00.000".into(),
        };
        assert!(not_ready_reason(None, &g, now())
            .unwrap()
            .contains("genesis"));
        // the receipt's arithmetic: cleos expiry = genesis + 30s
        assert_eq!(
            iso_ms("2018-06-01T12:00:30.000").unwrap() - iso_ms(&g.time).unwrap(),
            CLEOS_EXPIRY_S * 1000
        );
    }

    #[test]
    fn a_current_head_that_has_not_advanced_is_not_ready() {
        let h = at(2, now() - 200);
        assert!(not_ready_reason(None, &h, now())
            .unwrap()
            .contains("not advanced"));
        assert!(not_ready_reason(Some(&h), &h, now())
            .unwrap()
            .contains("not advanced"));
    }

    #[test]
    fn a_head_stale_past_half_the_expiry_window_is_not_ready() {
        let stale = at(5, now() - 40_000); // a tx would expire 10s BEFORE it was sent
        assert!(
            not_ready_reason(Some(&at(4, now() - 40_500)), &stale, now())
                .unwrap()
                .contains("bound")
        );
    }

    #[test]
    fn a_head_from_the_future_is_not_ready() {
        assert!(
            not_ready_reason(Some(&at(2, now())), &at(3, now() + FRESH_MS + 1), now())
                .unwrap()
                .contains("bound")
        );
    }

    #[test]
    fn an_advancing_fresh_post_genesis_head_is_ready_with_15s_of_expiry_left() {
        let h = at(3, now() - 500);
        assert_eq!(
            not_ready_reason(Some(&at(2, now() - 1000)), &h, now()),
            None
        );
        assert!(iso_ms(&h.time).unwrap() + CLEOS_EXPIRY_S * 1000 - now() >= FRESH_MS);
    }

    #[test]
    fn iso_round_trips_and_reads_the_z_form() {
        assert_eq!(iso_ms("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(
            iso_ms("2026-10-08T01:28:06.000"),
            iso_ms("2026-10-08T01:28:06Z")
        );
        let t = now();
        assert_eq!(iso_ms(&at(9, t).time), Some(t));
    }
}
