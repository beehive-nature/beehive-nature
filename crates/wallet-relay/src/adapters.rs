//! Adapter ring — every external endpoint sits behind a swappable adapter.
//! Per SPEC-PAY-ONCE-NOW-1 invariant #3: NO direct third-party endpoint calls.

use std::time::Duration;

/// A swappable adapter for an external rail/gateway/RPC.
/// All balance reads go through this trait — never direct ureq calls.
pub trait RailAdapter: Send + Sync {
    fn rail(&self) -> &str;
    fn base_url(&self) -> &str;
    fn read_balance(&self, address: &str) -> Result<serde_json::Value, String>;
}

// === Stellar ===

pub struct StellarAdapter { base_url: String }
impl Default for StellarAdapter { fn default() -> Self { Self { base_url: "https://horizon.stellar.org".into() } } }
impl StellarAdapter { pub fn with_url(url: impl Into<String>) -> Self { Self { base_url: url.into() } } }
impl RailAdapter for StellarAdapter {
    fn rail(&self) -> &str { "stellar" }
    fn base_url(&self) -> &str { &self.base_url }
    fn read_balance(&self, address: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(15)).redirects(0).build();
        let resp = agent.get(&format!("{}/accounts/{}", self.base_url, address)).call().map_err(|e| e.to_string())?;
        let body = resp.into_string().map_err(|e| e.to_string())?;
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
        let xlm = parsed.pointer("/balances").and_then(|b| b.as_array())
            .and_then(|a| a.iter().find(|b| b.get("asset_type").and_then(|t| t.as_str()) == Some("native")))
            .and_then(|b| b.get("balance").and_then(|v| v.as_str())).unwrap_or("0");
        Ok(serde_json::json!({ "v": 1, "self_desc": {"algo":"ed25519","encoding":"base32"}, "rail": "stellar",
            "address": address, "balances": parsed.get("balances").cloned().unwrap_or_default(),
            "native_xlm": xlm, "source": self.base_url, "tier": "T-S" }))
    }
}

// === Solana ===

pub struct SolanaAdapter { base_url: String }
impl Default for SolanaAdapter { fn default() -> Self { Self { base_url: "https://api.mainnet-beta.solana.com".into() } } }
impl SolanaAdapter { pub fn with_url(url: impl Into<String>) -> Self { Self { base_url: url.into() } } }
impl RailAdapter for SolanaAdapter {
    fn rail(&self) -> &str { "solana" }
    fn base_url(&self) -> &str { &self.base_url }
    fn read_balance(&self, address: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(15)).redirects(0).build();
        let body = serde_json::json!({"jsonrpc":"2.0","id":1,"method":"getBalance","params":[address]}).to_string();
        let resp = agent.post(&self.base_url).set("Content-Type","application/json").send_string(&body).map_err(|e| e.to_string())?;
        let r: serde_json::Value = serde_json::from_str(&resp.into_string().map_err(|e| e.to_string())?).unwrap_or_default();
        let lamports = r.pointer("/result/value").and_then(|v| v.as_u64()).unwrap_or(0);
        Ok(serde_json::json!({ "v": 1, "self_desc": {"algo":"ed25519","encoding":"base58"}, "rail": "solana",
            "address": address, "balance_lamports": lamports, "balance_sol": format!("{:.9}", lamports as f64 / 1e9),
            "source": self.base_url, "tier": "T-H" }))
    }
}

// === Hive ===

pub struct HiveAdapter { base_url: String }
impl Default for HiveAdapter { fn default() -> Self { Self { base_url: "https://api.hive.blog".into() } } }
impl HiveAdapter { pub fn with_url(url: impl Into<String>) -> Self { Self { base_url: url.into() } } }
impl RailAdapter for HiveAdapter {
    fn rail(&self) -> &str { "hive" }
    fn base_url(&self) -> &str { &self.base_url }
    fn read_balance(&self, address: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(15)).redirects(0).build();
        let acct_req = serde_json::json!({"jsonrpc":"2.0","id":0,"method":"call","params":["database_api","find_accounts",{"accounts":[address]}]}).to_string();
        let rc_req = serde_json::json!({"jsonrpc":"2.0","id":1,"method":"call","params":["rc_api","find_rc_accounts",{"accounts":[address]}]}).to_string();
        let ar = agent.post(&self.base_url).set("Content-Type","application/json").send_string(&acct_req).map_err(|e| e.to_string())?;
        let acct: serde_json::Value = serde_json::from_str(&ar.into_string().map_err(|e| e.to_string())?).unwrap_or_default();
        let rr = agent.post(&self.base_url).set("Content-Type","application/json").send_string(&rc_req).map_err(|e| e.to_string())?;
        let rc: serde_json::Value = serde_json::from_str(&rr.into_string().map_err(|e| e.to_string())?).unwrap_or_default();
        let hp = acct.pointer("/result/accounts/0/hive_power").and_then(|v| v.as_str()).unwrap_or("0");
        let mana = rc.pointer("/result/rc_accounts/0/rc_manabar/current_mana").and_then(|v| v.as_str()).unwrap_or("0");
        let max = rc.pointer("/result/rc_accounts/0/max_rc").and_then(|v| v.as_str()).unwrap_or("0");
        let pct = if max != "0" { let c:f64=mana.parse().unwrap_or(0.0); let m:f64=max.parse().unwrap_or(1.0); format!("{:.1}", c/m*100.0) } else { "0".into() };
        Ok(serde_json::json!({ "v": 1, "self_desc": {"algo":"ripemd160-htlc","encoding":"base58"}, "rail": "hive",
            "address": address, "hive_power": hp, "rc_mana": mana, "rc_mana_pct": pct,
            "source": self.base_url, "tier": "T-S" }))
    }
}

// === Vaulta ===

pub struct VaultaAdapter { base_url: String }
// Default CORRECTED 2026-08-14: was https://wax.eosrio.io, which is the WAX chain
// (chain_id 1064487b...), not Vaulta — every default-config read queried the wrong
// blockchain. eos.greymass.com serves Vaulta mainnet (chain_id aca376f2...,
// cross-confirmed live against eos.eosphere.io, the repo's second b-domain oracle).
impl Default for VaultaAdapter { fn default() -> Self { Self { base_url: "https://eos.greymass.com".into() } } }
impl VaultaAdapter {
    pub fn with_url(url: impl Into<String>) -> Self { Self { base_url: url.into() } }

    /// Read identity record (permission tree) from a Vaulta account.
    /// Returns versioned envelopes per SPEC-VAULTA-IDENTITY-1 §3.
    pub fn read_identity(&self, account: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new().timeout_connect(std::time::Duration::from_secs(15)).redirects(0).build();
        let body = serde_json::json!({"account_name": account}).to_string();
        let resp = agent.post(&format!("{}/v1/chain/get_account", self.base_url)).set("Content-Type","application/json").send_string(&body).map_err(|e| e.to_string())?;
        let parsed: serde_json::Value = serde_json::from_str(&resp.into_string().map_err(|e| e.to_string())?).unwrap_or_default();
        let perms = parsed.get("permissions").cloned().unwrap_or(serde_json::Value::Array(vec![]));
        let envs: Vec<serde_json::Value> = perms.as_array()
            .map(|a| a.iter().map(|p| serde_json::json!({"v":1,"self_desc":{"type":"vaulta-permission","encoding":"json"},
                "payload":{"permission_name":p.get("perm_name").and_then(|v| v.as_str()).unwrap_or(""),
                "parent":p.get("parent").and_then(|v| v.as_str()).unwrap_or(""),
                "auth":p.get("required_auth").cloned().unwrap_or(serde_json::json!({})),
                "linked_actions":p.get("linked_actions").cloned().unwrap_or(serde_json::Value::Array(vec![]))},
                "source":self.base_url})).collect()).unwrap_or_default();
        Ok(serde_json::json!({"v":1,"self_desc":{"type":"vaulta-identity-record","spec":"SPEC-VAULTA-IDENTITY-1"},
            "account":account,"permissions":envs,"source":self.base_url}))
    }
}
impl RailAdapter for VaultaAdapter {
    fn rail(&self) -> &str { "vaulta" }
    fn base_url(&self) -> &str { &self.base_url }
    fn read_balance(&self, address: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(15)).redirects(0).build();
        let body = serde_json::json!({"account_name": address}).to_string();
        let resp = agent.post(&format!("{}/v1/chain/get_account", self.base_url)).set("Content-Type","application/json").send_string(&body).map_err(|e| e.to_string())?;
        let parsed: serde_json::Value = serde_json::from_str(&resp.into_string().map_err(|e| e.to_string())?).unwrap_or_default();
        Ok(serde_json::json!({ "v": 1, "self_desc": {"algo":"secp256k1","encoding":"base58"}, "rail": "vaulta",
            "address": address, "liquid_balance": parsed.pointer("/core_liquid_balance").and_then(|v| v.as_str()).unwrap_or("0"),
            "cpu_available": parsed.pointer("/cpu_limit/available").and_then(|v| v.as_u64()).unwrap_or(0),
            "net_available": parsed.pointer("/net_limit/available").and_then(|v| v.as_u64()).unwrap_or(0),
            "ram_usage_bytes": parsed.pointer("/ram_usage").and_then(|v| v.as_u64()).unwrap_or(0),
            "ram_quota_bytes": parsed.pointer("/ram_quota").and_then(|v| v.as_u64()).unwrap_or(0),
            "source": self.base_url, "tier": "mixed" }))
    }
}
