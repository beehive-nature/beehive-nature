//! Read-path caching gateway adapter (SPEC-PAY-ONCE-NOW-1 #3).
//! Caches immutable Arweave data locally — sheds arweave.net read dependency.
//! Confirmed transactions never change; raw data is immutable. Cache serves first.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

pub struct ResponseCache {
    entries: Mutex<HashMap<String, (Vec<u8>, Instant)>>,
    ttl: Duration,
}

impl ResponseCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self { entries: Mutex::new(HashMap::new()), ttl: Duration::from_secs(ttl_secs) }
    }
    /// Get cached data if fresh.
    pub fn get(&self, key: &str) -> Option<Vec<u8>> {
        let e = self.entries.lock().ok()?;
        let (data, ts) = e.get(key)?;
        if ts.elapsed() < self.ttl { Some(data.clone()) } else { None }
    }
    /// Store data with current timestamp.
    pub fn put(&self, key: &str, data: Vec<u8>) {
        if let Ok(mut e) = self.entries.lock() { e.insert(key.to_string(), (data, Instant::now())); }
    }
}

static CACHE: OnceLock<ResponseCache> = OnceLock::new();

/// Global cache (300s TTL — confirmed txs are immutable).
pub fn cache() -> &'static ResponseCache {
    CACHE.get_or_init(|| ResponseCache::new(300))
}
