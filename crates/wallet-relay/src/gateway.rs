//! Health-checked multi-gateway fallback pool — PHASE0_AR_ANT_SETUP_SPEC step 7.
//!
//! The rule this module exists to enforce: **never hard-code arweave.net** (the
//! rule that would have prevented the Turbo login incident). A pool is ordered by
//! preference — self-hosted ar-io-node first, public gateways as fallback — and a
//! gateway that keeps failing degrades to the back of the order until it succeeds
//! again. Pure logic, no I/O: the HTTP layer asks for [`GatewayPool::ordered`] and
//! reports outcomes back; tests never touch a socket.

/// Consecutive failures after which a gateway is DEGRADED (tried last, never
/// removed — a self-hosted primary that restarts must be able to heal).
pub const DEGRADE_AFTER: u32 = 3;

/// Default pool: self-hosted envoy edge first (ops/phase0), then public
/// fallbacks. arweave.net appears as ONE fallback among several — present is
/// fine, hard-coded-as-the-only-path is the forbidden shape.
pub const DEFAULT_GATEWAYS: &[&str] = &[
    "http://127.0.0.1:3000",
    "https://arweave.net",
    "https://permagate.io",
];

#[derive(Debug, Clone)]
struct Gateway {
    url: String,
    consecutive_failures: u32,
}

#[derive(Debug)]
pub struct GatewayPool {
    gateways: Vec<Gateway>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PoolError {
    /// No gateways at all.
    Empty,
    /// A single (or fully-duplicated) gateway list cannot fail over — that IS
    /// the hard-coded-gateway shape, refused at construction.
    NoFallback,
}

impl GatewayPool {
    /// Build a pool from an ordered preference list. Refuses a pool that cannot
    /// fail over (empty, single, or all-duplicates).
    pub fn new(urls: &[impl AsRef<str>]) -> Result<Self, PoolError> {
        let mut seen = Vec::new();
        let mut gateways = Vec::new();
        for u in urls {
            let u = u.as_ref().trim_end_matches('/').to_string();
            if u.is_empty() || seen.contains(&u) {
                continue;
            }
            seen.push(u.clone());
            gateways.push(Gateway { url: u, consecutive_failures: 0 });
        }
        match gateways.len() {
            0 => Err(PoolError::Empty),
            1 => Err(PoolError::NoFallback),
            _ => Ok(GatewayPool { gateways }),
        }
    }

    pub fn default_pool() -> Self {
        Self::new(DEFAULT_GATEWAYS).expect("default list has fallback")
    }

    /// Gateways in try-order: healthy ones first (preference order preserved),
    /// degraded ones after (still tried — last, not never).
    pub fn ordered(&self) -> Vec<String> {
        let healthy = self
            .gateways
            .iter()
            .filter(|g| g.consecutive_failures < DEGRADE_AFTER)
            .map(|g| g.url.clone());
        let degraded = self
            .gateways
            .iter()
            .filter(|g| g.consecutive_failures >= DEGRADE_AFTER)
            .map(|g| g.url.clone());
        healthy.chain(degraded).collect()
    }

    /// Report a transport failure. Unknown URLs are ignored (never panic on a
    /// stale report).
    pub fn mark_failure(&mut self, url: &str) {
        if let Some(g) = self.gateways.iter_mut().find(|g| g.url == url) {
            g.consecutive_failures = g.consecutive_failures.saturating_add(1);
        }
    }

    /// Report a success — the gateway heals completely (consecutive counter).
    pub fn mark_success(&mut self, url: &str) {
        if let Some(g) = self.gateways.iter_mut().find(|g| g.url == url) {
            g.consecutive_failures = 0;
        }
    }

    /// (url, consecutive_failures, degraded) rows for /healthz — the pool's
    /// state is a read surface, honest about which gateways are limping.
    pub fn health(&self) -> Vec<(String, u32, bool)> {
        self.gateways
            .iter()
            .map(|g| {
                (
                    g.url.clone(),
                    g.consecutive_failures,
                    g.consecutive_failures >= DEGRADE_AFTER,
                )
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_pools_that_cannot_fail_over() {
        assert_eq!(GatewayPool::new(&[] as &[&str]).unwrap_err(), PoolError::Empty);
        assert_eq!(
            GatewayPool::new(&["https://arweave.net"]).unwrap_err(),
            PoolError::NoFallback,
            "a single gateway IS the hard-coded shape"
        );
        assert_eq!(
            GatewayPool::new(&["https://arweave.net", "https://arweave.net/"]).unwrap_err(),
            PoolError::NoFallback,
            "duplicates collapse — still no fallback"
        );
    }

    #[test]
    fn preference_order_holds_until_failures_degrade() {
        let mut p = GatewayPool::new(&["http://self:3000", "https://pub1", "https://pub2"]).unwrap();
        assert_eq!(p.ordered(), ["http://self:3000", "https://pub1", "https://pub2"]);

        // failures below the threshold do not reorder
        p.mark_failure("http://self:3000");
        p.mark_failure("http://self:3000");
        assert_eq!(p.ordered()[0], "http://self:3000");

        // the third consecutive failure degrades to the BACK — tried last, not never
        p.mark_failure("http://self:3000");
        assert_eq!(p.ordered(), ["https://pub1", "https://pub2", "http://self:3000"]);

        // one success heals fully and restores preference order
        p.mark_success("http://self:3000");
        assert_eq!(p.ordered()[0], "http://self:3000");
    }

    #[test]
    fn default_pool_is_self_hosted_first_with_public_fallback() {
        let p = GatewayPool::default_pool();
        let order = p.ordered();
        assert_eq!(order[0], "http://127.0.0.1:3000", "self-hosted primary");
        assert!(order.len() >= 3, "multiple fallbacks");
    }

    #[test]
    fn health_rows_report_degradation_honestly() {
        let mut p = GatewayPool::new(&["http://a", "http://b"]).unwrap();
        for _ in 0..DEGRADE_AFTER {
            p.mark_failure("http://b");
        }
        let rows = p.health();
        assert_eq!(rows[0], ("http://a".into(), 0, false));
        assert_eq!(rows[1], ("http://b".into(), DEGRADE_AFTER, true));
    }
}
