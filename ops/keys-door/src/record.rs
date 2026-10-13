//! The release record `bnr.keychain-release/1` (contract §1) and its
//! transport envelope (§3), parsed strictly: canonical bytes, no duplicate
//! key, no unknown field, no missing field, then every value rule.

use std::fmt;

use serde::{Deserialize, Deserializer, Serialize};

use crate::b64::{unb64u, unb64u32};
use crate::canon::{self, CanonError};
use crate::pq::{self, DetachedSig, Pre};

pub const SCHEMA: &str = "bnr.keychain-release/1";
pub const ENVELOPE: &str = "keychain-release-envelope/1";
pub const KIND: &str = "release";
/// source.build, EXACTLY (contract §1: `--origin`/`--parent` mean a
/// replacement origin in PR #407, so they are never accepted)
pub const BUILD: &str = "node scripts/build-keychain.mjs --out DIR";
/// Max envelope size (contract §3).
pub const MAX_ENVELOPE: usize = 64 * 1024;
/// The largest pack this edge will hold in memory.
pub const MAX_PACK: u64 = 32 * 1024 * 1024;
/// JavaScript's Number.MAX_SAFE_INTEGER, so the node tools read every
/// integer the same way this parser does.
pub const MAX_SAFE: u64 = (1 << 53) - 1;
/// build-keychain.mjs --out writes these two for GitHub Pages; the record
/// never names them (contract §1).
const PAGES_ONLY: [&str; 2] = ["CNAME", ".nojekyll"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    TooLarge,
    Canon(CanonError),
    UnknownField(String),
    MissingField(String),
    Malformed(String),
    /// a value breaks a §1 / §3b rule
    Field(&'static str),
    /// schema, kind, origin or rp_id differ from this edge's config (rule 1)
    ConfigMismatch(&'static str),
    /// the signature's id does not derive from its dsa and succ keys
    IdMismatch,
    /// the signature names a different file (size or SHA3-256)
    FileMismatch,
    /// both verifiers refused the ML-DSA-65 signature
    BadSignature,
    /// one verifier accepted and the other refused (rule 2)
    Disagreement {
        fips204: bool,
        bsigner: bool,
    },
    /// the second verifier could not give a verdict (spawn, timeout, output)
    VerifierFailed(String),
}

impl Refusal {
    pub fn name(&self) -> &'static str {
        match self {
            Refusal::TooLarge => "too_large",
            Refusal::Canon(CanonError::DuplicateKey(_)) => "duplicate_key",
            Refusal::Canon(CanonError::NonCanonical) => "non_canonical",
            Refusal::Canon(CanonError::NotPrintableAscii) => "not_ascii",
            Refusal::Canon(CanonError::Malformed(_)) | Refusal::Malformed(_) => "malformed",
            Refusal::UnknownField(_) => "unknown_field",
            Refusal::MissingField(_) => "missing_field",
            Refusal::Field(_) => "bad_field",
            Refusal::ConfigMismatch(_) => "config_mismatch",
            Refusal::IdMismatch => "id_mismatch",
            Refusal::FileMismatch => "file_mismatch",
            Refusal::BadSignature => "bad_signature",
            Refusal::Disagreement { .. } => "verifier_disagreement",
            Refusal::VerifierFailed(_) => "verifier_failed",
        }
    }
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Refusal::TooLarge => f.write_str("larger than the 64 KiB envelope limit"),
            Refusal::Canon(e) => write!(f, "{e}"),
            Refusal::UnknownField(m) | Refusal::MissingField(m) | Refusal::Malformed(m) => {
                f.write_str(m)
            }
            Refusal::Field(w) => write!(f, "bad field: {w}"),
            Refusal::ConfigMismatch(w) => write!(f, "{w} differs from this edge's config"),
            Refusal::IdMismatch => f.write_str("the signer id does not derive from its keys"),
            Refusal::FileMismatch => f.write_str("the signature names different record bytes"),
            Refusal::BadSignature => f.write_str("the signature does not verify (both verifiers)"),
            Refusal::Disagreement { fips204, bsigner } => write!(
                f,
                "verifier disagreement: fips204 {} but bsigner {}",
                verdict(*fips204),
                verdict(*bsigner)
            ),
            Refusal::VerifierFailed(m) => write!(f, "second verifier failed: {m}"),
        }
    }
}

fn verdict(ok: bool) -> &'static str {
    if ok {
        "accepted"
    } else {
        "refused"
    }
}

fn serde_refusal(e: serde_json::Error) -> Refusal {
    let m = e.to_string();
    if m.starts_with("unknown field") {
        Refusal::UnknownField(m)
    } else if m.starts_with("missing field") {
        Refusal::MissingField(m)
    } else if m.starts_with("duplicate field") {
        Refusal::Canon(CanonError::DuplicateKey(m))
    } else {
        Refusal::Malformed(m)
    }
}

/// `prev` must be present: `null` or a digest, never absent.
fn present<'de, D: Deserializer<'de>>(d: D) -> Result<Option<String>, D::Error> {
    Option::<String>::deserialize(d)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FileEntry {
    pub path: String,
    pub sha256: String,
    pub sha3: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pack {
    pub sha256: String,
    pub sha3: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Source {
    pub build: String,
    pub commit: String,
    pub repo: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub files: Vec<FileEntry>,
    pub kind: String,
    pub origin: String,
    pub pack: Pack,
    #[serde(deserialize_with = "present")]
    pub prev: Option<String>,
    pub rp_id: String,
    pub schema: String,
    pub seq: u64,
    pub signers: Vec<String>,
    pub source: Source,
}

fn path_ok(p: &str) -> bool {
    !p.is_empty()
        && p.len() <= 255
        && p.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'/' | b'-'))
        && p.split('/')
            .all(|seg| !seg.is_empty() && seg != "." && seg != "..")
        && !PAGES_ONLY.contains(&p)
}

fn digest_ok(s: &str) -> bool {
    unb64u32(s).is_some()
}

impl Record {
    /// The canonical bytes of this record (what a signer signs).
    pub fn canonical_bytes(&self) -> Vec<u8> {
        let v = serde_json::to_value(self).expect("a record serializes");
        canon::to_bytes(&canon::from_json(&v).expect("a record has integer numbers only"))
            .expect("a validated record is printable ASCII")
    }

    /// Every §1 value rule. Config equality (rule 1) is [`parse_envelope`]'s.
    pub fn validate(&self) -> Result<(), Refusal> {
        if self.schema != SCHEMA {
            return Err(Refusal::ConfigMismatch("schema"));
        }
        if self.kind != KIND {
            return Err(Refusal::ConfigMismatch("kind"));
        }
        if self.seq == 0 || self.seq > MAX_SAFE {
            return Err(Refusal::Field("seq"));
        }
        match (&self.prev, self.seq) {
            (None, 1) => {}
            (Some(p), s) if s > 1 && digest_ok(p) => {}
            _ => return Err(Refusal::Field("prev (null only when seq == 1)")),
        }
        if self.files.is_empty() {
            return Err(Refusal::Field("files"));
        }
        let mut total = 0u64;
        for (i, f) in self.files.iter().enumerate() {
            if !path_ok(&f.path) {
                return Err(Refusal::Field("files[].path"));
            }
            if i > 0 && self.files[i - 1].path.as_bytes() >= f.path.as_bytes() {
                return Err(Refusal::Field("files (sorted by path bytewise, unique)"));
            }
            if !digest_ok(&f.sha256) || !digest_ok(&f.sha3) || f.size > MAX_PACK {
                return Err(Refusal::Field("files[] digest or size"));
            }
            total += f.size;
        }
        if total != self.pack.size || self.pack.size > MAX_PACK {
            return Err(Refusal::Field("pack.size (the sum of files[].size)"));
        }
        if !digest_ok(&self.pack.sha256) || !digest_ok(&self.pack.sha3) {
            return Err(Refusal::Field("pack digest"));
        }
        if self.signers.is_empty()
            || !self.signers.iter().all(|s| pq::is_bzpq_id(s))
            || self
                .signers
                .windows(2)
                .any(|w| w[0].as_bytes() >= w[1].as_bytes())
        {
            return Err(Refusal::Field(
                "signers (non-empty, sorted, unique bzpq1 ids)",
            ));
        }
        if self.source.build != BUILD {
            return Err(Refusal::Field("source.build"));
        }
        let c = self.source.commit.as_bytes();
        if c.len() != 40
            || !c
                .iter()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
        {
            return Err(Refusal::Field("source.commit (40 lowercase hex)"));
        }
        let mut repo = self.source.repo.split('/');
        let part = |p: Option<&str>| {
            p.is_some_and(|p| {
                !p.is_empty()
                    && p.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
            })
        };
        if !part(repo.next()) || !part(repo.next()) || repo.next().is_some() {
            return Err(Refusal::Field("source.repo (owner/name)"));
        }
        if self.origin.is_empty() || self.rp_id.is_empty() {
            return Err(Refusal::Field("origin / rp_id"));
        }
        Ok(())
    }
}

/// Parse record bytes under the whole §1 rule.
pub fn parse_record(bytes: &[u8]) -> Result<Record, Refusal> {
    if bytes.len() > MAX_ENVELOPE {
        return Err(Refusal::TooLarge);
    }
    canon::check(bytes).map_err(Refusal::Canon)?;
    let r: Record = serde_json::from_slice(bytes).map_err(serde_refusal)?;
    r.validate()?;
    // the typed record must re-serialize to the same bytes: a field the
    // generic pass saw but the typed one dropped could not hide here
    if r.canonical_bytes() != bytes {
        return Err(Refusal::Canon(CanonError::NonCanonical));
    }
    Ok(r)
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HiveHint {
    pub block: u64,
    pub trx: String,
}

/// Unsigned, advisory locators (contract §3). Bytes found through them are
/// accepted by hash only.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Hints {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ant: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ar: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hive: Option<HiveHint>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub peers: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Envelope {
    pub bnr: String,
    #[serde(default)]
    pub hints: Hints,
    pub record: String,
    pub sig: DetachedSig,
}

/// One envelope that parsed: its bytes as received, the record it carries
/// and the signature's prechecked parts. Not yet signature-verified.
#[derive(Debug, Clone)]
pub struct Parsed {
    pub bytes: Vec<u8>,
    pub env: Envelope,
    pub record_bytes: Vec<u8>,
    pub record: Record,
    pub record_sha3: [u8; 32],
    /// SHA3-256 of the signature object as both verifiers receive it
    pub sig_key: [u8; 32],
    pub pre: Pre,
}

/// Parse an envelope (§3) and its record (§1), check rule 1 against the
/// config, and precheck the §3b signature shape, id and file binding.
pub fn parse_envelope(bytes: &[u8], origin: &str, rp_id: &str) -> Result<Parsed, Refusal> {
    if bytes.len() > MAX_ENVELOPE {
        return Err(Refusal::TooLarge);
    }
    canon::parse(bytes).map_err(Refusal::Canon)?;
    let env: Envelope = serde_json::from_slice(bytes).map_err(serde_refusal)?;
    if env.bnr != ENVELOPE {
        return Err(Refusal::Field("bnr"));
    }
    let record_bytes = unb64u(&env.record).ok_or(Refusal::Field("record (base64url)"))?;
    let record = parse_record(&record_bytes)?;
    if record.origin != origin {
        return Err(Refusal::ConfigMismatch("origin"));
    }
    if record.rp_id != rp_id {
        return Err(Refusal::ConfigMismatch("rp_id"));
    }
    let pre = pq::precheck(&env.sig, &record_bytes)?;
    let sig_key = pq::sha3(&[&serde_json::to_vec(&env.sig).expect("a signature serializes")]);
    Ok(Parsed {
        bytes: bytes.to_vec(),
        record_sha3: pq::sha3(&[&record_bytes]),
        env,
        record_bytes,
        record,
        sig_key,
        pre,
    })
}
