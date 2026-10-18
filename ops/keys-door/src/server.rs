//! Serving (contract §4 "Serving"): only the paths the verified record names
//! (`/` is index.html), GET and HEAD only, 404 for anything else, 503 for
//! everything but /.well-known while nothing is verified. Under
//! /.well-known/bnr-keychain: `release` (the current envelope),
//! `release/<n>` (the verified envelope of every seq 1..current, contract
//! §7 A1) and `pack`. Health is a separate router for its own listener.

use std::collections::BTreeMap;
use std::sync::{Arc, RwLock};

use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{header, HeaderValue, Method, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Router;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::b64::b64u;
use crate::chain::{Equivocation, Link};

pub struct FileServe {
    pub offset: usize,
    pub len: usize,
    pub content_type: &'static str,
    /// base64url SHA-256 of the file, from the record
    pub etag: String,
}

/// One verified envelope as served, with its ETag (base64url SHA-256 of
/// the envelope bytes).
pub struct ServedEnvelope {
    pub bytes: Bytes,
    pub etag: String,
}

/// A verified release, ready to serve.
pub struct Serving {
    pub seq: u64,
    pub record_sha3: [u8; 32],
    pub pack_sha3: [u8; 32],
    /// the served record's link (the base the next peer walk extends)
    pub tip: Link,
    /// every verified envelope from genesis to this one: `chain[n - 1]`
    /// is seq n (contract §7 A1, `/.well-known/bnr-keychain/release/<n>`)
    pub chain: Vec<ServedEnvelope>,
    pub pack: Bytes,
    pub pack_etag: String,
    pub files: BTreeMap<String, FileServe>,
}

/// The fixed extension allowlist; anything else is served as opaque bytes.
pub fn content_type(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, e)| e) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("json") => "application/json",
        Some("css") => "text/css; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// A seq as `/.well-known/bnr-keychain/release/<seq>` spells it: plain
/// decimal, no sign, no leading zero, at least 1.
pub fn seq_segment(s: &str) -> Option<u64> {
    let b = s.as_bytes();
    if b.is_empty() || b.len() > 16 || !b.iter().all(u8::is_ascii_digit) || b[0] == b'0' {
        return None;
    }
    s.parse().ok()
}

impl Serving {
    /// The release at the end of `chain` (genesis first, every link
    /// verified), over a pack already checked against it.
    pub fn new(chain: &[Link], pack: Vec<u8>, pack_sha3: [u8; 32]) -> Serving {
        let link = chain.last().expect("a non-empty chain");
        debug_assert!(chain
            .iter()
            .enumerate()
            .all(|(i, l)| l.seq() == i as u64 + 1));
        let r = &link.env.record;
        let mut files = BTreeMap::new();
        let mut offset = 0usize;
        for f in &r.files {
            files.insert(
                f.path.clone(),
                FileServe {
                    offset,
                    len: f.size as usize,
                    content_type: content_type(&f.path),
                    etag: f.sha256.clone(),
                },
            );
            offset += f.size as usize;
        }
        Serving {
            seq: r.seq,
            record_sha3: link.sha3(),
            pack_sha3,
            tip: link.clone(),
            chain: chain
                .iter()
                .map(|l| ServedEnvelope {
                    etag: b64u(&Sha256::digest(&l.env.bytes)),
                    bytes: Bytes::from(l.env.bytes.clone()),
                })
                .collect(),
            pack: Bytes::from(pack),
            pack_etag: r.pack.sha256.clone(),
            files,
        }
    }

    /// The verified envelope of seq `n`, when this edge holds it (1..=seq).
    pub fn envelope(&self, n: u64) -> Option<&ServedEnvelope> {
        n.checked_sub(1)
            .and_then(|i| usize::try_from(i).ok())
            .and_then(|i| self.chain.get(i))
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Health {
    pub seq: Option<u64>,
    pub record_sha3: Option<String>,
    /// "serving" or "unverified" (nothing verified: 503)
    pub state: &'static str,
    pub equivocation: Option<Equivocation>,
    pub last_error: Option<String>,
}

impl Default for Health {
    fn default() -> Self {
        Health {
            seq: None,
            record_sha3: None,
            state: "unverified",
            equivocation: None,
            last_error: None,
        }
    }
}

#[derive(Default)]
pub struct Shared {
    pub serving: Option<Arc<Serving>>,
    pub health: Health,
}

pub type SharedRef = Arc<RwLock<Shared>>;

fn plain(status: StatusCode, text: &'static str) -> Response {
    let mut r = (status, text).into_response();
    let h = r.headers_mut();
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    r
}

fn bytes(body: Bytes, content_type: &'static str, etag: &str, head: bool) -> Response {
    let len = body.len();
    let mut r = Response::new(if head {
        Body::empty()
    } else {
        Body::from(body)
    });
    let h = r.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    h.insert(header::CONTENT_LENGTH, HeaderValue::from(len));
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    if let Ok(v) = HeaderValue::from_str(&format!("\"{etag}\"")) {
        h.insert(header::ETAG, v);
    }
    r
}

async fn serve(State(shared): State<SharedRef>, method: Method, uri: Uri) -> Response {
    let head = method == Method::HEAD;
    if method != Method::GET && !head {
        let mut r = plain(StatusCode::METHOD_NOT_ALLOWED, "method not allowed\n");
        r.headers_mut()
            .insert(header::ALLOW, HeaderValue::from_static("GET, HEAD"));
        return r;
    }
    let serving = match shared.read() {
        Ok(s) => s.serving.clone(),
        Err(_) => return plain(StatusCode::SERVICE_UNAVAILABLE, "no verified release\n"),
    };
    let path = uri.path();
    if let Some(rest) = path.strip_prefix("/.well-known/") {
        let Some(s) = serving else {
            return plain(StatusCode::NOT_FOUND, "no verified release\n");
        };
        let envelope = match rest {
            "bnr-keychain/pack" => {
                return bytes(
                    s.pack.clone(),
                    "application/octet-stream",
                    &s.pack_etag,
                    head,
                )
            }
            "bnr-keychain/release" => s.envelope(s.seq),
            _ => rest
                .strip_prefix("bnr-keychain/release/")
                .and_then(seq_segment)
                .and_then(|n| s.envelope(n)),
        };
        return match envelope {
            Some(e) => bytes(e.bytes.clone(), "application/json", &e.etag, head),
            None => plain(StatusCode::NOT_FOUND, "not found\n"),
        };
    }
    let Some(s) = serving else {
        return plain(StatusCode::SERVICE_UNAVAILABLE, "no verified release\n");
    };
    let key = match path {
        "/" => "index.html",
        p => p.strip_prefix('/').unwrap_or(p),
    };
    match s.files.get(key) {
        Some(f) => bytes(
            s.pack.slice(f.offset..f.offset + f.len),
            f.content_type,
            &f.etag,
            head,
        ),
        None => plain(StatusCode::NOT_FOUND, "not found\n"),
    }
}

/// The public router: one fallback, so no method or path escapes the rules.
pub fn router(shared: SharedRef) -> Router {
    Router::new().fallback(serve).with_state(shared)
}

async fn health(State(shared): State<SharedRef>, method: Method, uri: Uri) -> Response {
    if method != Method::GET {
        return plain(StatusCode::METHOD_NOT_ALLOWED, "method not allowed\n");
    }
    if uri.path() != "/" && uri.path() != "/health" {
        return plain(StatusCode::NOT_FOUND, "not found\n");
    }
    let h = match shared.read() {
        Ok(s) => s.health.clone(),
        Err(_) => return plain(StatusCode::SERVICE_UNAVAILABLE, "health unavailable\n"),
    };
    let status = if h.state == "serving" {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    let mut r = (status, axum::Json(h)).into_response();
    r.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    r
}

/// The health router, for health_listen only.
pub fn health_router(shared: SharedRef) -> Router {
    Router::new().fallback(health).with_state(shared)
}
