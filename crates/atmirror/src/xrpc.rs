//! The PDS boundary — `com.atproto.sync.*`, all public, all
//! unauthenticated. Behind a trait so tests inject fixtures and never
//! touch the network (house law), and so the mirror logic stays honest
//! about what it does and does not trust: nothing from this boundary is
//! believed until it re-hashes.

use std::io::Read;

/// The four sync calls the mirror needs.
pub trait Pds {
    fn get_repo(&self, did: &str) -> Result<Vec<u8>, XrpcError>;
    /// `(commit cid string, rev)` — advisory freshness probe used for
    /// idempotency short-circuits. A lying host can at worst cause a
    /// harmless re-fetch; it cannot corrupt a mirror.
    fn get_latest_commit(&self, did: &str) -> Result<(String, String), XrpcError>;
    fn list_blobs(&self, did: &str) -> Result<Vec<String>, XrpcError>;
    fn get_blob(&self, did: &str, cid: &str) -> Result<Vec<u8>, XrpcError>;
}

#[derive(Debug, Clone, PartialEq)]
pub enum XrpcError {
    Transport(String),
    Status {
        status: u16,
        endpoint: String,
    },
    /// Response exceeded the configured ceiling.
    TooLarge {
        endpoint: String,
        limit: u64,
    },
    BadJson(String),
    /// Pagination failed to terminate within bounds.
    CursorLoop,
}

impl std::fmt::Display for XrpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            XrpcError::Transport(e) => write!(f, "xrpc transport: {e}"),
            XrpcError::Status { status, endpoint } => {
                write!(f, "xrpc {endpoint}: HTTP {status}")
            }
            XrpcError::TooLarge { endpoint, limit } => {
                write!(f, "xrpc {endpoint}: response exceeds {limit} bytes")
            }
            XrpcError::BadJson(e) => write!(f, "xrpc response json: {e}"),
            XrpcError::CursorLoop => write!(f, "listBlobs cursor did not terminate"),
        }
    }
}

impl std::error::Error for XrpcError {}

pub struct HttpPds {
    base: String,
    agent: ureq::Agent,
    /// Repo CAR ceiling (default 2 GiB).
    pub max_repo_bytes: u64,
    /// Single-blob ceiling (default 512 MiB).
    pub max_blob_bytes: u64,
}

const LIST_BLOBS_PAGE_CAP: u32 = 10_000;

impl HttpPds {
    pub fn new(base: &str) -> HttpPds {
        HttpPds {
            base: base.trim_end_matches('/').to_string(),
            agent: ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(30))
                .build(),
            max_repo_bytes: 2 * 1024 * 1024 * 1024,
            max_blob_bytes: 512 * 1024 * 1024,
        }
    }

    fn get_bytes(&self, endpoint: &str, url: &str, cap: u64) -> Result<Vec<u8>, XrpcError> {
        let mut last_err = XrpcError::Transport("unreached".into());
        for attempt in 0..3u32 {
            if attempt > 0 {
                std::thread::sleep(std::time::Duration::from_millis(500 << attempt));
            }
            match self.agent.get(url).call() {
                Ok(resp) => {
                    let mut reader = resp.into_reader().take(cap + 1);
                    let mut buf = Vec::new();
                    match reader.read_to_end(&mut buf) {
                        Ok(_) => {
                            if buf.len() as u64 > cap {
                                return Err(XrpcError::TooLarge {
                                    endpoint: endpoint.into(),
                                    limit: cap,
                                });
                            }
                            return Ok(buf);
                        }
                        Err(e) => last_err = XrpcError::Transport(e.to_string()),
                    }
                }
                Err(ureq::Error::Status(status, _)) => {
                    // 4xx will not improve on retry.
                    if (400..500).contains(&status) {
                        return Err(XrpcError::Status {
                            status,
                            endpoint: endpoint.into(),
                        });
                    }
                    last_err = XrpcError::Status {
                        status,
                        endpoint: endpoint.into(),
                    };
                }
                Err(e) => last_err = XrpcError::Transport(e.to_string()),
            }
        }
        Err(last_err)
    }

    fn get_json(&self, endpoint: &str, url: &str) -> Result<serde_json::Value, XrpcError> {
        let bytes = self.get_bytes(endpoint, url, 8 * 1024 * 1024)?;
        serde_json::from_slice(&bytes).map_err(|e| XrpcError::BadJson(e.to_string()))
    }
}

impl Pds for HttpPds {
    fn get_repo(&self, did: &str) -> Result<Vec<u8>, XrpcError> {
        let url = format!("{}/xrpc/com.atproto.sync.getRepo?did={did}", self.base);
        self.get_bytes("com.atproto.sync.getRepo", &url, self.max_repo_bytes)
    }

    fn get_latest_commit(&self, did: &str) -> Result<(String, String), XrpcError> {
        let url = format!(
            "{}/xrpc/com.atproto.sync.getLatestCommit?did={did}",
            self.base
        );
        let v = self.get_json("com.atproto.sync.getLatestCommit", &url)?;
        let cid = v
            .get("cid")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| XrpcError::BadJson("getLatestCommit: no cid".into()))?;
        let rev = v
            .get("rev")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| XrpcError::BadJson("getLatestCommit: no rev".into()))?;
        Ok((cid.to_string(), rev.to_string()))
    }

    fn list_blobs(&self, did: &str) -> Result<Vec<String>, XrpcError> {
        let mut out = Vec::new();
        let mut cursor: Option<String> = None;
        for _page in 0..LIST_BLOBS_PAGE_CAP {
            let url = match &cursor {
                None => format!(
                    "{}/xrpc/com.atproto.sync.listBlobs?did={did}&limit=500",
                    self.base
                ),
                Some(c) => format!(
                    "{}/xrpc/com.atproto.sync.listBlobs?did={did}&limit=500&cursor={c}",
                    self.base
                ),
            };
            let v = self.get_json("com.atproto.sync.listBlobs", &url)?;
            if let Some(cids) = v.get("cids").and_then(serde_json::Value::as_array) {
                out.extend(
                    cids.iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_owned),
                );
            }
            match v.get("cursor").and_then(serde_json::Value::as_str) {
                Some(next) if !next.is_empty() => {
                    let next = next.to_string();
                    if cursor.as_deref() == Some(next.as_str()) {
                        return Err(XrpcError::CursorLoop);
                    }
                    cursor = Some(next);
                }
                _ => return Ok(out),
            }
        }
        Err(XrpcError::CursorLoop)
    }

    fn get_blob(&self, did: &str, cid: &str) -> Result<Vec<u8>, XrpcError> {
        let url = format!(
            "{}/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}",
            self.base
        );
        self.get_bytes("com.atproto.sync.getBlob", &url, self.max_blob_bytes)
    }
}

/// Resolve a handle to a DID via an AppView's public
/// `com.atproto.identity.resolveHandle`. The result is only a pointer —
/// the DID document remains the identity authority and is cross-checked
/// by the caller.
pub fn resolve_handle(appview_base: &str, handle: &str) -> Result<String, XrpcError> {
    let base = appview_base.trim_end_matches('/');
    let url = format!("{base}/xrpc/com.atproto.identity.resolveHandle?handle={handle}");
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(30))
        .build();
    match agent.get(&url).call() {
        Ok(resp) => {
            let v: serde_json::Value = resp
                .into_json()
                .map_err(|e| XrpcError::BadJson(e.to_string()))?;
            v.get("did")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
                .ok_or_else(|| XrpcError::BadJson("resolveHandle: no did".into()))
        }
        Err(ureq::Error::Status(status, _)) => Err(XrpcError::Status {
            status,
            endpoint: "com.atproto.identity.resolveHandle".into(),
        }),
        Err(e) => Err(XrpcError::Transport(e.to_string())),
    }
}
