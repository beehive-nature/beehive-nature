//! Gateway pool client for sovereign Arweave uploads.
//!
//! Per SPEC-RESOURCE-DASHBOARD-1 §2 and pirate-haul-rulings:
//! self-hosted primary, multi-gateway fallback, NO Turbo/hosted login.
//! The ArDrive hosted-login failure is the founding boarding fact.
//!
//! STUB: actual HTTP requires a running gateway. The types and pool
//! logic are ready; the network calls are TODO (land when Phase 0
//! ar-io-node is live on the VPS).

use crate::ans104::DataItem;

/// A gateway in the pool with priority (lower = higher priority).
#[derive(Debug, Clone)]
pub struct Gateway {
    pub url: String,
    pub priority: u32,
    /// True if this is a BNR-owned self-hosted gateway (ar-io-node).
    pub self_hosted: bool,
}

/// A pool of Arweave gateways for uploads and reads.
/// Tries gateways in priority order; falls back on failure.
#[derive(Debug, Default)]
pub struct GatewayPool {
    gateways: Vec<Gateway>,
}

impl GatewayPool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a gateway to the pool.
    pub fn add(&mut self, url: &str, priority: u32, self_hosted: bool) -> &mut Self {
        self.gateways.push(Gateway {
            url: url.trim_end_matches('/').to_string(),
            priority,
            self_hosted,
        });
        // Keep sorted by priority
        self.gateways.sort_by_key(|g| g.priority);
        self
    }

    /// Return gateways in priority order (self-hosted first by convention).
    pub fn ordered(&self) -> &[Gateway] {
        &self.gateways
    }

    /// Post a signed DataItem to the gateway pool.
    /// Tries each gateway in priority order until one succeeds.
    ///
    /// TODO: implement actual HTTP POST when a gateway is available.
    /// The POST endpoint for ANS-104 DataItems is `/tx/ans104` on ar-io-node
    /// or `/tx` on arweave.net. The body is the raw DataItem binary.
    pub fn post_dataitem(&self, _item: &DataItem) -> Result<String, GatewayError> {
        if self.gateways.is_empty() {
            return Err(GatewayError::NoGateway);
        }
        // TODO: iterate gateways, POST item.to_bytes(), return tx id on success
        Err(GatewayError::NotImplemented)
    }

    /// Read back a transaction by id from the gateway pool.
    ///
    /// TODO: implement actual HTTP GET when a gateway is available.
    /// GET `/{tx_id}` returns the raw data bytes.
    pub fn get_data(&self, _tx_id: &str) -> Result<Vec<u8>, GatewayError> {
        if self.gateways.is_empty() {
            return Err(GatewayError::NoGateway);
        }
        // TODO: iterate gateways, GET /{tx_id}, return bytes on success
        Err(GatewayError::NotImplemented)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GatewayError {
    NoGateway,
    NotImplemented,
    Network(String),
    NotFound,
}

impl std::fmt::Display for GatewayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoGateway => write!(f, "no gateway in pool"),
            Self::NotImplemented => write!(f, "HTTP not yet implemented — gateway required"),
            Self::Network(e) => write!(f, "network: {e}"),
            Self::NotFound => write!(f, "transaction not found"),
        }
    }
}

impl std::error::Error for GatewayError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_pool_errors() {
        let pool = GatewayPool::new();
        assert_eq!(pool.post_dataitem(&DataItem::new(vec![], vec![])), Err(GatewayError::NoGateway));
        assert_eq!(pool.get_data("abc"), Err(GatewayError::NoGateway));
    }

    #[test]
    fn pool_orders_by_priority() {
        let mut pool = GatewayPool::new();
        pool.add("https://arweave.net", 10, false);
        pool.add("https://ar-io.bnature.social", 1, true);
        pool.add("https://ar-io.dev", 5, false);

        let ordered = pool.ordered();
        assert_eq!(ordered[0].url, "https://ar-io.bnature.social");
        assert!(ordered[0].self_hosted);
        assert_eq!(ordered[1].url, "https://ar-io.dev");
        assert_eq!(ordered[2].url, "https://arweave.net");
    }

    #[test]
    fn post_not_implemented_with_gateways() {
        let mut pool = GatewayPool::new();
        pool.add("https://arweave.net", 1, false);
        let item = DataItem::new(vec![], vec![]);
        // Has gateway but HTTP not implemented
        assert_eq!(pool.post_dataitem(&item), Err(GatewayError::NotImplemented));
    }
}
