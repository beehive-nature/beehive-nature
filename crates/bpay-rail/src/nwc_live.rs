//! LIVE NIP-47 transport (feature `live-nwc`) — WebSocket only, Nostr
//! subscription semantics for the response door (kind 23195 via REQ
//! over the SAME socket; no REST shortcut). NIP-44 v2 crypto lives in
//! the pure `nwc_crypto` module; correlation/reconnect in `nwc_reader`.
//!
//! LIVE SENDS remain gated OFF at the rail level (founder order); this
//! transport is used read-only until explicitly authorized.

use crate::nwc::NwcError;
use crate::nwc_crypto::nip44_encrypt;
use crate::nwc_reader::{read_response, ReadPolicy, RequestCtx, WsError, WsSocket};
use k256::schnorr::SigningKey;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use zeroize::{Zeroize, Zeroizing};

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// A parsed `nostr+walletconnect://…` connection. The client secret is
/// ZEROIZED on drop; parse() also zeroes its intermediate buffers.
#[derive(Clone)]
pub struct NwcConnection {
    pub wallet_pubkey_hex: String,
    pub relay_url_ws: String,
    client_secret: Zeroizing<[u8; 32]>,
}

impl std::fmt::Debug for NwcConnection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // never print the secret
        f.debug_struct("NwcConnection")
            .field("wallet_pubkey_hex", &self.wallet_pubkey_hex)
            .field("relay_url_ws", &self.relay_url_ws)
            .finish_non_exhaustive()
    }
}

impl NwcConnection {
    pub fn parse(url: &str) -> Result<Self, NwcError> {
        let rest = url
            .strip_prefix("nostr+walletconnect://")
            .ok_or_else(|| NwcError::Other("not a nostr+walletconnect:// URL".into()))?;
        let (pk, query) = rest
            .split_once('?')
            .ok_or_else(|| NwcError::Other("connection URL lacks query".into()))?;
        let mut relay = None;
        let mut secret_bytes: Option<Vec<u8>> = None;
        for kv in query.split('&') {
            let (k, v) = kv
                .split_once('=')
                .ok_or_else(|| NwcError::Other(format!("malformed query pair {kv:?}")))?;
            let v = urldecode(v);
            match k {
                "relay" => relay = Some(v),
                "secret" => {
                    let mut bytes = hex::decode(&v).map_err(|e| NwcError::Other(e.to_string()))?;
                    if bytes.len() != 32 {
                        bytes.zeroize();
                        return Err(NwcError::Other("secret must be 32 bytes hex".into()));
                    }
                    secret_bytes = Some(bytes);
                }
                _ => {}
            }
        }
        let mut raw = secret_bytes.ok_or_else(|| NwcError::Other("secret param missing".into()))?;
        let mut s = [0u8; 32];
        s.copy_from_slice(&raw);
        raw.zeroize();
        // relays in connection URLs are commonly https:// — nostr WS
        // wants wss://; scheme conversion only, never a different host.
        let relay = relay.ok_or_else(|| NwcError::Other("relay param missing".into()))?;
        let relay_ws = if relay.starts_with("wss://") || relay.starts_with("ws://") {
            relay
        } else if let Some(rest) = relay.strip_prefix("https://") {
            format!("wss://{rest}")
        } else if let Some(rest) = relay.strip_prefix("http://") {
            format!("ws://{rest}")
        } else {
            format!("wss://{relay}")
        };
        Ok(NwcConnection {
            wallet_pubkey_hex: pk.to_string(),
            relay_url_ws: relay_ws,
            client_secret: Zeroizing::new(s),
        })
    }

    fn secret(&self) -> [u8; 32] {
        *self.client_secret
    }
}

/// Tungstenite blocking socket (rustls, webpki roots — pure-Rust TLS).
pub struct TungsteniteSocket {
    inner: tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>,
}

impl TungsteniteSocket {
    pub fn connect(url: &str) -> Result<Self, WsError> {
        let (sock, _resp) = tungstenite::connect(url)
            .map_err(|e| WsError::Fatal(format!("ws connect {url}: {e}")))?;
        Ok(TungsteniteSocket { inner: sock })
    }
}

impl WsSocket for TungsteniteSocket {
    fn send_text(&mut self, text: &str) -> Result<(), WsError> {
        use tungstenite::Message;
        self.inner
            .send(Message::Text(text.into()))
            .map_err(|e| WsError::Disconnected(format!("send: {e}")))
    }
    fn recv_text(&mut self) -> Result<Option<String>, WsError> {
        use tungstenite::Message;
        loop {
            match self.inner.read() {
                Ok(Message::Text(t)) => return Ok(Some(t)),
                Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => continue,
                Ok(Message::Close(_)) => return Ok(None),
                Err(tungstenite::Error::ConnectionClosed) => return Ok(None),
                Err(e) => {
                    return Err(WsError::Disconnected(format!("recv: {e}")));
                }
                Ok(_) => continue,
            }
        }
    }
}

fn urldecode(s: &str) -> String {
    s.replace("%3A", ":")
        .replace("%2F", "/")
        .replace("%3F", "?")
        .replace("%3D", "=")
        .replace("%26", "&")
}

pub struct LiveNwcTransport {
    conn: NwcConnection,
    policy: ReadPolicy,
}

impl LiveNwcTransport {
    pub fn new(conn: NwcConnection) -> Self {
        LiveNwcTransport {
            conn,
            policy: ReadPolicy::default(),
        }
    }

    fn client_pubkey_hex(&self) -> String {
        let sk = SigningKey::from_bytes(&self.conn.secret()).expect("validated at parse");
        hex::encode(sk.verifying_key().to_bytes())
    }

    fn build_signed_event(&self, kind: u64, content: &str, tags: serde_json::Value) -> String {
        let sk = SigningKey::from_bytes(&self.conn.secret()).expect("validated at parse");
        let pubkey = hex::encode(sk.verifying_key().to_bytes());
        let created_at = now_secs();
        let serialized =
            serde_json::json!([0, pubkey, created_at, kind, tags, content]).to_string();
        let id: [u8; 32] = Sha256::digest(serialized.as_bytes()).into();
        let sig = sk.sign_raw(&id, &[0u8; 32]).expect("schnorr sign");
        serde_json::json!({
            "id": hex::encode(id),
            "pubkey": pubkey,
            "created_at": created_at,
            "kind": kind,
            "tags": tags,
            "content": content,
            "sig": hex::encode(sig.to_bytes()),
        })
        .to_string()
    }
}

impl crate::nwc::NwcTransport for LiveNwcTransport {
    fn request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, NwcError> {
        let content = nip44_encrypt(
            &self.conn.secret(),
            &self.conn.wallet_pubkey_hex,
            &serde_json::json!({ "method": method, "params": params }).to_string(),
        )?;
        let client_pub = self.client_pubkey_hex();
        let expiration = now_secs() + 60;
        let tags = serde_json::json!([
            ["p", self.conn.wallet_pubkey_hex],
            ["expiration", expiration]
        ]);
        let event = self.build_signed_event(23194, &content, tags);

        let since = now_secs();
        let sub = format!("bpay-{since}");
        let req_frame = serde_json::json!([
            "REQ", sub,
            { "kinds": [23195], "#p": [client_pub], "since": since.saturating_sub(2), "limit": 1 }
        ])
        .to_string();

        let relay = self.conn.relay_url_ws.clone();
        let relay_for_reopen = relay.clone();
        let mut socket = TungsteniteSocket::connect(&relay)
            .map_err(|e| NwcError::TransportAmbiguous(format!("{e:?}")))?;
        socket
            .send_text(&format!(r#"["EVENT",{event}]"#))
            .map_err(|e| NwcError::TransportAmbiguous(format!("send event: {e:?}")))?;
        socket
            .send_text(&req_frame)
            .map_err(|e| NwcError::TransportAmbiguous(format!("send req: {e:?}")))?;

        let ctx = RequestCtx {
            client_pubkey_hex: client_pub,
            wallet_pubkey_hex: self.conn.wallet_pubkey_hex.clone(),
            client_secret: self.conn.secret(),
            since_unix: since.saturating_sub(2),
            method: method.to_string(),
        };
        let envelope = {
            let reopen = move |_attempt: usize| TungsteniteSocket::connect(&relay_for_reopen);
            read_response(&mut socket, reopen, &req_frame, &self.policy, &ctx)?
        };
        // NIP-47 envelope: { result_type, result?, error? }
        if let Some(err) = envelope.get("error").filter(|e| !e.is_null()) {
            let code = err.get("code").and_then(|c| c.as_str()).unwrap_or("OTHER");
            let message = err.get("message").and_then(|m| m.as_str()).unwrap_or("");
            return Err(NwcError::from_code(code, message));
        }
        Ok(envelope
            .get("result")
            .cloned()
            .unwrap_or(serde_json::Value::Null))
    }
}
