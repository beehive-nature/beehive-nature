//! Distribution summaries that do not claim more than the sample supports.
//!
//! Every summary keeps the raw samples. Order statistics are reported by
//! sample size: one sample is reported as itself; 2 to 4 samples as min,
//! median and max; from 5 samples the mean is added; percentiles (nearest
//! rank) only from 20 samples. Nothing here computes a ratio between two
//! distributions: a speedup is not a statistic this bench reports.

use serde_json::{json, Value};

/// Smallest sample size for which p90 and p95 are reported.
pub const PERCENTILE_MIN_N: usize = 20;

pub fn summary(samples: &[u64]) -> Value {
    let n = samples.len();
    if n == 0 {
        return json!({ "n": 0, "samples": [] });
    }
    let mut s = samples.to_vec();
    s.sort_unstable();
    let median = if n % 2 == 1 {
        json!(s[n / 2])
    } else {
        let (a, b) = (s[n / 2 - 1] as u128, s[n / 2] as u128);
        if (a + b) % 2 == 0 {
            json!(((a + b) / 2) as u64)
        } else {
            json!((a + b) as f64 / 2.0)
        }
    };
    let mut v = json!({ "n": n, "samples": samples });
    if n == 1 {
        v["value"] = json!(s[0]);
        return v;
    }
    v["min"] = json!(s[0]);
    v["median"] = median;
    v["max"] = json!(s[n - 1]);
    if n >= 5 {
        let total: u128 = s.iter().map(|&x| x as u128).sum();
        v["mean"] = json!((total as f64) / (n as f64));
    }
    if n >= PERCENTILE_MIN_N {
        v["p90_nearest_rank"] = json!(nearest_rank(&s, 90));
        v["p95_nearest_rank"] = json!(nearest_rank(&s, 95));
    } else {
        v["percentiles"] = json!(format!("not reported: n = {n} < {PERCENTILE_MIN_N}"));
    }
    v
}

/// Nearest-rank percentile of sorted samples: the smallest value with at
/// least p% of the samples at or below it.
fn nearest_rank(sorted: &[u64], p: usize) -> u64 {
    let rank = (p * sorted.len()).div_ceil(100).max(1);
    sorted[rank - 1]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summaries_follow_the_sample_size() {
        let one = summary(&[7]);
        assert_eq!(one["value"], 7);
        assert!(one.get("median").is_none());

        let three = summary(&[9, 1, 5]);
        assert_eq!(
            (
                three["min"].as_u64(),
                three["median"].as_u64(),
                three["max"].as_u64()
            ),
            (Some(1), Some(5), Some(9))
        );
        assert!(three.get("mean").is_none());
        assert_eq!(
            three["samples"],
            json!([9, 1, 5]),
            "raw samples keep their run order"
        );

        let even = summary(&[1, 2, 3, 4, 5, 6]);
        assert_eq!(even["median"], json!(3.5));
        assert_eq!(even["mean"], json!(3.5));
        assert!(even.get("p95_nearest_rank").is_none());

        let twenty: Vec<u64> = (1..=20).collect();
        let s = summary(&twenty);
        assert_eq!(s["p90_nearest_rank"], 18);
        assert_eq!(s["p95_nearest_rank"], 19);
        assert_eq!(summary(&[])["n"], 0);
    }
}
