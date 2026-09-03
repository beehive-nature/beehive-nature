//! CONTENT CACHE — banchor's local memory of resolved names and fetched
//! content. Lives under the INSTALL home (~/.bheartwallet), never in the
//! repo: runtime state belongs to the machine, receipts belong to the tree.

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use crate::b64::sha3_256_b64u;

/// The bHEartWALLet install home: `$BHEARTWALLET_HOME` or `~/.bheartwallet`.
pub fn home() -> PathBuf {
    if let Ok(h) = std::env::var("BHEARTWALLET_HOME") {
        return PathBuf::from(h);
    }
    let user = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(user).join(".bheartwallet")
}

pub fn cache_dir(namespace: &str) -> PathBuf {
    home().join("banchor").join("cache").join(namespace)
}

/// Store `value` under `namespace`, keyed by digest of `key_material`.
/// Returns the cache key used.
pub fn put_json(namespace: &str, key_material: &str, value: &Value) -> String {
    let key = sha3_256_b64u(key_material.as_bytes());
    let dir = cache_dir(namespace);
    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(dir.join(format!("{key}.json")), value.to_string());
    key
}

/// Fetch a cached value. `None` on miss or unreadable content (a corrupt
/// cache entry is a miss, not an error — resolution re-fetches).
pub fn get_json(namespace: &str, key_material: &str) -> Option<Value> {
    let key = sha3_256_b64u(key_material.as_bytes());
    let text = fs::read_to_string(cache_dir(namespace).join(format!("{key}.json"))).ok()?;
    serde_json::from_str(&text).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn roundtrip_under_temp_home() {
        let tmp = std::env::temp_dir().join("banchor-cache-test-home");
        let _ = fs::remove_dir_all(&tmp);
        std::env::set_var("BHEARTWALLET_HOME", &tmp);
        put_json(
            "resolve-test",
            "oliver.b",
            &json!({"target": "untrusted-row"}),
        );
        let hit = get_json("resolve-test", "oliver.b").expect("cached entry");
        assert_eq!(hit["target"], "untrusted-row");
        assert!(get_json("resolve-test", "missing.b").is_none());
        let _ = fs::remove_dir_all(&tmp);
        std::env::remove_var("BHEARTWALLET_HOME");
    }
}
