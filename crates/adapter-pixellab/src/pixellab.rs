//! PixelLab API client: endpoint request builders, response parsing, and the
//! transport abstraction that keeps tests offline. Shapes verified against
//! `https://api.pixellab.ai/v1/openapi.json` (fetched 2026-08-16; a GET, zero
//! generations).
//!
//! Four schema answers this file encodes:
//! 1. style/reference image: EXISTS — `style_image` on bitforge ("Reference
//!    image for style transfer"), `init_image` on pixflux, `reference_image`
//!    on the animate endpoints.
//! 2. transparency: EXISTS — `no_background: boolean` on pixforge/bitforge/inpaint.
//! 3. palette control: EXISTS — `color_image` (a forced-palette reference
//!    image; there is no colour-count integer).
//! 4. cost per call: NOT DECLARED anywhere in the OpenAPI. `/balance` returns
//!    `CreditsResponse { type:"usd", usd: number }` — a USD float. Cost can
//!    only be *measured* as a before/after delta, so the budget cap is
//!    denominated in USD.

use serde_json::{json, Value};

/// Enum values transcribed from the OpenAPI component schemas. Validated on
/// input and mirrored into the tool schemas so the two cannot drift.
pub const OUTLINE_VALUES: &[&str] = &[
    "single color black outline",
    "single color outline",
    "selective outline",
    "lineless",
];
pub const DETAIL_VALUES: &[&str] = &["low detail", "medium detail", "highly detailed"];
pub const SHADING_VALUES: &[&str] = &[
    "flat shading",
    "basic shading",
    "medium shading",
    "detailed shading",
    "highly detailed shading",
];

/// Bitforge's ImageSize ceiling is 16..=200 per side. Pixflux would allow up
/// to 400, but the intersection is what the adapter accepts — one rule, no
/// endpoint-dependent traps.
pub const SIZE_MIN: u32 = 16;
pub const SIZE_MAX: u32 = 200;

#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub method: &'static str,
    pub path: String,
    pub body: Option<Value>,
}

#[derive(Debug)]
pub enum ApiError {
    Transport(String),
    Api { status: u16, body: String },
    Parse(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Transport(e) => write!(f, "transport: {e}"),
            ApiError::Api { status, body } => write!(f, "api {status}: {body}"),
            ApiError::Parse(e) => write!(f, "parse: {e}"),
        }
    }
}

pub trait Transport: Send + Sync + 'static {
    fn request(
        &self,
        req: HttpRequest,
    ) -> impl std::future::Future<Output = Result<Value, ApiError>> + Send;
}

/// Real HTTP transport. The key lives in memory and the Authorization header
/// only — never a log line, never a prompt.
pub struct HttpTransport {
    client: reqwest::Client,
    base: String,
    key: String,
}

impl HttpTransport {
    pub fn new(base_url: &str, key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base: base_url.trim_end_matches('/').to_string(),
            key,
        }
    }
}

impl Transport for HttpTransport {
    async fn request(&self, req: HttpRequest) -> Result<Value, ApiError> {
        let url = format!("{}{}", self.base, req.path);
        let method = match req.method {
            "GET" => reqwest::Method::GET,
            _ => reqwest::Method::POST,
        };
        let mut r = self.client.request(method, &url).bearer_auth(&self.key);
        if let Some(body) = req.body {
            r = r.json(&body);
        }
        let resp = r
            .send()
            .await
            .map_err(|e| ApiError::Transport(e.to_string()))?;
        let status = resp.status().as_u16();
        let text = resp
            .text()
            .await
            .map_err(|e| ApiError::Transport(e.to_string()))?;
        let val: Value = serde_json::from_str(&text).unwrap_or(json!({ "raw": text }));
        if status >= 400 {
            return Err(ApiError::Api {
                status,
                body: val.to_string(),
            });
        }
        Ok(val)
    }
}

/// Mock transport for tests: scripted responses in order, every request
/// recorded. Zero generations spent building or testing this crate.
#[derive(Default)]
pub struct MockTransport {
    queue: std::sync::Mutex<std::collections::VecDeque<Value>>,
    calls: std::sync::Mutex<Vec<HttpRequest>>,
}

impl MockTransport {
    pub fn new(responses: Vec<Value>) -> Self {
        Self {
            queue: std::sync::Mutex::new(responses.into_iter().collect()),
            calls: std::sync::Mutex::new(Vec::new()),
        }
    }

    /// (path, body) for every request the mock served, in order.
    pub fn calls_snapshot(&self) -> Vec<(String, Option<Value>)> {
        self.calls
            .lock()
            .unwrap()
            .iter()
            .map(|c| (c.path.clone(), c.body.clone()))
            .collect()
    }
}

impl Transport for MockTransport {
    async fn request(&self, req: HttpRequest) -> Result<Value, ApiError> {
        self.calls.lock().unwrap().push(req);
        match self.queue.lock().unwrap().pop_front() {
            Some(v) => Ok(v),
            None => Err(ApiError::Transport("mock queue empty".into())),
        }
    }
}

/// The generate request as the tool surface exposes it. Field names match the
/// API's own vocabulary; the adapter adds nothing of its own.
#[derive(Clone)]
pub struct GenerateRequest {
    pub description: String,
    pub negative_description: Option<String>,
    pub width: u32,
    pub height: u32,
    pub no_background: bool,
    pub seed: Option<i64>,
    pub outline: Option<String>,
    pub detail: Option<String>,
    pub shading: Option<String>,
    pub style_image_b64: Option<String>,
    pub style_strength: Option<i32>,
    pub init_image_b64: Option<String>,
    pub color_image_b64: Option<String>,
}

pub struct GenerateResult {
    pub image_b64: String,
    /// Passed through untouched; the schema declares it required but its
    /// inner fields are not enumerated in what we read — report, don't guess.
    pub usage: Value,
    pub endpoint: &'static str,
}

fn base64_image(b64: &str) -> Value {
    json!({ "type": "base64", "base64": b64 })
}

fn build_body(r: &GenerateRequest, bitforge: bool) -> Value {
    let mut v = json!({
        "description": r.description,
        "image_size": { "width": r.width, "height": r.height },
        "no_background": r.no_background,
    });
    if let Some(n) = &r.negative_description {
        v["negative_description"] = json!(n);
    }
    if let Some(s) = r.seed {
        v["seed"] = json!(s);
    }
    if let Some(o) = &r.outline {
        v["outline"] = json!(o);
    }
    if let Some(d) = &r.detail {
        v["detail"] = json!(d);
    }
    if let Some(s) = &r.shading {
        v["shading"] = json!(s);
    }
    if let Some(i) = &r.init_image_b64 {
        v["init_image"] = base64_image(i);
    }
    if let Some(c) = &r.color_image_b64 {
        v["color_image"] = base64_image(c);
    }
    if bitforge {
        if let Some(s) = &r.style_image_b64 {
            v["style_image"] = base64_image(s);
        }
        if let Some(x) = r.style_strength {
            v["style_strength"] = json!(x);
        }
    }
    v
}

fn parse_generate(v: Value, endpoint: &'static str) -> Result<GenerateResult, ApiError> {
    let image = v
        .get("image")
        .ok_or_else(|| ApiError::Parse("response missing image".into()))?;
    let b64 = image
        .get("base64")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::Parse("response image missing base64".into()))?;
    let usage = v.get("usage").cloned().unwrap_or(Value::Null);
    Ok(GenerateResult {
        image_b64: b64.to_string(),
        usage,
        endpoint,
    })
}

pub async fn generate_bitforge<T: Transport>(
    t: &T,
    r: &GenerateRequest,
) -> Result<GenerateResult, ApiError> {
    let v = t
        .request(HttpRequest {
            method: "POST",
            path: "/generate-image-bitforge".into(),
            body: Some(build_body(r, true)),
        })
        .await?;
    parse_generate(v, "bitforge")
}

pub async fn generate_pixflux<T: Transport>(
    t: &T,
    r: &GenerateRequest,
) -> Result<GenerateResult, ApiError> {
    let v = t
        .request(HttpRequest {
            method: "POST",
            path: "/generate-image-pixflux".into(),
            body: Some(build_body(r, false)),
        })
        .await?;
    parse_generate(v, "pixflux")
}

pub async fn get_balance<T: Transport>(t: &T) -> Result<f64, ApiError> {
    let v = t
        .request(HttpRequest {
            method: "GET",
            path: "/balance".into(),
            body: None,
        })
        .await?;
    v.get("usd")
        .and_then(Value::as_f64)
        .ok_or_else(|| ApiError::Parse("balance response missing usd".into()))
}

pub fn validate_size(w: u32, h: u32) -> Result<(), String> {
    if !(SIZE_MIN..=SIZE_MAX).contains(&w) || !(SIZE_MIN..=SIZE_MAX).contains(&h) {
        Err(format!(
            "width/height must each be {SIZE_MIN}..={SIZE_MAX} (bitforge ceiling); got {w}x{h}"
        ))
    } else {
        Ok(())
    }
}

pub fn validate_enum(name: &str, v: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.contains(&v) {
        Ok(())
    } else {
        Err(format!(
            "invalid {name} {v:?}; allowed: {}",
            allowed.join(", ")
        ))
    }
}
