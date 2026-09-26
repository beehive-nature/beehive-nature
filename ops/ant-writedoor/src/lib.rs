//! ant-writedoor — the estate's keyless Autonomi WRITE door (contract slice).
//!
//! Ruled 2026-09-21 (LoVis bee-laborer, event `7b0cc99b` + confirmations):
//! built fresh in the public repo, never a copy of the founder-private
//! `~/family-lineage/antd-bridge`. Three routes, nothing else:
//!
//! - `GET  /ant/v1/upload/prepare`  → `200 {"max_bytes": n}` (open probe + ceiling)
//! - `POST /ant/v1/upload/prepare`  → body = raw bytes (`application/octet-stream`);
//!   JSON carrying a `"path"` key is refused BY NAME (`path_refused`) — a server
//!   path is a file-read primitive exposed to strangers.
//! - `POST /ant/v1/upload/finalize` → `{upload_id, txs:[{quote_hash, tx_hash}]}`;
//!   per-quote pairs because ant-core's `finalize_upload` takes
//!   `HashMap<QuoteHash, TxHash>` (file.rs:2274 at ant-cli-v0.3.7 `785a155c`)
//!   and refuses any non-zero quote without its tx (batch.rs:296+).
//!
//! CORS law (ruling 2026-09-21): exactly `https://skaists.dev`, methods named
//! per route, never `*` — the live read door already answers this header
//! (re-measured through Caddy after the 06:52Z antd restore). Ceiling law:
//! 32 MiB default, over-limit refused BY NAME (`too_large`) server-side,
//! never resting on the page's honesty alone.
//!
//! KEYLESS: no key material exists anywhere in this crate. The visitor's
//! injected EIP-1193 wallet signs; this door only relays plans and completes
//! storage. The in-memory ant-core path is wave-batch only (data.rs:260 doc
//! at `785a155c`), so this door can never silently switch payment arms.
//!
//! This slice ships the HTTP contract + the [`AntGateway`] trait + a mock.
//! The ant-core wiring (feature `ant-wiring`) is its own reviewed slice; until
//! it lands, the unwired gateway refuses every prepare by name and the GET
//! probe answers non-200 — which is exactly the adapter's "door not open"
//! contract. The binary binds loopback only; Caddy fronts it on the box.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::{Request, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};

pub const DEFAULT_MAX_BYTES: usize = 32 * 1024 * 1024;
pub const DEFAULT_ALLOWED_ORIGIN: &str = "https://skaists.dev";
const PREPARE_PATH: &str = "/ant/v1/upload/prepare";
const FINALIZE_PATH: &str = "/ant/v1/upload/finalize";

// ---------------------------------------------------------------------------
// config

#[derive(Debug, Clone)]
pub struct DoorConfig {
    pub max_bytes: usize,
    pub allowed_origin: String,
}

impl Default for DoorConfig {
    fn default() -> Self {
        Self {
            max_bytes: DEFAULT_MAX_BYTES,
            allowed_origin: DEFAULT_ALLOWED_ORIGIN.to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// named errors — every refusal names its class; the page refuses by name

#[derive(Debug, thiserror::Error)]
pub enum DoorError {
    #[error("the door takes bytes, not paths")]
    PathRefused,
    #[error("file exceeds the door ceiling")]
    TooLarge { max_bytes: usize },
    #[error("upload_id unknown to this door; quotes age - re-prepare")]
    UnknownUpload,
    #[error("a quoted chunk has no tx hash")]
    MissingQuoteTx,
    #[error("a payment names a quote the door did not give")]
    UnknownQuote,
    #[error("a quote is paid twice")]
    DoublePay,
    #[error("finalized address differs from the quoted data_map_address")]
    AddressMismatch,
    #[error("request shape not accepted: {0}")]
    BadRequest(&'static str),
    #[error("the upstream Autonomi wiring is not live on this door")]
    UpstreamUnwired,
    #[error("upstream gateway failure: {0}")]
    Gateway(String),
}

impl DoorError {
    fn name(&self) -> &'static str {
        match self {
            DoorError::PathRefused => "path_refused",
            DoorError::TooLarge { .. } => "too_large",
            DoorError::UnknownUpload => "unknown_upload",
            DoorError::MissingQuoteTx => "missing_quote_tx",
            DoorError::UnknownQuote => "unknown_quote",
            DoorError::DoublePay => "double_pay",
            DoorError::AddressMismatch => "address_mismatch",
            DoorError::BadRequest(_) => "bad_request",
            DoorError::UpstreamUnwired => "upstream_unwired",
            DoorError::Gateway(_) => "gateway",
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            DoorError::PathRefused
            | DoorError::MissingQuoteTx
            | DoorError::UnknownQuote
            | DoorError::DoublePay
            | DoorError::BadRequest(_) => StatusCode::BAD_REQUEST,
            DoorError::TooLarge { .. } => StatusCode::PAYLOAD_TOO_LARGE,
            DoorError::UnknownUpload => StatusCode::NOT_FOUND,
            DoorError::AddressMismatch => StatusCode::INTERNAL_SERVER_ERROR,
            DoorError::UpstreamUnwired => StatusCode::SERVICE_UNAVAILABLE,
            DoorError::Gateway(_) => StatusCode::BAD_GATEWAY,
        }
    }
}

impl IntoResponse for DoorError {
    fn into_response(self) -> Response {
        let mut body = serde_json::json!({ "error": self.name(), "detail": self.to_string() });
        if let DoorError::TooLarge { max_bytes } = &self {
            body["max_bytes"] = serde_json::json!(max_bytes);
        }
        (self.status(), Json(body)).into_response()
    }
}

// ---------------------------------------------------------------------------
// the gateway trait — the ant-core wiring slice implements this

#[derive(Debug, Clone, Serialize)]
pub struct Quote {
    pub quote_hash: String,
    pub rewards_address: String,
    pub amount_atto: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChunksMeta {
    pub total: u64,
    pub already_stored: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreparedMeta {
    pub upload_id: String,
    pub payment_type: String,
    pub total_atto: String, // decimal STRING - atto does not fit JS float
    pub chunks: ChunksMeta,
    pub quotes: Vec<Quote>,
    pub data_map_address: String, // 0x + 64 hex
}

#[derive(Debug, Clone, Serialize)]
pub struct FinalMeta {
    pub data_map_address: String,
}

/// A proof pair: which quote was paid by which transaction.
pub type TxProof = (String, String);

#[async_trait::async_trait]
pub trait AntGateway: Send + Sync {
    /// `false` until the ant-core wiring is live: the GET probe answers
    /// non-200 and the page refuses before a byte leaves the phone.
    fn open(&self) -> bool;
    /// Phase 1 (keyless): encrypt + collect quotes. The gateway OWNS the
    /// prepared plan keyed by `upload_id`; the receipt's persistence law
    /// (plans survive door death; re-prepare of identical bytes returns the
    /// same quotes) is a wiring-slice obligation on the implementor.
    async fn prepare(&self, content: Vec<u8>) -> Result<PreparedMeta, DoorError>;
    /// Phase 3 (keyless): complete storage with the externally-signed txs.
    async fn finalize(&self, upload_id: &str, txs: &[TxProof]) -> Result<FinalMeta, DoorError>;
}

/// The unwired gateway: honest until the ant-core slice lands.
pub struct UnwiredGateway;

#[async_trait::async_trait]
impl AntGateway for UnwiredGateway {
    fn open(&self) -> bool {
        false
    }
    async fn prepare(&self, _content: Vec<u8>) -> Result<PreparedMeta, DoorError> {
        Err(DoorError::UpstreamUnwired)
    }
    async fn finalize(&self, _upload_id: &str, _txs: &[TxProof]) -> Result<FinalMeta, DoorError> {
        Err(DoorError::UpstreamUnwired)
    }
}

/// Mock gateway: contract-shaped, for tests and `--mock` demos only.
/// Addresses derive from a std hasher — SHAPE, not network truth; no
/// mainnet contact is possible from this type.
pub struct MockGateway {
    pub tamper_final_address: bool,
    plans: Mutex<HashMap<String, PreparedMeta>>,
}

impl MockGateway {
    pub fn new() -> Self {
        Self {
            tamper_final_address: false,
            plans: Mutex::new(HashMap::new()),
        }
    }

    /// A mock that returns a foreign address at finalize — exists ONLY to
    /// prove the door's own address-equality enforcement.
    pub fn tampered() -> Self {
        Self {
            tamper_final_address: true,
            ..Self::new()
        }
    }
}

impl Default for MockGateway {
    fn default() -> Self {
        Self::new()
    }
}

fn mock_hex(seed: u64, len: usize) -> String {
    // deterministic filler hex; shape-only, no crypto claim
    let mut out = String::with_capacity(len * 2);
    let mut v = seed.wrapping_mul(0x9e37_79b9_7f4a_7c15) | 1; // odd bijection: adjacent seeds never collapse
    for _ in 0..len {
        use std::hash::Hash;
        let mut h = std::collections::hash_map::DefaultHasher::new();
        v.hash(&mut h);
        v = std::hash::Hasher::finish(&h) | 1;
        out.push_str(&format!("{:02x}", (v & 0xff) as u8));
        v = v.rotate_left(7).wrapping_add(0x9e37_79b9_7f4a_7c15);
    }
    out
}

#[async_trait::async_trait]
impl AntGateway for MockGateway {
    fn open(&self) -> bool {
        true
    }
    async fn prepare(&self, content: Vec<u8>) -> Result<PreparedMeta, DoorError> {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        content.hash(&mut h);
        let seed = h.finish();
        let quotes: Vec<Quote> = (0..3u64)
            .map(|i| Quote {
                quote_hash: format!("0x{}", mock_hex(seed.wrapping_add(i), 32)),
                rewards_address: format!("0x{}", mock_hex(seed.wrapping_mul(i + 7), 20)),
                amount_atto: format!("{}", 1_000_000_000_000_000_000u64 + i),
            })
            .collect();
        // The page sums quotes and refuses a plan whose parts don't add up:
        // total_atto MUST equal the sum of amount_atto (ruling bOPus5 06:41Z).
        let total: u128 = quotes
            .iter()
            .filter_map(|q| q.amount_atto.parse::<u128>().ok())
            .sum();
        let meta = PreparedMeta {
            upload_id: format!("up-mock-{:016x}", seed),
            payment_type: "wave_batch".to_string(),
            total_atto: total.to_string(),
            chunks: ChunksMeta {
                total: 3,
                already_stored: 0,
            },
            quotes,
            data_map_address: format!("0x{}", mock_hex(seed ^ 0x5eed_1234, 32)),
        };
        self.plans
            .lock()
            .unwrap()
            .insert(meta.upload_id.clone(), meta.clone());
        Ok(meta)
    }
    async fn finalize(&self, upload_id: &str, txs: &[TxProof]) -> Result<FinalMeta, DoorError> {
        let guard = self.plans.lock().unwrap();
        let meta = guard.get(upload_id).ok_or(DoorError::UnknownUpload)?;
        for q in &meta.quotes {
            let paid = txs.iter().any(|(qh, _)| qh == &q.quote_hash);
            if !paid {
                return Err(DoorError::MissingQuoteTx);
            }
        }
        let addr = if self.tamper_final_address {
            format!("0x{}", mock_hex(0xdead_beef, 32))
        } else {
            meta.data_map_address.clone()
        };
        Ok(FinalMeta {
            data_map_address: addr,
        })
    }
}

// ---------------------------------------------------------------------------
// the door

/// What the door's own ledger remembers per prepare: the quoted address it
/// must see again at finalize, and the quote set payments may name.
#[derive(Debug, Clone)]
struct PlanRecord {
    data_map_address: String,
    quote_hashes: Vec<String>,
}

pub struct Door {
    pub cfg: DoorConfig,
    pub gateway: Arc<dyn AntGateway>,
    /// The door's OWN ledger, independent of the gateway: no gateway bug can
    /// hand back a foreign address or accept a payment for an unknown quote.
    ledger: Mutex<HashMap<String, PlanRecord>>,
}

impl Door {
    pub fn new(cfg: DoorConfig, gateway: Arc<dyn AntGateway>) -> Arc<Self> {
        Arc::new(Self {
            cfg,
            gateway,
            ledger: Mutex::new(HashMap::new()),
        })
    }

    pub fn router(self: &Arc<Self>) -> Router {
        Router::new()
            .route(
                PREPARE_PATH,
                get(get_ceiling).post(post_prepare).options(preflight_post),
            )
            .route(FINALIZE_PATH, post(post_finalize).options(preflight_post))
            .with_state(self.clone())
    }

    fn origin_allowed(&self, headers: &HeaderMap) -> bool {
        headers
            .get(header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            .map(|o| o == self.cfg.allowed_origin)
            .unwrap_or(false)
    }

    fn cors(response: &mut Response, headers: &HeaderMap, door: &Door, method: &'static str) {
        // CORS law: exact configured origin, echoed only when it matches;
        // methods named per route, never `*`.
        if door.origin_allowed(headers) {
            if let Some(o) = headers.get(header::ORIGIN) {
                let h = response.headers_mut();
                h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, o.clone());
                h.insert(
                    header::ACCESS_CONTROL_ALLOW_METHODS,
                    HeaderValue::from_static(method),
                );
                h.append(header::VARY, HeaderValue::from_static("Origin"));
            }
        }
    }
}

type DoorState = State<Arc<Door>>;

fn named_json(status: StatusCode, error: &str, detail: &str) -> Response {
    (
        status,
        Json(serde_json::json!({ "error": error, "detail": detail })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// handlers

async fn get_ceiling(State(door): DoorState, headers: HeaderMap) -> Response {
    let mut resp = if door.gateway.open() {
        (
            StatusCode::OK,
            Json(serde_json::json!({ "max_bytes": door.cfg.max_bytes })),
        )
            .into_response()
    } else {
        // The adapter's closed-door contract: ANY non-200 here means "the
        // estate's write door for this rail is not open" - refuse, never quote.
        DoorError::UpstreamUnwired.into_response()
    };
    Door::cors(&mut resp, &headers, &door, "GET");
    resp
}

async fn preflight_inner(door: Arc<Door>, headers: HeaderMap, method: &'static str) -> Response {
    if !door.origin_allowed(&headers) {
        return named_json(
            StatusCode::FORBIDDEN,
            "origin_refused",
            "preflight origin is not the door's allowed origin",
        );
    }
    let wants = headers
        .get("access-control-request-method")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if wants != method {
        return named_json(
            StatusCode::FORBIDDEN,
            "method_refused",
            "preflight method does not match this route",
        );
    }
    let mut resp = (StatusCode::NO_CONTENT, "").into_response();
    if let Some(o) = headers.get(header::ORIGIN) {
        let h = resp.headers_mut();
        h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, o.clone());
        h.insert(
            header::ACCESS_CONTROL_ALLOW_METHODS,
            HeaderValue::from_static(method),
        );
        h.insert(
            header::ACCESS_CONTROL_ALLOW_HEADERS,
            HeaderValue::from_static("Content-Type"),
        );
        h.append(header::VARY, HeaderValue::from_static("Origin"));
    }
    resp
}

async fn preflight_post(State(door): DoorState, headers: HeaderMap) -> Response {
    preflight_inner(door, headers, "POST").await
}

fn is_hex64(s: &str) -> bool {
    let b = s.strip_prefix("0x").unwrap_or(s);
    b.len() == 64 && b.bytes().all(|c| c.is_ascii_hexdigit())
}

async fn post_prepare(State(door): DoorState, headers: HeaderMap, req: Request) -> Response {
    let respond = |mut resp: Response| {
        Door::cors(&mut resp, &headers, &door, "POST");
        resp
    };

    let ctype = req
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();

    // Fast refusal on declared length, before reading the body.
    if let Some(len) = req
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<usize>().ok())
    {
        if len > door.cfg.max_bytes {
            return respond(
                DoorError::TooLarge {
                    max_bytes: door.cfg.max_bytes,
                }
                .into_response(),
            );
        }
    }

    if !ctype.starts_with("application/octet-stream") {
        // The named attack class: a JSON body carrying a "path" key — the
        // old bridge's server-local-file primitive, refused by name here.
        if ctype.starts_with("application/json") {
            if let Ok(bytes) = axum::body::to_bytes(req.into_body(), 1 << 20).await {
                if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    if v.get("path").is_some() {
                        return respond(DoorError::PathRefused.into_response());
                    }
                }
            }
        }
        return respond(
            DoorError::BadRequest("content-type must be application/octet-stream").into_response(),
        );
    }

    // Streamed count against the ceiling (trusts no declared length alone).
    let body = match axum::body::to_bytes(req.into_body(), door.cfg.max_bytes + 1).await {
        Ok(b) => b,
        Err(_) => {
            return respond(
                DoorError::TooLarge {
                    max_bytes: door.cfg.max_bytes,
                }
                .into_response(),
            )
        }
    };
    if body.len() > door.cfg.max_bytes {
        return respond(
            DoorError::TooLarge {
                max_bytes: door.cfg.max_bytes,
            }
            .into_response(),
        );
    }

    match door.gateway.prepare(body.to_vec()).await {
        Ok(meta) => {
            door.ledger.lock().unwrap().insert(
                meta.upload_id.clone(),
                PlanRecord {
                    data_map_address: meta.data_map_address.clone(),
                    quote_hashes: meta.quotes.iter().map(|q| q.quote_hash.clone()).collect(),
                },
            );
            respond((StatusCode::OK, Json(&meta)).into_response())
        }
        Err(e) => respond(e.into_response()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FinalizeRequest {
    upload_id: String,
    txs: Vec<TxEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TxEntry {
    quote_hash: String,
    tx_hash: String,
}

async fn post_finalize(State(door): DoorState, headers: HeaderMap, req: Request) -> Response {
    let respond = |mut resp: Response| {
        Door::cors(&mut resp, &headers, &door, "POST");
        resp
    };

    let bytes = match axum::body::to_bytes(req.into_body(), 1 << 20).await {
        Ok(b) => b,
        Err(_) => return respond(DoorError::BadRequest("unreadable body").into_response()),
    };
    let parsed: FinalizeRequest = match serde_json::from_slice(&bytes) {
        Ok(p) => p,
        Err(_) => {
            return respond(
                DoorError::BadRequest("finalize wants {upload_id, txs:[{quote_hash, tx_hash}]}")
                    .into_response(),
            )
        }
    };
    for t in &parsed.txs {
        if !is_hex64(&t.quote_hash) || !is_hex64(&t.tx_hash) {
            return respond(
                DoorError::BadRequest("quote_hash and tx_hash must be 0x + 64 hex").into_response(),
            );
        }
    }
    let record = door.ledger.lock().unwrap().get(&parsed.upload_id).cloned();
    let record = match record {
        Some(r) => r,
        None => return respond(DoorError::UnknownUpload.into_response()),
    };

    // The three payment-shape laws the page checks (bOPus5 06:41Z), held
    // door-side too: every quote paid exactly once, no foreign quotes.
    let mut seen: HashMap<&str, ()> = HashMap::with_capacity(parsed.txs.len());
    for t in &parsed.txs {
        if seen.insert(t.quote_hash.as_str(), ()).is_some() {
            return respond(DoorError::DoublePay.into_response());
        }
        if !record.quote_hashes.iter().any(|q| q == &t.quote_hash) {
            return respond(DoorError::UnknownQuote.into_response());
        }
    }
    for q in &record.quote_hashes {
        if !parsed.txs.iter().any(|t| &t.quote_hash == q) {
            return respond(DoorError::MissingQuoteTx.into_response());
        }
    }

    let txs: Vec<TxProof> = parsed
        .txs
        .into_iter()
        .map(|t| (t.quote_hash, t.tx_hash))
        .collect();
    match door.gateway.finalize(&parsed.upload_id, &txs).await {
        Ok(fin) if fin.data_map_address == record.data_map_address => {
            respond((StatusCode::OK, Json(&fin)).into_response())
        }
        Ok(_) => respond(DoorError::AddressMismatch.into_response()),
        Err(e) => respond(e.into_response()),
    }
}
