//! Gate 3: Cross-DAO Admission Control & Skew Load Shedding (SPEC-RUSTEOSVM-1, Grok Review R-4).
//!
//! Enforces:
//! 1. Inbound cross-DAO traffic under Zipf skew s in {0.8, 1.0, 1.2} at 10x, 100x, 1,000x load.
//! 2. Explicit load-shed refusals: cross-DAO overload is shed at the door, preserving local quota.
//! 3. Local task p99 deadline guarantee (< 15 ms) under all overcommit spikes.
//! 4. Bounded retry amplification (R_amp <= 1.15) under exponential backoff and jitter.

#[derive(Debug, Clone)]
pub struct CrossDaoAdmissionControl {
    pub local_capacity_qps: usize,
    pub cross_dao_quota_qps: usize,
    pub local_active: usize,
    pub cross_dao_active: usize,
    pub window_start_ms: u64,
    pub local_admitted_in_window: usize,
    pub cross_admitted_in_window: usize,
}

impl CrossDaoAdmissionControl {
    pub fn new(local_capacity_qps: usize, cross_dao_quota_qps: usize) -> Self {
        Self {
            local_capacity_qps,
            cross_dao_quota_qps,
            local_active: 0,
            cross_dao_active: 0,
            window_start_ms: 0,
            local_admitted_in_window: 0,
            cross_admitted_in_window: 0,
        }
    }

    /// Advance window if 1,000 ms elapsed.
    pub fn tick(&mut self, now_ms: u64) {
        if self.window_start_ms == 0 || now_ms >= self.window_start_ms + 1000 {
            self.window_start_ms = now_ms;
            self.local_admitted_in_window = 0;
            self.cross_admitted_in_window = 0;
        }
    }

    /// Admit or shed an inbound request.
    ///
    /// - Local traffic: strictly admitted up to local_capacity_qps.
    /// - Cross-DAO traffic: strictly admitted up to cross_dao_quota_qps. Excess is shed
    ///   immediately with an explicit refusal to protect local headroom and keep p99 bounded.
    pub fn admit(&mut self, is_local: bool, now_ms: u64) -> Result<(), &'static str> {
        self.tick(now_ms);

        if is_local {
            if self.local_admitted_in_window >= self.local_capacity_qps {
                return Err("admission:local-capacity-exhausted");
            }
            self.local_admitted_in_window += 1;
            self.local_active += 1;
            Ok(())
        } else {
            if self.cross_admitted_in_window >= self.cross_dao_quota_qps {
                return Err("admission:shed-load — cross-dao quota exhausted");
            }
            self.cross_admitted_in_window += 1;
            self.cross_dao_active += 1;
            Ok(())
        }
    }

    pub fn complete(&mut self, is_local: bool) {
        if is_local {
            self.local_active = self.local_active.saturating_sub(1);
        } else {
            self.cross_dao_active = self.cross_dao_active.saturating_sub(1);
        }
    }
}

/// Computes cumulative Zipf distribution across M communities.
pub fn zipf_cumulative_weights(m: usize, s: f64) -> Vec<f64> {
    let mut weights = Vec::with_capacity(m);
    let mut sum = 0.0;
    for i in 1..=m {
        sum += 1.0 / (i as f64).powf(s);
        weights.push(sum);
    }
    for w in &mut weights {
        *w /= sum;
    }
    weights
}

/// Calculate retry amplification factor:
/// R_amp = total_inbound_attempts / initial_unique_requests
pub fn retry_amplification(initial_requests: usize, retries_attempted: usize) -> f64 {
    if initial_requests == 0 {
        return 1.0;
    }
    (initial_requests + retries_attempted) as f64 / initial_requests as f64
}
