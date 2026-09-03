//! MINIMAL CDP CLIENT — hand-rolled, vendored from nobody.
//!
//! The lane law: "Vendor nothing from BrowserOS." Everything that touches
//! the browser here is estate code: a plain-HTTP JSON reader for the
//! DevTools endpoints and a WebSocket JSON-RPC conductor for the protocol
//! itself. No chromiumoxide, no playwright, no BrowserOS lineage — the only
//! counterparty is Chromium's own DevTools interface, spoken directly.
//!
//! Transport facts (verified live by the Milestone 1 run):
//! - `PUT /json/new?url=<url>` creates a tab and returns its
//!   `webSocketDebuggerUrl` (GET was disabled for /json/new in Chrome 111).
//! - CDP is JSON-RPC over that WebSocket: `{"id","method","params"}` in,
//!   `{"id","result"}` or `{"id","error"}` back, `{"method","params"}` for
//!   events.
//! - The methods used are stable CDP domains: Page.navigate,
//!   Runtime.evaluate, Accessibility.getFullAXTree,
//!   DOM.pushNodesByBackendIdsToFrontend, DOM.getBoxModel,
//!   CSS.getComputedStyleForNode, Input.dispatchMouseEvent. The Milestone 1
//!   replay is the live proof they behave as assumed on this Chromium.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use serde_json::{json, Value};
use tungstenite::{connect, Message, WebSocket};

/// Stream-type-agnostic WebSocket surface, so the conductor compiles no
/// matter which concrete stream type `connect` returns under feature
/// unification (TcpStream bare, or wrapped in a TLS-stream enum).
trait WsIo: Send {
    fn send_msg(&mut self, m: Message) -> Result<(), tungstenite::Error>;
    fn read_msg(&mut self) -> Result<Message, tungstenite::Error>;
}

impl<S: std::io::Read + std::io::Write + Send> WsIo for WebSocket<S> {
    fn send_msg(&mut self, m: Message) -> Result<(), tungstenite::Error> {
        self.send(m)
    }
    fn read_msg(&mut self) -> Result<Message, tungstenite::Error> {
        self.read()
    }
}

use crate::b64::b64u;

#[derive(Debug, thiserror::Error)]
pub enum CdpError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("ws: {0}")]
    Ws(#[from] tungstenite::Error),
    #[error("cdp error on {method}: {code} {message}")]
    Method {
        method: String,
        code: i64,
        message: String,
    },
    #[error("unexpected cdp shape on {0}")]
    Shape(String),
}

/// Plain-HTTP JSON call against the DevTools HTTP endpoints (127.0.0.1 only).
///
/// Response framing is parsed PROPERLY (headers → Content-Length → exactly
/// that many body bytes): Chrome's DevTools server ignores `Connection:
/// close` and keeps the socket open, so waiting for EOF would block until
/// the read timeout on every call. Learned live on Chrome 151.
pub fn http_json(port: u16, method: &str, path: &str) -> Result<Value, CdpError> {
    let mut s = TcpStream::connect(("127.0.0.1", port))?;
    s.set_read_timeout(Some(Duration::from_secs(10)))?;
    s.set_write_timeout(Some(Duration::from_secs(10)))?;
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAccept: application/json\r\nContent-Length: 0\r\n\r\n"
    );
    s.write_all(req.as_bytes())?;

    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    let mut chunk = [0u8; 4096];
    // read until end of headers
    let sep = loop {
        if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break i;
        }
        let n = s.read(&mut chunk)?;
        if n == 0 {
            return Err(CdpError::Shape("eof before headers complete".into()));
        }
        buf.extend_from_slice(&chunk[..n]);
    };
    let head = String::from_utf8_lossy(&buf[..sep]).to_string();
    if !head.starts_with("HTTP/1.1 200") && !head.starts_with("HTTP/1.0 200") {
        let status = head.lines().next().unwrap_or("?");
        return Err(CdpError::Shape(format!("devtools http status: {status}")));
    }
    let content_length: usize = head
        .lines()
        .find_map(|l| {
            l.split_once(':').and_then(|(k, v)| {
                if k.trim().eq_ignore_ascii_case("content-length") {
                    v.trim().parse().ok()
                } else {
                    None
                }
            })
        })
        .unwrap_or(0);
    let body_start = sep + 4;
    while buf.len() < body_start + content_length {
        let n = s.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    let body = &buf[body_start..body_start + content_length];
    serde_json::from_slice(body).map_err(|e| CdpError::Shape(format!("non-json body: {e}")))
}

/// A CDP WebSocket conductor: sequential calls, events parked for later.
pub struct CdpConn {
    ws: Box<dyn WsIo>,
    next_id: u64,
    events: Vec<(String, Value)>,
    /// set true whenever a Close frame arrives — call() then fails fast.
    closed: bool,
}

impl CdpConn {
    pub fn connect(url: &str) -> Result<Self, CdpError> {
        let (ws, _) = connect(url)?;
        Ok(CdpConn {
            ws: Box::new(ws),
            next_id: 0,
            events: Vec::new(),
            closed: false,
        })
    }

    fn send_text(&mut self, text: String) -> Result<(), CdpError> {
        self.ws.send_msg(Message::text(text))?;
        Ok(())
    }

    /// Issue one command, block for its response. Events that arrive first
    /// are parked (see [`Self::take_events`]).
    pub fn call(&mut self, method: &str, params: Value) -> Result<Value, CdpError> {
        if self.closed {
            return Err(CdpError::Io(std::io::Error::other("cdp socket closed")));
        }
        self.next_id += 1;
        let id = self.next_id;
        let msg = json!({ "id": id, "method": method, "params": params });
        self.send_text(msg.to_string())?;
        loop {
            match self.ws.read_msg()? {
                Message::Text(t) => {
                    let v: Value = serde_json::from_str(t.as_str())
                        .map_err(|e| CdpError::Shape(format!("bad cdp frame: {e}")))?;
                    if v.get("id").and_then(|i| i.as_u64()) == Some(id) {
                        if let Some(err) = v.get("error") {
                            return Err(CdpError::Method {
                                method: method.to_string(),
                                code: err.get("code").and_then(|c| c.as_i64()).unwrap_or(0),
                                message: err
                                    .get("message")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("?")
                                    .to_string(),
                            });
                        }
                        return Ok(v.get("result").cloned().unwrap_or(Value::Null));
                    }
                    if let (Some(m), Some(p)) = (
                        v.get("method").and_then(|m| m.as_str()),
                        v.get("params").cloned(),
                    ) {
                        self.events.push((m.to_string(), p));
                    }
                }
                Message::Ping(p) => self.ws.send_msg(Message::Pong(p))?,
                Message::Close(_) => {
                    self.closed = true;
                    return Err(CdpError::Io(std::io::Error::other(
                        "cdp socket closed mid-call",
                    )));
                }
                _ => {}
            }
        }
    }

    /// Drain parked events (method name, params), newest last.
    pub fn take_events(&mut self) -> Vec<(String, Value)> {
        std::mem::take(&mut self.events)
    }

    /// The socket's target id, derived from its URL path (…/devtools/page/<id>).
    pub fn target_id_from_url(url: &str) -> String {
        url.rsplit('/').next().unwrap_or("").to_string()
    }

    /// Unique-ish correlation tag for replay logging (never secret material).
    pub fn conn_tag(url: &str) -> String {
        b64u(url.as_bytes())[..12].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_id_extraction() {
        assert_eq!(
            CdpConn::target_id_from_url("ws://127.0.0.1:9222/devtools/page/ABC123"),
            "ABC123"
        );
    }
}
