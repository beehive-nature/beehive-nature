//! The Suite-MCP transport — the founder's real Safe 7 underneath, the
//! cockpit on top (board ruling: Suite as transport infrastructure only).
//!
//! PROVEN (2026-09-19): the live handshake + `trezor_get_address`
//! (silent, showOnTrezor:false) returned the expected payer
//! 0x8fD7252A29FB759755E30A15E966932EaAD91b75 through this exact code
//! path. The SIGNING leg (`trezor_send_transaction`) is wired with
//! **broadcast:false pinned** — `trezor_push_transaction` is never
//! called by this binary — and remains UNVERIFIED-UNTIL-FIRST-SIGNATURE
//! (Observation B, founder-operated): the response parser accepts both
//! a full signed-tex hex and a {serializedTx,v,r,s} object; the wall
//! verifies whatever returns, independently.
//!
//! The token is env-only (BPAY_SIGN_MCP_TOKEN, copied from Suite
//! Settings → Experimental); it is never logged, never persisted.

use watchpay::connect::{ConnectRequestJson, ConnectSignedTxRaw, ConnectTransactionJson};
use watchpay::signed_tx::SignedTx;

#[derive(Clone)]
pub struct SuiteMcp {
    pub url: String,
    pub token: String,
    /// The MCP session (established lazily by `ensure_session`).
    pub(crate) session: std::sync::Arc<std::sync::Mutex<Option<String>>>,
    /// ONE pooled HTTP agent (keep-alive): per-call connections churned
    /// loopback sockets until Windows starved (os error 10060 = connect
    /// timeout) — the transport defect, fixed at the connection layer.
    pub(crate) agent: ureq::Agent,
}

impl SuiteMcp {
    pub fn new(url: String, token: String) -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(5))
            .timeout(std::time::Duration::from_secs(190)) // device waits are human-paced
            .build();
        SuiteMcp {
            url,
            token,
            session: std::sync::Arc::new(std::sync::Mutex::new(None)),
            agent,
        }
    }
}

#[derive(serde::Deserialize)]
struct McpToolResult {
    #[serde(default)]
    content: Vec<McpContent>,
}
#[derive(serde::Deserialize)]
struct McpContent {
    #[serde(default)]
    text: String,
}

impl SuiteMcp {
    /// Establish the MCP session once (initialize + initialized), then
    /// carry the mcp-session-id on every call — the server 404s a
    /// sessionless tools/call.
    pub(crate) fn ensure_session(&self) -> watchpay::Result<()> {
        let mut guard = self.session.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
        let resp = self.agent
            .post(&self.url)
            .set("Authorization", &format!("Bearer {}", self.token))
            .set("Accept", "application/json, text/event-stream")
            .send_json(serde_json::json!({
                "jsonrpc": "2.0", "id": 0, "method": "initialize",
                "params": { "protocolVersion": "2025-03-26", "capabilities": {},
                            "clientInfo": { "name": "bpay-sign", "version": "0.1.0" } }
            }))
            .map_err(|e| watchpay::Error::Malformed(format!("mcp init: {e}")))?;
        if let Some(sid) = resp.header("mcp-session-id") {
            *guard = Some(sid.to_string());
        }
        // read the body fully — the proven node client does exactly this
        // (the server closes its initialize responses); bounded by the
        // agent's connect timeout on a dead peer.
        let _ = resp.into_string();
        let _ = self.post_notify(guard.clone());
        Ok(())
    }
    fn post_notify(&self, sid: Option<String>) -> watchpay::Result<()> {
        let mut h = self.agent
            .post(&self.url)
            .set("Authorization", &format!("Bearer {}", self.token))
            .set("Accept", "application/json, text/event-stream");
        if let Some(s) = sid.as_deref() {
            h = h.set("mcp-session-id", s);
        }
        h.send_json(serde_json::json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }))
            .map(|r| {
                let _ = r.into_string();
            })
            .map_err(|e| watchpay::Error::Malformed(format!("mcp initialized note: {e}")))
    }
    fn post(&self, body: serde_json::Value) -> watchpay::Result<serde_json::Value> {
        self.ensure_session()?;
        let mut req = self.agent
            .post(&self.url)
            .set("Authorization", &format!("Bearer {}", self.token))
            .set("Accept", "application/json, text/event-stream");
        if let Some(sid) = self.session.lock().unwrap().clone() {
            req = req.set("mcp-session-id", &sid);
        }
        let resp = req
            .send_json(body)
            .map_err(|e| watchpay::Error::Malformed(format!("mcp transport: {e}")))?;
        let text = resp
            .into_string()
            .map_err(|e| watchpay::Error::Malformed(format!("mcp body: {e}")))?;
        // streamable-http: pull the last data: line
        let payload = if text.contains("data:") {
            text.lines()
                .filter(|l| l.starts_with("data:"))
                .last()
                .map(|l| l.trim()[5..].to_string())
                .unwrap_or_default()
        } else {
            text
        };
        serde_json::from_str(&payload)
            .map_err(|e| watchpay::Error::Malformed(format!("mcp json: {e} ({})", payload.len())))
    }

    fn call(
        &self,
        id: u64,
        name: &str,
        args: serde_json::Value,
    ) -> watchpay::Result<McpToolResult> {
        let r = self.post(serde_json::json!({
            "jsonrpc": "2.0", "id": id, "method": "tools/call",
            "params": { "name": name, "arguments": args }
        }))?;
        if let Some(err) = r.get("error") {
            return Err(watchpay::Error::Malformed(format!("mcp tool error: {err}")));
        }
        serde_json::from_value(r.get("result").cloned().unwrap_or(serde_json::Value::Null))
            .map_err(|e| watchpay::Error::Malformed(format!("mcp result shape: {e}")))
    }

    /// The CONNECT ceremony device leg: the Safe 7 address-export
    /// prompt (showOnTrezor:true) — the founder physically rejects or
    /// approves; rejection surfaces as a named refusal.
    pub fn connect_address(&self, path: &str) -> watchpay::Result<String> {
        let r = self.call(
            3,
            "trezor_get_address",
            serde_json::json!({
                "coin": "eth", "path": path, "showOnTrezor": true
            }),
        )?;
        let text = r
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default();
        let lower = text.to_lowercase();
        if lower.contains("cancel") || lower.contains("reject") {
            return Err(watchpay::Error::Malformed(format!(
                "DEVICE REJECTED the address export — connection refused on the Safe 7: {}",
                &text[..text.len().min(160)]
            )));
        }
        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| watchpay::Error::Malformed(format!("connect payload: {e}")))?;
        parsed
            .get("address")
            .and_then(|a| a.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| watchpay::Error::Malformed("no address in connect payload".into()))
    }

    /// The harmless preflight: silent address derivation (no device
    /// prompt at showOnTrezor:false) — the transport-identity check.
    pub fn get_address(&self, path: &str) -> watchpay::Result<String> {
        let r = self.call(
            1,
            "trezor_get_address",
            serde_json::json!({
                "coin": "eth", "path": path, "showOnTrezor": false
            }),
        )?;
        let text = r
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default();
        // the text is JSON with an "address" field
        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| watchpay::Error::Malformed(format!("address payload: {e}")))?;
        parsed
            .get("address")
            .and_then(|a| a.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| watchpay::Error::Malformed("no address in payload".into()))
    }
}

fn minimal_hex(x: &[u8]) -> String {
    let first = x.iter().position(|&b| b != 0).unwrap_or(x.len());
    format!("0x{}", hex::encode(&x[first..]))
}

impl watchpay::connect::ConnectTransport for SuiteMcp {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> watchpay::Result<ConnectSignedTxRaw> {
        let ConnectTransactionJson::Eip1559 {
            ref to,
            ref value,
            ref gas_limit,
            ref nonce,
            ref data,
            chain_id,
            ref max_fee_per_gas,
            ref max_priority_fee_per_gas,
        } = request.transaction
        else {
            return Err(watchpay::Error::Malformed(
                "wave slice composes 1559 only".into(),
            ));
        };
        // broadcast:false is PINNED — this transport signs, never sends.
        let args = serde_json::json!({
            "coin": "eth",
            "path": request.path,
            "to": to,
            "value": value,
            "nonce": String::from(nonce.clone()),
            "gasLimit": String::from(gas_limit.clone()),
            "maxFeePerGas": String::from(max_fee_per_gas.clone()),
            "maxPriorityFeePerGas": String::from(max_priority_fee_per_gas.clone()),
            "data": String::from(data.clone()),
            "chainId": chain_id,
            "broadcast": false,
        });
        let r = self.call(2, "trezor_send_transaction", args)?;
        let text = r
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| watchpay::Error::Malformed("empty tool result".into()))?;
        // Accept either {"serializedTx": "0x..", "v": "..", "r": "..", "s": ".."}
        // or a payload carrying the signed tx hex under a known key.
        let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
            watchpay::Error::Malformed(format!(
                "sign payload not json: {e} — raw: {}",
                &text[..text.len().min(160)]
            ))
        })?;
        let serialized = ["serializedTx", "serialized_tx", "tx", "signedTransaction", "raw"]
            .iter()
            .find_map(|k| parsed.get(k).and_then(|v| v.as_str()))
            .map(|s| s.to_string())
            .ok_or_else(|| {
                watchpay::Error::Malformed(format!(
                    "no signed-tx field in the tool result — shape to adapt on first device signature (raw: {})",
                    &text[..text.len().min(160)]
                ))
            })?;
        // v/r/s: prefer explicit fields; else decode from the envelope
        // (the wall re-verifies everything independently either way).
        if let (Some(v), Some(rr), Some(ss)) = (
            parsed.get("v").and_then(|x| x.as_str()),
            parsed.get("r").and_then(|x| x.as_str()),
            parsed.get("s").and_then(|x| x.as_str()),
        ) {
            return Ok(ConnectSignedTxRaw {
                serialized_tx: serialized,
                v: v.to_string(),
                r: rr.to_string(),
                s: ss.to_string(),
            });
        }
        let body = serialized
            .strip_prefix("0x")
            .ok_or_else(|| watchpay::Error::Malformed("signed tx not 0x-hex".into()))?;
        let bytes = hex::decode(body)
            .map_err(|e| watchpay::Error::Malformed(format!("signed tx hex: {e}")))?;
        let signed = SignedTx::decode_strict(&bytes)?;
        match &signed {
            SignedTx::Eip1559(t) => Ok(ConnectSignedTxRaw {
                serialized_tx: serialized,
                v: format!("0x{:x}", t.y_parity as u64),
                r: minimal_hex(&t.r),
                s: minimal_hex(&t.s),
            }),
            SignedTx::Legacy(t) => Ok(ConnectSignedTxRaw {
                serialized_tx: serialized,
                v: format!("0x{:x}", t.v),
                r: minimal_hex(&t.r),
                s: minimal_hex(&t.s),
            }),
        }
    }
}
