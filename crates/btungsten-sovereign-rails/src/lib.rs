//! btungsten-sovereign-rails — sovereign P2P content rails (issue #479).
//!
//! The smallest decisive milestone the issue names: independently
//! administered peers retrieve the same PINNED artifacts with NO estate
//! dependency (no GitHub bootstrap, no skaists.dev, no relay door, no box,
//! no DNS), every received byte verified against the /2 seal chain
//! (`genealogy_publication::verify_seal_artifacts` — pin → state →
//! indexSha256 → index → page digests) BEFORE anything is retained, and
//! hard payer/egress caps that REFUSE unfunded chargeable delivery
//! instead of silently subsidizing it.
//!
//! Architecture per the issue's ruling:
//! - HTTP over a PEER-LOCAL loopback adapter is allowed ("a small
//!   peer-local loopback service is allowed only as a local adapter
//!   endpoint"); what is forbidden is a mandatory estate-operated
//!   gateway. Peers dial each other's DIRECT addresses.
//! - The x0x authenticated-peer transport (`x0x forward add --peer …` per
//!   ops/x0x/README.md) is the intended sovereign discovery/session
//!   seam. [`x0x`] below declares that adapter and NAMES what is missing
//!   (node access + bilateral ACL provisioning; the box was unreachable
//!   both attempts — SSH timeout). No hosted proxy is substituted.
//! - Storage is the peer's own local store of sealed artifacts — no
//!   hosted DB, no DBaaS (issue ruling), nothing estate-paid.
//! - Egress is an accountable resource: the serving peer carries a
//!   byte-budget ledger; exhausted or zero budget REFUSES the paid route
//!   (HTTP 402 with a named reason) — the issue's no-budget negative
//!   control. Missing budget never becomes a hidden subsidy and never
//!   falls back to an estate route (there is none in this crate).
//!
//! Honest scope (promotion rules): this qualifies the FUNDING-FREE
//! SOVEREIGN LOCAL-FIXTURE route's peer-delivery semantics only — the
//! two-peer lab runs as separate OS processes on one host and says so;
//! it is not a multi-host qualification, not a 10B claim, and promotes
//! no rail in rail-manifest.json.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// The artifact names a peer may serve. Closed set + charset-checked
/// person ids: no path traversal, no listing, nothing else exists.
pub fn artifact_path_ok(name: &str) -> Result<PathBuf, String> {
    if name == "publication-state.json" || name == "publication-index.json" {
        return Ok(PathBuf::from(name));
    }
    if let Some(rest) = name.strip_prefix("persons/") {
        let (id, ext) = match (rest.strip_suffix(".html"), rest.strip_suffix(".json")) {
            (Some(id), _) => (id, "html"),
            (_, Some(id)) => (id, "json"),
            _ => return Err(format!("artifact {name:?}: not a seal artifact")),
        };
        let ok = !id.is_empty()
            && !id.starts_with('.')
            && id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
        if !ok {
            return Err(format!(
                "artifact {name:?}: person id is a shape, never a path"
            ));
        }
        return Ok(PathBuf::from(format!("persons/{id}.{ext}")));
    }
    Err(format!("artifact {name:?}: not a seal artifact"))
}

/// The payer/egress ledger (issue #479: accountable resources). A peer
/// serves chargeable bytes only from an EXPLICIT, bounded authorization;
/// when it is gone the paid route refuses — no estate default payer, no
/// silent subsidy, no partial drip.
pub struct EgressLedger {
    authorized_bytes: u64,
    spent: AtomicU64,
}

impl EgressLedger {
    pub fn new(authorized_bytes: u64) -> Self {
        EgressLedger {
            authorized_bytes,
            spent: AtomicU64::new(0),
        }
    }
    /// Reserve `n` bytes of chargeable delivery. Refusal is a named
    /// verdict, never a silent fallback.
    pub fn reserve(&self, n: u64) -> Result<(), String> {
        let spent = self.spent.load(Ordering::SeqCst);
        if spent.saturating_add(n) > self.authorized_bytes {
            return Err(format!(
                "egress budget exhausted: authorized {}, already served {}, request {n} — paid route REFUSED (payer authorization required; no estate fallback exists)",
                self.authorized_bytes, spent
            ));
        }
        self.spent.fetch_add(n, Ordering::SeqCst);
        Ok(())
    }
    pub fn spent(&self) -> u64 {
        self.spent.load(Ordering::SeqCst)
    }
    pub fn authorized(&self) -> u64 {
        self.authorized_bytes
    }
}

/// A sovereign peer serving sealed artifacts from its own local store.
/// Transport: a peer-local HTTP/1.1 adapter (GET only) on a direct
/// address — replaceable, estate-free.
pub struct SovereignPeer {
    store: PathBuf,
    ledger: Arc<EgressLedger>,
    /// lab fault injection: close the connection after N body bytes
    /// (named, deterministic, test-only)
    truncate_after: Option<u64>,
}

pub struct ServeHandle {
    pub addr: std::net::SocketAddr,
    pub ledger: Arc<EgressLedger>,
    join: Option<std::thread::JoinHandle<()>>,
    stop: Arc<std::sync::atomic::AtomicBool>,
}

impl ServeHandle {
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        // wake the accept loop
        if let Ok(mut s) = TcpStream::connect(self.addr) {
            let _ = s.write_all(b"GET /stop HTTP/1.1\r\nHost: x\r\n\r\n");
        }
        if let Some(j) = self.join.take() {
            let _ = j.join();
        }
    }
}

impl SovereignPeer {
    pub fn new(store: impl Into<PathBuf>, egress_budget_bytes: u64) -> Self {
        SovereignPeer {
            store: store.into(),
            ledger: Arc::new(EgressLedger::new(egress_budget_bytes)),
            truncate_after: None,
        }
    }

    pub fn with_truncate_after(mut self, n: u64) -> Self {
        self.truncate_after = Some(n);
        self
    }

    /// Serve on the given address (use 127.0.0.1:0 for a direct ephemeral
    /// address). Blocks a worker thread; the returned handle carries the
    /// bound address and the ledger.
    pub fn serve(self, bind: &str) -> Result<ServeHandle, String> {
        let listener = TcpListener::bind(bind).map_err(|e| format!("bind {bind}: {e}"))?;
        let addr = listener.local_addr().map_err(|e| e.to_string())?;
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop2 = stop.clone();
        let ledger_outer = self.ledger.clone();
        let store_outer = self.store.clone();
        let truncate_after = self.truncate_after;
        let join = std::thread::spawn(move || {
            for conn in listener.incoming() {
                if stop2.load(Ordering::SeqCst) {
                    break;
                }
                let Ok(mut stream) = conn else { continue };
                let store = store_outer.clone();
                let ledger = ledger_outer.clone();
                std::thread::spawn(move || {
                    let _ = handle_conn(&mut stream, &store, &ledger, truncate_after);
                });
            }
        });
        Ok(ServeHandle {
            addr,
            ledger: self.ledger.clone(),
            join: Some(join),
            stop,
        })
    }
}

fn handle_conn(
    stream: &mut TcpStream,
    store: &Path,
    ledger: &EgressLedger,
    truncate_after: Option<u64>,
) -> Result<(), String> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let req = String::from_utf8_lossy(&buf[..n]).to_string();
    let line1 = req.lines().next().unwrap_or("");
    let path = line1.split_whitespace().nth(1).unwrap_or("");
    if path == "/stop" {
        return Ok(());
    }
    let name = path.strip_prefix("/artifact/").unwrap_or("");
    let rel = match artifact_path_ok(name) {
        Ok(p) => p,
        Err(e) => {
            let body = e.clone();
            let _ = write_response(
                stream,
                403,
                "refused",
                body.as_bytes(),
                ledger,
                truncate_after,
                false,
            );
            return Err(e);
        }
    };
    let full = store.join(rel);
    let bytes = match std::fs::read(&full) {
        Ok(b) => b,
        Err(e) => {
            let body = format!("artifact {name} not in this peer's store: {e}");
            let _ = write_response(
                stream,
                404,
                "not found",
                body.as_bytes(),
                ledger,
                truncate_after,
                false,
            );
            return Err(body);
        }
    };
    // the payer gate — BEFORE any chargeable byte leaves
    if let Err(e) = ledger.reserve(bytes.len() as u64) {
        let _ = write_response(
            stream,
            402,
            "egress refused — payer authorization required",
            e.as_bytes(),
            ledger,
            truncate_after,
            false,
        );
        return Err(e);
    }
    write_response(stream, 200, "OK", &bytes, ledger, truncate_after, true)
}

fn write_response(
    stream: &mut TcpStream,
    code: u16,
    reason: &str,
    body: &[u8],
    _ledger: &EgressLedger,
    truncate_after: Option<u64>,
    chargeable: bool,
) -> Result<(), String> {
    let head = format!("HTTP/1.1 {code} {reason}\r\nContent-Length: {}\r\nX-Chargeable: {}\r\nConnection: close\r\n\r\n", body.len(), if chargeable { "yes" } else { "no" });
    stream
        .write_all(head.as_bytes())
        .map_err(|e| e.to_string())?;
    let send = match truncate_after {
        Some(t) if chargeable => &body[..(t as usize).min(body.len())],
        _ => body,
    };
    stream.write_all(send).map_err(|e| e.to_string())?;
    // truncate injection: lie by closing early (Content-Length promised more)
    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}

/// The retrieving side: fetch one artifact from a peer's direct address.
/// Bounded reads (Content-Length cap), no DNS, no estate endpoints.
pub fn fetch_artifact(addr: &str, name: &str, max_bytes: u64) -> Result<Vec<u8>, String> {
    artifact_path_ok(name)?;
    let mut stream = TcpStream::connect(addr).map_err(|e| format!("peer {addr}: {e}"))?;
    let req = format!("GET /artifact/{name} HTTP/1.1\r\nHost: peer\r\nConnection: close\r\n\r\n");
    stream
        .write_all(req.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    stream
        .read_to_end(&mut buf)
        .map_err(|e| format!("peer {addr} read: {e}"))?;
    let text_end = find_headers_end(&buf).ok_or("peer sent no HTTP header terminator")?;
    let head = String::from_utf8_lossy(&buf[..text_end]).to_string();
    let status = head
        .lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .nth(1)
        .unwrap_or("")
        .to_string();
    let clen: u64 = head
        .lines()
        .find_map(|l| {
            l.to_ascii_lowercase()
                .strip_prefix("content-length:")
                .map(|v| v.trim().to_string())
        })
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    if status != "200" {
        let body = String::from_utf8_lossy(&buf[text_end.min(buf.len())..])
            .trim()
            .to_string();
        return Err(format!("peer refused ({status}): {body}"));
    }
    if clen > max_bytes {
        return Err(format!(
            "oversized response: {clen} bytes declared, cap {max_bytes}"
        ));
    }
    let body = &buf[text_end.min(buf.len())..];
    if body.len() as u64 != clen {
        return Err(format!(
            "interrupted transfer: header promised {clen} bytes, {len} arrived — failing closed",
            len = body.len()
        ));
    }
    Ok(body.to_vec())
}

fn find_headers_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n").map(|i| i + 4)
}

/// Fetch the full artifact set for one person from a peer and verify the
/// #477 chain over the RECEIVED bytes before returning anything.
pub fn fetch_and_verify(
    addr: &str,
    person: &str,
    pin: Option<&str>,
    max_bytes: u64,
) -> Result<genealogy_publication::VerifiedArtifacts, String> {
    let state = fetch_artifact(addr, "publication-state.json", max_bytes)?;
    let index = fetch_artifact(addr, "publication-index.json", max_bytes)?;
    let html = fetch_artifact(addr, &format!("persons/{person}.html"), max_bytes)?;
    let json = fetch_artifact(addr, &format!("persons/{person}.json"), max_bytes)?;
    genealogy_publication::verify_seal_artifacts(&state, &index, &html, &json, person, pin)
}

/// The x0x sovereign seam — DECLARED, with the missing pieces named
/// (issue #479: "if the current x0x API cannot provide it without extra
/// work, name the missing seam; do not substitute a hosted proxy").
/// ops/x0x/README.md documents authenticated peer forwarding
/// (`x0x forward add --peer … --target-port …`, bilateral ACL/trust);
/// reaching it needs the estate box's node (loopback 127.0.0.1:12700) —
/// unreachable in both investigation attempts (SSH refused, then timed
/// out). Discovery advertisements over gossip and byte delivery over
/// authenticated peer streams remain the target shape; THIS crate's
/// peers discover by direct address in the lab, labeled as such.
pub mod x0x {
    pub const SEAM: &str = "x0x-authenticated-peer-transport";
    pub const MISSING: &str = "node access for authenticated `x0x forward` provisioning (box SSH refused 2026-10-20, then timed out); bilateral ACL + peer identity wiring; a bytes-over-peer-stream contract above gossip";
    pub const STATUS: &str = "declared — not substituted by any hosted proxy";
}
