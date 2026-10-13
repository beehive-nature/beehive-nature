//! The rails a release arrives by. Every one is untrusted: what they return
//! is only a candidate (an envelope) or a byte string accepted by hash.
//! Every read is bounded in size, count and time.
//!
//! - inbox_dir: `*.json` envelopes, at most 64 KiB each, at most 256 read per poll.
//! - peers: `GET <peer>/.well-known/bnr-keychain/release` and `/pack`.
//! - ANT doors: antd 0.12.0 REST `GET <door>/v1/data/public/<address>` ->
//!   `{"data":"<base64>"}` (tools/connect-store/adapters.mjs `AutonomiReadStore`;
//!   the live door is relay.skaists.dev/ant, Caddy strips `/ant`, see
//!   ops/watch/hostinger/Caddyfile.hostinger). The base64 must round-trip
//!   exactly, as adapters.mjs requires.
//! - Arweave: GraphQL over transactions tagged App-Name=bnr-keychain-release,
//!   Origin=<origin>, Seq in a window, from the configured owners only; an
//!   empty owner list disables it (an unfiltered tag query is anyone's).

use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};

use crate::b64::{unb64_std, unb64u};
use crate::record::MAX_ENVELOPE;

pub const MAX_INBOX_FILES: usize = 256;
pub const RELEASE_PATH: &str = "/.well-known/bnr-keychain/release";
pub const PACK_PATH: &str = "/.well-known/bnr-keychain/pack";
pub const AR_APP: &str = "bnr-keychain-release";
/// GraphQL pages per poll, transactions per page, data fetches per poll
pub const AR_PAGES: usize = 4;
pub const AR_PAGE_SIZE: usize = 50;
pub const AR_FETCHES: usize = 32;
/// Seq values asked of Arweave per poll, from the walked tip on
pub const AR_SEQ_WINDOW: u64 = 32;
const GRAPHQL_MAX: u64 = 1024 * 1024;
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);

/// One bounded request. Implementations must refuse redirects and never
/// return more than `limit` body bytes.
pub trait Http: Send {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, String>;
    fn post_json(&self, url: &str, body: &[u8], limit: u64) -> Result<Vec<u8>, String>;
}

pub struct UreqHttp {
    agent: ureq::Agent,
}

impl Default for UreqHttp {
    fn default() -> Self {
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(HTTP_TIMEOUT))
            .max_redirects(0)
            .http_status_as_error(false)
            .user_agent("keys-door/0.1")
            .build()
            .into();
        UreqHttp { agent }
    }
}

fn read_body(
    r: Result<ureq::http::Response<ureq::Body>, ureq::Error>,
    limit: u64,
) -> Result<Vec<u8>, String> {
    let mut r = r.map_err(|e| e.to_string())?;
    if r.status() != 200 {
        return Err(format!("HTTP {}", r.status().as_u16()));
    }
    r.body_mut()
        .with_config()
        .limit(limit)
        .read_to_vec()
        .map_err(|e| e.to_string())
}

impl Http for UreqHttp {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, String> {
        read_body(self.agent.get(url).call(), limit)
    }
    fn post_json(&self, url: &str, body: &[u8], limit: u64) -> Result<Vec<u8>, String> {
        read_body(
            self.agent
                .post(url)
                .header("content-type", "application/json")
                .send(body),
            limit,
        )
    }
}

/// An endpoint base: `https://host[:port][/path]` with no query, fragment,
/// userinfo or trailing slash; plain http only to loopback when allowed.
pub fn url_ok(u: &str, loopback_http: bool) -> bool {
    let rest = if let Some(r) = u.strip_prefix("https://") {
        r
    } else if loopback_http {
        match u.strip_prefix("http://") {
            Some(r)
                if ["127.0.0.1", "[::1]", "localhost"].iter().any(|h| {
                    r == *h || r.starts_with(&format!("{h}:")) || r.starts_with(&format!("{h}/"))
                }) =>
            {
                r
            }
            _ => return false,
        }
    } else {
        return false;
    };
    !rest.is_empty()
        && !rest.starts_with('/')
        && !u.ends_with('/')
        && u.len() <= 256
        && rest
            .bytes()
            .all(|b| b.is_ascii_graphic() && !matches!(b, b'?' | b'#' | b'@' | b'\\' | b'%'))
}

/// An ANT data address as antd takes it: 64 lowercase hex (adapters.mjs `hex`).
pub fn ant_address_ok(a: &str) -> bool {
    a.len() == 64
        && a.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// An Arweave transaction id: 32 bytes, base64url.
pub fn ar_txid_ok(t: &str) -> bool {
    t.len() == 43 && unb64u(t).is_some()
}

/// Up to [`MAX_INBOX_FILES`] `*.json` envelopes, by file name, each at most
/// 64 KiB. Files that break a bound are skipped and named in `notes`.
pub fn read_inbox(dir: &Path, notes: &mut Vec<String>) -> Vec<(String, Vec<u8>)> {
    let rd = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(e) => {
            notes.push(format!("inbox {}: {e}", dir.display()));
            return Vec::new();
        }
    };
    let mut names: Vec<String> = rd
        .flatten()
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.ends_with(".json") && !n.starts_with('.'))
        .collect();
    names.sort();
    if names.len() > MAX_INBOX_FILES {
        notes.push(format!(
            "inbox holds {} envelopes; read the first {MAX_INBOX_FILES} by name",
            names.len()
        ));
        names.truncate(MAX_INBOX_FILES);
    }
    let mut out = Vec::new();
    for n in names {
        let path = dir.join(&n);
        let regular = fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_file());
        if !regular {
            notes.push(format!("inbox {n}: not a regular file"));
            continue;
        }
        let mut bytes = Vec::new();
        let read = fs::File::open(&path)
            .and_then(|f| f.take(MAX_ENVELOPE as u64 + 1).read_to_end(&mut bytes));
        match read {
            Ok(_) if bytes.len() > MAX_ENVELOPE => {
                notes.push(format!("inbox {n}: larger than 64 KiB"))
            }
            Ok(_) => out.push((n, bytes)),
            Err(e) => notes.push(format!("inbox {n}: {e}")),
        }
    }
    out
}

pub fn peer_release(http: &dyn Http, peer: &str) -> Result<Vec<u8>, String> {
    http.get(&format!("{peer}{RELEASE_PATH}"), MAX_ENVELOPE as u64)
}

pub fn peer_pack(http: &dyn Http, peer: &str, size: u64) -> Result<Vec<u8>, String> {
    http.get(&format!("{peer}{PACK_PATH}"), size)
}

/// `size` bytes from an antd door, or a refusal. The JSON `data` field must
/// be standard base64 that re-encodes to itself exactly; hashes are the
/// caller's check.
pub fn ant_get(http: &dyn Http, door: &str, addr: &str, size: u64) -> Result<Vec<u8>, String> {
    if !ant_address_ok(addr) {
        return Err("ANT address is not 64 lowercase hex".into());
    }
    let encoded = size.div_ceil(3) * 4;
    let body = http.get(&format!("{door}/v1/data/public/{addr}"), encoded + 1024)?;
    let v: Value = serde_json::from_slice(&body).map_err(|e| format!("antd JSON: {e}"))?;
    let data = v["data"].as_str().ok_or("antd JSON has no data string")?;
    if data.len() as u64 != encoded {
        return Err("antd data has the wrong length".into());
    }
    let bytes = unb64_std(data).ok_or("antd data is not canonical base64")?;
    if bytes.len() as u64 != size {
        return Err("antd data has the wrong size".into());
    }
    Ok(bytes)
}

/// A transaction the Arweave index names for one release record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArHit {
    pub txid: String,
    pub seq: u64,
    /// the Record-SHA3 tag (base64url); checked against the body before
    /// any signature is verified
    pub record_sha3: String,
}

fn ar_query(owners: &[String], origin: &str, seqs: &[String], after: Option<&str>) -> Vec<u8> {
    let q = "query($owners:[String!],$tags:[TagFilter!],$after:String){transactions(owners:$owners,tags:$tags,first:50,after:$after,sort:HEIGHT_ASC){pageInfo{hasNextPage}edges{cursor node{id tags{name value}}}}}";
    serde_json::to_vec(&json!({
        "query": q,
        "variables": {
            "owners": owners,
            "tags": [
                {"name": "App-Name", "values": [AR_APP]},
                {"name": "Origin", "values": [origin]},
                {"name": "Seq", "values": seqs},
            ],
            "after": after,
        }
    }))
    .expect("a query serializes")
}

/// Index hits for seq in [from, from + AR_SEQ_WINDOW), within the page budget.
pub fn arweave_index(
    http: &dyn Http,
    gateway: &str,
    owners: &[String],
    origin: &str,
    from: u64,
    notes: &mut Vec<String>,
) -> Vec<ArHit> {
    debug_assert_eq!(AR_PAGE_SIZE, 50, "the query text asks for 50 per page");
    if owners.is_empty() {
        return Vec::new();
    }
    let seqs: Vec<String> = (from..from + AR_SEQ_WINDOW)
        .map(|s| s.to_string())
        .collect();
    let mut hits = Vec::new();
    let mut after: Option<String> = None;
    for _ in 0..AR_PAGES {
        let body = ar_query(owners, origin, &seqs, after.as_deref());
        let v: Value = match http
            .post_json(&format!("{gateway}/graphql"), &body, GRAPHQL_MAX)
            .and_then(|b| serde_json::from_slice(&b).map_err(|e| e.to_string()))
        {
            Ok(v) => v,
            Err(e) => {
                notes.push(format!("arweave {gateway}: {e}"));
                break;
            }
        };
        let t = &v["data"]["transactions"];
        let Some(edges) = t["edges"].as_array() else {
            notes.push(format!("arweave {gateway}: no transactions in the answer"));
            break;
        };
        for e in edges {
            let node = &e["node"];
            let tag = |name: &str| -> Option<&str> {
                node["tags"]
                    .as_array()?
                    .iter()
                    .find(|t| t["name"] == name)?["value"]
                    .as_str()
            };
            let (Some(id), Some(seq), Some(rs), Some(app), Some(o)) = (
                node["id"].as_str(),
                tag("Seq").and_then(|s| s.parse::<u64>().ok()),
                tag("Record-SHA3"),
                tag("App-Name"),
                tag("Origin"),
            ) else {
                continue;
            };
            if ar_txid_ok(id) && rs.len() == 43 && app == AR_APP && o == origin {
                hits.push(ArHit {
                    txid: id.to_string(),
                    seq,
                    record_sha3: rs.to_string(),
                });
            }
        }
        let next = edges.last().and_then(|e| e["cursor"].as_str());
        match (t["pageInfo"]["hasNextPage"].as_bool(), next) {
            (Some(true), Some(c)) => after = Some(c.to_string()),
            _ => break,
        }
    }
    hits
}

/// The raw data of one Arweave transaction (envelope or pack).
pub fn arweave_data(
    http: &dyn Http,
    gateway: &str,
    txid: &str,
    limit: u64,
) -> Result<Vec<u8>, String> {
    if !ar_txid_ok(txid) {
        return Err("not an Arweave transaction id".into());
    }
    http.get(&format!("{gateway}/{txid}"), limit)
}
