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

/// LT-8: the clock seam — a function producing "now" in unix seconds.
/// The DEFAULT is the system wall clock (called at the live edge);
/// tests inject deterministic time. The epoch-0 fallback is RETIRED:
/// a clock failure is a typed pre-ledger refusal (LT-8.1), not a
/// silently-zero timestamp.
pub type ClockFn = std::rc::Rc<dyn Fn() -> Result<u64, ClockError>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClockError {
    Unavailable(String),
}

impl std::fmt::Display for ClockError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClockError::Unavailable(why) => write!(f, "clock unavailable: {why}"),
        }
    }
}

fn system_clock() -> Result<u64, ClockError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|e| ClockError::Unavailable(e.to_string()))
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
        let mut relays: Vec<String> = Vec::new();
        let mut secret_bytes: Option<Vec<u8>> = None;
        for kv in query.split('&') {
            let (k, v) = kv
                .split_once('=')
                .ok_or_else(|| NwcError::Other(format!("malformed query pair {kv:?}")))?;
            let v = urldecode(v);
            match k {
                "relay" => relays.push(v),
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
        // LT-7.1: multiple relay= params are a TYPED refusal — never
        // silent last-wins (multi-relay composition is its own slice).
        if relays.len() > 1 {
            return Err(NwcError::Other(format!(
                "multiple relays in connection URL ({} found) — multi-relay composition is not built;                  the connection must name exactly one relay (LT-7.1)",
                relays.len()
            )));
        }
        let relay = relays
            .into_iter()
            .next()
            .ok_or_else(|| NwcError::Other("relay param missing".into()))?;
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

/// LT-9.3: case-insensitive percent-decoding — any hex case decodes;
/// unknown sequences are preserved verbatim (RFC 3986 consumer).
fn urldecode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 3 <= bytes.len() {
            let hi = hex_val(bytes[i + 1]);
            let lo = hex_val(bytes[i + 2]);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push(((h << 4) | l) as char);
                i += 3;
            } else {
                out.push(bytes[i] as char);
                i += 1;
            }
        } else {
            out.push(bytes[i] as char);
            i += 1;
        }
    }
    out
}

fn hex_val(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

pub struct LiveNwcTransport {
    conn: NwcConnection,
    policy: ReadPolicy,
    clock: ClockFn,
    /// LT-8.1 test seam: records every relay-connect ATTEMPT (None =
    /// inert). Proves zero-published-requests without any network.
    connect_log: Option<std::rc::Rc<std::cell::RefCell<Vec<String>>>>,
    /// BOUNDARY-AUDIT seams (inert by default; each fails AT its named
    /// boundary so the audit proves provenance, not plumbing):
    /// fail BEFORE any connect (DNS/socket/TLS class);
    pub connect_fail_next: bool,
    /// fail at LOCAL construction (CSPRNG/encrypt, pre-send);
    pub encrypt_fail_next: bool,
    /// fail AFTER connect at the event write (submitted class).
    pub send_fail_next: bool,
}

impl LiveNwcTransport {
    pub fn new(conn: NwcConnection) -> Self {
        LiveNwcTransport {
            conn,
            policy: ReadPolicy::default(),
            clock: std::rc::Rc::new(system_clock),
            connect_log: None,
            connect_fail_next: false,
            encrypt_fail_next: false,
            send_fail_next: false,
        }
    }

    /// LT-8: inject a deterministic clock for testing.
    pub fn with_clock(mut self, clock: ClockFn) -> Self {
        self.clock = clock;
        self
    }

    /// LT-8.1 test seam: every relay-connect attempt is recorded.
    pub fn with_connect_log(mut self, log: std::rc::Rc<std::cell::RefCell<Vec<String>>>) -> Self {
        self.connect_log = Some(log);
        self
    }

    fn client_pubkey_hex(&self) -> String {
        let sk = SigningKey::from_bytes(&self.conn.secret()).expect("validated at parse");
        hex::encode(sk.verifying_key().to_bytes())
    }

    fn build_signed_event(
        &self,
        now: u64,
        kind: u64,
        content: &str,
        tags: serde_json::Value,
    ) -> String {
        let sk = SigningKey::from_bytes(&self.conn.secret()).expect("validated at parse");
        let pubkey = hex::encode(sk.verifying_key().to_bytes());
        let created_at = now;
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
        let now = (self.clock)().map_err(|e| {
            NwcError::ClockUnavailable(format!("clock failure (pre-ledger, nothing sent): {e}"))
        })?;
        // LT-8.1: an epoch-0 reading is the dead fallback — refuse it as
        // a clock failure BEFORE building any event (never created_at=0).
        if now == 0 {
            return Err(NwcError::ClockUnavailable(
                "epoch-0 clock reading refused (pre-ledger, nothing sent)".into(),
            ));
        }
        if self.encrypt_fail_next {
            self.encrypt_fail_next = false;
            return Err(NwcError::LocalConstruction(
                "CSPRNG/encrypt failure (injected probe, pre-send)".into(),
            ));
        }
        let content = nip44_encrypt(
            &self.conn.secret(),
            &self.conn.wallet_pubkey_hex,
            &serde_json::json!({ "method": method, "params": params }).to_string(),
        )
        .map_err(|e| {
            // CSPRNG/serialization/key-material construction happens
            // before any send — LOCAL, never Unknown.
            NwcError::LocalConstruction(format!("encryption construction (pre-send): {e}"))
        })?;
        let client_pub = self.client_pubkey_hex();
        let expiration = now + 60; // LT-8.2: per-request TTL (60s is the NIP-47 recommended); the intent's declared evidence window governs at the ledger
        let tags = serde_json::json!([
            ["p", self.conn.wallet_pubkey_hex],
            ["expiration", expiration]
        ]);
        let event = self.build_signed_event(now, 23194, &content, tags);
        let our_event_id: String = serde_json::from_str::<serde_json::Value>(&event)
            .ok()
            .and_then(|ev| ev.get("id").and_then(|i| i.as_str()).map(str::to_string))
            .unwrap_or_default();

        let since = now;
        let sub = format!("bpay-{since}");
        let req_frame = serde_json::json!([
            "REQ", sub,
            { "kinds": [23195], "#p": [client_pub], "since": since.saturating_sub(2), "limit": 1 }
        ])
        .to_string();

        let relay = self.conn.relay_url_ws.clone();
        let relay_for_reopen = relay.clone();
        if self.connect_fail_next {
            self.connect_fail_next = false;
            return Err(NwcError::ConnectFailed(
                "ws connect failure (injected probe, pre-send)".into(),
            ));
        }
        if let Some(log) = &self.connect_log {
            log.borrow_mut().push(relay.clone());
        }
        if self.send_fail_next {
            // Model connect-succeeded-then-write-failed WITHOUT network:
            // the attempt is recorded (the boundary WAS crossed) and the
            // write fails — the submitted/unacknowledged class.
            self.send_fail_next = false;
            return Err(NwcError::TransportAmbiguous(
                "event write failed after connect (submitted, unacknowledged)".into(),
            ));
        }
        let mut socket = TungsteniteSocket::connect(&relay).map_err(|e| {
            // DNS/socket/TLS: no application byte reached any relay —
            // a PRE-SEND failure, never ambiguity (the boundary audit).
            NwcError::ConnectFailed(format!("{e:?}"))
        })?;
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
            max_future_skew_secs: crate::nwc_reader::DEFAULT_MAX_SKEW_SECS,
            now_unix: now,
            method: method.to_string(),
        };
        let envelope = {
            let reopen = move |_attempt: usize| TungsteniteSocket::connect(&relay_for_reopen);
            read_response(
                &mut socket,
                reopen,
                &req_frame,
                &self.policy,
                &ctx,
                &our_event_id,
            )?
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
