//! Oracles — SPEC-BINDEXER-0 §3: an indexer is ONE oracle; every chain fact the
//! reader serves must carry the sources that agreed on it.
//!
//! v0 ships the generic EVM JSON-RPC oracle; the two-oracle pair is two
//! independently-operated endpoints. The Blockscout-class second reader named in
//! §5 is the owed upgrade — same trait, richer shape. The trait boundary does not
//! move when it lands.

use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub struct Tip {
    pub height: i64,
    pub hash: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct Block {
    pub height: i64,
    pub hash: Vec<u8>,
    pub parent: Vec<u8>,
    pub ts: i64,
    /// full transaction objects as returned by the RPC (already `true`-shaped)
    pub txs: Vec<Value>,
}

pub trait Oracle {
    fn name(&self) -> &str;
    fn chain_id(&self) -> String;
    fn tip(&self) -> Result<Tip, String>;
    fn block_by_height(&self, height: i64) -> Result<Option<Block>, String>;
}

/// Generic EVM JSON-RPC oracle (eth_chainId / eth_blockNumber / eth_getBlockByNumber).
pub struct EvmRpcOracle {
    pub name: String,
    pub endpoint: String,
    agent: ureq::Agent,
}

impl EvmRpcOracle {
    pub fn new(name: &str, endpoint: &str) -> Self {
        EvmRpcOracle {
            name: name.to_string(),
            endpoint: endpoint.to_string(),
            agent: ureq::AgentBuilder::new()
                .timeout(std::time::Duration::from_secs(30))
                .build(),
        }
    }

    fn rpc(&self, method: &str, params: Value) -> Result<Value, String> {
        // Read-only by construction: the ONLY methods this crate can issue are the
        // three spelled in the impl blocks below. There is no code path that could
        // carry a broadcast verb even by accident — see tests/keyless.rs.
        let body = serde_json::json!({"jsonrpc":"2.0","id":1,"method":method,"params":params});
        let resp_text = self
            .agent
            .post(&self.endpoint)
            .set("Content-Type", "application/json")
            .send_string(&body.to_string())
            .map_err(|e| format!("transport: {e}"))?
            .into_string()
            .map_err(|e| format!("read: {e}"))?;
        let resp: Value = serde_json::from_str(&resp_text).map_err(|e| format!("decode: {e}"))?;
        match resp.get("error") {
            Some(e) => Err(format!("rpc error: {e}")),
            None => Ok(resp
                .get("result")
                .cloned()
                .ok_or_else(|| "missing result".to_string())?),
        }
    }
}

fn hex_to_bytes(h: &str) -> Vec<u8> {
    let h = h.trim_start_matches("0x");
    (0..h.len())
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(&h[i..i + 2], 16).ok())
        .collect()
}

fn hex_qty(h: &str) -> i64 {
    i64::from_str_radix(h.trim_start_matches("0x"), 16).unwrap_or(0)
}

impl Oracle for EvmRpcOracle {
    fn name(&self) -> &str {
        &self.name
    }
    fn chain_id(&self) -> String {
        self.rpc("eth_chainId", Value::Null)
            .map(|v| v.as_str().unwrap_or("?").to_string())
            .unwrap_or_else(|_| "?".into())
    }
    fn tip(&self) -> Result<Tip, String> {
        let n = self.rpc("eth_blockNumber", Value::Null)?;
        let h = n.as_str().ok_or("blockNumber not a string")?;
        let height = hex_qty(h);
        if height == 0 && h != "0x0" {
            return Err("unparseable height".into());
        }
        // hash via header-only fetch
        let b = self.rpc("eth_getBlockByNumber", serde_json::json!([h, false]))?;
        let hash = b
            .get("hash")
            .and_then(|v| v.as_str())
            .ok_or("tip block without hash")?;
        Ok(Tip {
            height,
            hash: hex_to_bytes(hash),
        })
    }
    fn block_by_height(&self, height: i64) -> Result<Option<Block>, String> {
        let b = self.rpc(
            "eth_getBlockByNumber",
            serde_json::json!([format!("0x{height:x}"), true]),
        )?;
        if b.is_null() {
            return Ok(None);
        }
        let hash = b.get("hash").and_then(|v| v.as_str()).ok_or("no hash")?;
        let parent = b
            .get("parentHash")
            .and_then(|v| v.as_str())
            .ok_or("no parentHash")?;
        let ts = b
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(hex_qty)
            .ok_or("no timestamp")?;
        let txs = b
            .get("transactions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        Ok(Some(Block {
            height,
            hash: hex_to_bytes(hash),
            parent: hex_to_bytes(parent),
            ts,
            txs,
        }))
    }
}

/// Agreement between two oracles — the schema law's enforcement point.
pub enum Agreement {
    /// both oracles returned the same block hash
    Agreed(Block, String, String),
    /// both reachable, hashes differ — fail-closed territory
    Diverged {
        height: i64,
        a: Vec<u8>,
        b: Vec<u8>,
    },
    /// one failed/absent
    Single(Block, String),
    BothFailed(String, String),
}

pub fn agree_at(a: &dyn Oracle, b: &dyn Oracle, height: i64) -> Agreement {
    let ra = a.block_by_height(height);
    let rb = b.block_by_height(height);
    match (ra, rb) {
        (Ok(Some(ba)), Ok(Some(bb))) => {
            if ba.hash == bb.hash {
                Agreement::Agreed(ba, a.name().into(), b.name().into())
            } else {
                Agreement::Diverged {
                    height,
                    a: ba.hash,
                    b: bb.hash,
                }
            }
        }
        (Ok(Some(ba)), _) => Agreement::Single(ba, a.name().into()),
        (_, Ok(Some(bb))) => Agreement::Single(bb, b.name().into()),
        (Ok(None), Ok(None)) => {
            Agreement::BothFailed("height absent on both oracles".into(), "absent".into())
        }
        (Err(ea), Err(eb)) => Agreement::BothFailed(ea, eb),
        (Err(e), _) | (_, Err(e)) => Agreement::BothFailed(e, "absent".into()),
    }
}
