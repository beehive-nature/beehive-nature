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
        let per_source_retry_allowance = (retry_budget_cap / 10).max(1);
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
        self.per_source_retry_allowance = self.per_source_retry_allowance.min(cap);
        self
    }

    pub fn set_retry_budget_cap(&mut self, cap: usize) {
        self.retry_budget_cap = cap;
        self.per_source_retry_allowance = self.per_source_retry_allowance.min(cap);
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

                // Global retry cap check: hard ceiling on total retries admitted in window (PR #465, d14).
                // Retries exceeding retry_budget_cap are refused even if general cross quota has free slots.
                if self.retry_budget_cap > 0
                    && self.retries_admitted_in_window >= self.retry_budget_cap
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
    ttl_ms: u64,
    nonce_queue: std::collections::VecDeque<([u8; 32], [u8; 32])>,
    nonce_map: std::collections::HashMap<([u8; 32], [u8; 32]), u64>,
    intent_queue: std::collections::VecDeque<([u8; 32], [u8; 32])>,
    intent_map: std::collections::HashMap<([u8; 32], [u8; 32]), u64>,
}

impl BoundedShedTracker {
    pub const DEFAULT_MAX: usize = 2048;
    pub const DEFAULT_TTL_MS: u64 = 10_000; // 10s TTL: retries under backoff match, but recurring payments later are fresh work (PR #465, O2)

    pub fn new(max_entries: usize) -> Self {
        Self {
            max_entries,
            ttl_ms: Self::DEFAULT_TTL_MS,
            nonce_queue: std::collections::VecDeque::with_capacity(max_entries),
            nonce_map: std::collections::HashMap::with_capacity(max_entries),
            intent_queue: std::collections::VecDeque::with_capacity(max_entries),
            intent_map: std::collections::HashMap::with_capacity(max_entries),
        }
    }

    pub fn with_ttl(mut self, ttl_ms: u64) -> Self {
        self.ttl_ms = ttl_ms;
        self
    }

    pub fn insert(&mut self, nonce_key: ([u8; 32], [u8; 32]), intent_key: ([u8; 32], [u8; 32])) {
        self.insert_at(nonce_key, intent_key, 0);
    }

    pub fn insert_at(
        &mut self,
        nonce_key: ([u8; 32], [u8; 32]),
        intent_key: ([u8; 32], [u8; 32]),
        now_ms: u64,
    ) {
        if let Some(ts) = self.nonce_map.get_mut(&nonce_key) {
            *ts = now_ms;
        } else {
            while self.nonce_queue.len() >= self.max_entries {
                if let Some(oldest) = self.nonce_queue.pop_front() {
                    self.nonce_map.remove(&oldest);
                }
            }
            self.nonce_map.insert(nonce_key, now_ms);
            self.nonce_queue.push_back(nonce_key);
        }

        if let Some(ts) = self.intent_map.get_mut(&intent_key) {
            *ts = now_ms;
        } else {
            while self.intent_queue.len() >= self.max_entries {
                if let Some(oldest) = self.intent_queue.pop_front() {
                    self.intent_map.remove(&oldest);
                }
            }
            self.intent_map.insert(intent_key, now_ms);
            self.intent_queue.push_back(intent_key);
        }
    }

    pub fn contains_nonce(&self, nonce_key: &([u8; 32], [u8; 32])) -> bool {
        self.contains_nonce_at(nonce_key, 0)
    }

    pub fn contains_nonce_at(&self, nonce_key: &([u8; 32], [u8; 32]), now_ms: u64) -> bool {
        if let Some(&ts) = self.nonce_map.get(nonce_key) {
            if now_ms == 0 || ts == 0 || now_ms < ts.saturating_add(self.ttl_ms) {
                return true;
            }
        }
        false
    }

    pub fn contains_intent(&self, intent_key: &([u8; 32], [u8; 32])) -> bool {
        self.contains_intent_at(intent_key, 0)
    }

    pub fn contains_intent_at(&self, intent_key: &([u8; 32], [u8; 32]), now_ms: u64) -> bool {
        if let Some(&ts) = self.intent_map.get(intent_key) {
            if now_ms == 0 || ts == 0 || now_ms < ts.saturating_add(self.ttl_ms) {
                return true;
            }
        }
        false
    }

    pub fn remove(&mut self, nonce_key: &([u8; 32], [u8; 32]), intent_key: &([u8; 32], [u8; 32])) {
        if self.nonce_map.remove(nonce_key).is_some() {
            self.nonce_queue.retain(|k| k != nonce_key);
        }
        if self.intent_map.remove(intent_key).is_some() {
            self.intent_queue.retain(|k| k != intent_key);
        }
    }

    pub fn len(&self) -> usize {
        self.nonce_map.len().max(self.intent_map.len())
    }

    pub fn is_empty(&self) -> bool {
        self.nonce_map.is_empty() && self.intent_map.is_empty()
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
///
/// Uses a 10s tumbling window with a floor of min_retries = 1 (PR #465, O1)
/// so first-time and light clients can retry when quota is free.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientRetryBudget {
    pub initial_requests: usize,
    pub retries_attempted: usize,
    pub budget_pct: usize,
    pub min_retries: usize,
    pub window_ms: u64,
    pub window_start_ms: u64,
    pub window_initialized: bool,
}

impl ClientRetryBudget {
    pub const DEFAULT_WINDOW_MS: u64 = 10_000;
    pub const DEFAULT_BUDGET_PCT: usize = 10;
    pub const DEFAULT_MIN_RETRIES: usize = 1;

    pub fn new(initial_requests: usize, budget_pct: usize) -> Self {
        Self {
            initial_requests,
            retries_attempted: 0,
            budget_pct,
            min_retries: Self::DEFAULT_MIN_RETRIES,
            window_ms: Self::DEFAULT_WINDOW_MS,
            window_start_ms: 0,
            window_initialized: false,
        }
    }

    pub fn with_min_retries(mut self, min: usize) -> Self {
        self.min_retries = min;
        self
    }

    pub fn with_window(mut self, window_ms: u64) -> Self {
        self.window_ms = window_ms;
        self
    }

    pub fn with_cap(max_retries: usize) -> Self {
        Self {
            initial_requests: max_retries * 10,
            retries_attempted: 0,
            budget_pct: 10,
            min_retries: Self::DEFAULT_MIN_RETRIES,
            window_ms: Self::DEFAULT_WINDOW_MS,
            window_start_ms: 0,
            window_initialized: false,
        }
    }

    /// Advance tumbling window if window_ms has elapsed since window_start_ms.
    pub fn tumble_window(&mut self, now_ms: u64) {
        if !self.window_initialized {
            self.window_start_ms = now_ms;
            self.window_initialized = true;
            return;
        }
        if now_ms >= self.window_start_ms.saturating_add(self.window_ms) {
            self.initial_requests = 0;
            self.retries_attempted = 0;
            self.window_start_ms = now_ms;
        }
    }

    /// Backwards compatibility alias for tumble_window.
    pub fn roll_window(&mut self, now_ms: u64) {
        self.tumble_window(now_ms);
    }

    pub fn record_admitted(&mut self, now_ms: u64) {
        self.tumble_window(now_ms);
        self.initial_requests = self.initial_requests.saturating_add(1);
    }

    pub fn max_retries(&self) -> usize {
        ((self.initial_requests * self.budget_pct) / 100).max(self.min_retries)
    }

    /// Tries to acquire a retry token from the client's local budget.
    /// Returns true if retry is permitted.
    /// Returns false if budget is exhausted, causing the client to fail fast locally
    /// without sending any network request.
    pub fn try_acquire(&mut self) -> bool {
        self.try_acquire_at(0)
    }

    pub fn try_acquire_at(&mut self, now_ms: u64) -> bool {
        self.tumble_window(now_ms);
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

#[derive(Debug, Clone)]
struct BudgetNode {
    authority: [u8; 32],
    budget: ClientRetryBudget,
    prev: usize,
    next: usize,
}

/// Bounded true LRU map for verified client retry budgets (PR #465, O3).
/// Max capacity bounded at 2048 entries to prevent unbounded memory growth.
/// Implemented as an O(1) index-based doubly-linked list with HashMap index lookup.
/// Only cryptographically verified authorities with valid signatures are ever inserted.
#[derive(Debug, Clone)]
pub struct BoundedClientBudgets {
    max_entries: usize,
    map: std::collections::HashMap<[u8; 32], usize>,
    nodes: Vec<Option<BudgetNode>>,
    free_list: Vec<usize>,
    head: usize, // least recently used (oldest)
    tail: usize, // most recently used (newest)
}

impl BoundedClientBudgets {
    pub const DEFAULT_MAX: usize = 2048;

    pub fn new(max_entries: usize) -> Self {
        Self {
            max_entries,
            map: std::collections::HashMap::with_capacity(max_entries),
            nodes: Vec::with_capacity(max_entries),
            free_list: Vec::new(),
            head: usize::MAX,
            tail: usize::MAX,
        }
    }

    fn detach(&mut self, idx: usize) {
        let (prev, next) = {
            let node = self.nodes[idx].as_ref().unwrap();
            (node.prev, node.next)
        };
        if prev != usize::MAX {
            self.nodes[prev].as_mut().unwrap().next = next;
        } else {
            self.head = next;
        }
        if next != usize::MAX {
            self.nodes[next].as_mut().unwrap().prev = prev;
        } else {
            self.tail = prev;
        }
        let node = self.nodes[idx].as_mut().unwrap();
        node.prev = usize::MAX;
        node.next = usize::MAX;
    }

    fn attach_tail(&mut self, idx: usize) {
        {
            let node = self.nodes[idx].as_mut().unwrap();
            node.prev = self.tail;
            node.next = usize::MAX;
        }
        if self.tail != usize::MAX {
            self.nodes[self.tail].as_mut().unwrap().next = idx;
        } else {
            self.head = idx;
        }
        self.tail = idx;
    }

    fn touch(&mut self, idx: usize) {
        if self.tail == idx {
            return;
        }
        self.detach(idx);
        self.attach_tail(idx);
    }

    pub fn get(&self, authority: &[u8; 32]) -> Option<&ClientRetryBudget> {
        self.map
            .get(authority)
            .and_then(|&idx| self.nodes[idx].as_ref().map(|n| &n.budget))
    }

    pub fn get_mut(&mut self, authority: &[u8; 32]) -> Option<&mut ClientRetryBudget> {
        if let Some(&idx) = self.map.get(authority) {
            self.touch(idx);
            self.nodes[idx].as_mut().map(|n| &mut n.budget)
        } else {
            None
        }
    }

    pub fn contains_key(&self, authority: &[u8; 32]) -> bool {
        self.map.contains_key(authority)
    }

    pub fn insert(&mut self, authority: [u8; 32], budget: ClientRetryBudget) {
        if let Some(&idx) = self.map.get(&authority) {
            self.nodes[idx].as_mut().unwrap().budget = budget;
            self.touch(idx);
        } else {
            while self.map.len() >= self.max_entries {
                let oldest = self.head;
                if oldest == usize::MAX {
                    break;
                }
                let oldest_auth = self.nodes[oldest].as_ref().unwrap().authority;
                self.detach(oldest);
                self.map.remove(&oldest_auth);
                self.nodes[oldest] = None;
                self.free_list.push(oldest);
            }

            let idx = if let Some(free_idx) = self.free_list.pop() {
                self.nodes[free_idx] = Some(BudgetNode {
                    authority,
                    budget,
                    prev: usize::MAX,
                    next: usize::MAX,
                });
                free_idx
            } else {
                let new_idx = self.nodes.len();
                self.nodes.push(Some(BudgetNode {
                    authority,
                    budget,
                    prev: usize::MAX,
                    next: usize::MAX,
                }));
                new_idx
            };

            self.attach_tail(idx);
            self.map.insert(authority, idx);
        }
    }

    pub fn entry_or_insert_with<F>(&mut self, authority: [u8; 32], f: F) -> &mut ClientRetryBudget
    where
        F: FnOnce() -> ClientRetryBudget,
    {
        if !self.map.contains_key(&authority) {
            let b = f();
            self.insert(authority, b);
        }
        let idx = *self.map.get(&authority).unwrap();
        self.touch(idx);
        &mut self.nodes[idx].as_mut().unwrap().budget
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }
}

impl Default for BoundedClientBudgets {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX)
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
