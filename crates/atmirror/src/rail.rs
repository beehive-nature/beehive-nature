//! The permanence-rail boundary. A rail stores bytes and returns a content
//! address; it is **never trusted** — every `get` is re-hashed by the
//! caller against the manifest, and every `put`'s returned address is
//! cross-checked where the rail's addressing allows it (Arweave DataItem
//! ids are computed locally before upload; the service must agree).

#[derive(Debug)]
pub enum RailError {
    Transport(String),
    /// The rail refused the upload (insufficient funds, too large, …).
    Rejected {
        status: u16,
        body: String,
    },
    /// Output that could not be interpreted — surfaced verbatim, never
    /// guessed at.
    Unparseable(String),
    /// Address not (yet) retrievable.
    Missing(String),
    /// The rail returned a different address than locally computed — the
    /// pipe disagrees with the source hash. Nothing downstream may trust it.
    AddressMismatch {
        local: String,
        remote: String,
    },
    /// This rail cannot answer this probe (e.g. no cheap existence check).
    Unsupported(&'static str),
    /// Local process/tooling failure (missing binary, io error).
    Local(String),
}

impl std::fmt::Display for RailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RailError::Transport(e) => write!(f, "rail transport: {e}"),
            RailError::Rejected { status, body } => {
                write!(f, "rail rejected upload: HTTP {status}: {body}")
            }
            RailError::Unparseable(out) => write!(f, "rail output unparseable: {out}"),
            RailError::Missing(addr) => write!(f, "rail address {addr} not retrievable"),
            RailError::AddressMismatch { local, remote } => write!(
                f,
                "rail returned address {remote} but locally computed {local} — refusing"
            ),
            RailError::Unsupported(what) => write!(f, "rail does not support {what}"),
            RailError::Local(e) => write!(f, "rail local failure: {e}"),
        }
    }
}

impl std::error::Error for RailError {}

/// A permanence rail.
pub trait Rail {
    /// SPEC_LEXICON-1 §4 `mediaPointer.scheme` value: `"ar"` or `"ant"`.
    fn scheme(&self) -> &'static str;
    /// Store bytes; return the content address. Tags are advisory metadata
    /// (Arweave tags; ignored by rails without a tag concept).
    fn put(&mut self, bytes: &[u8], tags: &[(String, String)]) -> Result<String, RailError>;
    /// Retrieve bytes by address. Callers re-hash; a rail's word is never
    /// the verification.
    fn get(&self, address: &str) -> Result<Vec<u8>, RailError>;
    /// Cheap existence check for idempotency. `Err(Unsupported)` is a
    /// legitimate answer; callers then fall back to trusting local state.
    fn probe(&self, address: &str) -> Result<bool, RailError>;
}

/// In-memory rail: content-addressed by sha256-hex, counts puts so
/// idempotency claims are assertable. Test support (unit + integration
/// suites) — never a production rail; it "stores" to process memory and
/// says so in its scheme via [`Rail::scheme`] returning `"ar"` only so
/// receipt-shape tests exercise the arweave anchor path.
pub mod testrail {
    use super::{hex_lower, Rail, RailError};
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;

    #[derive(Default)]
    pub struct MemRail {
        pub stored: BTreeMap<String, Vec<u8>>,
        pub put_count: usize,
    }

    impl Rail for MemRail {
        fn scheme(&self) -> &'static str {
            "ar"
        }
        fn put(&mut self, bytes: &[u8], _tags: &[(String, String)]) -> Result<String, RailError> {
            self.put_count += 1;
            let addr = hex_lower(&Sha256::digest(bytes));
            self.stored.insert(addr.clone(), bytes.to_vec());
            Ok(addr)
        }
        fn get(&self, address: &str) -> Result<Vec<u8>, RailError> {
            self.stored
                .get(address)
                .cloned()
                .ok_or_else(|| RailError::Missing(address.to_string()))
        }
        fn probe(&self, address: &str) -> Result<bool, RailError> {
            Ok(self.stored.contains_key(address))
        }
    }
}

/// Lowercase-hex encode (shipped code path; used for manifest sha256 fields).
pub fn hex_lower(data: &[u8]) -> String {
    let mut s = String::with_capacity(data.len() * 2);
    for b in data {
        use std::fmt::Write;
        let _ = write!(s, "{b:02x}");
    }
    s
}
