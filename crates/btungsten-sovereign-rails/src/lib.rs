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

/// The payer/egress ledger (issue #479: accountable resources; issue #480
/// P0: a CONCURRENCY-SAFE hard ceiling). A peer serves chargeable bytes
/// only from an EXPLICIT, bounded authorization; when it is gone the paid
/// route refuses — no estate default payer, no silent subsidy, no partial
/// drip. HONEST SCOPE (issue #480 wording): this is a byte-allowance
/// ledger — not yet evidence of user-signed funding, settlement, or
/// actual network tariff enforcement.
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
    /// Reserve `n` bytes of chargeable delivery. The check-and-increment is
    /// ONE atomic step (issue #480 P0: the old load→check→fetch_add let two
    /// concurrent requests both pass and collectively overspend). Overflow-
    /// safe via saturating arithmetic inside the CAS predicate. Refusal is
    /// a named verdict, never a silent fallback.
    pub fn reserve(&self, n: u64) -> Result<(), String> {
        let outcome = self
            .spent
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |spent| {
                if spent.saturating_add(n) > self.authorized_bytes {
                    None
                } else {
                    Some(spent + n)
                }
            });
        match outcome {
            Ok(_) => Ok(()),
            Err(current) => Err(format!(
                "egress budget exhausted: authorized {}, already served {}, request {n} — paid route REFUSED (payer authorization required; no estate fallback exists)",
                self.authorized_bytes, current
            )),
        }
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
    // issue #480 P1: a served artifact is a REGULAR FILE inside the store —
    // symlink_metadata does not follow, so a planted symlink (or anything
    // non-regular) refuses BEFORE a byte is read. Client-side digest
    // verification is not a server-side confidentiality guard.
    let meta = match std::fs::symlink_metadata(&full) {
        Ok(m) => m,
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
    if meta.file_type().is_symlink() {
        let body = format!(
            "artifact {name}: symlink refused — a served artifact is a regular file inside the store, never a link out of it"
        );
        let _ = write_response(
            stream,
            403,
            "symlink refused",
            body.as_bytes(),
            ledger,
            truncate_after,
            false,
        );
        return Err(body);
    }
    if !meta.file_type().is_file() {
        let body = format!("artifact {name}: not a regular file — refused");
        let _ = write_response(
            stream,
            403,
            "not a regular file",
            body.as_bytes(),
            ledger,
            truncate_after,
            false,
        );
        return Err(body);
    }
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
/// Issue #480 P0: memory is bounded BEFORE the payload is trusted — the
/// header is read incrementally under a byte cap, Content-Length is
/// REQUIRED (a missing, duplicate or malformed length refuses; a body
/// without one would be unbounded), the declared size is checked against
/// `max_bytes` BEFORE any body byte is read, the body is then read
/// incrementally to exactly the declared length (a peer that lies small
/// and streams 100× the cap simply stops being read), and every read
/// carries a deadline. No DNS, no estate endpoints.
pub fn fetch_artifact(addr: &str, name: &str, max_bytes: u64) -> Result<Vec<u8>, String> {
    fetch_artifact_deadlined(addr, name, max_bytes, std::time::Duration::from_secs(10))
}

/// `fetch_artifact` with an explicit read deadline (the trickle-stall
/// control drives this with a short one).
pub fn fetch_artifact_deadlined(
    addr: &str,
    name: &str,
    max_bytes: u64,
    read_timeout: std::time::Duration,
) -> Result<Vec<u8>, String> {
    const MAX_HEADER_BYTES: usize = 8 * 1024;
    const MAX_ERROR_BODY: usize = 4 * 1024;
    artifact_path_ok(name)?;
    let mut stream = TcpStream::connect(addr).map_err(|e| format!("peer {addr}: {e}"))?;
    stream
        .set_read_timeout(Some(read_timeout))
        .map_err(|e| format!("peer {addr}: {e}"))?;
    let req = format!("GET /artifact/{name} HTTP/1.1\r\nHost: peer\r\nConnection: close\r\n\r\n");
    stream
        .write_all(req.as_bytes())
        .map_err(|e| e.to_string())?;

    // bounded incremental header read: a header that never ends (or floods)
    // refuses at the cap, never at the peer's leisure
    let mut raw: Vec<u8> = Vec::with_capacity(1024);
    let mut chunk = [0u8; 2048];
    let mut head_end: Option<usize> = None;
    while raw.len() < MAX_HEADER_BYTES {
        let n = stream
            .read(&mut chunk)
            .map_err(|e| format!("peer {addr} header read stalled or failed: {e}"))?;
        if n == 0 {
            break;
        }
        raw.extend_from_slice(&chunk[..n]);
        if let Some(i) = find_headers_end(&raw) {
            head_end = Some(i);
            break;
        }
    }
    let text_end = head_end.ok_or(
        "peer sent no HTTP header terminator (or flooded the header — refused at the cap)",
    )?;
    let head = String::from_utf8_lossy(&raw[..text_end]).to_string();
    let status = head
        .lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .nth(1)
        .unwrap_or("")
        .to_string();
    // Content-Length: exactly one, well-formed — required
    let mut clen_opt: Option<u64> = None;
    let mut duplicate = false;
    for l in head.lines() {
        if let Some(v) = l.to_ascii_lowercase().strip_prefix("content-length:") {
            if clen_opt.is_some() {
                duplicate = true;
            }
            match v.trim().parse::<u64>() {
                Ok(n) => clen_opt = Some(n),
                Err(_) => {
                    return Err(format!(
                        "malformed content-length ({:?}) — refusing unbounded body",
                        v.trim()
                    ))
                }
            }
        }
    }
    if duplicate {
        return Err("duplicate content-length headers — refusing (ambiguous length)".to_string());
    }
    let clen = clen_opt.ok_or("no content-length on the response — refusing unbounded body")?;
    if status != "200" {
        // bounded error-body read, best effort
        let mut body = raw[text_end.min(raw.len())..].to_vec();
        while body.len() < MAX_ERROR_BODY {
            let n = match stream.read(&mut chunk) {
                Ok(n) => n,
                Err(_) => break,
            };
            if n == 0 {
                break;
            }
            body.extend_from_slice(&chunk[..n]);
        }
        let body = String::from_utf8_lossy(&body).trim().to_string();
        return Err(format!("peer refused ({status}): {body}"));
    }
    if clen > max_bytes {
        return Err(format!(
            "oversized response: {clen} bytes declared, cap {max_bytes} — refused before any body byte was read"
        ));
    }
    // read EXACTLY clen body bytes, incrementally; capacity is bounded by
    // the already-checked clen, so a lying peer cannot grow the allocation
    let mut body: Vec<u8> = raw[text_end.min(raw.len())..].to_vec();
    body.reserve_exact(clen.saturating_sub(body.len() as u64) as usize);
    while (body.len() as u64) < clen {
        let n = stream
            .read(&mut chunk)
            .map_err(|e| format!("peer {addr} body read stalled or failed: {e}"))?;
        if n == 0 {
            return Err(format!(
                "interrupted transfer: header promised {clen} bytes, {len} arrived — failing closed",
                len = body.len()
            ));
        }
        body.extend_from_slice(&chunk[..n]);
    }
    // a peer that DELIVERS more than it declared is lying: an honest peer
    // sends exactly clen and closes. One buffered read may overshoot by TCP
    // granularity — that overshoot IS the lie, visible here as body > clen.
    // Refuse (issue #480: reject overlong responses); memory stayed bounded
    // regardless, and nothing of the attacker tail is retained.
    if (body.len() as u64) > clen {
        return Err(format!(
            "overlong response: declared {clen} bytes, the peer delivered {len} — a lying peer, refusing",
            len = body.len()
        ));
    }
    Ok(body)
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
    pub const MISSING: &str = "multi-host repetition (estate box SSH timed out 3x 2026-10-20; no second administered host) and the x0x v0.48.1 restart-path seam: after peer restarts, send-file offers are refused (peer did not accept the file control frame, HTTP 500 — reproduced; see docs/rails/x0x-transport-evidence-2026-10-20.md)";
    pub const STATUS: &str = "investigated — REAL transport observed live 2026-10-20: two real v0.48.1 daemons, distinct ML-DSA identities, announce/discovery over the real mesh, attributable byte-exact file delivery (sha-identical sealed artifact); pending transfers are volatile across receiver restart; still not qualified for corpus delivery";
}
