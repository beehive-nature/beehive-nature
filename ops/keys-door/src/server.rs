//! Serving (contract §4 "Serving"): only the paths the verified record names
//! (`/` is index.html), GET and HEAD only, 404 for anything else, 503 for
//! everything but /.well-known while nothing is verified. Health is a
//! separate router for its own listener.

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

/// A verified release, ready to serve.
pub struct Serving {
    pub seq: u64,
    pub record_sha3: [u8; 32],
    pub pack_sha3: [u8; 32],
    pub envelope: Bytes,
    pub envelope_etag: String,
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

impl Serving {
    /// The release `link` names, over a pack already checked against it.
    pub fn new(link: &Link, pack: Vec<u8>, pack_sha3: [u8; 32]) -> Serving {
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
            envelope_etag: b64u(&Sha256::digest(&link.env.bytes)),
            envelope: Bytes::from(link.env.bytes.clone()),
            pack: Bytes::from(pack),
            pack_etag: r.pack.sha256.clone(),
            files,
        }
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
        return match rest {
            "bnr-keychain/release" => bytes(
                s.envelope.clone(),
                "application/json",
                &s.envelope_etag,
                head,
            ),
            "bnr-keychain/pack" => bytes(
                s.pack.clone(),
                "application/octet-stream",
                &s.pack_etag,
                head,
            ),
            _ => plain(StatusCode::NOT_FOUND, "not found\n"),
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
