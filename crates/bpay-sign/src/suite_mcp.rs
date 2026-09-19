//! The Trezor Suite experimental-MCP transport adapter (Safe 7 lane).
//!
//! # Evidence pins (installed + runtime, 2026-09-19 — no API inferred)
//! - Installed build: Trezor Suite **26.9.2** desktop
//!   (`%LOCALAPPDATA%/Programs/Trezor Suite`, `savedCurrentVersion` in
//!   `%APPDATA%/@trezor/suite-desktop/config.json`), with
//!   `mcpSettings.enabled = true`, port **21340**, token in the same file
//!   (read from disk, passed by env, NEVER printed or committed).
//! - Serving surface (runtime-probed, not assumed): plain JSON-RPC 2.0
//!   over `POST http://127.0.0.1:21340/mcp?token=…`; the root path
//!   answers 404 with `"Not found. Use POST /mcp"`; missing/incorrect
//!   token answers 401 naming the `?token=` / Bearer shapes. No
//!   initialize handshake and no SSE are required for `tools/list` /
//!   `tools/call` (single JSON response per POST).
//! - Tool inventory (runtime `tools/list` AND asar strings, both): eight
//!   tools — get_address, get_account_info, get_public_key, sign_message,
//!   sign_typed_data, verify_message, send_transaction, push_transaction.
//!   There is **no** sign-only `trezor_sign_transaction`; EVM transaction
//!   signing rides `trezor_send_transaction`.
//! - `trezor_send_transaction` (asar schema, verified verbatim): EVM
//!   branch honors EXPLICIT `path`, `nonce`, `gasLimit`,
//!   `maxFeePerGas`, `maxPriorityFeePerGas`, `data`, `chainId` — each is
//!   passed through into the device call `ethereumSignTransaction`
//!   (the same wire shape [`ConnectRequestJson`] models); auto-fill of
//!   nonce/fees happens ONLY when the field is omitted (this adapter
//!   always supplies every field; the 100000-contract-call default is
//!   therefore never reachable through it). `broadcast` defaults to
//!   TRUE at the tool layer — post-signing it calls `pushTransaction`.
//!   **This adapter structurally passes `broadcast: false` on every
//!   call** (a constant in the composer below, not a parameter): the
//!   success payload is then Connect's `EthereumSignedTx`
//!   `{serializedTx, v, r, s}` — exactly [`ConnectSignedTxRaw`].
//! - Failures arrive as HTTP 200 with `content[0].text` equal to
//!   `"Error: {json}"` (the asar wrapper stringifies Connect error
//!   objects) — mapped here to a transport refusal the driver treats as
//!   after-dispatch, never retried.
//! - Device today: Trezor Safe 7 (T3W1, `VID_1209&PID_53C1`), firmware
//!   upgraded to stock **2.12.5** by the founder immediately before the
//!   first ceremony attempt (core/CHANGELOG.T3W1.md: 2.12.5 Ethereum
//!   fixes touch SLIP-24/pubkey layout, not `ethereumSignTransaction`;
//!   2.12.4 switched to the optimized THP implementation and fixed host
//!   disconnection handling).
//!
//! # Boundary law
//! This module implements [`watchpay::connect::ConnectTransport`] — the
//! SAME injected-trait boundary the hot TESTNET key implements. Nothing
//! above the boundary (binding gate, composer, wall, receipts) knows or
//! cares which transport is injected; the result of every call here is
//! UNTRUSTED until `verify_wave_signed` accepts it. The adapter cannot
//! broadcast: it has no `pushTransaction` code path at all.

use std::time::Duration;

use serde_json::{json, Value};
use watchpay::connect::{ConnectRequestJson, ConnectSignedTxRaw, ConnectTransactionJson};
use watchpay::types::EthAddr;

use watchpay::abi::keccak256;
use watchpay::error::{Error, Result};

/// Default MCP endpoint (Suite 26.9.2 writes `mcpSettings.port = 21340`).
pub const DEFAULT_MCP_URL: &str = "http://127.0.0.1:21340/mcp";

/// The result of one MCP `tools/call`: either the parsed Connect payload
/// (a JSON object) or the tool-level failure text (`Error: …`).
#[derive(Debug, Clone)]
pub enum ToolReply {
    Ok(Value),
    /// The tool answered with a failure (Connect error object, e.g. a
    /// device rejection `Action cancelled`). Carries the text verbatim.
    ToolError(String),
}

/// The minimal Suite-MCP JSON-RPC client. ONE call per HTTP POST; the
/// token rides the `?token=` query parameter (the 401 body names that as
/// the accepted shape) and is never logged.
pub struct SuiteMcp {
    url: String,
    token: String,
    timeout_secs: u64,
    next_id: u64,
}

impl SuiteMcp {
    pub fn new(url: &str, token: &str, timeout_secs: u64) -> Self {
        SuiteMcp {
            url: url.to_string(),
            token: token.to_string(),
            timeout_secs,
            next_id: 1,
        }
    }

    /// `tools/list` — runtime interface evidence (the tool inventory).
    pub fn tools_list(&mut self) -> Result<Vec<String>> {
        let v = self.rpc("tools/list", json!({}))?;
        let names = v
            .get("tools")
            .and_then(|t| t.as_array())
            .ok_or_else(|| Error::Malformed("tools/list result carries no tools array".into()))?
            .iter()
            .filter_map(|t| t.get("name").and_then(|n| n.as_str()).map(String::from))
            .collect();
        Ok(names)
    }

    /// `tools/call` — returns the parsed payload or the tool failure.
    pub fn call_tool(&mut self, name: &str, arguments: Value) -> Result<ToolReply> {
        let v = self.rpc(
            "tools/call",
            json!({ "name": name, "arguments": arguments }),
        )?;
        // The wrapper answers {content:[{type:"text",text:"<json string>"}]};
        // failures are the SAME shape with text "Error: {json}".
        let text = v
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|c| c.first())
            .and_then(|c| c.get("text"))
            .and_then(|t| t.as_str())
            .ok_or_else(|| {
                Error::Malformed(format!(
                    "tools/call({name}) answered without content[0].text: {v}"
                ))
            })?;
        if let Some(rest) = text.strip_prefix("Error:") {
            return Ok(ToolReply::ToolError(rest.trim().to_string()));
        }
        match serde_json::from_str::<Value>(text) {
            Ok(payload) if payload.is_object() => Ok(ToolReply::Ok(payload)),
            Ok(other) => Err(Error::Malformed(format!(
                "tools/call({name}) payload is not an object: {other}"
            ))),
            Err(_) => Ok(ToolReply::ToolError(text.to_string())),
        }
    }

    fn rpc(&mut self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id;
        self.next_id += 1;
        let body = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        let url = format!("{}?token={}", self.url, self.token);
        let resp = ureq::post(&url)
            .timeout(Duration::from_secs(self.timeout_secs))
            .send_json(body)
            .map_err(|e| {
                // ureq's error Display embeds the full request URL — the
                // token is scrubbed from ANY string that leaves this crate
                Error::Malformed(format!(
                    "MCP transport ({method}) against {} (token redacted): {}",
                    self.url,
                    e.to_string().replace(&self.token, "REDACTED")
                ))
            })?;
        let v: Value = resp
            .into_json()
            .map_err(|e| Error::Malformed(format!("MCP response JSON ({method}): {e}")))?;
        if let Some(err) = v.get("error") {
            return Err(Error::Malformed(format!(
                "MCP JSON-RPC error ({method}): {err}"
            )));
        }
        Ok(v.get("result").cloned().unwrap_or(Value::Null))
    }
}

/// Hex-quantity string ("0x…") → u64 (the Connect wire composes hex
/// quantities; the MCP tool schema documents decimal wei strings).
fn hexq_u64(s: &str, field: &'static str) -> Result<u64> {
    u64::from_str_radix(s.trim_start_matches("0x"), 16)
        .map_err(|e| Error::field(field, format!("bad hex quantity {s}: {e}")))
}

/// Compose the `trezor_send_transaction` arguments for an EIP-1559
/// Connect request. EVERY transaction field is supplied explicitly —
/// none of the tool's auto-fills (nonce, fee estimation, gasLimit
/// default) is reachable — and `broadcast` is the constant `false`
/// (SIGNED ONLY; this function has no parameter that could set it).
pub fn send_transaction_args(req: &ConnectRequestJson, coin: &str) -> Result<Value> {
    let ConnectTransactionJson::Eip1559 {
        ref to,
        ref value,
        ref gas_limit,
        ref nonce,
        ref data,
        chain_id,
        ref max_fee_per_gas,
        ref max_priority_fee_per_gas,
    } = req.transaction
    else {
        return Err(Error::Malformed(
            "the wave slice composes 1559 only — refusing to map a legacy request".into(),
        ));
    };
    if req.chunkify {
        return Err(Error::Malformed(
            "chunked requests are a device-transport detail this adapter does not carry".into(),
        ));
    }
    Ok(json!({
        "coin": coin,
        "to": to,
        "value": hexq_u64(value, "value")?.to_string(), // the organ composes zero-value contract calls; the wall re-enforces it
        "nonce": hexq_u64(nonce, "nonce")?.to_string(),
        "gasLimit": hexq_u64(gas_limit, "gasLimit")?.to_string(),
        "maxFeePerGas": hexq_u64(max_fee_per_gas, "maxFeePerGas")?.to_string(),
        "maxPriorityFeePerGas": hexq_u64(max_priority_fee_per_gas, "maxPriorityFeePerGas")?.to_string(),
        "data": data,
        "chainId": chain_id,
        "path": req.path,
        "broadcast": false, // SIGNED, NEVER BROADCAST — structural constant
    }))
}

/// Decode the tool payload (Connect `EthereumSignedTx`) into the
/// untrusted raw type the wall consumes. `deny_unknown_fields` on
/// [`ConnectSignedTxRaw`] makes a half-decoded or whole-envelope object
/// fail loudly.
pub fn parse_signed_payload(payload: &Value) -> Result<ConnectSignedTxRaw> {
    serde_json::from_value(payload.clone())
        .map_err(|e| Error::Malformed(format!("send_transaction payload: {e}")))
}

/// The Safe 7 Suite-MCP transport — implements the bPay signing
/// boundary. ONE device round-trip per call; a tool failure (device
/// rejection, timeout) is an `Err` the driver phase-types
/// after-dispatch and never retries.
pub struct SuiteMcpTransport {
    pub mcp: SuiteMcp,
    pub coin: String,
}

impl SuiteMcpTransport {
    pub fn new(mcp: SuiteMcp) -> Self {
        SuiteMcpTransport {
            mcp,
            coin: "eth".into(),
        }
    }
}

impl watchpay::connect::ConnectTransport for SuiteMcpTransport {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> Result<ConnectSignedTxRaw> {
        let args = send_transaction_args(request, &self.coin)?;
        match self.mcp.call_tool("trezor_send_transaction", args)? {
            ToolReply::Ok(payload) => parse_signed_payload(&payload),
            ToolReply::ToolError(why) => Err(Error::Malformed(format!(
                "trezor_send_transaction refused (device/Suite answer, untrusted): {why}"
            ))),
        }
    }
}

// ───────────── the harmless preflight primitives (Observation A) ─────────────

/// `trezor_get_address` (ethereumGetAddress, silent — no device button
/// when `show_on_trezor` is false). Returns the device-derived address.
pub fn get_address(mcp: &mut SuiteMcp, path: &str, show_on_trezor: bool) -> Result<EthAddr> {
    match mcp.call_tool(
        "trezor_get_address",
        json!({ "coin": "eth", "path": path, "showOnTrezor": show_on_trezor }),
    )? {
        ToolReply::Ok(payload) => {
            let addr = payload
                .get("address")
                .and_then(|a| a.as_str())
                .ok_or_else(|| {
                    Error::Malformed(format!("get_address payload has no address: {payload}"))
                })?;
            // the device returns the EIP-55 checksummed form; the estate's
            // EthAddr carries lowercase-only identity
            EthAddr::from_lower_hex(&addr.to_lowercase()).map_err(|e| Error::field("address", e))
        }
        ToolReply::ToolError(why) => Err(Error::Malformed(format!("get_address refused: {why}"))),
    }
}

/// The Ethereum personal-message preimage:
/// keccak256("\x19Ethereum Signed Message:\n" + len + message).
pub fn personal_message_hash(message: &str) -> [u8; 32] {
    let bytes = message.as_bytes();
    let mut pre = format!("\x19Ethereum Signed Message:\n{}", bytes.len()).into_bytes();
    pre.extend_from_slice(bytes);
    keccak256(&pre)
}

/// Recover the signer of a Trezor `ethereumSignMessage` answer. The
/// 65-byte signature is r‖s‖v with v EITHER the recovery id {0,1}
/// (Connect's compact form) or {27,28} (EIP-155 style); both are
/// accepted and the raw v is returned for the receipt.
pub fn recover_personal_message_signer(message: &str, sig65: &[u8; 65]) -> Result<(EthAddr, u8)> {
    let r: [u8; 32] = sig65[..32].try_into().expect("65-byte sig");
    let s: [u8; 32] = sig65[32..64].try_into().expect("65-byte sig");
    let v = sig65[64];
    let recid = match v {
        0 | 1 => v,
        27 | 28 => v - 27,
        other => {
            return Err(Error::field(
                "signature",
                format!("v byte {other} is neither a recovery id nor EIP-155 form"),
            ))
        }
    };
    let prehash = personal_message_hash(message);
    let addr = watchpay::eth::recover_signer(&prehash, &r, &s, recid)?;
    Ok((addr, v))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use watchpay::connect::ConnectTransport;

    /// Find the offset just past the blank line ending the HTTP headers.
    fn find_headers_end(buf: &[u8]) -> Option<usize> {
        buf.windows(4).position(|w| w == b"\r\n\r\n").map(|p| p + 4)
    }

    /// One-shot mock MCP server: captures the request JSON, replies with
    /// the given response body, closes.
    fn mock_mcp(reply: String) -> (String, std::sync::mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            if let Ok((mut sock, _)) = listener.accept() {
                // read headers + the full Content-Length body (a single
                // read can return just the first TCP segment)
                let mut buf = Vec::new();
                let mut chunk = [0u8; 8192];
                let body_start = loop {
                    if let Some(pos) = find_headers_end(&buf) {
                        break pos;
                    }
                    let n = match sock.read(&mut chunk) {
                        Ok(0) | Err(_) => break usize::MAX,
                        Ok(n) => n,
                    };
                    buf.extend_from_slice(&chunk[..n]);
                };
                if body_start != usize::MAX {
                    let headers = String::from_utf8_lossy(&buf[..body_start]).to_string();
                    let len: usize = headers
                        .lines()
                        .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                        .and_then(|l| l.split(':').nth(1))
                        .and_then(|v| v.trim().parse().ok())
                        .unwrap_or(0);
                    while buf.len() < body_start + len {
                        let n = match sock.read(&mut chunk) {
                            Ok(0) | Err(_) => break,
                            Ok(n) => n,
                        };
                        buf.extend_from_slice(&chunk[..n]);
                    }
                }
                let req = String::from_utf8_lossy(&buf).to_string();
                let _ = tx.send(req);
                let body = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    reply.len(),
                    reply
                );
                let _ = sock.write_all(body.as_bytes());
                let _ = sock.flush();
                let _ = sock.shutdown(std::net::Shutdown::Write);
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        });
        (format!("http://127.0.0.1:{port}/mcp"), rx)
    }

    fn eip1559_request() -> ConnectRequestJson {
        ConnectRequestJson {
            path: "m/44'/60'/0'/0/0".into(),
            chunkify: false,
            transaction: ConnectTransactionJson::Eip1559 {
                to: "0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26".into(),
                value: "0x0".into(),
                gas_limit: "0x5b8d80".into(), // 6000000
                nonce: "0x7".into(),
                data: "0xb6c2141b".into(),
                chain_id: 42161,
                max_fee_per_gas: "0x3b9aca00".into(), // 1 gwei
                max_priority_fee_per_gas: "0x77359400".into(),
            },
        }
    }

    #[test]
    fn send_args_map_every_field_explicitly_decimal_broadcast_false() {
        let args = send_transaction_args(&eip1559_request(), "eth").expect("args");
        assert_eq!(args["nonce"], "7");
        assert_eq!(args["gasLimit"], "6000000");
        assert_eq!(args["maxFeePerGas"], "1000000000");
        assert_eq!(args["maxPriorityFeePerGas"], "2000000000");
        assert_eq!(args["chainId"], 42161);
        assert_eq!(args["to"], "0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26");
        assert_eq!(args["value"], "0");
        assert_eq!(args["data"], "0xb6c2141b");
        assert_eq!(args["path"], "m/44'/60'/0'/0/0");
        assert_eq!(args["coin"], "eth");
        // THE structural law: never broadcast.
        assert_eq!(args["broadcast"], false);
        // no auto-fill reachable: every field the schema documents for EVM
        // composition is present exactly once.
        for key in [
            "nonce",
            "gasLimit",
            "maxFeePerGas",
            "maxPriorityFeePerGas",
            "data",
            "chainId",
            "path",
        ] {
            assert!(args.get(key).is_some(), "missing {key}");
        }
    }

    #[test]
    fn transport_round_trip_posts_tool_call_and_parses_payload() {
        let inner = json!({
        "serializedTx": "0x02f8b2018207843b9aca0084773594008305b8d80949a3ecac693b699fc0b2b6a50b5549e50c2320a268084b6c2141b", // PUBLIC-CONSTANT: synthetic mock vector, not a real tx
        "v": "0x1",
            "r": "0x33",
            "s": "0x44"
        });
        let reply = json!({
            "jsonrpc": "2.0", "id": 1,
            "result": { "content": [ { "type": "text", "text": inner.to_string() } ] }
        })
        .to_string();
        let (url, rx) = mock_mcp(reply);
        let mut t = SuiteMcpTransport::new(SuiteMcp::new(&url, "test-token", 5));
        let raw = t
            .ethereum_sign_transaction(&eip1559_request())
            .expect("signed");
        assert_eq!(raw.v, "0x1");
        assert_eq!(raw.r, "0x33");
        assert_eq!(raw.s, "0x44");
        assert!(raw.serialized_tx.starts_with("0x02f8b2"));
        // the request the server saw: token in the query, JSON-RPC
        // tools/call with our args
        let seen = rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("req");
        assert!(
            seen.contains("POST /mcp?token=test-token"),
            "token route: {seen}"
        );
        assert!(seen.contains("\"trezor_send_transaction\""));
        assert!(seen.contains("\"broadcast\":false"));
        assert!(seen.contains("\"nonce\":\"7\""));
    }

    #[test]
    fn tool_error_is_a_refusal_not_a_retry() {
        let reply = json!({
            "jsonrpc": "2.0", "id": 1,
            "result": { "content": [ { "type": "text",
                "text": "Error: {\"error\":\"Action cancelled by user\"}" } ] }
        })
        .to_string();
        let (url, _rx) = mock_mcp(reply);
        let mut t = SuiteMcpTransport::new(SuiteMcp::new(&url, "tk", 5));
        let err = t
            .ethereum_sign_transaction(&eip1559_request())
            .expect_err("refused");
        assert!(err.to_string().contains("Action cancelled"));
    }

    #[test]
    fn unknown_tool_is_a_protocol_error() {
        let reply = json!({
            "jsonrpc": "2.0", "id": 1,
            "error": { "code": -32602, "message": "Unknown tool: nope" }
        })
        .to_string();
        let (url, _rx) = mock_mcp(reply);
        let mut mcp = SuiteMcp::new(&url, "tk", 5);
        assert!(mcp.call_tool("nope", json!({})).is_err());
    }

    #[test]
    fn personal_message_recovery_round_trip_both_v_forms() {
        use k256::ecdsa::SigningKey;
        use k256::elliptic_curve::rand_core::OsRng;
        let msg = "bPay Safe 7 preflight — harmless, no transaction, no broadcast";
        let key = SigningKey::random(&mut OsRng);
        let digest = personal_message_hash(msg);
        let (sig, rid) = key.sign_prehash_recoverable(&digest).expect("sign");
        let b = sig.to_bytes();
        let mut sig65 = [0u8; 65];
        sig65[..64].copy_from_slice(&b[..]);
        // compact v = recid
        sig65[64] = rid.to_byte();
        let (addr, v_seen) = recover_personal_message_signer(msg, &sig65).expect("recover");
        assert_eq!(v_seen, rid.to_byte());
        // EIP-155 form v = recid + 27 recovers the SAME address
        sig65[64] = rid.to_byte() + 27;
        let (addr2, v2) = recover_personal_message_signer(msg, &sig65).expect("recover 27");
        assert_eq!(v2, rid.to_byte() + 27);
        assert_eq!(addr, addr2);
        // and it equals the key's own Ethereum address
        let point = key.verifying_key().to_encoded_point(false);
        let h = keccak256(&point.as_bytes()[1..65]);
        let mut expect = [0u8; 20];
        expect.copy_from_slice(&h[12..]);
        assert_eq!(addr.0, expect);
        // a different message does NOT recover to it (binding proof)
        sig65[64] = rid.to_byte();
        let wrong = recover_personal_message_signer("other message", &sig65);
        assert_ne!(wrong.map(|(a, _)| a).unwrap_or(addr), addr);
    }

    #[test]
    fn get_address_parses_and_bad_v_refused() {
        let reply = json!({
            "jsonrpc": "2.0", "id": 1,
            "result": { "content": [ { "type": "text",
                "text": json!({ "address": "0x8992f76e5c9c5f78dd0e2f6b1f0a3a4b9d5c6e7f" }).to_string() } ] }
        })
        .to_string();
        let (url, _rx) = mock_mcp(reply);
        let mut mcp = SuiteMcp::new(&url, "tk", 5);
        let a = get_address(&mut mcp, "m/44'/60'/0'/0/0", false).expect("addr");
        assert_eq!(
            a.to_lower_hex(),
            "0x8992f76e5c9c5f78dd0e2f6b1f0a3a4b9d5c6e7f"
        );
        let mut bad = [1u8; 65];
        bad[64] = 5;
        assert!(recover_personal_message_signer("m", &bad).is_err());
    }
}
