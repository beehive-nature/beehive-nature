//! PQ-ready versioned envelope builder (SPEC-PAY-ONCE-NOW-1 #2, SPEC-VAULTA-IDENTITY-1 §2).
//! Every key/address/identity claim wrapped algorithm-agnostic + versioned + additive-only.

use serde_json::{json, Value};

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Wrap a device-read address in a PQ-ready versioned envelope.
pub fn address_envelope(address: &str, network: &str, source: &str, tier: &str) -> Value {
    let (algo, enc) = match network {
        "evm" | "ethereum" => ("secp256k1", "hex"),
        "btc" | "bitcoin" => ("secp256k1", "base58check"),
        "zec" | "zcash" => ("secp256k1", "base58check"),
        _ => ("unknown", "unknown"),
    };
    json!({ "v":1, "self_desc":{"key_algo":algo,"sig_algo":"ecdsa","hash":"sha2-256","encoding":enc},
        "pq":{"ready":true,"successor_algo":null,"successor_key_ref":null},
        "payload":{"type":"address","value":address,"network":network,"source":source,"custody_tier":tier}, "timestamp":now() })
}

/// Wrap a public key in a PQ-ready versioned envelope.
pub fn pubkey_envelope(pubkey: &str, key_algo: &str, source: &str, tier: &str) -> Value {
    json!({ "v":1, "self_desc":{"key_algo":key_algo,"sig_algo":"ecdsa","hash":"sha2-256","encoding":"base58"},
        "pq":{"ready":true,"successor_algo":null,"successor_key_ref":null},
        "payload":{"type":"pubkey","value":pubkey,"source":source,"custody_tier":tier}, "timestamp":now() })
}
