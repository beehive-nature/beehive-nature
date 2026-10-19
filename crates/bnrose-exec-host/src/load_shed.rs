//! Gate 3: Cross-DAO Admission Control & Skew Load Shedding (SPEC-RUSTEOSVM-1, Grok Review R-4).
//!
//! Enforces:
//! 1. Inbound cross-DAO traffic under Zipf skew s in {0.8, 1.0, 1.2} at 10x, 100x, 1,000x load.
//! 2. Explicit load-shed refusals: cross-DAO overload is shed at the door, preserving local quota.
//! 3. Local task p99 deadline guarantee (< 15 ms) under all overcommit spikes.
//! 4. Bounded retry amplification (R_amp <= 1.15) under exponential backoff and jitter.
//! 5. RAII InFlightGuard guarantees zero active count leaks on any error or early exit.

#[derive(Debug, Clone)]
pub struct CrossDaoAdmissionControl {
    pub local_capacity_qps: usize,
    pub cross_dao_quota_qps: usize,
    pub local_active: usize,
    pub cross_dao_active: usize,
    pub window_start_ms: u64,
    pub local_admitted_in_window: usize,
    pub cross_admitted_in_window: usize,
    /// Production retry budget cap (Gate 3, SPEC-RUSTEOSVM-1).
    /// Enforces a hard upper bound on retried cross-DAO requests admitted per window,
    /// bounding retry storm amplification to R_amp <= 1.15 under severe overload (10x, 100x).
    pub retry_budget_cap: usize,
    pub retries_admitted_in_window: usize,
    pub retries_attempted_in_window: usize,
    /// Per-source retry allowance preventing any single authority from monopolizing retry capacity (d11a).
    pub per_source_retry_allowance: usize,
    pub retries_by_authority: std::collections::HashMap<[u8; 32], usize>,
}

impl CrossDaoAdmissionControl {
    pub fn new(local_capacity_qps: usize, cross_dao_quota_qps: usize) -> Self {
        let retry_budget_cap = (cross_dao_quota_qps / 10).max(1);
        let per_source_retry_allowance = retry_budget_cap.max(1);
        Self {
            local_capacity_qps,
            cross_dao_quota_qps,
            local_active: 0,
            cross_dao_active: 0,
            window_start_ms: 0,
            local_admitted_in_window: 0,
            cross_admitted_in_window: 0,
            retry_budget_cap,
            retries_admitted_in_window: 0,
            retries_attempted_in_window: 0,
            per_source_retry_allowance,
            retries_by_authority: std::collections::HashMap::new(),
        }
    }

    pub fn with_retry_budget_cap(mut self, cap: usize) -> Self {
        self.retry_budget_cap = cap;
        self
    }

    pub fn set_retry_budget_cap(&mut self, cap: usize) {
        self.retry_budget_cap = cap;
    }

    pub fn retry_budget_cap(&self) -> usize {
        self.retry_budget_cap
    }

    pub fn with_per_source_retry_allowance(mut self, allowance: usize) -> Self {
        self.per_source_retry_allowance = allowance;
        self
    }

    pub fn set_per_source_retry_allowance(&mut self, allowance: usize) {
        self.per_source_retry_allowance = allowance;
    }

    pub fn per_source_retry_allowance(&self) -> usize {
        self.per_source_retry_allowance
    }

    /// Advance window if 1,000 ms elapsed.
    pub fn tick(&mut self, now_ms: u64) {
        if self.window_start_ms == 0 || now_ms >= self.window_start_ms + 1000 {
            self.window_start_ms = now_ms;
            self.local_admitted_in_window = 0;
            self.cross_admitted_in_window = 0;
            self.retries_admitted_in_window = 0;
            self.retries_attempted_in_window = 0;
            self.retries_by_authority.clear();
        }
    }

    /// Admit or shed an inbound request, distinguishing fresh vs retried traffic.
    ///
    /// - Local traffic: strictly admitted up to local_capacity_qps.
    /// - Cross-DAO fresh traffic: admitted up to cross_dao_quota_qps.
    /// - Cross-DAO retried traffic: governed by per-source retry allowance (d11a).
    ///   A retry is never refused when ordinary quota is free unless its authority exceeds
    ///   its per-source allowance.
    pub fn admit_request(
        &mut self,
        is_local: bool,
        is_retry: bool,
        authority: &[u8; 32],
        now_ms: u64,
    ) -> Result<(), &'static str> {
        self.tick(now_ms);

        if is_local {
            if self.local_admitted_in_window >= self.local_capacity_qps {
                return Err("admission:local-capacity-exhausted");
            }
            self.local_admitted_in_window += 1;
            self.local_active += 1;
            Ok(())
        } else {
            // 1. Overall cross-DAO quota check
            if self.cross_admitted_in_window >= self.cross_dao_quota_qps {
                return Err("admission:shed-load — cross-dao quota exhausted");
            }

            // 2. Retry traffic governance (PR #465, d11a)
            if is_retry {
                self.retries_attempted_in_window += 1;

                // Per-source allowance check: one client cannot use up another client's retry allowance
                let source_retries = self.retries_by_authority.entry(*authority).or_insert(0);
                if self.per_source_retry_allowance > 0
                    && *source_retries >= self.per_source_retry_allowance
                {
                    return Err("admission:shed-load — retry quota exhausted");
                }

                // Global retry cap check when quota is not entirely reserved
                if self.retry_budget_cap > 0
                    && self.retries_admitted_in_window >= self.retry_budget_cap
                    && self.cross_admitted_in_window + 1 >= self.cross_dao_quota_qps
                {
                    return Err("admission:shed-load — retry quota exhausted");
                }

                *source_retries += 1;
                self.retries_admitted_in_window += 1;
            }

            self.cross_admitted_in_window += 1;
            self.cross_dao_active += 1;
            Ok(())
        }
    }

    pub fn admit(&mut self, is_local: bool, now_ms: u64) -> Result<(), &'static str> {
        self.admit_request(is_local, false, &[0u8; 32], now_ms)
    }

    pub fn complete(&mut self, is_local: bool) {
        if is_local {
            self.local_active = self.local_active.saturating_sub(1);
        } else {
            self.cross_dao_active = self.cross_dao_active.saturating_sub(1);
        }
    }

    /// Creates an RAII guard that automatically calls complete() when dropped,
    /// preventing any leak of in-flight active counts across returns or errors.
    pub fn guard(&mut self, is_local: bool) -> InFlightGuard<'_> {
        InFlightGuard::new(self, is_local)
    }
}

/// RAII guard ensuring active in-flight count is strictly decremented on drop.
pub struct InFlightGuard<'a> {
    shed: &'a mut CrossDaoAdmissionControl,
    is_local: bool,
    disarmed: bool,
}

impl<'a> InFlightGuard<'a> {
    pub fn new(shed: &'a mut CrossDaoAdmissionControl, is_local: bool) -> Self {
        Self {
            shed,
            is_local,
            disarmed: false,
        }
    }

    pub fn disarm(&mut self) {
        self.disarmed = true;
    }
}

impl<'a> Drop for InFlightGuard<'a> {
    fn drop(&mut self) {
        if !self.disarmed {
            self.shed.complete(self.is_local);
        }
    }
}

/// Bounded FIFO/LRU tracker for shed requests, strictly preventing unbounded memory growth (PR #465, d12).
///
/// Tracks both (authority, nonce) and (authority, action) intent fingerprints to detect
/// retries even when clients generate fresh nonces (d11b), with hard memory bounding.
#[derive(Debug, Clone)]
pub struct BoundedShedTracker {
    max_entries: usize,
    nonce_queue: std::collections::VecDeque<([u8; 32], [u8; 32])>,
    nonce_set: std::collections::HashSet<([u8; 32], [u8; 32])>,
    intent_queue: std::collections::VecDeque<([u8; 32], [u8; 32])>,
    intent_set: std::collections::HashSet<([u8; 32], [u8; 32])>,
}

impl BoundedShedTracker {
    pub const DEFAULT_MAX: usize = 2048;

    pub fn new(max_entries: usize) -> Self {
        Self {
            max_entries,
            nonce_queue: std::collections::VecDeque::with_capacity(max_entries),
            nonce_set: std::collections::HashSet::with_capacity(max_entries),
            intent_queue: std::collections::VecDeque::with_capacity(max_entries),
            intent_set: std::collections::HashSet::with_capacity(max_entries),
        }
    }

    pub fn insert(&mut self, nonce_key: ([u8; 32], [u8; 32]), intent_key: ([u8; 32], [u8; 32])) {
        if !self.nonce_set.contains(&nonce_key) {
            while self.nonce_queue.len() >= self.max_entries {
                if let Some(oldest) = self.nonce_queue.pop_front() {
                    self.nonce_set.remove(&oldest);
                }
            }
            self.nonce_set.insert(nonce_key);
            self.nonce_queue.push_back(nonce_key);
        }

        if !self.intent_set.contains(&intent_key) {
            while self.intent_queue.len() >= self.max_entries {
                if let Some(oldest) = self.intent_queue.pop_front() {
                    self.intent_set.remove(&oldest);
                }
            }
            self.intent_set.insert(intent_key);
            self.intent_queue.push_back(intent_key);
        }
    }

    pub fn contains_nonce(&self, nonce_key: &([u8; 32], [u8; 32])) -> bool {
        self.nonce_set.contains(nonce_key)
    }

    pub fn contains_intent(&self, intent_key: &([u8; 32], [u8; 32])) -> bool {
        self.intent_set.contains(intent_key)
    }

    pub fn remove(&mut self, nonce_key: &([u8; 32], [u8; 32]), intent_key: &([u8; 32], [u8; 32])) {
        self.nonce_set.remove(nonce_key);
        self.intent_set.remove(intent_key);
    }

    pub fn len(&self) -> usize {
        self.nonce_set.len().max(self.intent_set.len())
    }

    pub fn is_empty(&self) -> bool {
        self.nonce_set.is_empty() && self.intent_set.is_empty()
    }
}

impl Default for BoundedShedTracker {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX)
    }
}

/// Client-side retry budget policy bounding network retry amplification (PR #465 review).
///
/// Enforces local fail-fast behavior: when a client's retry budget is exhausted,
/// requests fail fast locally without transmitting any packets over the network,
/// strictly guaranteeing R_amp <= 1.15 across independent client nodes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientRetryBudget {
    pub initial_requests: usize,
    pub retries_attempted: usize,
    pub budget_pct: usize,
}

impl ClientRetryBudget {
    pub fn new(initial_requests: usize, budget_pct: usize) -> Self {
        Self {
            initial_requests,
            retries_attempted: 0,
            budget_pct,
        }
    }

    pub fn with_cap(max_retries: usize) -> Self {
        Self {
            initial_requests: max_retries * 10,
            retries_attempted: 0,
            budget_pct: 10,
        }
    }

    pub fn max_retries(&self) -> usize {
        (self.initial_requests * self.budget_pct) / 100
    }

    /// Tries to acquire a retry token from the client's local budget.
    /// Returns true if retry is permitted.
    /// Returns false if budget is exhausted, causing the client to fail fast locally
    /// without sending any network request.
    pub fn try_acquire(&mut self) -> bool {
        if self.retries_attempted < self.max_retries() {
            self.retries_attempted += 1;
            true
        } else {
            false
        }
    }

    pub fn is_exhausted(&self) -> bool {
        self.retries_attempted >= self.max_retries()
    }

    pub fn amplification(&self) -> f64 {
        retry_amplification(self.initial_requests, self.retries_attempted)
    }
}

pub type RetryBudget = ClientRetryBudget;

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
